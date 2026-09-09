import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

import { ApiError } from './errors'

export interface OkEnvelope<T> {
  ok: true
  data: T
  meta?: Record<string, unknown>
}

export interface ErrEnvelope {
  ok: false
  error: {
    message: string
    code: string
    fields?: Record<string, string[]>
  }
}

export function ok<T>(data: T, meta?: Record<string, unknown>, status = 200) {
  return NextResponse.json<OkEnvelope<T>>({ ok: true, data, ...(meta ? { meta } : {}) }, { status })
}

export function fail(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json<ErrEnvelope>(
      { ok: false, error: { message: error.message, code: error.code, fields: error.fields } },
      { status: error.status },
    )
  }
  if (error instanceof ZodError) {
    const fields: Record<string, string[]> = {}
    for (const issue of error.issues) {
      const key = issue.path.join('.') || '_'
      ;(fields[key] ??= []).push(issue.message)
    }
    return NextResponse.json<ErrEnvelope>(
      { ok: false, error: { message: 'Validation failed', code: 'validation_error', fields } },
      { status: 422 },
    )
  }
  console.error('[api] unhandled error', error)
  return NextResponse.json<ErrEnvelope>(
    { ok: false, error: { message: 'Something went wrong', code: 'server_error' } },
    { status: 500 },
  )
}

/**
 * Wraps a Route Handler body so thrown `ApiError` / `ZodError` become the
 * error envelope and anything else becomes a 500 (no stack leak).
 *
 *   export const GET = handler(async (req, ctx) => ok(await load(ctx)))
 */
export function handler<Ctx = unknown>(
  fn: (req: Request, ctx: Ctx) => Promise<Response> | Response,
) {
  return async (req: Request, ctx: Ctx): Promise<Response> => {
    try {
      return await fn(req, ctx)
    } catch (error) {
      return fail(error)
    }
  }
}
