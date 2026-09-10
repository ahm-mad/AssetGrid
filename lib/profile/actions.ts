"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { createClient } from "@/utils/supabase/server"
import { requireAuth } from "@/lib/auth/guards"

const schema = z.object({
  first_name: z.string().trim().max(191).optional().default(""),
  last_name: z.string().trim().max(191).optional().default(""),
  phone_number: z.string().trim().max(50).optional().default(""),
  phone_type: z.string().trim().max(50).optional().default(""),
  address_1: z.string().trim().max(191).optional().default(""),
  address_2: z.string().trim().max(191).optional().default(""),
  city: z.string().trim().max(191).optional().default(""),
  state: z.string().trim().max(191).optional().default(""),
  country: z.string().trim().max(191).optional().default(""),
  postal_code: z.string().trim().max(50).optional().default(""),
})

export interface ProfileActionState {
  ok?: boolean
  error?: string
  fieldErrors?: Record<string, string[]>
}

export async function updateMyProfile(
  _prev: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const user = await requireAuth()

  const parsed = schema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors }
  }
  const v = parsed.data
  const supabase = await createClient()

  const { error: pErr } = await supabase
    .from("profiles")
    .update({ first_name: v.first_name || null, last_name: v.last_name || null })
    .eq("id", user.id)
  if (pErr) return { error: "Could not save your name." }

  const { error: dErr } = await supabase.from("profile_details").upsert(
    {
      user_id: user.id,
      phone_number: v.phone_number || null,
      phone_type: v.phone_type || null,
      address_1: v.address_1 || null,
      address_2: v.address_2 || null,
      city: v.city || null,
      state: v.state || null,
      country: v.country || null,
      postal_code: v.postal_code || null,
    },
    { onConflict: "user_id" },
  )
  if (dErr) return { error: "Could not save your details." }

  revalidatePath("/app/profile")
  return { ok: true }
}
