import { defineComponent, h } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import { useAuth } from './composables/useAuth'

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
  }
}

/** Outlet shells only — page UI is out of U05/U11 scope. */
const RouteShell = defineComponent({
  name: 'RouteShell',
  setup() {
    return () => h('div')
  },
})

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', component: RouteShell },
    { path: '/', component: RouteShell, meta: { requiresAuth: true } },
  ],
})

router.beforeEach(async (to) => {
  const { user, restore } = useAuth()
  await restore()

  const isAuthenticated = user.value !== null

  if (to.meta.requiresAuth && !isAuthenticated) {
    return to.path === '/login' ? true : '/login'
  }

  if (to.path === '/login' && isAuthenticated) {
    return '/'
  }

  return true
})
