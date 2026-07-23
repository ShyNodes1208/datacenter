import { createRouter, createWebHistory } from 'vue-router'
import { useAuth } from './composables/useAuth'
import HomeView from './views/HomeView.vue'
import LoginView from './views/LoginView.vue'
import RackDeviceView from './views/RackDeviceView.vue'
import ServerListView from './views/ServerListView.vue'
import ServerDetailView from './views/ServerDetailView.vue'
import ServerFormView from './views/ServerFormView.vue'

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
  }
}

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', component: LoginView },
    { path: '/', component: HomeView, meta: { requiresAuth: true } },
    { path: '/racks/:id', component: RackDeviceView, meta: { requiresAuth: true } },
    { path: '/servers', component: ServerListView, meta: { requiresAuth: true } },
    { path: '/servers/new', component: ServerFormView, meta: { requiresAuth: true } },
    { path: '/servers/:id/edit', component: ServerFormView, meta: { requiresAuth: true } },
    { path: '/servers/:id', component: ServerDetailView, meta: { requiresAuth: true } },
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
