import 'server-only'

import { cookies } from 'next/headers'

export const IMPERSONATION_COOKIE = 'assetgrid-imp'

export interface ImpersonationTicket {
  actorId: string
  logId: number
  /** The actor's own refresh token, to restore their session on "return to admin". */
  actorRefreshToken: string
}

export async function readImpersonation(): Promise<ImpersonationTicket | null> {
  const store = await cookies()
  const raw = store.get(IMPERSONATION_COOKIE)?.value
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as ImpersonationTicket
    if (parsed?.actorId && parsed?.actorRefreshToken) return parsed
    return null
  } catch {
    return null
  }
}

export async function setImpersonation(ticket: ImpersonationTicket) {
  const store = await cookies()
  store.set(IMPERSONATION_COOKIE, JSON.stringify(ticket), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60, // 1h ceiling; the log row is the audit record
  })
}

export async function clearImpersonation() {
  const store = await cookies()
  store.delete(IMPERSONATION_COOKIE)
}
