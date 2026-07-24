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

type RoomFixture = {
  id: string
  name: string
  status: string
}

type ImportRowFixture = {
  row: number
  code: string | null
  roomName: string | null
  roomId: string | null
  heightU: number | null
  brand: string | null
  power: number | null
  notes: string | null
  x: number | null
  y: number | null
  z: number | null
  errors: string[]
  duplicate: boolean
  existingRackId: string | null
  action: '' | 'create' | 'skip' | 'overwrite'
}

type ImportPreviewFixture = {
  rows: ImportRowFixture[]
  totalRows: number
  validRows: number
  errorRows: number
  duplicateRows: number
}

type HomeViewSetupState = {
  rooms: RoomFixture[] | null
  roomsError: string
  createFormVisible: boolean
  roomName: string
  roomStatus: string
  createSubmitting: boolean
  createError: string
  editingRoomId: string | null
  editName: string
  editStatus: string
  editSubmitting: boolean
  editError: string
  importVisible: boolean
  importPreview: ImportPreviewFixture | null
  importSubmitting: boolean
  importError: string
  importResult: {
    created: number
    skipped: number
    overwritten: number
    failed: number
    errors: Array<{ row: number; error: string }>
  } | null
  isRoomAdmin: boolean
  loadRooms: () => Promise<void>
  openCreateForm: () => void
  cancelCreate: () => void
  onCreateRoom: () => Promise<void>
  startEdit: (room: RoomFixture) => void
  cancelEdit: () => void
  saveEdit: (room: RoomFixture) => Promise<void>
  openImport: () => void
  cancelImport: () => void
  uploadPreview: (file: File) => Promise<void>
  submitImport: () => Promise<void>
  closeResult: () => void
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

function readSetupField<T>(state: HomeViewSetupState, field: keyof HomeViewSetupState): T {
  const raw = state[field]
  if (raw !== null && typeof raw === 'object' && 'value' in (raw as object)) {
    return (raw as { value: T }).value
  }
  return raw as T
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

let roomIdCounter = 0

function nextRoomId(): string {
  roomIdCounter += 1
  return `room-id-${roomIdCounter}`
}

function mockRoomsGet(data: RoomFixture[]) {
  return {
    ok: true as const,
    data,
    headers: new Headers(),
    status: 200,
  }
}

/**
 * Shared HomeView setup bindings + real renderToString HTML for the same instance.
 * Needed so edit/create interactions are visible in subsequent html() calls.
 */
async function mountSharedHomeView(): Promise<{
  state: HomeViewSetupState
  html: () => Promise<string>
  writeField: <T>(field: keyof HomeViewSetupState, value: T) => void
  unmount: () => void
}> {
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

  const writeField = <T,>(field: keyof HomeViewSetupState, value: T): void => {
    const raw = bindings![field as string]
    if (raw !== null && typeof raw === 'object' && 'value' in (raw as object)) {
      ;(raw as { value: T }).value = value
      return
    }
    ;(bindings as Record<string, unknown>)[field as string] = value
  }

  return {
    state,
    html: renderRealHtml,
    writeField,
    unmount: () => {
      component.setup = originalSetup
      bindings = null
    },
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
  roomIdCounter = 0
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
  it('renders the room list section', async () => {
    userMock.value = { id: '1', username: 'admin', role: 'Admin' }

    const html = await renderHomeViewHtml()

    expect(html).toContain('aria-label="机房列表"')
  })
})

describe('HomeView readonly room list (G09-03)', () => {
  const forbiddenControls = ['创建', '删除', '详情', '搜索', '排序', '筛选', '分页']

  it('shows room names and enabled/disabled status after a successful API response', async () => {
    userMock.value = { id: '1', username: 'admin', role: '机房管理员' }
    requestMock.mockResolvedValue({
      ok: true,
      data: [
        { id: 'room-1', name: '机房A', status: '启用' },
        { id: 'room-2', name: '机房B', status: '停用' },
      ],
      headers: new Headers(),
      status: 200,
    })

    const state = await mountHomeViewState()
    await state.loadRooms()
    const html = await renderHomeViewHtml()

    expect(requestMock).toHaveBeenCalledWith('/api/rooms', { method: 'GET' })
    expect(state.rooms).toEqual([
      { id: 'room-1', name: '机房A', status: '启用' },
      { id: 'room-2', name: '机房B', status: '停用' },
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

  it('keeps the room list region free of create/edit/delete and related controls for non-admin', async () => {
    userMock.value = { id: '1', username: 'viewer', role: '只读查看人员' }
    requestMock.mockResolvedValue({
      ok: true,
      data: [{ id: 'room-1', name: '机房A', status: '启用' }],
      headers: new Headers(),
      status: 200,
    })

    const view = await mountSharedHomeView()
    try {
      const html = await view.html()
      const listMatch = html.match(/<section[^>]*aria-label="机房列表"[^>]*>[\s\S]*?<\/section>/)
      expect(listMatch).not.toBeNull()
      const listHtml = listMatch?.[0] ?? ''

      expect(readSetupField<RoomFixture[] | null>(view.state, 'rooms')).toEqual([
        { id: 'room-1', name: '机房A', status: '启用' },
      ])
      expect(listHtml).not.toContain('编辑')
      for (const label of forbiddenControls) {
        expect(listHtml).not.toContain(label)
      }
    } finally {
      view.unmount()
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
    let listData: RoomFixture[] = [{ id: 'room-1', name: '旧机房', status: '启用' }]
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
          { id: 'room-1', name: '旧机房', status: '启用' },
          { id: 'room-2', name: '主机房', status: '启用' },
        ]
        return {
          ok: true,
          data: { id: 'room-2', name: '主机房', status: '启用' },
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
      return mockRoomsGet([{ id: 'room-1', name: '主机房', status: '启用' }])
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
          data: { id: 'room-2', name: '主机房', status: '启用' },
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
    requestMock.mockResolvedValue(mockRoomsGet([{ id: 'room-1', name: '机房A', status: '启用' }]))

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

describe('HomeView edit room', () => {
  it('shows edit button for 机房管理员 and hides for other roles', async () => {
    userMock.value = { id: '1', username: 'admin', role: '机房管理员' }
    requestMock.mockResolvedValue(
      mockRoomsGet([{ id: 'room-1', name: '机房A', status: '启用' }]),
    )

    const adminView = await mountSharedHomeView()
    try {
      const html = await adminView.html()
      expect(html).toContain('编辑')
    } finally {
      adminView.unmount()
    }

    for (const role of ['运维人员', 'DBA/应用运维人员', '只读查看人员']) {
      userMock.value = { id: '1', username: 'user', role }
      requestMock.mockResolvedValue(
        mockRoomsGet([{ id: 'room-1', name: '机房A', status: '启用' }]),
      )
      const view = await mountSharedHomeView()
      try {
        const html = await view.html()
        expect(html).not.toContain('编辑')
      } finally {
        view.unmount()
      }
    }
  })

  it('opens edit form with pre-filled values from the room', async () => {
    userMock.value = { id: '1', username: 'admin', role: '机房管理员' }
    requestMock.mockResolvedValue(
      mockRoomsGet([{ id: 'room-1', name: '主机房', status: '停用' }]),
    )

    const view = await mountSharedHomeView()
    try {
      view.state.startEdit({ id: 'room-1', name: '主机房', status: '停用' })
      await flushUi()

      const html = await view.html()
      expect(html).toMatch(/name="editName"/)
      expect(html).toMatch(/name="editStatus"/)
      expect(html).toContain('value="主机房"')
      expect(html).toMatch(/<option[^>]*value="停用"[^>]*selected/)
      expect(html).toContain('保存')
      expect(html).toContain('取消')
    } finally {
      view.unmount()
    }
  })

  it('sends PUT with correct id, reloads list, and shows updated values', async () => {
    userMock.value = { id: '1', username: 'admin', role: '机房管理员' }
    let getData: RoomFixture[] = [{ id: 'room-1', name: '旧名', status: '启用' }]

    requestMock.mockImplementation(
      async (path: string, options: { method?: string; body?: unknown; csrfToken?: string } = {}) => {
        if (path === '/api/auth/csrf') {
          return {
            ok: true,
            data: undefined,
            headers: new Headers({ 'X-XSRF-TOKEN': 'csrf-edit-1' }),
            status: 200,
          }
        }
        if (path === '/api/rooms/room-1' && options.method === 'PUT') {
          getData = [{ id: 'room-1', name: '新名', status: '停用' }]
          return {
            ok: true,
            data: { id: 'room-1', name: '新名', status: '停用' },
            headers: new Headers(),
            status: 200,
          }
        }
        if (path === '/api/rooms') {
          return mockRoomsGet(getData)
        }
        return { ok: false, error: 'unexpected', status: 500 }
      },
    )

    const view = await mountSharedHomeView()
    try {
      view.state.startEdit({ id: 'room-1', name: '旧名', status: '启用' })
      view.writeField('editName', '新名')
      view.writeField('editStatus', '停用')
      await view.state.saveEdit({ id: 'room-1', name: '旧名', status: '启用' })
      await flushUi()

      const putCalls = requestMock.mock.calls.filter(
        (call) => call[0] === '/api/rooms/room-1' && call[1]?.method === 'PUT',
      )
      expect(putCalls.length).toBe(1)
      expect(putCalls[0]?.[1]).toMatchObject({
        method: 'PUT',
        body: { name: '新名', status: '停用' },
        csrfToken: 'csrf-edit-1',
      })

      expect(readSetupField<string | null>(view.state, 'editingRoomId')).toBeNull()

      const html = await view.html()
      expect(html).toContain('新名')
      expect(html).toContain('停用')
      expect(html).not.toContain('旧名')
    } finally {
      view.unmount()
    }
  })

  it('keeps edit form open with input retained on duplicate name error', async () => {
    userMock.value = { id: '1', username: 'admin', role: '机房管理员' }
    requestMock.mockImplementation(
      async (path: string, options: { method?: string } = {}) => {
        if (path === '/api/auth/csrf') {
          return {
            ok: true,
            data: undefined,
            headers: new Headers({ 'X-XSRF-TOKEN': 'csrf-dup' }),
            status: 200,
          }
        }
        if (path === '/api/rooms/room-1' && options.method === 'PUT') {
          return { ok: false, error: '机房名称已存在', status: 409 }
        }
        return mockRoomsGet([{ id: 'room-1', name: '机房A', status: '启用' }])
      },
    )

    const view = await mountSharedHomeView()
    try {
      view.state.startEdit({ id: 'room-1', name: '机房A', status: '启用' })
      view.writeField('editName', '重复名')
      await view.state.saveEdit({ id: 'room-1', name: '机房A', status: '启用' })
      await flushUi()

      expect(readSetupField<string | null>(view.state, 'editingRoomId')).toBe('room-1')
      expect(readSetupField<string>(view.state, 'editName')).toBe('重复名')
      expect(readSetupField<string>(view.state, 'editError')).toBe('机房名称已存在')

      const html = await view.html()
      expect(html).toContain('机房名称已存在')
      expect(html).toMatch(/name="editName"/)
      expect(html).toContain('value="重复名"')
    } finally {
      view.unmount()
    }
  })

  it('cancel restores display row without sending PUT', async () => {
    userMock.value = { id: '1', username: 'admin', role: '机房管理员' }
    requestMock.mockResolvedValue(
      mockRoomsGet([{ id: 'room-1', name: '机房A', status: '启用' }]),
    )

    const view = await mountSharedHomeView()
    try {
      view.state.startEdit({ id: 'room-1', name: '机房A', status: '启用' })
      view.writeField('editName', '暂不保存')
      view.state.cancelEdit()
      await flushUi()

      expect(readSetupField<string | null>(view.state, 'editingRoomId')).toBeNull()

      const html = await view.html()
      expect(html).toContain('机房A')
      expect(html).toContain('编辑')
      expect(html).not.toMatch(/name="editName"/)

      const putCalls = requestMock.mock.calls.filter(
        (call) => call[1]?.method === 'PUT',
      )
      expect(putCalls.length).toBe(0)
    } finally {
      view.unmount()
    }
  })

  it('disables save button while edit-submitting to prevent duplicate PUT', async () => {
    userMock.value = { id: '1', username: 'admin', role: '机房管理员' }
    let resolvePut!: (value: unknown) => void
    const putGate = new Promise((resolve) => {
      resolvePut = resolve
    })

    requestMock.mockImplementation(
      async (path: string, options: { method?: string } = {}) => {
        if (path === '/api/auth/csrf') {
          return {
            ok: true,
            data: undefined,
            headers: new Headers({ 'X-XSRF-TOKEN': 'csrf-gate' }),
            status: 200,
          }
        }
        if (path === '/api/rooms/room-1' && options.method === 'PUT') {
          await putGate
          return {
            ok: true,
            data: { id: 'room-1', name: '主机房', status: '启用' },
            headers: new Headers(),
            status: 200,
          }
        }
        return mockRoomsGet([{ id: 'room-1', name: '旧名', status: '启用' }])
      },
    )

    const view = await mountSharedHomeView()
    try {
      view.state.startEdit({ id: 'room-1', name: '旧名', status: '启用' })
      view.writeField('editName', '主机房')

      const submitPromise = view.state.saveEdit({ id: 'room-1', name: '旧名', status: '启用' })
      await flushUi()

      const html = await view.html()
      // 保存按钮文字变为保存中...且 disabled
      const saveMatch = html.match(
        /<button[^>]*type="button"[^>]*disabled[^>]*>\s*保存中\.\.\.\s*<\/button>/,
      )
      expect(saveMatch).not.toBeNull()

      // 二次保存不产生新 PUT
      await view.state.saveEdit({ id: 'room-1', name: '旧名', status: '启用' })
      await Promise.resolve()
      const putCalls = requestMock.mock.calls.filter(
        (call) => call[0] === '/api/rooms/room-1' && call[1]?.method === 'PUT',
      )
      expect(putCalls.length).toBe(1)

      resolvePut(undefined)
      await submitPromise
      await flushUi()
    } finally {
      view.unmount()
    }
  })

  it('hides create button during edit and hides edit buttons during create', async () => {
    userMock.value = { id: '1', username: 'admin', role: '机房管理员' }
    requestMock.mockResolvedValue(
      mockRoomsGet([{ id: 'room-1', name: '机房A', status: '启用' }]),
    )

    const view = await mountSharedHomeView()
    try {
      // 初始状态：新增和编辑按钮都可见
      let html = await view.html()
      expect(html).toContain('新增机房')
      expect(html).toContain('编辑')

      // 进入编辑：新增按钮和新增表单均消失，编辑表单出现
      view.state.startEdit({ id: 'room-1', name: '机房A', status: '启用' })
      await flushUi()
      html = await view.html()
      expect(html).not.toContain('新增机房')
      expect(html).not.toMatch(/name="roomName"/)
      expect(html).toMatch(/name="editName"/)

      // 取消编辑：新增按钮恢复
      view.state.cancelEdit()
      await flushUi()
      html = await view.html()
      expect(html).toContain('新增机房')

      // 打开新增表单：编辑按钮和编辑表单均消失，新增表单出现
      view.state.openCreateForm()
      await flushUi()
      html = await view.html()
      expect(html).not.toContain('编辑')
      expect(html).not.toMatch(/name="editName"/)
      expect(html).toMatch(/name="roomName"/)

      // 取消新增：编辑按钮恢复
      view.state.cancelCreate()
      await flushUi()
      html = await view.html()
      expect(html).toContain('编辑')
    } finally {
      view.unmount()
    }
  })
})

describe('HomeView import racks', () => {
  const previewRow = (overrides: Partial<ImportRowFixture> = {}): ImportRowFixture => ({
    row: 2,
    code: 'R001',
    roomName: '主机房',
    roomId: 'room-1',
    heightU: 42,
    brand: '华为',
    power: 5.5,
    notes: '核心机柜',
    x: 1,
    y: 2,
    z: 1,
    errors: [],
    duplicate: false,
    existingRackId: null,
    action: 'create',
    ...overrides,
  })

  it('shows import button for any authenticated user', async () => {
    userMock.value = { id: '1', username: 'user', role: '只读查看人员' }
    requestMock.mockResolvedValue(mockRoomsGet([]))
    const state = await mountHomeViewState()
    await state.loadRooms()

    const html = await renderHomeViewHtml()

    expect(html).toContain('Excel 导入机柜')
  })

  it('opens file input after clicking import', async () => {
    userMock.value = { id: '1', username: 'admin', role: '机房管理员' }
    requestMock.mockResolvedValue(mockRoomsGet([]))
    const view = await mountSharedHomeView()
    try {
      view.state.openImport()
      await flushUi()

      const html = await view.html()
      expect(html).toMatch(/type="file"/)
      expect(html).toMatch(/accept="\.xlsx"/)
    } finally {
      view.unmount()
    }
  })

  it('cancel clears import area', async () => {
    userMock.value = { id: '1', username: 'admin', role: '机房管理员' }
    requestMock.mockResolvedValue(mockRoomsGet([]))
    const view = await mountSharedHomeView()
    try {
      view.state.openImport()
      view.state.cancelImport()
      await flushUi()

      const html = await view.html()
      expect(html).not.toMatch(/type="file"/)
    } finally {
      view.unmount()
    }
  })

  it('uploads a file and renders the preview rows', async () => {
    userMock.value = { id: '1', username: 'user', role: '运维人员' }
    requestMock.mockImplementation(async (path: string) => {
      if (path === '/api/auth/csrf') {
        return {
          ok: true,
          data: undefined,
          headers: new Headers({ 'X-XSRF-TOKEN': 'preview-token' }),
          status: 200,
        }
      }
      return mockRoomsGet([])
    })
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          rows: [previewRow()],
          totalRows: 1,
          validRows: 1,
          errorRows: 0,
          duplicateRows: 0,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    vi.stubGlobal('fetch', mockFetch)

    const view = await mountSharedHomeView()
    try {
      view.state.openImport()
      await view.state.uploadPreview(
        new File(['workbook'], 'racks.xlsx', {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }),
      )
      await flushUi()

      const html = await view.html()
      expect(html).toContain('R001')
      expect(html).toContain('主机房')
      expect(html).toContain('核心机柜')
      expect(html).toContain('共 1 行，1 有效，0 错误，0 重复')
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/racks/import-preview',
        expect.objectContaining({ method: 'POST', credentials: 'include' }),
      )
    } finally {
      view.unmount()
    }
  })

  it('shows overwrite and skip choices for a duplicate row with mandatory selection gate', async () => {
    userMock.value = { id: '1', username: 'admin', role: '机房管理员' }
    requestMock.mockResolvedValue(mockRoomsGet([]))
    const view = await mountSharedHomeView()
    try {
      view.state.openImport()
      view.writeField<ImportPreviewFixture>('importPreview', {
        rows: [
          previewRow({
            duplicate: true,
            existingRackId: 'rack-1',
            action: '',
          }),
        ],
        totalRows: 1,
        validRows: 1,
        errorRows: 0,
        duplicateRows: 1,
      })
      await flushUi()

      const html = await view.html()
      // 占位选项存在
      expect(html).toMatch(/<option[^>]*value=""[^>]*disabled[^>]*>请选择<\/option>/)
      // 覆盖/跳过选项存在
      expect(html).toMatch(/<option[^>]*value="skip"[^>]*>跳过<\/option>/)
      expect(html).toMatch(/<option[^>]*value="overwrite"[^>]*>覆盖<\/option>/)
      expect(html).toContain('重复')
      // 确认按钮因空选择被禁用
      expect(html).toMatch(/<button[^>]*disabled[^>]*>\s*确认导入\s*<\/button>/)

      // 选择覆盖后确认按钮恢复
      view.writeField<ImportPreviewFixture>('importPreview', {
        rows: [
          previewRow({
            duplicate: true,
            existingRackId: 'rack-1',
            action: 'overwrite',
          }),
        ],
        totalRows: 1,
        validRows: 1,
        errorRows: 0,
        duplicateRows: 1,
      })
      await flushUi()
      const afterSelect = await view.html()
      expect(afterSelect).not.toMatch(/<button[^>]*disabled[^>]*>\s*确认导入\s*<\/button>/)
    } finally {
      view.unmount()
    }
  })

  it('shows result counts after confirming import', async () => {
    userMock.value = { id: '1', username: 'admin', role: '机房管理员' }
    requestMock.mockImplementation(async (path: string) => {
      if (path === '/api/auth/csrf') {
        return {
          ok: true,
          data: undefined,
          headers: new Headers({ 'X-XSRF-TOKEN': 'import-token' }),
          status: 200,
        }
      }
      if (path === '/api/racks/import') {
        return {
          ok: true,
          data: { created: 3, skipped: 1, overwritten: 2, failed: 1, errors: [] },
          headers: new Headers(),
          status: 200,
        }
      }
      return mockRoomsGet([])
    })

    const view = await mountSharedHomeView()
    try {
      view.state.openImport()
      view.writeField<ImportPreviewFixture>('importPreview', {
        rows: [previewRow()],
        totalRows: 1,
        validRows: 1,
        errorRows: 0,
        duplicateRows: 0,
      })
      await view.state.submitImport()
      await flushUi()

      const html = await view.html()
      expect(html).toContain('导入完成：新增 3，跳过 1，覆盖 2，失败 1')
      expect(html).toMatch(/<button[^>]*>关闭<\/button>/)
      expect(requestMock).toHaveBeenCalledWith(
        '/api/racks/import',
        expect.objectContaining({ method: 'POST', csrfToken: 'import-token' }),
      )
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
