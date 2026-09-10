import 'server-only'

import { createServiceClient } from '@/utils/supabase/service'

/**
 * Ports the two unscheduled Laravel maintenance commands for the PMS
 * (`tech-debt.md` B22 — they relied on an external cron not in the repo):
 *
 *  - `QuoteController::releaseExpiredHolds` — draft quotes whose 15-minute hold
 *    has lapsed become `expired`.
 *  - `App\Console\Commands\ExpireReservations` — reservations in a live status
 *    past their `end_date` become `expired`, releasing their assignment / stay,
 *    expiring live contracts, and detaching the quote.
 *
 * Invoked by `/api/internal/marina-pms-maintenance` (a `pg_cron` job in N+2).
 * Uses the service client — no user session; the checks are all status-gated.
 */

export interface PmsMaintenanceResult {
  ok: boolean
  holdsExpired: number
  reservationsExpired: number
  errors: string[]
}

const LIVE_RESERVATION_STATUSES = [
  'pending',
  'hold',
  'confirmed',
  'contract_required',
  'contract_signed',
  'active',
]

export async function runPmsMaintenance(): Promise<PmsMaintenanceResult> {
  const db = createServiceClient()
  const errors: string[] = []
  const today = new Date().toISOString().slice(0, 10)

  // 1. release expired quote holds
  let holdsExpired = 0
  {
    const { data, error } = await db
      .from('quotes')
      .update({ status: 'expired' })
      .eq('status', 'draft')
      .lt('hold_expires_at', new Date().toISOString())
      .select('id')
    if (error) errors.push(`holds: ${error.message}`)
    else holdsExpired = data?.length ?? 0
  }

  // 2. expire past-end reservations
  let reservationsExpired = 0
  {
    const { data: due, error } = await db
      .from('reservations')
      .select('id')
      .in('status', LIVE_RESERVATION_STATUSES)
      .lt('end_date', today)
    if (error) {
      errors.push(`reservations: ${error.message}`)
    } else {
      for (const r of due ?? []) {
        try {
          await db.from('reservations').update({ status: 'expired' }).eq('id', r.id)
          await db.from('assignments').update({ status: 'unassigned' }).eq('reservation_id', r.id)
          await db.from('stays').update({ status: 'expired' }).eq('reservation_id', r.id)
          await db
            .from('contracts')
            .update({ status: 'expired' })
            .eq('reservation_id', r.id)
            .in('status', ['required', 'sent', 'signed'])
          await db
            .from('quotes')
            .update({ status: 'expired', reservation_id: null })
            .eq('reservation_id', r.id)
          reservationsExpired += 1
        } catch (e) {
          errors.push(`reservation ${r.id}: ${(e as Error).message}`)
        }
      }
    }
  }

  return { ok: errors.length === 0, holdsExpired, reservationsExpired, errors }
}
