import 'server-only'

/**
 * In-app WebRTC signalling — ports `CallController` (`call/{invite,accept,
 * reject}`). The old app fanned `IncomingCall` / `CallAccepted` / `CallRejected`
 * out over Pusher on `user.<xnid>` channels; the target is **Supabase Realtime
 * Broadcast** (ADR-008). No DB table — the events are ephemeral.
 *
 * We publish via the Realtime HTTP broadcast endpoint (no websocket needed on
 * the server). The client subscribes to `call:<its own profile id>` and runs
 * the actual peer connection.
 */

export interface CallEvent {
  topic: string
  event: 'incoming.call' | 'call.accepted' | 'call.rejected'
  payload: Record<string, unknown>
}

export async function publishCallEvents(events: CallEvent[]): Promise<{ ok: boolean; error?: string }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_SECRET
  if (!url || !key) return { ok: false, error: 'Supabase not configured' }

  try {
    const res = await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: {
        apikey: key,
        authorization: `Bearer ${key}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        messages: events.map((e) => ({
          topic: e.topic,
          event: e.event,
          payload: e.payload,
        })),
      }),
    })
    if (!res.ok) return { ok: false, error: `realtime ${res.status}: ${await res.text()}` }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

export function callTopic(profileIdOrXnid: string): string {
  return `call:${profileIdOrXnid}`
}
