import { createRouter, createWebHistory } from 'vue-router'
import { useAuth } from './composables/useAuth'
import LoginView from './views/LoginView.vue'

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
  }
}

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', component: LoginView },
    { path: '/', redirect: '/rooms' },
    { path: '/rooms', component: () => import('./views/RoomListPage.vue'), meta: { requiresAuth: true } },
    { path: '/rooms/:id', component: () => import('./views/RoomDetailPage.vue'), meta: { requiresAuth: true } },
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
