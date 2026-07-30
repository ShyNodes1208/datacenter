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

vi.mock('../composables/useRackDetail', () => ({
  useRackDetail: () => ({
    rack: ref({ id: 'r1', code: 'A01', roomId: 'rm1', roomName: 'Room A', heightU: 42 }),
    uSlots: ref([]),
    stats: ref({ total: 42, occupied: 10, empty: 32 }),
    loading: ref(false),
    error: ref(''),
    rackedServerCount: ref(3),
    loadData: vi.fn(),
  }),
}))

import RackDeviceView from '../views/RackDeviceView.vue'

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
  })
})
