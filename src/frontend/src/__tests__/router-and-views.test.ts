import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSSRApp, nextTick, ref } from 'vue'
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
  createFormVisible: boolean
  roomName: string
  roomStatus: string
  createSubmitting: boolean
  createError: string
  isRoomAdmin: boolean
  loadRooms: () => Promise<void>
  openCreateForm: () => void
  cancelCreate: () => void
  onCreateRoom: () => Promise<void>
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

async function flushUi(): Promise<void> {
  await Promise.resolve()
  await nextTick()
  await Promise.resolve()
  await nextTick()
}

type MountedHomeView = {
  /** Real Vue SSR HTML from HomeView.vue template (same reactive bindings). */
  html: () => Promise<string>
  hasButton: (markup: string, text: string) => boolean
  hasForm: (markup: string) => boolean
  inputValue: (markup: string, name: string) => string | null
  selectedStatus: (markup: string) => string | null
  createErrorText: (markup: string) => string
  saveButtonDisabled: (markup: string) => boolean
  saveButtonLabel: (markup: string) => string | null
  clickCreate: () => Promise<void>
  clickSave: () => Promise<void>
  clickCancel: () => Promise<void>
  typeRoomName: (value: string) => Promise<void>
  chooseStatus: (value: string) => Promise<void>
  unmount: () => void
}

/**
 * One shared HomeView reactive instance. html() always comes from Vue's
 * renderToString / HomeView.vue ssrRender — never hand-assembled markup.
 *
 * Note: Vitest compiles SFCs with ssrRender only and no jsdom/happy-dom is
 * installed, so client DOM event dispatch is unavailable. Interactions invoke
 * the same handlers the template binds (@click / @submit.prevent / v-model).
 */
async function mountInteractiveHomeView(): Promise<MountedHomeView> {
  type SetupFn = (...args: unknown[]) => Record<string, unknown>
  const component = HomeView as { setup: SetupFn }
  const originalSetup = component.setup
  let bindings: Record<string, unknown> | null = null

  component.setup = (props, ctx) => {
    if (bindings) {
      return bindings
    }
    bindings = originalSetup(props, ctx)
    return bindings
  }

  const renderRealHtml = async (): Promise<string> => {
    const app = createSSRApp(HomeView)
    return renderToString(app)
  }

  await renderRealHtml()
  if (bindings === null) {
    component.setup = originalSetup
    throw new Error('HomeView setup bindings were not captured')
  }

  const state = bindings as unknown as HomeViewSetupState
  await state.loadRooms()
  await flushUi()

  const writeRef = <T,>(field: keyof HomeViewSetupState, value: T): void => {
    const raw = bindings![field as string]
    if (raw !== null && typeof raw === 'object' && 'value' in (raw as object)) {
      ;(raw as { value: T }).value = value
      return
    }
    ;(bindings as Record<string, unknown>)[field as string] = value
  }

  const hasButton = (markup: string, text: string): boolean =>
    new RegExp(`<button[^>]*>\\s*${text}\\s*<\\/button>`).test(markup)

  const hasForm = (markup: string): boolean => /<form[\s>]/.test(markup)

  const inputValue = (markup: string, name: string): string | null => {
    const match = markup.match(new RegExp(`<input[^>]*name="${name}"[^>]*>`))
    if (!match) {
      return null
    }
    const valueMatch = match[0].match(/\bvalue="([^"]*)"/)
    return valueMatch ? valueMatch[1] : ''
  }

  const selectedStatus = (markup: string): string | null => {
    const selectMatch = markup.match(
      /<select[^>]*name="roomStatus"[^>]*>([\s\S]*?)<\/select>/,
    )
    if (!selectMatch) {
      return null
    }
    const selected = selectMatch[1].match(/<option[^>]*value="([^"]*)"[^>]*selected/)
    return selected ? selected[1] : null
  }

  const createErrorText = (markup: string): string => {
    const formMatch = markup.match(/<form[\s\S]*?<\/form>/)
    if (!formMatch) {
      return ''
    }
    const alertMatch = formMatch[0].match(
      /<div[^>]*role="alert"[^>]*>([\s\S]*?)<\/div>/,
    )
    return alertMatch ? alertMatch[1].trim() : ''
  }

  const saveButtonDisabled = (markup: string): boolean => {
    const match = markup.match(/<button[^>]*type="submit"[^>]*>/)
    return Boolean(match && /\bdisabled\b/.test(match[0]))
  }

  const saveButtonLabel = (markup: string): string | null => {
    const match = markup.match(/<button[^>]*type="submit"[^>]*>([\s\S]*?)<\/button>/)
    return match ? match[1].trim() : null
  }

  return {
    html: renderRealHtml,
    hasButton,
    hasForm,
    inputValue,
    selectedStatus,
    createErrorText,
    saveButtonDisabled,
    saveButtonLabel,
    clickCreate: async () => {
      state.openCreateForm()
      await flushUi()
    },
    clickSave: async () => {
      await state.onCreateRoom()
      await flushUi()
    },
    clickCancel: async () => {
      state.cancelCreate()
      await flushUi()
    },
    typeRoomName: async (value: string) => {
      writeRef('roomName', value)
      await flushUi()
    },
    chooseStatus: async (value: string) => {
      writeRef('roomStatus', value)
      await flushUi()
    },
    unmount: () => {
      component.setup = originalSetup
      bindings = null
    },
  }
}

function mockRoomsGet(data: Array<{ name: string; status: string }>) {
  return {
    ok: true as const,
    data,
    headers: new Headers(),
    status: 200,
  }
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

describe('HomeView create room (TASK-0018)', () => {
  it('shows the create-room button for 机房管理员', async () => {
    userMock.value = { id: '1', username: 'admin', role: '机房管理员' }
    requestMock.mockResolvedValue(mockRoomsGet([]))

    const view = await mountInteractiveHomeView()
    try {
      const html = await view.html()
      expect(view.hasButton(html, '新增机房')).toBe(true)
      expect(view.hasForm(html)).toBe(false)
    } finally {
      view.unmount()
    }
  })

  it.each(['运维人员', 'DBA/应用运维人员', '只读查看人员'])(
    'hides the create-room entry for role %s',
    async (role) => {
      userMock.value = { id: '1', username: 'user', role }
      requestMock.mockResolvedValue(mockRoomsGet([]))

      const view = await mountInteractiveHomeView()
      try {
        const html = await view.html()
        expect(view.hasButton(html, '新增机房')).toBe(false)
        expect(view.hasForm(html)).toBe(false)
        expect(html).not.toMatch(/name="roomName"/)
      } finally {
        view.unmount()
      }
    },
  )

  it('opens the inline form with name, status default 启用, save and cancel', async () => {
    userMock.value = { id: '1', username: 'admin', role: '机房管理员' }
    requestMock.mockResolvedValue(mockRoomsGet([]))

    const view = await mountInteractiveHomeView()
    try {
      await view.clickCreate()
      const html = await view.html()

      expect(view.hasForm(html)).toBe(true)
      expect(view.inputValue(html, 'roomName')).toBe('')
      expect(view.selectedStatus(html)).toBe('启用')
      expect(view.hasButton(html, '保存')).toBe(true)
      expect(view.hasButton(html, '取消')).toBe(true)
      expect(html).toMatch(/name="roomName"/)
      expect(html).toMatch(/name="roomStatus"/)
    } finally {
      view.unmount()
    }
  })

  it('posts a new room, reloads the list on the same instance, and closes the form', async () => {
    userMock.value = { id: '1', username: 'admin', role: '机房管理员' }
    let listData = [{ name: '旧机房', status: '启用' }]
    requestMock.mockImplementation(async (path: string, options: { method?: string; body?: unknown; csrfToken?: string } = {}) => {
      if (path === '/api/auth/csrf') {
        return {
          ok: true,
          data: undefined,
          headers: new Headers({ 'X-XSRF-TOKEN': 'csrf-token-1' }),
          status: 200,
        }
      }
      if (path === '/api/rooms' && options.method === 'POST') {
        listData = [
          { name: '旧机房', status: '启用' },
          { name: '主机房', status: '启用' },
        ]
        return {
          ok: true,
          data: { name: '主机房', status: '启用' },
          headers: new Headers(),
          status: 201,
        }
      }
      if (path === '/api/rooms') {
        return mockRoomsGet(listData)
      }
      return { ok: false, error: 'unexpected', status: 500 }
    })

    const view = await mountInteractiveHomeView()
    try {
      await view.clickCreate()
      await view.typeRoomName('主机房')
      await view.chooseStatus('启用')
      await view.clickSave()

      expect(requestMock).toHaveBeenCalledWith('/api/rooms', {
        method: 'POST',
        body: { name: '主机房', status: '启用' },
        csrfToken: 'csrf-token-1',
      })
      const getCalls = requestMock.mock.calls.filter(
        (call) => call[0] === '/api/rooms' && (call[1]?.method === 'GET' || call[1]?.method === undefined),
      )
      expect(getCalls.length).toBeGreaterThanOrEqual(2)

      const html = await view.html()
      expect(html).toContain('主机房')
      expect(html).toContain('启用')
      expect(view.hasForm(html)).toBe(false)
      expect(view.hasButton(html, '新增机房')).toBe(true)
      expect(html).not.toMatch(/name="roomName"/)
    } finally {
      view.unmount()
    }
  })

  it('keeps the form open with input retained when the name already exists', async () => {
    userMock.value = { id: '1', username: 'admin', role: '机房管理员' }
    requestMock.mockImplementation(async (path: string, options: { method?: string } = {}) => {
      if (path === '/api/auth/csrf') {
        return {
          ok: true,
          data: undefined,
          headers: new Headers({ 'X-XSRF-TOKEN': 'csrf-token-2' }),
          status: 200,
        }
      }
      if (path === '/api/rooms' && options.method === 'POST') {
        return { ok: false, error: '机房名称已存在', status: 409 }
      }
      return mockRoomsGet([{ name: '主机房', status: '启用' }])
    })

    const view = await mountInteractiveHomeView()
    try {
      await view.clickCreate()
      await view.typeRoomName('主机房')
      await view.clickSave()

      const html = await view.html()
      expect(view.createErrorText(html)).toBe('机房名称已存在')
      expect(view.hasForm(html)).toBe(true)
      expect(view.inputValue(html, 'roomName')).toBe('主机房')
      expect(html).toContain('机房名称已存在')
    } finally {
      view.unmount()
    }
  })

  it('shows 机房名称不能为空 from the backend and keeps the form open', async () => {
    userMock.value = { id: '1', username: 'admin', role: '机房管理员' }
    requestMock.mockImplementation(async (path: string, options: { method?: string } = {}) => {
      if (path === '/api/auth/csrf') {
        return {
          ok: true,
          data: undefined,
          headers: new Headers({ 'X-XSRF-TOKEN': 'csrf-token-3' }),
          status: 200,
        }
      }
      if (path === '/api/rooms' && options.method === 'POST') {
        return { ok: false, error: '机房名称不能为空', status: 400 }
      }
      return mockRoomsGet([])
    })

    const view = await mountInteractiveHomeView()
    try {
      await view.clickCreate()
      await view.typeRoomName('   ')
      await view.clickSave()

      const html = await view.html()
      expect(view.createErrorText(html)).toBe('机房名称不能为空')
      expect(view.hasForm(html)).toBe(true)
      expect(html).toContain('机房名称不能为空')
    } finally {
      view.unmount()
    }
  })

  it('disables the save button while submitting to prevent duplicate posts', async () => {
    userMock.value = { id: '1', username: 'admin', role: '机房管理员' }
    let resolvePost!: (value: unknown) => void
    const postGate = new Promise((resolve) => {
      resolvePost = resolve
    })

    requestMock.mockImplementation(async (path: string, options: { method?: string } = {}) => {
      if (path === '/api/auth/csrf') {
        return {
          ok: true,
          data: undefined,
          headers: new Headers({ 'X-XSRF-TOKEN': 'csrf-token-4' }),
          status: 200,
        }
      }
      if (path === '/api/rooms' && options.method === 'POST') {
        await postGate
        return {
          ok: true,
          data: { name: '主机房', status: '启用' },
          headers: new Headers(),
          status: 201,
        }
      }
      return mockRoomsGet([])
    })

    const view = await mountInteractiveHomeView()
    try {
      await view.clickCreate()
      await view.typeRoomName('主机房')

      const submitPromise = view.clickSave()
      await flushUi()

      const html = await view.html()
      expect(view.saveButtonDisabled(html)).toBe(true)
      expect(view.saveButtonLabel(html)).toBe('保存中...')
      expect(html).toMatch(/disabled/)

      // Second save while in-flight must not create another POST.
      await view.clickSave()
      await Promise.resolve()
      const postCalls = requestMock.mock.calls.filter(
        (call) => call[0] === '/api/rooms' && call[1]?.method === 'POST',
      )
      expect(postCalls.length).toBe(1)

      resolvePost(undefined)
      await submitPromise
      await flushUi()
    } finally {
      view.unmount()
    }
  })

  it('cancels the form, clears fields, and leaves the room list unchanged', async () => {
    userMock.value = { id: '1', username: 'admin', role: '机房管理员' }
    requestMock.mockResolvedValue(mockRoomsGet([{ name: '机房A', status: '启用' }]))

    const view = await mountInteractiveHomeView()
    try {
      expect(await view.html()).toContain('机房A')

      await view.clickCreate()
      await view.typeRoomName('临时名')
      await view.chooseStatus('停用')
      await view.clickCancel()

      const afterCancel = await view.html()
      expect(view.hasForm(afterCancel)).toBe(false)
      expect(afterCancel).toContain('机房A')
      expect(afterCancel).not.toMatch(/name="roomName"/)

      await view.clickCreate()
      const reopened = await view.html()
      expect(view.inputValue(reopened, 'roomName')).toBe('')
      expect(view.selectedStatus(reopened)).toBe('启用')
      expect(view.createErrorText(reopened)).toBe('')
    } finally {
      view.unmount()
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
