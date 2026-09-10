'use server'

import { randomUUID } from 'node:crypto'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { requireAuth } from '@/lib/auth/guards'
import { can } from '@/lib/auth/permissions'
import { createServiceClient } from '@/utils/supabase/service'

/**
 * `POST /api/devices/activate` (`UserDeviceController@activateDevices`) — the
 * device-claim flow. Validates each activation code against `inventory_devices`,
 * reconciles company ownership, and creates (or re-assigns) a `user_devices`
 * row (`status = 'decline'`) plus its `device_charging_state`.
 *
 * The Stripe / entitlement side is `startCheckout` (`lib/billing/checkout.ts`);
 * this action only gets the device onto the user's account in "pending
 * activation" state.
 *
 * Runs on the service client — it auto-creates a `companies` row from the
 * user's email domain and can touch inventory rows the caller could not write
 * directly (parity with the old controller, which ran these as the user).
 *
 * device_type ids 1 (eMAXDuplex) and 2 (MAX Switch) are the relay/charger
 * types — their charging state starts `off`; everything else starts `on`.
 */

const RELAY_DEVICE_TYPE_IDS = [1, 2]

export interface ActivateDeviceResult {
  activationCode: string
  success: boolean
  message: string
  userDeviceId?: number
}

export interface ActivateResult {
  ok: boolean
  error?: string
  fieldErrors?: Record<string, string[]>
  results?: ActivateDeviceResult[]
}

const schema = z.object({
  user_id: z.string().uuid(),
  devices: z
    .array(
      z.object({
        device_name: z.string().trim().min(1).max(255),
        device_location: z.string().trim().min(1).max(255),
        activation_code: z.string().trim().min(1).max(255),
      }),
    )
    .min(1),
})

export async function activateDevices(input: unknown): Promise<ActivateResult> {
  const actor = await requireAuth()
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors }
  const v = parsed.data

  const isAdmin = actor.isSuperAdmin || can(actor.permissions, 'inventory', 'update') || can(actor.permissions, 'commerce', 'create')
  if (!isAdmin && v.user_id !== actor.id) {
    return { ok: false, error: 'You can only activate devices on your own account.' }
  }

  const db = createServiceClient()

  const { data: profile } = await db
    .from('profiles')
    .select('id, company_id')
    .eq('id', v.user_id)
    .maybeSingle()
  if (!profile) return { ok: false, error: 'User not found.' }
  const { data: authUser } = await db.auth.admin.getUserById(v.user_id)
  const email = authUser.user?.email ?? null

  let userCompanyId = profile.company_id
  const results: ActivateDeviceResult[] = []

  for (const item of v.devices) {
    const code = item.activation_code
    try {
      const { data: inventory } = await db
        .from('inventory_devices')
        .select('id, company_id, dev_eui, product_id')
        .eq('activation_code', code)
        .maybeSingle()
      if (!inventory) {
        results.push({ activationCode: code, success: false, message: 'This activation code is not valid' })
        continue
      }

      let inventoryCompanyId = inventory.company_id

      // ---- Company reconciliation (parity with the old controller) ----
      if (userCompanyId && inventoryCompanyId && userCompanyId !== inventoryCompanyId) {
        results.push({
          activationCode: code,
          success: false,
          message: 'This inventory does not exist or is not assigned to you',
        })
        continue
      }
      if (!userCompanyId && inventoryCompanyId) {
        await db.from('profiles').update({ company_id: inventoryCompanyId }).eq('id', v.user_id)
        userCompanyId = inventoryCompanyId
      } else if (userCompanyId && !inventoryCompanyId) {
        await db.from('inventory_devices').update({ company_id: userCompanyId }).eq('id', inventory.id)
        inventoryCompanyId = userCompanyId
      } else if (!userCompanyId && !inventoryCompanyId && email) {
        const domain = email.split('@')[1] ?? email
        const { data: company } = await db
          .from('companies')
          .upsert({ email, company_name: email.split('@')[0], username: domain }, { onConflict: 'email' })
          .select('id')
          .single()
        if (company) {
          await db.from('profiles').update({ company_id: company.id }).eq('id', v.user_id)
          await db.from('inventory_devices').update({ company_id: company.id }).eq('id', inventory.id)
          userCompanyId = company.id
          inventoryCompanyId = company.id
        }
      }

      // ---- Resolve / create the user_devices row ----
      const { data: existing } = await db
        .from('user_devices')
        .select('id, user_id, status')
        .eq('device_activation_code', code)
        .maybeSingle()

      let deviceId: number | null = null

      if (!existing) {
        const { data: created, error } = await db
          .from('user_devices')
          .insert({
            xnid: `xnid:user_device:${randomUUID()}`,
            user_id: v.user_id,
            device_name: item.device_name,
            device_location: item.device_location,
            device_activation_code: code,
            inventory_device_id: inventory.id,
            dev_eui: inventory.dev_eui,
            status: 'decline',
          })
          .select('id')
          .single()
        if (error || !created) {
          results.push({ activationCode: code, success: false, message: 'Device creation failed' })
          continue
        }
        deviceId = created.id
      } else if (existing.user_id === v.user_id) {
        if (existing.status === 'captured') {
          results.push({ activationCode: code, success: false, message: 'This device is already active on your account' })
          continue
        }
        results.push({
          activationCode: code,
          success: true,
          message: 'Device is pending activation. Please complete payment',
          userDeviceId: existing.id,
        })
        continue
      } else if (existing.status !== 'captured') {
        await db
          .from('user_devices')
          .update({
            user_id: v.user_id,
            device_name: item.device_name,
            device_location: item.device_location,
            status: 'decline',
          })
          .eq('id', existing.id)
        deviceId = existing.id
      } else {
        results.push({
          activationCode: code,
          success: false,
          message: 'This activation code is already assigned to another user',
        })
        continue
      }

      // ---- Charging-state row ----
      const { data: product } = await db
        .from('products')
        .select('device_type_id')
        .eq('id', inventory.product_id)
        .maybeSingle()
      const startsOff = product?.device_type_id != null && RELAY_DEVICE_TYPE_IDS.includes(product.device_type_id)

      await db.from('device_charging_state').upsert(
        {
          user_device_id: deviceId!,
          is_on: !startsOff,
          last_status: startsOff ? 'off' : 'on',
          dev_eui: inventory.dev_eui,
          user_id: v.user_id,
          inventory_device_id: inventory.id,
        },
        { onConflict: 'user_device_id' },
      )

      results.push({
        activationCode: code,
        success: true,
        message: 'Device processed successfully',
        userDeviceId: deviceId!,
      })
    } catch (e) {
      results.push({ activationCode: code, success: false, message: (e as Error).message })
    }
  }

  revalidatePath('/app/devices')
  return { ok: true, results }
}
