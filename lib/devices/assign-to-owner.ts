import 'server-only'

import { randomUUID } from 'node:crypto'

import { createServiceClient } from '@/utils/supabase/service'
import { seedUserXupPreferences } from '@/lib/catalog/xup-preferences'
import { provisionDevices } from '@/lib/provisioning/actions'

/**
 * Shared "mount a device onto a location and give it to a user" step — the
 * common body of `SiteController@store` (slice 6) and `BoatController@store`
 * (slice 7). For one inventory device + one user:
 *  - create the `user_devices` row (captured) if it doesn't exist,
 *  - create its `device_charging_state`,
 *  - provision an admin entitlement (Flow B),
 *  - seed the default `user_xup_preferences`.
 *
 * Returns the (existing or new) `user_devices.id`. Uses the service client —
 * this runs inside an admin site/boat write.
 */
export async function assignDeviceToOwner(opts: {
  inventoryDeviceId: number
  userId: string
  ownerXnid: string
  deviceName?: string | null
  notificationEmail?: string | null
  notificationPhone?: string | null
  deviceLocation?: string | null
}): Promise<{ userDeviceId: number | null }> {
  const db = createServiceClient()

  const { data: inv } = await db
    .from('inventory_devices')
    .select('id, dev_eui, activation_code, product_id')
    .eq('id', opts.inventoryDeviceId)
    .maybeSingle()
  if (!inv) return { userDeviceId: null }

  const { data: existing } = await db
    .from('user_devices')
    .select('id')
    .eq('user_id', opts.userId)
    .eq('inventory_device_id', opts.inventoryDeviceId)
    .maybeSingle()

  let userDeviceId = existing?.id ?? null
  if (!userDeviceId) {
    const { data: ud } = await db
      .from('user_devices')
      .insert({
        xnid: `xnid:user_device:${randomUUID()}`,
        user_id: opts.userId,
        inventory_device_id: inv.id,
        dev_eui: inv.dev_eui,
        status: 'captured',
        device_name: opts.deviceName ?? null,
        device_activation_code: inv.activation_code,
        notification_email: opts.notificationEmail ?? null,
        notification_phone_number: opts.notificationPhone ?? null,
        device_location: opts.deviceLocation ?? null,
      })
      .select('id')
      .single()
    userDeviceId = ud?.id ?? null

    if (userDeviceId) {
      await db.from('device_charging_state').upsert(
        {
          user_device_id: userDeviceId,
          dev_eui: inv.dev_eui,
          user_id: opts.userId,
          inventory_device_id: inv.id,
          is_on: false,
        },
        { onConflict: 'user_device_id' },
      )
    }
  }

  if (userDeviceId) {
    await provisionDevices({
      user_id: opts.userId,
      user_device_ids: [userDeviceId],
      owner_xnid: opts.ownerXnid,
    })
  }
  if (inv.product_id) {
    await seedUserXupPreferences(db, { userId: opts.userId, productId: inv.product_id })
  }

  return { userDeviceId }
}
