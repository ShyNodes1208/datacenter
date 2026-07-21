import { ref } from 'vue'
import { setUnauthorizedHandler, useApi } from './useApi'

export type AuthUser = {
  id: string
  username: string
  role: string
}

const user = ref<AuthUser | null>(null)
const initializing = ref(false)
const restoreError = ref<string | null>(null)
let restorePromise: Promise<void> | null = null

function clearAuthState(): void {
  user.value = null
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

export function useAuth() {
  return {
    user,
    initializing,
    restoreError,
    restore,
  }
}
