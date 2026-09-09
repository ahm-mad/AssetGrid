/**
 * The one API error type. Route Handlers / Server Actions throw this; the
 * envelope helpers turn it into `{ ok:false, error }` + the right HTTP status.
 */
export class ApiError extends Error {
  status: number
  code: string
  fields?: Record<string, string[]>

  constructor(
    status: number,
    message: string,
    opts?: { code?: string; fields?: Record<string, string[]> },
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = opts?.code ?? defaultCode(status)
    this.fields = opts?.fields
  }
}

function defaultCode(status: number): string {
  switch (status) {
    case 400:
      return 'bad_request'
    case 401:
      return 'unauthenticated'
    case 403:
      return 'forbidden'
    case 404:
      return 'not_found'
    case 409:
      return 'conflict'
    case 422:
      return 'validation_error'
    case 429:
      return 'rate_limited'
    default:
      return status >= 500 ? 'server_error' : 'error'
  }
}

export const unauthorized = (msg = 'Not authenticated') => new ApiError(401, msg)
export const forbidden = (msg = 'Not allowed') => new ApiError(403, msg)
export const notFound = (msg = 'Not found') => new ApiError(404, msg)
export const conflict = (msg: string) => new ApiError(409, msg, { code: 'conflict' })
export const validationError = (fields: Record<string, string[]>, msg = 'Validation failed') =>
  new ApiError(422, msg, { code: 'validation_error', fields })
