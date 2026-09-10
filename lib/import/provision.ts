import 'server-only'

import { randomUUID } from 'node:crypto'

import type { createServiceClient } from '@/utils/supabase/service'
import { seedUserXupPreferences } from '@/lib/catalog/xup-preferences'

/**
 * The device-provisioning step the building + marina importers share (old
 * `ImportController` "Layer 3" / the `importbuilding` device block): capture the
 * device onto the user (`user_devices`), create its `device_charging_state`
 * (was `running_devices` — ADR-024), and seed the default xUP preferences.
 *
 * Deliberately does NOT provision an admin entitlement (unlike
 * `assignDeviceToOwner` used by the interactive site/boat forms) — the old
 * importers never did, and imported inventory is pre-owned.
 */
export async function provisionImportedDevice(
  db: ReturnType<typeof createServiceClient>,
  opts: {
    inventoryDeviceId: number
    userId: string
    deviceName?: string | null
    deviceLocation?: string | null
    notificationEmail?: string | null
  },
): Promise<void> {
  const { data: inv } = await db
    .from('inventory_devices')
    .select('id, dev_eui, activation_code, product_id')
    .eq('id', opts.inventoryDeviceId)
    .maybeSingle()
  if (!inv) return

  const { data: existing } = await db
    .from('user_devices')
    .select('id')
    .eq('user_id', opts.userId)
    .eq('inventory_device_id', opts.inventoryDeviceId)
    .maybeSingle()

  let userDeviceId: number
  const patch = {
    status: 'captured' as const,
    device_location: opts.deviceLocation ?? null,
    device_name: opts.deviceName ?? null,
    device_activation_code: inv.activation_code,
    dev_eui: inv.dev_eui,
    notification_email: opts.notificationEmail ?? null,
  }
  if (existing) {
    await db.from('user_devices').update(patch).eq('id', existing.id)
    userDeviceId = existing.id
  } else {
    const { data: created } = await db
      .from('user_devices')
      .insert({
        ...patch,
        xnid: `xnid:user_device:${randomUUID()}`,
        user_id: opts.userId,
        inventory_device_id: opts.inventoryDeviceId,
      })
      .select('id')
      .single()
    if (!created) return
    userDeviceId = created.id
  }

  await db.from('device_charging_state').upsert(
    {
      user_device_id: userDeviceId,
      user_id: opts.userId,
      inventory_device_id: opts.inventoryDeviceId,
      dev_eui: inv.dev_eui,
    },
    { onConflict: 'user_device_id' },
  )

  if (inv.product_id) {
    await seedUserXupPreferences(db, { userId: opts.userId, productId: inv.product_id })
  }
}
