"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { createClient } from "@/utils/supabase/server"
import { requirePermission } from "@/lib/auth/guards"

export interface CatalogResult {
  ok: boolean
  error?: string
  fieldErrors?: Record<string, string[]>
  id?: number
}

const REVALIDATE = "/app/catalog"

// ---------------------------------------------------------------------------
// Attributes (system alert definitions)
// ---------------------------------------------------------------------------
const attributeSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  subject: z.string().trim().min(1).max(191),
  alert_message: z.string().trim().max(4000).optional().default(""),
  threshold: z.string().trim().max(191).optional().default(""),
  comparison: z.enum(["<", ">", "=", "!=", ">=", "<=", "-"]),
  checkin: z.coerce.boolean().optional().default(false),
  notifie_id: z.coerce.number().int().positive(),
  xup_id: z.union([z.coerce.number().int().positive(), z.literal(""), z.null()]).optional(),
  description: z.string().trim().max(191).optional().default(""),
  alert_channel: z.string().trim().max(191).optional().default("0"),
  neo_event_code: z.string().trim().max(191).optional().default(""),
})

export async function saveAttribute(input: unknown): Promise<CatalogResult> {
  const actor = await requirePermission("catalog", input && (input as { id?: unknown }).id ? "update" : "create")
  const parsed = attributeSchema.safeParse(input)
  if (!parsed.success) return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors }
  const v = parsed.data
  const supabase = await createClient()

  const row = {
    subject: v.subject,
    alert_message: v.alert_message || null,
    threshold: v.threshold || null,
    comparison: v.comparison,
    checkin: v.checkin,
    notifie_id: v.notifie_id,
    xup_id: v.xup_id === "" || v.xup_id == null ? null : Number(v.xup_id),
    description: v.description || null,
    alert_channel: v.alert_channel || "0",
    neo_event_code: v.neo_event_code || null,
  }

  if (v.id) {
    if (!actor.isSuperAdmin) await requirePermission("catalog", "update")
    const { error } = await supabase.from("attributes").update(row).eq("id", v.id)
    if (error) return { ok: false, error: "Could not update the attribute." }
    revalidatePath(REVALIDATE)
    return { ok: true, id: v.id }
  }
  const { data, error } = await supabase.from("attributes").insert(row).select("id").single()
  if (error || !data) return { ok: false, error: "Could not create the attribute." }
  revalidatePath(REVALIDATE)
  return { ok: true, id: data.id }
}

export async function deleteAttribute(id: number): Promise<CatalogResult> {
  await requirePermission("catalog", "delete")
  const supabase = await createClient()
  const { error } = await supabase.from("attributes").delete().eq("id", id)
  if (error) return { ok: false, error: "Could not delete the attribute." }
  revalidatePath(REVALIDATE)
  return { ok: true }
}

// ---------------------------------------------------------------------------
// xUPs
// ---------------------------------------------------------------------------
const xupSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  code: z.string().trim().min(1).max(191),
  data_type: z.string().trim().min(1).max(191),
  version: z.string().trim().min(1).max(191),
  description: z.string().trim().max(4000).optional().default(""),
  format: z.string().trim().max(191).optional().default(""),
  units: z.string().trim().max(191).optional().default(""),
  label: z.string().trim().max(191).optional().default(""),
})

export async function saveXup(input: unknown): Promise<CatalogResult> {
  const hasId = !!(input && (input as { id?: unknown }).id)
  await requirePermission("catalog", hasId ? "update" : "create")
  const parsed = xupSchema.safeParse(input)
  if (!parsed.success) return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors }
  const v = parsed.data
  const supabase = await createClient()
  const row = {
    code: v.code,
    data_type: v.data_type,
    version: v.version,
    description: v.description || null,
    format: v.format || null,
    units: v.units || null,
    label: v.label || null,
  }
  if (v.id) {
    const { error } = await supabase.from("xups").update(row).eq("id", v.id)
    if (error) return { ok: false, error: "Could not update the xUP." }
    revalidatePath(REVALIDATE)
    return { ok: true, id: v.id }
  }
  const { data, error } = await supabase.from("xups").insert(row).select("id").single()
  if (error || !data) return { ok: false, error: "Could not create the xUP." }
  revalidatePath(REVALIDATE)
  return { ok: true, id: data.id }
}

export async function deleteXup(id: number): Promise<CatalogResult> {
  await requirePermission("catalog", "delete")
  const supabase = await createClient()
  const { error } = await supabase.from("xups").delete().eq("id", id)
  if (error) return { ok: false, error: "Could not delete the xUP (still referenced?)." }
  revalidatePath(REVALIDATE)
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Notifies
// ---------------------------------------------------------------------------
export async function saveNotifie(input: { id?: number; name: string }): Promise<CatalogResult> {
  await requirePermission("messaging", input.id ? "update" : "create", { allowCustomer: true })
  const name = String(input.name ?? "").trim()
  if (name.length < 1 || name.length > 191) return { ok: false, error: "Name is required." }
  const supabase = await createClient()
  if (input.id) {
    const { error } = await supabase.from("notifies").update({ name }).eq("id", input.id)
    if (error) return { ok: false, error: "Could not update." }
  } else {
    const { error } = await supabase.from("notifies").insert({ name })
    if (error) return { ok: false, error: "Could not create." }
  }
  revalidatePath(REVALIDATE)
  return { ok: true }
}

export async function deleteNotifie(id: number): Promise<CatalogResult> {
  await requirePermission("messaging", "delete", { allowCustomer: true })
  const supabase = await createClient()
  const { error } = await supabase.from("notifies").delete().eq("id", id)
  if (error) return { ok: false, error: "Could not delete (attributes still reference it)." }
  revalidatePath(REVALIDATE)
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Device types
// ---------------------------------------------------------------------------
export async function saveDeviceType(input: {
  id?: number
  name: string
  description: string
}): Promise<CatalogResult> {
  await requirePermission("catalog", input.id ? "update" : "create")
  const name = String(input.name ?? "").trim()
  if (!name) return { ok: false, error: "Name is required." }
  const supabase = await createClient()
  const row = { name, description: String(input.description ?? "").trim() || null }
  if (input.id) {
    const { error } = await supabase.from("device_types").update(row).eq("id", input.id)
    if (error) return { ok: false, error: "Could not update." }
  } else {
    const { error } = await supabase.from("device_types").insert(row)
    if (error) return { ok: false, error: "Could not create." }
  }
  revalidatePath(REVALIDATE)
  return { ok: true }
}

export async function deleteDeviceType(id: number): Promise<CatalogResult> {
  await requirePermission("catalog", "delete")
  const supabase = await createClient()
  const { error } = await supabase.from("device_types").delete().eq("id", id)
  if (error) return { ok: false, error: "Could not delete (still referenced)." }
  revalidatePath(REVALIDATE)
  return { ok: true }
}
