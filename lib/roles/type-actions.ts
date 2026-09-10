"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { createClient } from "@/utils/supabase/server"
import { requirePermission } from "@/lib/auth/guards"

export interface RoleTypeResult {
  ok: boolean
  error?: string
  id?: number
}

/** Roles 1–6 are the built-ins the code special-cases — they can be renamed but not deleted. */
const BUILTIN_MAX = 6

const createSchema = z.object({
  title: z.string().trim().min(2).max(191),
  description: z.string().trim().max(2000).optional().default(""),
})

export async function createRoleType(input: unknown): Promise<RoleTypeResult> {
  await requirePermission("roles_permissions", "create")
  const parsed = createSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Title is required (2–191 chars)." }

  const supabase = await createClient()
  const { data: maxRow } = await supabase
    .from("role_types")
    .select("id")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle()
  const nextId = Math.max(BUILTIN_MAX, maxRow?.id ?? 0) + 1

  const { error } = await supabase
    .from("role_types")
    .insert({ id: nextId, title: parsed.data.title, description: parsed.data.description || null })
  if (error) {
    return {
      ok: false,
      error: error.code === "23505" ? "A role with that title already exists." : "Could not create the role.",
    }
  }
  revalidatePath("/app/roles")
  return { ok: true, id: nextId }
}

export async function renameRoleType(id: number, title: string, description: string): Promise<RoleTypeResult> {
  await requirePermission("roles_permissions", "update")
  const parsed = createSchema.safeParse({ title, description })
  if (!parsed.success) return { ok: false, error: "Invalid title." }

  const supabase = await createClient()
  const { error } = await supabase
    .from("role_types")
    .update({ title: parsed.data.title, description: parsed.data.description || null })
    .eq("id", id)
  if (error) return { ok: false, error: "Could not rename the role." }
  revalidatePath("/app/roles")
  return { ok: true }
}

export async function deleteRoleType(id: number): Promise<RoleTypeResult> {
  await requirePermission("roles_permissions", "delete")
  if (id <= BUILTIN_MAX) return { ok: false, error: "Built-in roles cannot be deleted." }

  const supabase = await createClient()
  const { count } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role_type_id", id)
  if ((count ?? 0) > 0) return { ok: false, error: `${count} user(s) still have this role.` }

  const { error } = await supabase.from("role_types").delete().eq("id", id)
  if (error) return { ok: false, error: "Could not delete the role." }
  revalidatePath("/app/roles")
  return { ok: true }
}
