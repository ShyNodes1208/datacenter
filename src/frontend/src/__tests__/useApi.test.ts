import { afterEach, describe, expect, it, vi } from 'vitest'
import { setUnauthorizedHandler, useApi } from '../composables/useApi'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

afterEach(() => {
  setUnauthorizedHandler(null)
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('useApi basic request (U13-A)', () => {
  it('rejects non-relative /api paths without calling fetch', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const { request } = useApi()
    const absolute = await request('https://example.com/api/auth/me')
    const protocolRelative = await request('//example.com/api/auth/me')
    const outsideApi = await request('/other')

    expect(absolute.ok).toBe(false)
    expect(protocolRelative.ok).toBe(false)
    expect(outsideApi.ok).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('calls fetch with a relative /api path and credentials include', async () => {
    const payload = { userId: '1', username: 'admin', role: 'Admin' }
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(payload))
    vi.stubGlobal('fetch', fetchMock)

    const { request } = useApi()
    const result = await request<{ userId: string }>('/api/auth/me', { method: 'GET' })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data).toEqual(payload)
      expect(result.status).toBe(200)
    }
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/auth/me')
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: 'GET',
      credentials: 'include',
    })
  })

  it('sends JSON request bodies and parses JSON responses', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ userId: '1', username: 'admin', role: 'Admin' }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const { request } = useApi()
    const result = await request('/api/auth/login', {
      method: 'POST',
      body: { username: 'admin', password: 'secret' },
    })

    expect(result.ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit
    expect(init.method).toBe('POST')
    expect(init.credentials).toBe('include')
    expect(init.body).toBe(JSON.stringify({ username: 'admin', password: 'secret' }))

    const headers = new Headers(init.headers)
    expect(headers.get('Content-Type')).toBe('application/json')
  })

  it('does not write to localStorage or sessionStorage during requests', async () => {
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
      vi.fn().mockImplementation(() => Promise.resolve(jsonResponse({ ok: true }))),
    )

    const { request } = useApi()
    await request('/api/auth/me', { method: 'GET' })
    await request('/api/auth/login', {
      method: 'POST',
      body: { username: 'admin', password: 'secret' },
    })

    expect(localStorageMock.setItem).not.toHaveBeenCalled()
    expect(sessionStorageMock.setItem).not.toHaveBeenCalled()
  })
})

describe('useApi errors, CSRF and 401 (U13-B)', () => {
  it('returns the unified error message from non-success JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ error: '用户名或密码错误' }, 401)),
    )

    const { request } = useApi()
    const result = await request('/api/auth/login', {
      method: 'POST',
      body: { username: 'admin', password: 'wrong' },
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('用户名或密码错误')
      expect(result.status).toBe(401)
    }
  })

  it('returns a generic safe error for non-JSON error bodies', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('<html>stack</html>', {
          status: 500,
          headers: { 'Content-Type': 'text/html' },
        }),
      ),
    )

    const { request } = useApi()
    const result = await request('/api/auth/me', { method: 'GET' })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('Request failed.')
      expect(result.status).toBe(500)
      expect(result.error).not.toContain('stack')
      expect(result.error).not.toContain('<html>')
    }
  })

  it('returns a generic safe error when JSON lacks a unified error field', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ message: 'internal detail' }, 400)),
    )

    const { request } = useApi()
    const result = await request('/api/auth/login', {
      method: 'POST',
      body: { username: 'admin', password: 'secret' },
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('Request failed.')
      expect(result.error).not.toContain('internal detail')
    }
  })

  it('returns a generic safe error when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))

    const { request } = useApi()
    const result = await request('/api/auth/me', { method: 'GET' })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('Request failed.')
      expect(result.status).toBe(0)
      expect(result.error).not.toContain('network down')
    }
  })

  it('sets X-XSRF-TOKEN when the caller provides csrfToken', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}))
    vi.stubGlobal('fetch', fetchMock)

    const { request } = useApi()
    await request('/api/auth/login', {
      method: 'POST',
      body: { username: 'admin', password: 'secret' },
      csrfToken: 'token-abc',
    })

    const headers = new Headers((fetchMock.mock.calls[0]?.[1] as RequestInit).headers)
    expect(headers.get('X-XSRF-TOKEN')).toBe('token-abc')
  })

  it('does not set X-XSRF-TOKEN when csrfToken is omitted', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}))
    vi.stubGlobal('fetch', fetchMock)

    const { request } = useApi()
    await request('/api/auth/login', {
      method: 'POST',
      body: { username: 'admin', password: 'secret' },
    })

    const headers = new Headers((fetchMock.mock.calls[0]?.[1] as RequestInit).headers)
    expect(headers.get('X-XSRF-TOKEN')).toBeNull()
  })

  it('invokes the unauthorized handler exactly once on 401', async () => {
    const handler = vi.fn()
    setUnauthorizedHandler(handler)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ error: '未认证' }, 401)),
    )

    const { request } = useApi()
    const result = await request('/api/auth/me', { method: 'GET' })

    expect(result.ok).toBe(false)
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('does not invoke the unauthorized handler on non-401 failures', async () => {
    const handler = vi.fn()
    setUnauthorizedHandler(handler)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ error: '防伪令牌缺失或无效' }, 400)),
    )

    const { request } = useApi()
    const result = await request('/api/auth/logout', {
      method: 'POST',
      csrfToken: 'token-abc',
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('防伪令牌缺失或无效')
      expect(result.status).toBe(400)
    }
    expect(handler).not.toHaveBeenCalled()
  })

  it('does not persist CSRF tokens or error payloads in web storage', async () => {
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
      vi.fn().mockResolvedValue(jsonResponse({ error: '用户名或密码错误' }, 401)),
    )

    const { request } = useApi()
    await request('/api/auth/login', {
      method: 'POST',
      body: { username: 'admin', password: 'secret' },
      csrfToken: 'token-abc',
    })

    expect(localStorageMock.setItem).not.toHaveBeenCalled()
    expect(sessionStorageMock.setItem).not.toHaveBeenCalled()
  })
})
