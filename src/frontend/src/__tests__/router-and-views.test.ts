import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSSRApp, ref } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createMemoryHistory, createRouter } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import LoginView from '../views/LoginView.vue'

const loginMock = vi.fn()
const logoutMock = vi.fn()
const restoreMock = vi.fn().mockResolvedValue(undefined)
const requestMock = vi.fn()
const pushMock = vi.fn()
const userMock = ref<{ id: string; username: string; role: string } | null>(null)

vi.mock('../composables/useAuth', () => ({
  useAuth: () => ({
    login: (...args: unknown[]) => loginMock(...args),
    logout: (...args: unknown[]) => logoutMock(...args),
    restore: (...args: unknown[]) => restoreMock(...args),
    user: userMock,
  }),
}))

vi.mock('../composables/useApi', () => ({
  useApi: () => ({
    request: (...args: unknown[]) => requestMock(...args),
  }),
}))

vi.mock('vue-router', async () => {
  const actual = await vi.importActual<typeof import('vue-router')>('vue-router')
  return {
    ...actual,
    createWebHistory: () => actual.createMemoryHistory(),
    useRouter: () => ({
      push: (...args: unknown[]) => pushMock(...args),
    }),
  }
})

type LoginViewSetupState = {
  username: string
  password: string
  errorMessage: string
  submitting: boolean
  onSubmit: () => Promise<void>
}

type HomeViewSetupState = {
  errorMessage: string
  submitting: boolean
  rooms: { name: string; status: string }[] | null
  roomsError: string
  loadRooms: () => Promise<void>
  onLogout: () => Promise<void>
}

async function renderLoginViewHtml(): Promise<string> {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/login', component: LoginView },
    ],
  })
  await router.push('/login')
  await router.isReady()

  const app = createSSRApp(LoginView)
  app.use(router)
  return renderToString(app)
}

async function mountLoginViewState(): Promise<LoginViewSetupState> {
  let setupState: LoginViewSetupState | null = null
  const app = createSSRApp(LoginView)
  app.mixin({
    created() {
      const instance = (this as { $: { type?: { __name?: string }; setupState?: LoginViewSetupState } }).$
      if (instance.type?.__name === 'LoginView' && instance.setupState) {
        setupState = instance.setupState
      }
    },
  })
  await renderToString(app)
  if (setupState === null) {
    throw new Error('LoginView setupState was not captured')
  }
  return setupState
}

async function renderHomeViewHtml(): Promise<string> {
  const app = createSSRApp(HomeView)
  return renderToString(app)
}

async function mountHomeViewState(): Promise<HomeViewSetupState> {
  let setupState: HomeViewSetupState | null = null
  const app = createSSRApp(HomeView)
  app.mixin({
    created() {
      const instance = (this as { $: { type?: { __name?: string }; setupState?: HomeViewSetupState } }).$
      if (instance.type?.__name === 'HomeView' && instance.setupState) {
        setupState = instance.setupState
      }
    },
  })
  await renderToString(app)
  if (setupState === null) {
    throw new Error('HomeView setupState was not captured')
  }
  return setupState
}

afterEach(() => {
  loginMock.mockReset()
  logoutMock.mockReset()
  restoreMock.mockReset()
  restoreMock.mockResolvedValue(undefined)
  requestMock.mockReset()
  pushMock.mockReset()
  userMock.value = null
  vi.unstubAllGlobals()
})

describe('LoginView render (U14-A)', () => {
  it('renders username input, password input, login button, and fixed error region', async () => {
    const html = await renderLoginViewHtml()

    expect(html).toMatch(/<input[^>]*name="username"[^>]*type="text"/)
    expect(html).toMatch(/<input[^>]*name="password"[^>]*type="password"/)
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*>登录<\/button>/)
    expect(html).toMatch(/<div[^>]*role="alert"[^>]*aria-live="polite"/)
  })
})

describe('LoginView submit behavior (U14-B)', () => {
  it('submits username and password to login', async () => {
    loginMock.mockResolvedValue({ ok: false, error: '用户名或密码错误' })
    pushMock.mockResolvedValue(undefined)

    const state = await mountLoginViewState()
    state.username = 'admin'
    state.password = 'secret'

    await state.onSubmit()

    expect(loginMock).toHaveBeenCalledTimes(1)
    expect(loginMock).toHaveBeenCalledWith('admin', 'secret')
  })

  it('requests navigation to / after successful login', async () => {
    loginMock.mockResolvedValue({ ok: true })
    pushMock.mockResolvedValue(undefined)

    const state = await mountLoginViewState()
    state.username = 'admin'
    state.password = 'secret'

    await state.onSubmit()

    expect(loginMock).toHaveBeenCalledWith('admin', 'secret')
    expect(pushMock).toHaveBeenCalledTimes(1)
    expect(pushMock).toHaveBeenCalledWith('/')
    expect(state.errorMessage).toBe('')
  })

  it('shows the unified login error and clears password after failure', async () => {
    loginMock.mockResolvedValue({ ok: false, error: '用户名或密码错误' })
    pushMock.mockResolvedValue(undefined)

    const state = await mountLoginViewState()
    state.username = 'admin'
    state.password = 'wrong-password'

    await state.onSubmit()

    expect(loginMock).toHaveBeenCalledWith('admin', 'wrong-password')
    expect(state.errorMessage).toBe('用户名或密码错误')
    expect(state.password).toBe('')
    expect(pushMock).not.toHaveBeenCalled()
  })
})

describe('HomeView protected shell (U14-C)', () => {
  it('renders current username, role, and logout button', async () => {
    userMock.value = { id: '1', username: 'admin', role: 'Admin' }

    const html = await renderHomeViewHtml()

    expect(html).toContain('admin')
    expect(html).toContain('Admin')
    expect(html).toMatch(/<button[^>]*type="button"[^>]*>登出<\/button>/)
    expect(html).toContain('aria-label="机房列表"')
  })

  it('calls logout and navigates to /login after successful logout', async () => {
    userMock.value = { id: '1', username: 'admin', role: 'Admin' }
    logoutMock.mockResolvedValue({ ok: true })
    pushMock.mockResolvedValue(undefined)

    const state = await mountHomeViewState()
    await state.onLogout()

    expect(logoutMock).toHaveBeenCalledTimes(1)
    expect(pushMock).toHaveBeenCalledTimes(1)
    expect(pushMock).toHaveBeenCalledWith('/login')
    expect(state.errorMessage).toBe('')
  })

  it('shows the unified logout error and does not navigate after failure', async () => {
    userMock.value = { id: '1', username: 'admin', role: 'Admin' }
    logoutMock.mockResolvedValue({ ok: false, error: '服务不可用' })
    pushMock.mockResolvedValue(undefined)

    const state = await mountHomeViewState()
    await state.onLogout()

    expect(logoutMock).toHaveBeenCalledTimes(1)
    expect(state.errorMessage).toBe('服务不可用')
    expect(pushMock).not.toHaveBeenCalled()
  })
})

describe('HomeView readonly room list (G09-03)', () => {
  const forbiddenControls = ['创建', '编辑', '删除', '详情', '搜索', '排序', '筛选', '分页']

  it('shows room names and enabled/disabled status after a successful API response', async () => {
    userMock.value = { id: '1', username: 'admin', role: '机房管理员' }
    requestMock.mockResolvedValue({
      ok: true,
      data: [
        { name: '机房A', status: '启用' },
        { name: '机房B', status: '停用' },
      ],
      headers: new Headers(),
      status: 200,
    })

    const state = await mountHomeViewState()
    await state.loadRooms()
    const html = await renderHomeViewHtml()

    expect(requestMock).toHaveBeenCalledWith('/api/rooms', { method: 'GET' })
    expect(state.rooms).toEqual([
      { name: '机房A', status: '启用' },
      { name: '机房B', status: '停用' },
    ])
    expect(state.roomsError).toBe('')
    expect(html).toContain('aria-label="机房列表"')
  })

  it('shows the empty state when the API returns an empty array', async () => {
    userMock.value = { id: '1', username: 'admin', role: '机房管理员' }
    requestMock.mockResolvedValue({
      ok: true,
      data: [],
      headers: new Headers(),
      status: 200,
    })

    const state = await mountHomeViewState()
    await state.loadRooms()
    const html = await renderHomeViewHtml()

    expect(state.rooms).toEqual([])
    expect(state.roomsError).toBe('')
    expect(html).toContain('aria-label="机房列表"')
    // Empty-state copy is bound when rooms === [] (see HomeView template).
    expect(state.rooms !== null && state.rooms.length === 0).toBe(true)
  })

  it('shows the error state on API failure and does not show the empty state', async () => {
    userMock.value = { id: '1', username: 'admin', role: '机房管理员' }
    requestMock.mockResolvedValue({
      ok: false,
      error: '服务不可用',
      status: 500,
    })

    const state = await mountHomeViewState()
    await state.loadRooms()
    const html = await renderHomeViewHtml()

    expect(state.rooms).toBeNull()
    expect(state.roomsError).toBe('服务不可用')
    expect(html).toContain('aria-label="机房列表"')
    expect(html).not.toContain('暂无机房')
  })

  it('keeps the room list region free of create/edit/delete and related controls', async () => {
    userMock.value = { id: '1', username: 'admin', role: '机房管理员' }
    requestMock.mockResolvedValue({
      ok: true,
      data: [{ name: '机房A', status: '启用' }],
      headers: new Headers(),
      status: 200,
    })

    const state = await mountHomeViewState()
    await state.loadRooms()
    const html = await renderHomeViewHtml()
    const listMatch = html.match(/<section[^>]*aria-label="机房列表"[^>]*>[\s\S]*?<\/section>/)
    expect(listMatch).not.toBeNull()
    const listHtml = listMatch?.[0] ?? ''

    expect(state.rooms).toEqual([{ name: '机房A', status: '启用' }])
    for (const label of forbiddenControls) {
      expect(listHtml).not.toContain(label)
    }
  })
})

describe('auth redirect route guards (U14-D)', () => {
  async function loadAppRouter() {
    vi.resetModules()
    restoreMock.mockResolvedValue(undefined)
    const { router } = await import('../router')
    return router
  }

  it('redirects anonymous access of / to /login', async () => {
    userMock.value = null
    const router = await loadAppRouter()

    await router.push('/')
    await router.isReady()

    expect(restoreMock).toHaveBeenCalled()
    expect(router.currentRoute.value.fullPath).toBe('/login')
  })

  it('redirects authenticated access of /login to /', async () => {
    userMock.value = { id: '1', username: 'admin', role: 'Admin' }
    const router = await loadAppRouter()

    await router.push('/login')
    await router.isReady()

    expect(restoreMock).toHaveBeenCalled()
    expect(router.currentRoute.value.fullPath).toBe('/')
  })
})

describe('route guard init wait (U14-E)', () => {
  async function loadAppRouter() {
    vi.resetModules()
    const { router } = await import('../router')
    return router
  }

  it('waits for a pending restore before navigating by final auth state', async () => {
    let resolveRestore!: () => void
    const pendingRestore = new Promise<void>((resolve) => {
      resolveRestore = resolve
    })
    restoreMock.mockImplementation(() => pendingRestore)

    userMock.value = null
    const router = await loadAppRouter()

    let navigationDone = false
    const navigation = router.push('/').then(() => {
      navigationDone = true
    })

    for (let i = 0; i < 20 && restoreMock.mock.calls.length === 0; i += 1) {
      await Promise.resolve()
    }

    expect(restoreMock).toHaveBeenCalled()
    expect(navigationDone).toBe(false)

    resolveRestore()
    await navigation
    await router.isReady()

    expect(navigationDone).toBe(true)
    expect(router.currentRoute.value.fullPath).toBe('/login')
  })

  it('reuses one pending restore promise and navigates once after it resolves', async () => {
    let resolveRestore!: () => void
    const pendingRestore = new Promise<void>((resolve) => {
      resolveRestore = resolve
    })
    restoreMock.mockImplementation(() => pendingRestore)

    userMock.value = null
    const router = await loadAppRouter()

    const first = router.push('/')
    const second = router.push('/')

    for (let i = 0; i < 20 && restoreMock.mock.calls.length === 0; i += 1) {
      await Promise.resolve()
    }

    expect(restoreMock.mock.results.length).toBeGreaterThan(0)
    expect(
      restoreMock.mock.results.every(
        (result) => result.type === 'return' && result.value === pendingRestore,
      ),
    ).toBe(true)

    userMock.value = { id: '1', username: 'admin', role: 'Admin' }
    resolveRestore()
    await Promise.all([first, second])
    await router.isReady()

    expect(router.currentRoute.value.fullPath).toBe('/')
  })

  it('does not enter a redirect loop after auth state settles', async () => {
    restoreMock.mockResolvedValue(undefined)
    userMock.value = null
    const router = await loadAppRouter()

    await router.push('/')
    await router.isReady()
    expect(router.currentRoute.value.fullPath).toBe('/login')

    await router.push('/login')
    await router.isReady()
    expect(router.currentRoute.value.fullPath).toBe('/login')

    userMock.value = { id: '1', username: 'admin', role: 'Admin' }
    await router.push('/')
    await router.isReady()
    expect(router.currentRoute.value.fullPath).toBe('/')

    await router.push('/')
    await router.isReady()
    expect(router.currentRoute.value.fullPath).toBe('/')
  })
})
