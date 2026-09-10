"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { createClient } from "@/utils/supabase/server"
import { createServiceClient } from "@/utils/supabase/service"
import { requirePermission } from "@/lib/auth/guards"

export interface CreateUserResult {
  ok: boolean
  error?: string
  fieldErrors?: Record<string, string[]>
  userId?: string
  inviteSent?: boolean
}

const ROLE_BY_KIND = {
  admin: 2,
  manager: 4, // admin-manager: role 4 under an existing company
  dealer: 5,
  partner: 6,
} as const
type Kind = keyof typeof ROLE_BY_KIND

const schema = z
  .object({
    kind: z.enum(["admin", "manager", "dealer", "partner"]),
    first_name: z.string().trim().min(1, "Required").max(191),
    last_name: z.string().trim().min(1, "Required").max(191),
    email: z.string().trim().email(),
    // company fields — required for admin/dealer/partner, ignored for manager
    company_name: z.string().trim().max(191).optional().default(""),
    company_username: z.string().trim().max(191).optional().default(""),
    company_email: z.string().trim().optional().default(""),
    // manager: attach to an existing company
    company_id: z.coerce.number().int().positive().optional(),
    // dealer scope: container codes (comma/space separated)
    container_codes: z.string().trim().optional().default(""),
    // partner scope: inventory device ids
    inventory_device_ids: z.string().trim().optional().default(""),
  })
  .superRefine((v, ctx) => {
    if (v.kind === "manager") {
      if (!v.company_id)
        ctx.addIssue({ code: "custom", path: ["company_id"], message: "Pick a company" })
    } else {
      if (!v.company_name)
        ctx.addIssue({ code: "custom", path: ["company_name"], message: "Required" })
      if (!v.company_username)
        ctx.addIssue({ code: "custom", path: ["company_username"], message: "Required" })
      if (!z.string().email().safeParse(v.company_email).success)
        ctx.addIssue({ code: "custom", path: ["company_email"], message: "Valid email required" })
    }
  })

function parseIntList(s: string): number[] {
  return s
    .split(/[\s,]+/)
    .map((x) => Number(x))
    .filter((n) => Number.isInteger(n) && n > 0)
}
function parseCodeList(s: string): string[] {
  return s.split(/[\s,]+/).map((x) => x.trim()).filter(Boolean)
}

/**
 * Create a company + its principal user (admin/dealer/partner), or a manager
 * under an existing company. Merges the old CompanyController create* flows.
 * Transactional: rolls back the auth user if a later step fails.
 */
export async function createCompanyUser(input: unknown): Promise<CreateUserResult> {
  await requirePermission("commerce", "create")

  const parsed = schema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors }
  }
  const v = parsed.data
  const kind = v.kind as Kind
  const roleTypeId = ROLE_BY_KIND[kind]

  const admin = createServiceClient()
  const db = await createClient()

  // 1. company
  let companyId: number | null = null
  if (kind === "manager") {
    companyId = v.company_id!
    const { data: c } = await db.from("companies").select("id").eq("id", companyId).maybeSingle()
    if (!c) return { ok: false, error: "Company not found." }
  } else {
    const { data: existing } = await admin
      .from("companies")
      .select("id")
      .eq("email", v.company_email)
      .maybeSingle()
    if (existing) {
      companyId = existing.id
    } else {
      const { data: c, error: cErr } = await admin
        .from("companies")
        .insert({
          company_name: v.company_name,
          username: v.company_username,
          email: v.company_email,
        })
        .select("id")
        .single()
      if (cErr || !c) return { ok: false, error: "Could not create the company." }
      companyId = c.id
    }
  }

  // 2. auth user (invite email). The handle_new_user trigger creates the profile.
  const { data: invited, error: iErr } = await admin.auth.admin.inviteUserByEmail(v.email, {
    data: { first_name: v.first_name, last_name: v.last_name, role_type_id: roleTypeId },
  })
  let userId = invited?.user?.id ?? null
  let inviteSent = !iErr

  if (iErr || !userId) {
    // fall back to creating the user directly (e.g. SMTP not configured / rate limited)
    const { data: created, error: cuErr } = await admin.auth.admin.createUser({
      email: v.email,
      email_confirm: false,
      user_metadata: {
        first_name: v.first_name,
        last_name: v.last_name,
        role_type_id: roleTypeId,
      },
    })
    if (cuErr || !created.user) {
      return {
        ok: false,
        error:
          cuErr?.message?.includes("already been registered") || cuErr?.code === "email_exists"
            ? "That email is already registered."
            : "Could not create the user.",
      }
    }
    userId = created.user.id
    inviteSent = false
  }

  // 3. finalise the profile (role from metadata is set by the trigger; set company)
  const rollback = async () => {
    if (userId) await admin.auth.admin.deleteUser(userId)
  }

  const { error: pErr } = await admin
    .from("profiles")
    .update({ role_type_id: roleTypeId, company_id: companyId })
    .eq("id", userId)
  if (pErr) {
    await rollback()
    return { ok: false, error: "Could not finalise the profile." }
  }

  // 4. profile_details with the role-specific scope inputs
  const { error: dErr } = await admin.from("profile_details").upsert(
    {
      user_id: userId,
      container_codes: kind === "dealer" ? parseCodeList(v.container_codes) : [],
      inventory_device_ids: kind === "partner" ? parseIntList(v.inventory_device_ids) : [],
    },
    { onConflict: "user_id" },
  )
  if (dErr) {
    await rollback()
    return { ok: false, error: "Could not save the profile details." }
  }

  revalidatePath("/app/customers")
  return { ok: true, userId: userId!, inviteSent }
}
