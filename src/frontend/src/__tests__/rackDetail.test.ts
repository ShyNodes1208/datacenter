import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createMemoryHistory, createRouter } from 'vue-router'

vi.mock('../composables/useApi', () => ({
  useApi: () => ({ request: vi.fn() }),
}))

vi.mock('../composables/useAuth', () => ({
  useAuth: () => ({
    user: { value: { username: 'test', role: '机房管理员' } },
    restore: vi.fn(),
    logout: vi.fn(),
  }),
}))

vi.mock('../composables/useRackDetail', async () => ({
  ...(await vi.importActual('../composables/useRackDetail')),
  useRackDetail: () => ({
    rack: ref({ id: 'r1', code: 'A01', roomId: 'rm1', roomName: 'Room A', heightU: 42, status: '启用' }),
    uSlots: ref([]),
    stats: ref({ total: 42, occupied: 10, empty: 32 }),
    loading: ref(false),
    error: ref(''),
    rackedServerCount: ref(3),
    loadData: vi.fn(),
  }),
}))

import RackDeviceView from '../views/RackDeviceView.vue'
import { findAvailableURanges } from '../composables/useRackDetail'

describe('findAvailableURanges', () => {
  it('returns adjacent free ranges that meet the requested U count', () => {
    expect(findAvailableURanges([
      { startU: 12, endU: 9, uCount: 4, occupied: false },
      { startU: 8, endU: 7, uCount: 2, occupied: false },
    ], 4)).toEqual([
      { startU: 12, endU: 9, length: 4 },
    ])
  })

  it('excludes free ranges interrupted by occupied slots or shorter than required', () => {
    expect(findAvailableURanges([
      { startU: 12, endU: 10, uCount: 3, occupied: false },
      { startU: 9, endU: 9, uCount: 1, occupied: true },
      { startU: 8, endU: 6, uCount: 3, occupied: false },
    ], 4)).toEqual([])
  })
})

describe('RackDeviceView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders rack code and stats in toolbar', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/racks/:id', component: RackDeviceView }],
    })
    await router.push('/racks/r1')

    const app = createSSRApp(RackDeviceView)
    app.use(router)
    const html = await renderToString(app)
    expect(html).toContain('A01')
    expect(html).toContain('Room A')
    expect(html).toContain('在架服务器')
    expect(html).toContain('状态：启用')
  })
})
