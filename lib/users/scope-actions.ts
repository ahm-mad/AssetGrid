"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { createClient } from "@/utils/supabase/server"
import { requirePermission } from "@/lib/auth/guards"

export interface ScopeActionResult {
  ok: boolean
  error?: string
}

export const SCOPE_ENTITIES = [
  "building",
  "marina",
  "inventory",
  "commerce",
  "messaging",
  "rule_builder",
] as const

const schema = z.object({
  userId: z.string().uuid(),
  entityType: z.enum(SCOPE_ENTITIES),
  assetIds: z.array(z.coerce.number().int().positive()),
})

/**
 * Upsert one entity's scope for a user. `assetIds` empty ⇒ the user is locked
 * out of that entity (matches the old "empty assets" semantics). The
 * creator-ceiling `WITH CHECK` on `user_scopes` (auth_scope_grant_allowed)
 * rejects granting assets the actor can't reach.
 */
export async function setUserScope(input: unknown): Promise<ScopeActionResult> {
  await requirePermission("roles_permissions", "update")

  const parsed = schema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Invalid input" }
  const { userId, entityType, assetIds } = parsed.data

  const supabase = await createClient()
  const { error } = await supabase.from("user_scopes").upsert(
    { user_id: userId, entity_type: entityType, asset_ids: assetIds, asset_labels: null },
    { onConflict: "user_id,entity_type" },
  )
  if (error) {
    return {
      ok: false,
      error:
        error.code === "42501" || /policy/i.test(error.message)
          ? "You can only grant assets within your own scope."
          : "Could not save the scope.",
    }
  }

  revalidatePath(`/app/customers/${userId}`)
  return { ok: true }
}

export async function clearUserScope(
  userId: string,
  entityType: string,
): Promise<ScopeActionResult> {
  await requirePermission("roles_permissions", "update")
  if (!z.string().uuid().safeParse(userId).success) return { ok: false, error: "Invalid id" }

  const supabase = await createClient()
  const { error } = await supabase
    .from("user_scopes")
    .delete()
    .eq("user_id", userId)
    .eq("entity_type", entityType)
  if (error) return { ok: false, error: "Could not clear the scope." }

  revalidatePath(`/app/customers/${userId}`)
  return { ok: true }
}
