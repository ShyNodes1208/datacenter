import { ref } from 'vue'
import { setUnauthorizedHandler, useApi } from './useApi'

export type AuthUser = {
  id: string
  username: string
  role: string
}

export type AuthActionResult =
  | { ok: true }
  | { ok: false; error: string }

const user = ref<AuthUser | null>(null)
const initializing = ref(false)
const restoreError = ref<string | null>(null)

/** CSRF request token — module memory only; never persisted. */
let csrfToken: string | null = null
let restorePromise: Promise<void> | null = null

function clearAuthState(): void {
  user.value = null
  if (csrfToken !== null) {
    csrfToken = null
  }
}

setUnauthorizedHandler(() => {
  clearAuthState()
})

function parseUser(data: unknown): AuthUser | null {
  if (data === null || typeof data !== 'object') {
    return null
  }

  const record = data as Record<string, unknown>
  const id =
    typeof record.id === 'string'
      ? record.id
      : typeof record.userId === 'string'
        ? record.userId
        : null
  const username = typeof record.username === 'string' ? record.username : null
  const role = typeof record.role === 'string' ? record.role : null

  if (id === null || username === null || role === null) {
    return null
  }

  return { id, username, role }
}

async function fetchCsrfToken(): Promise<AuthActionResult & { token?: string }> {
  const { request } = useApi()
  const result = await request('/api/auth/csrf', { method: 'GET' })
  if (!result.ok) {
    return { ok: false, error: result.error }
  }

  const token = result.headers.get('X-XSRF-TOKEN')
  if (!token) {
    return { ok: false, error: 'Request failed.' }
  }

  return { ok: true, token }
}

async function runRestore(): Promise<void> {
  initializing.value = true
  restoreError.value = null

  const { request } = useApi()
  const result = await request<unknown>('/api/auth/me', { method: 'GET' })

  if (result.ok) {
    const parsed = parseUser(result.data)
    if (parsed) {
      user.value = parsed
    } else {
      clearAuthState()
      restoreError.value = 'Request failed.'
    }
  } else if (result.status === 401) {
    // Anonymous is a normal restore outcome.
    clearAuthState()
  } else {
    clearAuthState()
    restoreError.value = result.error
  }

  initializing.value = false
}

async function restore(): Promise<void> {
  if (restorePromise === null) {
    restorePromise = runRestore()
  }
  return restorePromise
}

async function login(username: string, password: string): Promise<AuthActionResult> {
  const { request } = useApi()

  const anonymousCsrf = await fetchCsrfToken()
  if (!anonymousCsrf.ok || !anonymousCsrf.token) {
    return { ok: false, error: anonymousCsrf.error ?? 'Request failed.' }
  }

  const loginResult = await request('/api/auth/login', {
    method: 'POST',
    body: { username, password },
    csrfToken: anonymousCsrf.token,
  })
  if (!loginResult.ok) {
    clearAuthState()
    return { ok: false, error: loginResult.error }
  }

  const authenticatedCsrf = await fetchCsrfToken()
  if (!authenticatedCsrf.ok || !authenticatedCsrf.token) {
    clearAuthState()
    return { ok: false, error: authenticatedCsrf.error ?? 'Request failed.' }
  }
  csrfToken = authenticatedCsrf.token

  const meResult = await request<unknown>('/api/auth/me', { method: 'GET' })
  if (!meResult.ok) {
    clearAuthState()
    return { ok: false, error: meResult.error }
  }

  const parsed = parseUser(meResult.data)
  if (!parsed) {
    clearAuthState()
    return { ok: false, error: 'Request failed.' }
  }

  user.value = parsed
  return { ok: true }
}

export function useAuth() {
  return {
    user,
    initializing,
    restoreError,
    restore,
    login,
  }
}
