/**
 * Playwright F2 harness: real Vue client mount so @click.stop on rack-hit-target
 * is registered by Vue (not static HTML + manual listeners).
 */
import { createApp, defineComponent, h } from 'vue'
import { createRouter, createMemoryHistory, RouterView } from 'vue-router'
import TopologyView from '../views/TopologyView.vue'

/** Same corridor fixture as topology.test.ts F2 (k1 left rack). */
const corridorScene = {
  racks: [
    { rackId: 'k1', code: 'R1', x: 80, y: 110, width: 240, height: 200 },
    { rackId: 'k2', code: 'R2', x: 420, y: 110, width: 240, height: 200 },
    { rackId: 'k3', code: 'R3', x: 760, y: 110, width: 240, height: 200 },
  ],
  devices: [
    { deviceId: 'd1', deviceName: 'a', rackId: 'k1', deviceType: '服务器', operationalStatus: '正常', startU: 1, endU: 2 },
    { deviceId: 'd2', deviceName: 'b', rackId: 'k2', deviceType: '交换机', operationalStatus: '正常', startU: 1, endU: 1 },
    { deviceId: 'd3', deviceName: 'c', rackId: 'k3', deviceType: '服务器', operationalStatus: '正常', startU: 1, endU: 2 },
  ],
  cables: [
    {
      cableId: 'c-mgmt', cableType: '网线', purpose: '正常', status: '正常',
      source: { deviceId: 'd1', deviceName: 'a', portName: 'eth0', speed: '1G', rackId: 'k1', rackCode: 'R1' },
      target: { deviceId: 'd2', deviceName: 'b', portName: 'GE0/1', speed: '1G', rackId: 'k2', rackCode: 'R2' },
    },
    {
      cableId: 'c-biz', cableType: '光纤', purpose: '存储', status: '正常',
      source: { deviceId: 'd1', deviceName: 'a', portName: 'eth1', speed: '10G', rackId: 'k1', rackCode: 'R1' },
      target: { deviceId: 'd3', deviceName: 'c', portName: 'eth0', speed: '10G', rackId: 'k3', rackCode: 'R3' },
    },
    {
      cableId: 'c-alert', cableType: '铜缆', purpose: '上联', status: '告警',
      source: { deviceId: 'd1', deviceName: 'a', portName: 'eth2', speed: '10G', rackId: 'k1', rackCode: 'R1' },
      target: { deviceId: 'd2', deviceName: 'b', portName: 'GE0/2', speed: '10G', rackId: 'k2', rackCode: 'R2' },
    },
  ],
}

const topologyPayload = {
  rooms: [{
    id: 'r1',
    name: '主机房',
    status: '启用',
    location: 'A区',
    topologyX: 0,
    topologyY: 0,
    rackCount: corridorScene.racks.length,
    serverCount: corridorScene.devices.length,
    cableCount: corridorScene.cables.length,
  }],
  racks: corridorScene.racks.map((r) => ({ id: r.rackId, code: r.code, x: r.x, y: r.y })),
  connections: [] as unknown[],
}

const originalFetch = globalThis.fetch.bind(globalThis)
globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.href
      : input.url

  if (url.includes('/cable-scene')) {
    return new Response(JSON.stringify(corridorScene), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  if (url.includes('/rooms/topology')) {
    return new Response(JSON.stringify(topologyPayload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  if (url.includes('/api/auth/me')) {
    return new Response(JSON.stringify({ id: 'u1', username: 'admin', role: '机房管理员' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  if (url.includes('/api/auth/csrf')) {
    return new Response('{}', {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': 'harness-csrf' },
    })
  }
  return originalFetch(input, init)
}

const router = createRouter({
  history: createMemoryHistory(),
  routes: [{ path: '/topology', component: TopologyView }],
})

const HarnessRoot = defineComponent({
  name: 'RackHitHarnessRoot',
  setup() {
    return () => h(RouterView)
  },
})

async function boot(): Promise<void> {
  await router.push({ path: '/topology', query: { roomId: 'r1', view: 'devices' } })
  const app = createApp(HarnessRoot)
  app.use(router)
  app.mount('#app')
  await router.isReady()
}

boot().catch((err: unknown) => {
  const root = document.getElementById('app')
  const message = err instanceof Error ? err.message : String(err)
  if (root) {
    root.innerHTML = `<pre data-testid="rack-hit-harness-error">Harness boot failed: ${message}</pre>`
  }
  console.error(err)
})
