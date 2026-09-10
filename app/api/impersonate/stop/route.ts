import { createClient } from "@/utils/supabase/server"
import { createServiceClient } from "@/utils/supabase/service"
import { readImpersonation, clearImpersonation } from "@/lib/auth/impersonation"
import { ok, handler } from "@/lib/api/envelope"
import { ApiError } from "@/lib/api/errors"

export const POST = handler(async () => {
  const ticket = await readImpersonation()
  if (!ticket) throw new ApiError(400, "Not impersonating.")

  const supabase = await createClient()
  // Restore the actor's session from their stashed refresh token.
  const { error } = await supabase.auth.refreshSession({ refresh_token: ticket.actorRefreshToken })
  if (error) {
    // Session couldn't be restored — sign out cleanly rather than leaving a
    // half state; the actor logs in again.
    await supabase.auth.signOut()
    await clearImpersonation()
    throw new ApiError(401, "Your admin session expired. Please sign in again.")
  }

  if (ticket.logId) {
    await createServiceClient()
      .from("impersonation_log")
      .update({ ended_at: new Date().toISOString() })
      .eq("id", ticket.logId)
  }

  await clearImpersonation()
  return ok({ restored: ticket.actorId })
})
