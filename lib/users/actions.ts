"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { createClient } from "@/utils/supabase/server"
import { requirePermission } from "@/lib/auth/guards"

export interface ActionResult {
  ok: boolean
  error?: string
  fieldErrors?: Record<string, string[]>
}

const basicsSchema = z.object({
  userId: z.string().uuid(),
  first_name: z.string().trim().max(191).optional().default(""),
  last_name: z.string().trim().max(191).optional().default(""),
  role_type_id: z.coerce.number().int().min(1).max(6),
  company_id: z
    .union([z.coerce.number().int().positive(), z.literal(""), z.null()])
    .optional(),
  residence_customer: z.coerce.boolean().optional().default(false),
})

/** Update a user's name / role / company (old admin-user/dealer-user/... merged). */
export async function updateUserBasics(input: unknown): Promise<ActionResult> {
  const actor = await requirePermission("commerce", "update")

  const parsed = basicsSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors }
  }
  const v = parsed.data

  const supabase = await createClient()

  // read current to detect a role change (which needs roles_permissions.update)
  const { data: current } = await supabase
    .from("profiles")
    .select("role_type_id")
    .eq("id", v.userId)
    .maybeSingle()
  if (!current) return { ok: false, error: "User not found or not visible." }

  if (current.role_type_id !== v.role_type_id) {
    if (!actor.isSuperAdmin) {
      try {
        await requirePermission("roles_permissions", "update")
      } catch {
        return { ok: false, error: "Changing a role requires the roles & permissions permission." }
      }
    }
  }

  const companyId =
    v.company_id === "" || v.company_id == null ? null : Number(v.company_id)

  const { error } = await supabase
    .from("profiles")
    .update({
      first_name: v.first_name || null,
      last_name: v.last_name || null,
      role_type_id: v.role_type_id,
      company_id: companyId,
      residence_customer: v.residence_customer,
    })
    .eq("id", v.userId)

  if (error) return { ok: false, error: "Could not save the user." }

  revalidatePath(`/app/customers/${v.userId}`)
  revalidatePath("/app/customers")
  return { ok: true }
}

const overrideSchema = z.object({
  userId: z.string().uuid(),
  moduleId: z.coerce.number().int().min(1),
  action: z.enum(["read", "create", "update", "delete"]),
  value: z.boolean(),
})

/**
 * Toggle one action of a per-user permission override. If the user has no
 * override row for the module yet, it's seeded from the role's current
 * permissions first (an override replaces the role grant entirely — see
 * `auth_can`), so a fresh override doesn't silently drop other actions.
 */
export async function setUserPermissionOverride(input: unknown): Promise<ActionResult> {
  await requirePermission("roles_permissions", "update")

  const parsed = overrideSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Invalid input" }
  const { userId, moduleId, action, value } = parsed.data

  const supabase = await createClient()

  const [{ data: existing }, { data: profile }] = await Promise.all([
    supabase
      .from("user_permissions")
      .select("can_read, can_create, can_update, can_delete")
      .eq("user_id", userId)
      .eq("module_id", moduleId)
      .maybeSingle(),
    supabase.from("profiles").select("role_type_id").eq("id", userId).maybeSingle(),
  ])
  if (!profile) return { ok: false, error: "User not found." }

  let seed = existing ?? { can_read: false, can_create: false, can_update: false, can_delete: false }
  if (!existing) {
    const { data: rolePerm } = await supabase
      .from("role_permissions")
      .select("can_read, can_create, can_update, can_delete")
      .eq("role_type_id", profile.role_type_id)
      .eq("module_id", moduleId)
      .maybeSingle()
    if (rolePerm) seed = rolePerm
  }

  const next = {
    user_id: userId,
    module_id: moduleId,
    can_read: action === "read" ? value : seed.can_read,
    can_create: action === "create" ? value : seed.can_create,
    can_update: action === "update" ? value : seed.can_update,
    can_delete: action === "delete" ? value : seed.can_delete,
  }

  const { error } = await supabase
    .from("user_permissions")
    .upsert(next, { onConflict: "user_id,module_id" })
  if (error) return { ok: false, error: "Could not save the override." }

  revalidatePath(`/app/customers/${userId}`)
  return { ok: true }
}

export async function clearUserPermissionOverride(
  userId: string,
  moduleId: number,
): Promise<ActionResult> {
  await requirePermission("roles_permissions", "update")
  const supabase = await createClient()
  const { error } = await supabase
    .from("user_permissions")
    .delete()
    .eq("user_id", userId)
    .eq("module_id", moduleId)
  if (error) return { ok: false, error: "Could not clear the override." }
  revalidatePath(`/app/customers/${userId}`)
  return { ok: true }
}

const idSchema = z.string().uuid()

export async function softDeleteUser(userId: string): Promise<ActionResult> {
  const actor = await requirePermission("commerce", "delete")
  if (!idSchema.safeParse(userId).success) return { ok: false, error: "Invalid id" }
  if (userId === actor.id) return { ok: false, error: "You cannot delete your own account." }

  const supabase = await createClient()
  const { error } = await supabase
    .from("profiles")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", userId)
  if (error) return { ok: false, error: "Could not delete the user." }
  revalidatePath("/app/customers")
  revalidatePath(`/app/customers/${userId}`)
  return { ok: true }
}

export async function restoreUser(userId: string): Promise<ActionResult> {
  await requirePermission("commerce", "create")
  if (!idSchema.safeParse(userId).success) return { ok: false, error: "Invalid id" }
  const supabase = await createClient()
  const { error } = await supabase
    .from("profiles")
    .update({ deleted_at: null })
    .eq("id", userId)
  if (error) return { ok: false, error: "Could not restore the user." }
  revalidatePath("/app/customers")
  revalidatePath(`/app/customers/${userId}`)
  return { ok: true }
}

