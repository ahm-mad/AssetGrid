import 'server-only'

import type { createServiceClient } from '@/utils/supabase/service'

/**
 * Seed the default `user_xup_preferences` rows for a user + product — a port of
 * `UserXupPreferenceService::syncUserPreferences` as used by
 * `SiteController@store` (device assignment). For every attribute of the
 * product's notifie, insert `(user_id, product_id, notifie_id, attribute_id,
 * xup_id, is_visible=true, send_notification=true)` if it doesn't exist.
 *
 * Called from `lib/buildings/actions.ts` (site create) and, later, the marina
 * boat-device assignment (slice 7). Takes the service client — it runs as part
 * of an admin site/boat write.
 */
export async function seedUserXupPreferences(
  db: ReturnType<typeof createServiceClient>,
  opts: { userId: string; productId: number },
): Promise<{ inserted: number }> {
  const { data: product } = await db
    .from('products')
    .select('id, notifie_id')
    .eq('id', opts.productId)
    .maybeSingle()
  if (!product?.notifie_id) return { inserted: 0 }

  const { data: attributes } = await db
    .from('attributes')
    .select('id, xup_id')
    .eq('notifie_id', product.notifie_id)
  if (!attributes || attributes.length === 0) return { inserted: 0 }

  const { data: existing } = await db
    .from('user_xup_preferences')
    .select('attribute_id, xup_id')
    .eq('user_id', opts.userId)
    .eq('product_id', opts.productId)
  const have = new Set((existing ?? []).map((e) => `${e.attribute_id}-${e.xup_id}`))

  const rows = attributes
    .filter((a) => !have.has(`${a.id}-${a.xup_id}`))
    .map((a) => ({
      user_id: opts.userId,
      product_id: opts.productId,
      notifie_id: product.notifie_id,
      attribute_id: a.id,
      xup_id: a.xup_id,
      is_visible: true,
      send_notification: true,
    }))
  if (rows.length === 0) return { inserted: 0 }

  const { error } = await db.from('user_xup_preferences').insert(rows)
  return { inserted: error ? 0 : rows.length }
}
