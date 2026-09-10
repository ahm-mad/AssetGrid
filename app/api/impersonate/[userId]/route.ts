import { z } from "zod"

import { createClient } from "@/utils/supabase/server"
import { createServiceClient } from "@/utils/supabase/service"
import { requireAuth } from "@/lib/auth/guards"
import { getCurrentUser } from "@/lib/auth/dal"
import { setImpersonation } from "@/lib/auth/impersonation"
import { ok, handler } from "@/lib/api/envelope"
import { ApiError, forbidden, notFound } from "@/lib/api/errors"

const ALLOWED_ACTOR_ROLES = new Set(["Super Admin", "Admin", "Manager", "Dealer", "Partner"])

export const POST = handler<{ params: Promise<{ userId: string }> }>(async (_req, ctx) => {
  const actor = await requireAuth()
  if (!ALLOWED_ACTOR_ROLES.has(actor.roleTitle)) {
    throw forbidden("Your role cannot impersonate.")
  }

  const current = await getCurrentUser()
  if (current?.impersonatorId) {
    throw new ApiError(409, "Already impersonating — return to admin first.")
  }

  const { userId } = await ctx.params
  if (!z.string().uuid().safeParse(userId).success) throw new ApiError(400, "Invalid user id")
  if (userId === actor.id) throw new ApiError(400, "You cannot impersonate yourself.")

  const supabase = await createClient()

  // RLS: the actor must be able to see this profile.
  const { data: target } = await supabase
    .from("profiles")
    .select("id, deleted_at, role:role_types!profiles_role_type_id_fkey(title)")
    .eq("id", userId)
    .maybeSingle()
  if (!target || target.deleted_at) throw notFound("User not found")

  const targetRole = (target.role as { title?: string } | null)?.title
  if (targetRole === "Super Admin" && !actor.isSuperAdmin) {
    throw forbidden("You cannot impersonate a Super Admin.")
  }

  // Capture the actor's own refresh token so "return to admin" can restore it.
  const { data: sessionData } = await supabase.auth.getSession()
  const actorRefreshToken = sessionData.session?.refresh_token
  if (!actorRefreshToken) throw new ApiError(401, "No active session.")

  const admin = createServiceClient()
  const { data: targetUser } = await admin.auth.admin.getUserById(userId)
  const targetEmail = targetUser.user?.email
  if (!targetEmail) throw new ApiError(422, "Target user has no email.")

  // Mint a session for the target via a magic-link token exchange.
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: targetEmail,
  })
  if (linkErr || !link.properties?.hashed_token) {
    throw new ApiError(500, "Could not create the impersonation session.")
  }

  // Audit row first (so it exists even if the swap partially fails).
  const { data: logRow } = await admin
    .from("impersonation_log")
    .insert({
      actor_id: actor.id,
      target_id: userId,
      ip: _req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      user_agent: _req.headers.get("user-agent"),
    })
    .select("id")
    .single()

  // This swaps the auth cookies to the target's session.
  const { error: otpErr } = await supabase.auth.verifyOtp({
    token_hash: link.properties.hashed_token,
    type: "magiclink",
  })
  if (otpErr) throw new ApiError(500, "Session swap failed.")

  await setImpersonation({
    actorId: actor.id,
    logId: logRow?.id ?? 0,
    actorRefreshToken,
  })

  return ok({ impersonating: userId })
})
