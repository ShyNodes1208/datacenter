import { afterEach, describe, expect, it, vi } from 'vitest'
import { useApi } from '../composables/useApi'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('useApi basic request (U13-A)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

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
