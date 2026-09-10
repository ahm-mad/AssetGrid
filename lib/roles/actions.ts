"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { createClient } from "@/utils/supabase/server"
import { requirePermission } from "@/lib/auth/guards"

const schema = z.object({
  roleTypeId: z.coerce.number().int().min(1),
  moduleId: z.coerce.number().int().min(1),
  action: z.enum(["read", "create", "update", "delete"]),
  value: z.boolean(),
})

export interface ToggleResult {
  ok: boolean
  error?: string
}

/**
 * Toggle one permission flag for a role × module. Upserts the row (so a role
 * that had no row for the module gets one). Super Admin (role 1) is not editable
 * — it bypasses checks in code anyway.
 */
export async function setRolePermission(input: unknown): Promise<ToggleResult> {
  await requirePermission("roles_permissions", "update")

  const parsed = schema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Invalid input" }
  const { roleTypeId, moduleId, action, value } = parsed.data

  if (roleTypeId === 1) return { ok: false, error: "The Super Admin role cannot be edited." }

  const supabase = await createClient()
  const row = {
    role_type_id: roleTypeId,
    module_id: moduleId,
    can_read: action === "read" ? value : undefined,
    can_create: action === "create" ? value : undefined,
    can_update: action === "update" ? value : undefined,
    can_delete: action === "delete" ? value : undefined,
  }
  const { error } = await supabase
    .from("role_permissions")
    .upsert(row, { onConflict: "role_type_id,module_id" })
  if (error) return { ok: false, error: "Could not save the change." }

  revalidatePath("/app/roles")
  return { ok: true }
}
