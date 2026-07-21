import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSSRApp, ref } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createMemoryHistory, createRouter } from 'vue-router'

const userMock = ref<{ id: string; username: string; role: string } | null>(null)

vi.mock('../composables/useAuth', () => ({
  useAuth: () => ({
    user: userMock,
  }),
}))

vi.mock('vue-router', async () => {
  const actual = await vi.importActual<typeof import('vue-router')>('vue-router')
  return {
    ...actual,
    createWebHistory: () => actual.createMemoryHistory(),
    useRouter: () => ({
      push: vi.fn(),
    }),
  }
})

afterEach(() => {
  userMock.value = null
  vi.unstubAllGlobals()
})

describe('RoomListPage SSR render', () => {
  it('renders without crashing', async () => {
    userMock.value = { id: '1', username: 'admin', role: '机房管理员' }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } })
    ))

    const { default: RoomListPage } = await import('../views/RoomListPage.vue')
    const app = createSSRApp(RoomListPage)
    const html = await renderToString(app)

    expect(html).toContain('机房列表')
  })

  it('shows empty state when no rooms exist', async () => {
    userMock.value = { id: '1', username: 'admin', role: '机房管理员' }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } })
    ))

    const { default: RoomListPage } = await import('../views/RoomListPage.vue')
    const app = createSSRApp(RoomListPage)
    const html = await renderToString(app)

    expect(html).toContain('暂无机房')
  })

  it('renders room names in the output when data is present', async () => {
    userMock.value = { id: '1', username: 'admin', role: '机房管理员' }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify([
        { id: 1, name: 'Room A', location: 'Floor 1', notes: null, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
        { id: 2, name: 'Room B', location: null, notes: null, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
      ]), { status: 200, headers: { 'Content-Type': 'application/json' } })
    ))

    const { default: RoomListPage } = await import('../views/RoomListPage.vue')
    const app = createSSRApp(RoomListPage)
    const html = await renderToString(app)

    expect(html).toContain('Room A')
    expect(html).toContain('Room B')
    expect(html).toContain('Floor 1')
    expect(html).toContain('—')
  })

  it('shows create button for admin role', async () => {
    userMock.value = { id: '1', username: 'admin', role: '机房管理员' }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } })
    ))

    const { default: RoomListPage } = await import('../views/RoomListPage.vue')
    const app = createSSRApp(RoomListPage)
    const html = await renderToString(app)

    expect(html).toContain('新建机房')
  })

  it('hides create button for readonly role', async () => {
    userMock.value = { id: '1', username: 'viewer', role: '只读查看人员' }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } })
    ))

    const { default: RoomListPage } = await import('../views/RoomListPage.vue')
    const app = createSSRApp(RoomListPage)
    const html = await renderToString(app)

    expect(html).not.toContain('新建机房')
  })
})
