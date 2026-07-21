import { afterEach, describe, expect, it, vi } from 'vitest'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function csrfResponse(token: string): Response {
  return new Response(undefined, {
    status: 200,
    headers: { 'X-XSRF-TOKEN': token },
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

describe('useAuth login protocol (U13-D)', () => {
  it('follows anonymous csrf → login → authenticated csrf → me and sets user only from /me', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(csrfResponse('anon-token'))
      .mockResolvedValueOnce(
        jsonResponse({ userId: 'login-id', username: 'login-user', role: 'LoginRole' }),
      )
      .mockResolvedValueOnce(csrfResponse('auth-token'))
      .mockResolvedValueOnce(
        jsonResponse({ userId: '1', username: 'admin', role: 'Admin' }),
      )
    vi.stubGlobal('fetch', fetchMock)

    const { useAuth } = await loadUseAuth()
    const { user, login } = useAuth()
    const result = await login('admin', 'secret')

    expect(result).toEqual({ ok: true })
    expect(user.value).toEqual({ id: '1', username: 'admin', role: 'Admin' })
    expect(user.value).not.toEqual({
      id: 'login-id',
      username: 'login-user',
      role: 'LoginRole',
    })

    expect(fetchMock).toHaveBeenCalledTimes(4)

    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/auth/csrf')
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: 'GET',
      credentials: 'include',
    })
    expect(
      new Headers((fetchMock.mock.calls[0]?.[1] as RequestInit).headers).get('X-XSRF-TOKEN'),
    ).toBeNull()

    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/auth/login')
    const loginInit = fetchMock.mock.calls[1]?.[1] as RequestInit
    expect(loginInit.method).toBe('POST')
    expect(loginInit.credentials).toBe('include')
    expect(loginInit.body).toBe(JSON.stringify({ username: 'admin', password: 'secret' }))
    expect(new Headers(loginInit.headers).get('X-XSRF-TOKEN')).toBe('anon-token')
    expect(new Headers(loginInit.headers).get('Content-Type')).toBe('application/json')

    expect(fetchMock.mock.calls[2]?.[0]).toBe('/api/auth/csrf')
    expect(fetchMock.mock.calls[2]?.[1]).toMatchObject({
      method: 'GET',
      credentials: 'include',
    })

    expect(fetchMock.mock.calls[3]?.[0]).toBe('/api/auth/me')
    expect(fetchMock.mock.calls[3]?.[1]).toMatchObject({
      method: 'GET',
      credentials: 'include',
    })
  })

  it('returns the unified login error and does not authenticate on failed login', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(csrfResponse('anon-token'))
      .mockResolvedValueOnce(jsonResponse({ error: '用户名或密码错误' }, 401))
    vi.stubGlobal('fetch', fetchMock)

    const { useAuth } = await loadUseAuth()
    const { user, login } = useAuth()
    const result = await login('admin', 'wrong-password')

    expect(result).toEqual({ ok: false, error: '用户名或密码错误' })
    expect(user.value).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/auth/login')
  })

  it('stops the login protocol when anonymous csrf fails', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: 'csrf unavailable' }, 500))
    vi.stubGlobal('fetch', fetchMock)

    const { useAuth } = await loadUseAuth()
    const { user, login } = useAuth()
    const result = await login('admin', 'secret')

    expect(result).toEqual({ ok: false, error: 'csrf unavailable' })
    expect(user.value).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/auth/csrf')
  })

  it('clears auth and returns an error when /me fails after login', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(csrfResponse('anon-token'))
      .mockResolvedValueOnce(
        jsonResponse({ userId: 'login-id', username: 'login-user', role: 'LoginRole' }),
      )
      .mockResolvedValueOnce(csrfResponse('auth-token'))
      .mockResolvedValueOnce(jsonResponse({ error: '未认证' }, 401))
    vi.stubGlobal('fetch', fetchMock)

    const { useAuth } = await loadUseAuth()
    const { user, login } = useAuth()
    const result = await login('admin', 'secret')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('未认证')
    }
    expect(user.value).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  it('does not retain password or write auth secrets to web storage during login', async () => {
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

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(csrfResponse('anon-token'))
      .mockResolvedValueOnce(jsonResponse({ error: '用户名或密码错误' }, 401))
    vi.stubGlobal('fetch', fetchMock)

    const { useAuth } = await loadUseAuth()
    const { user, login } = useAuth()
    const password = 'secret-that-must-not-persist'
    await login('admin', password)

    expect(user.value).toBeNull()
    expect(localStorageMock.setItem).not.toHaveBeenCalled()
    expect(sessionStorageMock.setItem).not.toHaveBeenCalled()
    expect(JSON.stringify(user)).not.toContain(password)
  })
})

describe('useAuth logout protocol (U13-E)', () => {
  it('follows authenticated csrf → logout and clears identity on 204', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ userId: '1', username: 'admin', role: 'Admin' }),
      )
      .mockResolvedValueOnce(csrfResponse('logout-csrf-token'))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)

    const { useAuth } = await loadUseAuth()
    const { user, restore, logout } = useAuth()
    await restore()
    expect(user.value).toEqual({ id: '1', username: 'admin', role: 'Admin' })

    const result = await logout()

    expect(result).toEqual({ ok: true })
    expect(user.value).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(3)

    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/auth/csrf')
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      method: 'GET',
      credentials: 'include',
    })
    expect(
      new Headers((fetchMock.mock.calls[1]?.[1] as RequestInit).headers).get('X-XSRF-TOKEN'),
    ).toBeNull()

    expect(fetchMock.mock.calls[2]?.[0]).toBe('/api/auth/logout')
    const logoutInit = fetchMock.mock.calls[2]?.[1] as RequestInit
    expect(logoutInit.method).toBe('POST')
    expect(logoutInit.credentials).toBe('include')
    expect(logoutInit.body).toBeUndefined()
    expect(new Headers(logoutInit.headers).get('X-XSRF-TOKEN')).toBe('logout-csrf-token')
  })

  it('clears identity when logout returns 401', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ userId: '1', username: 'admin', role: 'Admin' }),
      )
      .mockResolvedValueOnce(csrfResponse('logout-csrf-token'))
      .mockResolvedValueOnce(jsonResponse({ error: '未认证' }, 401))
    vi.stubGlobal('fetch', fetchMock)

    const { useAuth } = await loadUseAuth()
    const { user, restore, logout } = useAuth()
    await restore()
    expect(user.value).not.toBeNull()

    const result = await logout()

    expect(result).toEqual({ ok: true })
    expect(user.value).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock.mock.calls[2]?.[0]).toBe('/api/auth/logout')
  })

  it('keeps user and returns unified error on non-204/401 logout failure', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ userId: '1', username: 'admin', role: 'Admin' }),
      )
      .mockResolvedValueOnce(csrfResponse('logout-csrf-token'))
      .mockResolvedValueOnce(jsonResponse({ error: '服务不可用' }, 500))
    vi.stubGlobal('fetch', fetchMock)

    const { useAuth } = await loadUseAuth()
    const { user, restore, logout } = useAuth()
    await restore()
    expect(user.value).toEqual({ id: '1', username: 'admin', role: 'Admin' })

    const result = await logout()

    expect(result).toEqual({ ok: false, error: '服务不可用' })
    expect(user.value).toEqual({ id: '1', username: 'admin', role: 'Admin' })
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('stops logout and keeps user when authenticated csrf fails', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ userId: '1', username: 'admin', role: 'Admin' }),
      )
      .mockResolvedValueOnce(jsonResponse({ error: 'csrf unavailable' }, 500))
    vi.stubGlobal('fetch', fetchMock)

    const { useAuth } = await loadUseAuth()
    const { user, restore, logout } = useAuth()
    await restore()
    expect(user.value).toEqual({ id: '1', username: 'admin', role: 'Admin' })

    const result = await logout()

    expect(result).toEqual({ ok: false, error: 'csrf unavailable' })
    expect(user.value).toEqual({ id: '1', username: 'admin', role: 'Admin' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/auth/csrf')
  })

  it('treats a second logout 401 as anonymous and keeps identity cleared', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ userId: '1', username: 'admin', role: 'Admin' }),
      )
      .mockResolvedValueOnce(csrfResponse('first-logout-csrf'))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(csrfResponse('second-logout-csrf'))
      .mockResolvedValueOnce(jsonResponse({ error: '未认证' }, 401))
    vi.stubGlobal('fetch', fetchMock)

    const { useAuth } = await loadUseAuth()
    const { user, restore, logout } = useAuth()
    await restore()

    const first = await logout()
    expect(first).toEqual({ ok: true })
    expect(user.value).toBeNull()

    const second = await logout()
    expect(second).toEqual({ ok: true })
    expect(user.value).toBeNull()

    expect(fetchMock).toHaveBeenCalledTimes(5)
    expect(fetchMock.mock.calls[3]?.[0]).toBe('/api/auth/csrf')
    expect(fetchMock.mock.calls[4]?.[0]).toBe('/api/auth/logout')
    expect(
      new Headers((fetchMock.mock.calls[4]?.[1] as RequestInit).headers).get('X-XSRF-TOKEN'),
    ).toBe('second-logout-csrf')
  })

  it('does not write auth secrets to web storage during logout', async () => {
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

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ userId: '1', username: 'admin', role: 'Admin' }),
      )
      .mockResolvedValueOnce(csrfResponse('logout-csrf-token'))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)

    const { useAuth } = await loadUseAuth()
    const { restore, logout } = useAuth()
    await restore()
    await logout()

    expect(localStorageMock.setItem).not.toHaveBeenCalled()
    expect(sessionStorageMock.setItem).not.toHaveBeenCalled()
  })
})
