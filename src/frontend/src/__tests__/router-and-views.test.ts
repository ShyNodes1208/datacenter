import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createMemoryHistory, createRouter } from 'vue-router'
import LoginView from '../views/LoginView.vue'

const loginMock = vi.fn()
const pushMock = vi.fn()

vi.mock('../composables/useAuth', () => ({
  useAuth: () => ({
    login: (...args: unknown[]) => loginMock(...args),
  }),
}))

vi.mock('vue-router', async () => {
  const actual = await vi.importActual<typeof import('vue-router')>('vue-router')
  return {
    ...actual,
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

afterEach(() => {
  loginMock.mockReset()
  pushMock.mockReset()
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
