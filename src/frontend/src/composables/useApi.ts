export type ApiSuccess<T> = {
  ok: true
  data: T
  headers: Headers
  status: number
}

export type ApiFailure = {
  ok: false
  error: string
  status: number
}

export type ApiResult<T> = ApiSuccess<T> | ApiFailure

export type ApiRequestOptions = {
  method?: string
  body?: unknown
  csrfToken?: string
}

const GENERIC_ERROR = 'Request failed.'
const INVALID_PATH_ERROR = 'Only relative /api paths are supported.'

let unauthorizedHandler: (() => void) | null = null

/** Registers the 401 notification hook for useAuth; useApi does not clear auth state. */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler
}

function isRelativeApiPath(path: string): boolean {
  if (path.includes('://') || path.startsWith('//')) {
    return false
  }
  return path === '/api' || path.startsWith('/api/')
}

function parseErrorMessage(payload: unknown): string | null {
  if (
    payload !== null &&
    typeof payload === 'object' &&
    'error' in payload &&
    typeof (payload as { error: unknown }).error === 'string' &&
    (payload as { error: string }).error.length > 0
  ) {
    return (payload as { error: string }).error
  }
  return null
}

type ParsedBody =
  | { kind: 'empty' }
  | { kind: 'json'; value: unknown }
  | { kind: 'invalid' }

async function readBody(response: Response): Promise<ParsedBody> {
  if (response.status === 204) {
    return { kind: 'empty' }
  }

  const text = await response.text()
  if (!text) {
    return { kind: 'empty' }
  }

  try {
    return { kind: 'json', value: JSON.parse(text) as unknown }
  } catch {
    return { kind: 'invalid' }
  }
}

export function useApi() {
  async function request<T = unknown>(
    path: string,
    options: ApiRequestOptions = {},
  ): Promise<ApiResult<T>> {
    if (!isRelativeApiPath(path)) {
      return { ok: false, error: INVALID_PATH_ERROR, status: 0 }
    }

    const headers = new Headers()
    if (options.body !== undefined) {
      headers.set('Content-Type', 'application/json')
    }
    if (options.csrfToken !== undefined) {
      headers.set('X-XSRF-TOKEN', options.csrfToken)
    }

    let response: Response
    try {
      response = await fetch(path, {
        method: options.method ?? (options.body !== undefined ? 'POST' : 'GET'),
        credentials: 'include',
        headers,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      })
    } catch {
      return { ok: false, error: GENERIC_ERROR, status: 0 }
    }

    if (response.status === 401) {
      unauthorizedHandler?.()
    }

    const payload = await readBody(response)

    if (!response.ok) {
      const message =
        payload.kind === 'json'
          ? (parseErrorMessage(payload.value) ?? GENERIC_ERROR)
          : GENERIC_ERROR
      return { ok: false, error: message, status: response.status }
    }

    if (payload.kind === 'invalid') {
      return { ok: false, error: GENERIC_ERROR, status: response.status }
    }

    return {
      ok: true,
      data: (payload.kind === 'json' ? payload.value : undefined) as T,
      headers: response.headers,
      status: response.status,
    }
  }

  return { request }
}
