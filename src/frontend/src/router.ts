import { defineComponent, h } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'

/** Outlet shells only — page UI is out of U05 scope. */
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
    { path: '/', component: RouteShell },
  ],
})
