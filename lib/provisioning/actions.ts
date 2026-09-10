'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { requireAuth } from '@/lib/auth/guards'
import { can } from '@/lib/auth/permissions'
import { createServiceClient } from '@/utils/supabase/service'

/**
 * Flow B — admin / dealer device provisioning without Stripe. Ports
 * `App\Services\AdminDeviceEntitlementService::provision` / `::deactivateDevice`.
 *
 * Gate: Super Admin, or `commerce` create, or `inventory` update (the old
 * service is called from the Boat/Site device-assignment flows which are
 * `buildings` / `marina` writes — those slices will call `provisionDevices`
 * directly; this action is the standalone admin entry point).
 */

export interface ProvisionResult {
  ok: boolean
  error?: string
  fieldErrors?: Record<string, string[]>
  entitlementId?: number
}

async function gate() {
  const actor = await requireAuth()
  const allowed =
    actor.isSuperAdmin ||
    can(actor.permissions, 'commerce', 'create') ||
    can(actor.permissions, 'inventory', 'update')
  if (!allowed) throw new Error('Not authorised to provision devices.')
  return actor
}

const provisionSchema = z.object({
  user_id: z.string().uuid(),
  user_device_ids: z.array(z.coerce.number().int().positive()).min(1),
  owner_xnid: z.string().trim().min(1),
})

export async function provisionDevices(input: unknown): Promise<ProvisionResult> {
  await gate()
  const parsed = provisionSchema.safeParse(input)
  if (!parsed.success) return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors }
  const v = parsed.data
  const db = createServiceClient()

  const { data: devices } = await db
    .from('user_devices')
    .select('id, xnid')
    .in('id', v.user_device_ids)
    .eq('user_id', v.user_id)
  const valid = (devices ?? []).filter((d) => d.xnid)
  if (valid.length === 0) return { ok: false, error: 'No valid devices found.' }

  // "command_annual_protection_plan" (unlimited) or the first active plan.
  const { data: plan } =
    (await db
      .from('plans')
      .select('id')
      .eq('plan_code', 'command_annual_protection_plan')
      .eq('is_active', true)
      .maybeSingle()) ?? {}
  const { data: fallbackPlan } = plan
    ? { data: plan }
    : await db.from('plans').select('id').eq('is_active', true).order('id').limit(1).maybeSingle()
  const planId = (plan ?? fallbackPlan)?.id ?? null

  const { data: ent, error: eErr } = await db
    .from('subscription_entitlements')
    .insert({
      plan_id: planId,
      user_id: v.user_id,
      billing_mode: 'dealer_billed',
      owner_xnid: v.owner_xnid,
      source: 'admin',
      payment_provider: 'cash',
      max_devices_allowed: -1,
      active_device_count: valid.length,
      status: 'active',
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single()
  if (eErr || !ent) return { ok: false, error: 'Could not create the entitlement.' }

  for (const d of valid) {
    await db.from('device_assignments').upsert(
      {
        xnid: d.xnid as string,
        entitlement_id: ent.id,
        assigned_at: new Date().toISOString(),
        status: 'active',
      },
      { onConflict: 'xnid,entitlement_id' },
    )
    await db
      .from('user_devices')
      .update({
        entitlement_id: ent.id,
        activation_status: 'activated',
        activated_at: new Date().toISOString(),
      })
      .eq('id', d.id)
  }

  revalidatePath('/app/billing')
  return { ok: true, entitlementId: ent.id }
}

/**
 * `::deactivateDevice` — when a device is removed from a boat/site. Only acts
 * when the entitlement is admin-sourced; sets the assignment to `inactive` and
 * decrements the entitlement's device count.
 */
export async function deactivateDeviceAssignment(userDeviceId: number): Promise<ProvisionResult> {
  await gate()
  const db = createServiceClient()

  const { data: ud } = await db
    .from('user_devices')
    .select('id, xnid, entitlement_id')
    .eq('id', userDeviceId)
    .maybeSingle()
  if (!ud?.entitlement_id || !ud.xnid) return { ok: true }

  const { data: ent } = await db
    .from('subscription_entitlements')
    .select('id, source, active_device_count')
    .eq('id', ud.entitlement_id)
    .maybeSingle()
  if (!ent || ent.source !== 'admin') return { ok: true }

  await db
    .from('device_assignments')
    .update({ status: 'inactive' })
    .eq('xnid', ud.xnid)
    .eq('entitlement_id', ent.id)

  await db
    .from('subscription_entitlements')
    .update({ active_device_count: Math.max(0, ent.active_device_count - 1) })
    .eq('id', ent.id)

  revalidatePath('/app/billing')
  return { ok: true }
}
