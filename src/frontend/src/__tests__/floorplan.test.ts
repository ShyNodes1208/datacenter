import { describe, expect, it, vi } from 'vitest'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createMemoryHistory, createRouter } from 'vue-router'
import FloorplanView from '../views/FloorplanView.vue'

const requestMock = vi.fn()
vi.mock('../composables/useApi', () => ({
  useApi: () => ({ request: (...args: unknown[]) => requestMock(...args) }),
}))
vi.mock('../composables/useAuth', () => ({
  useAuth: () => ({ user: { value: { id: 'u1', username: 'admin', role: '机房管理员' } } }),
}))
vi.mock('../composables/useFloorplan', () => ({
  useFloorplan: () => ({
    racks: { value: [] }, loading: { value: false }, error: { value: null },
    loadRacks: vi.fn().mockResolvedValue(undefined),
    toCanvasX: (v: number) => v * 0.1,
    toCanvasY: (v: number) => v * 0.1,
    toDbX: (v: number) => Math.round(v / 0.1),
    toDbY: (v: number) => Math.round(v / 0.1),
    scaleFactor: 0.1,
  }),
}))
vi.mock('../composables/useFloorplanEditor', () => ({
  useFloorplanEditor: () => ({
    mode: { value: 'view' }, selectedRackId: { value: null },
    isDragging: { value: false }, snapLines: { value: [] },
    toggleMode: vi.fn(), selectRack: vi.fn(),
    snapPosition: vi.fn((_id: string, x: number, y: number) => ({ x, y })),
    handleDragStart: vi.fn(), handleDragEnd: vi.fn(),
    undo: vi.fn(), redo: vi.fn(),
    canUndo: { value: false }, canRedo: { value: false },
  }),
}))

describe('FloorplanView', () => {
  it('renders page structure', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/rooms/:id/floorplan', component: FloorplanView }],
    })
    router.push('/rooms/room1/floorplan')
    await router.isReady()

    const app = createSSRApp(FloorplanView, {})
    app.use(router)
    const html = await renderToString(app)

    expect(html).toContain('查看模式')
    expect(html).toContain('编辑模式')
    expect(html).toContain('机房详情')
  })
})
