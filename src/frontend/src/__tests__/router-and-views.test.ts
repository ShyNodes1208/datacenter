import { describe, expect, it } from 'vitest'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createMemoryHistory, createRouter } from 'vue-router'
import LoginView from '../views/LoginView.vue'

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

describe('LoginView render (U14-A)', () => {
  it('renders username input, password input, login button, and fixed error region', async () => {
    const html = await renderLoginViewHtml()

    expect(html).toMatch(/<input[^>]*name="username"[^>]*type="text"/)
    expect(html).toMatch(/<input[^>]*name="password"[^>]*type="password"/)
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*>登录<\/button>/)
    expect(html).toMatch(/<div[^>]*role="alert"[^>]*aria-live="polite"/)
  })
})
