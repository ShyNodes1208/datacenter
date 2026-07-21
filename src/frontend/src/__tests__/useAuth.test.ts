import { afterEach, describe, expect, it, vi } from 'vitest'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function loadUseAuth() {
  vi.resetModules()
  return import('../composables/useAuth')
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('useAuth identity restoration (U13-C)', () => {
  it('shares the same module-level user and initializing refs across useAuth calls', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({})))
    const { useAuth } = await loadUseAuth()

    const first = useAuth()
    const second = useAuth()

    expect(first.user).toBe(second.user)
    expect(first.initializing).toBe(second.initializing)
    expect(first.restoreError).toBe(second.restoreError)
  })

  it('restores an authenticated user from GET /api/auth/me', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ userId: '1', username: 'admin', role: 'Admin' }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const { useAuth } = await loadUseAuth()
    const { user, initializing, restoreError, restore } = useAuth()

    expect(initializing.value).toBe(false)
    const pending = restore()
    expect(initializing.value).toBe(true)

    await pending

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/auth/me')
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: 'GET',
      credentials: 'include',
    })
    expect(user.value).toEqual({ id: '1', username: 'admin', role: 'Admin' })
    expect(initializing.value).toBe(false)
    expect(restoreError.value).toBeNull()
  })

  it('treats /me 401 as anonymous and clears memory user', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ error: '未认证' }, 401)),
    )

    const { useAuth } = await loadUseAuth()
    const { user, initializing, restoreError, restore } = useAuth()

    await restore()

    expect(user.value).toBeNull()
    expect(initializing.value).toBe(false)
    expect(restoreError.value).toBeNull()
  })

  it('exposes non-401 restore failures without pretending to be authenticated', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ error: '服务不可用' }, 500)),
    )

    const { useAuth } = await loadUseAuth()
    const { user, initializing, restoreError, restore } = useAuth()

    await restore()

    expect(user.value).toBeNull()
    expect(initializing.value).toBe(false)
    expect(restoreError.value).toBe('服务不可用')
  })

  it('reuses one shared restore Promise and issues a single /me request', async () => {
    let resolveMe!: (response: Response) => void
    const pendingMe = new Promise<Response>((resolve) => {
      resolveMe = resolve
    })
    const fetchMock = vi.fn().mockReturnValue(pendingMe)
    vi.stubGlobal('fetch', fetchMock)

    const { useAuth } = await loadUseAuth()
    const { user, initializing, restore } = useAuth()

    const first = restore()
    const second = restore()

    expect(initializing.value).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/auth/me')

    resolveMe(jsonResponse({ userId: '2', username: 'ops', role: 'Operator' }))
    await Promise.all([first, second])

    expect(user.value).toEqual({ id: '2', username: 'ops', role: 'Operator' })
    expect(initializing.value).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('clears shared memory user when any API returns 401', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ userId: '1', username: 'admin', role: 'Admin' }),
      )
      .mockResolvedValueOnce(jsonResponse({ error: '未认证' }, 401))
    vi.stubGlobal('fetch', fetchMock)

    const { useAuth } = await loadUseAuth()
    const { user, restore } = useAuth()
    await restore()
    expect(user.value).toEqual({ id: '1', username: 'admin', role: 'Admin' })

    const { useApi } = await import('../composables/useApi')
    const { request } = useApi()
    await request('/api/auth/me', { method: 'GET' })

    expect(user.value).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not write auth state to localStorage or sessionStorage during restore', async () => {
    const localStorageMock = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    }
    const sessionStorageMock = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    }
    vi.stubGlobal('localStorage', localStorageMock)
    vi.stubGlobal('sessionStorage', sessionStorageMock)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({ userId: '1', username: 'admin', role: 'Admin' }),
      ),
    )

    const { useAuth } = await loadUseAuth()
    await useAuth().restore()

    expect(localStorageMock.setItem).not.toHaveBeenCalled()
    expect(sessionStorageMock.setItem).not.toHaveBeenCalled()
  })
})
