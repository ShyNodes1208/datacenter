<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useApi } from '../composables/useApi'

type ServerDetail = {
  id: string
  name: string
  managementIP: string
  assetNumber: string | null
  deviceType: string
  deviceHeight: number
  operationalStatus: string
  positionStatus: string
  system: string | null
  owner: string | null
  notes: string | null
}

const route = useRoute()
const router = useRouter()
const { request } = useApi()

const serverId = computed(() => route.params.id as string | undefined)
const isEdit = computed(() => serverId.value !== undefined)
const title = computed(() => (isEdit.value ? '编辑服务器' : '新增服务器'))

const name = ref('')
const managementIP = ref('')
const assetNumber = ref('')
const deviceType = ref('')
const deviceHeight = ref<number | ''>('')
const system = ref('')
const owner = ref('')
const notes = ref('')
const positionStatus = ref('')

const submitting = ref(false)
const error = ref('')
const validationErrors = ref<string[]>([])
const loading = ref(false)

async function loadServer(): Promise<void> {
  if (!isEdit.value) return

  loading.value = true
  error.value = ''

  const result = await request<unknown>(`/api/servers/${serverId.value}`, { method: 'GET' })
  if (!result.ok) {
    error.value = result.error
    loading.value = false
    return
  }

  const data = result.data
  if (data === null || typeof data !== 'object') {
    error.value = 'Request failed.'
    loading.value = false
    return
  }

  const record = data as Record<string, unknown>

  name.value = typeof record.name === 'string' ? record.name : ''
  managementIP.value = typeof record.managementIP === 'string' ? record.managementIP : ''
  assetNumber.value = typeof record.assetNumber === 'string' ? record.assetNumber : ''
  deviceType.value = typeof record.deviceType === 'string' ? record.deviceType : ''
  deviceHeight.value = typeof record.deviceHeight === 'number' ? record.deviceHeight : ''
  system.value = typeof record.system === 'string' ? record.system : ''
  owner.value = typeof record.owner === 'string' ? record.owner : ''
  notes.value = typeof record.notes === 'string' ? record.notes : ''
  positionStatus.value = typeof record.positionStatus === 'string' ? record.positionStatus : ''

  loading.value = false
}

function validate(): boolean {
  const errors: string[] = []

  if (!name.value.trim()) errors.push('名称不能为空')
  if (!managementIP.value.trim()) errors.push('管理 IP 不能为空')
  if (!deviceType.value.trim()) errors.push('设备类型不能为空')

  if (deviceHeight.value === '' || deviceHeight.value === null) {
    errors.push('设备高度不能为空')
  } else if (typeof deviceHeight.value === 'number' && deviceHeight.value < 1) {
    errors.push('设备高度必须大于等于 1')
  }

  validationErrors.value = errors
  return errors.length === 0
}

async function fetchCsrfToken(): Promise<string | null> {
  const result = await request('/api/auth/csrf', { method: 'GET' })
  if (!result.ok) {
    error.value = result.error
    return null
  }
  const token = result.headers.get('X-XSRF-TOKEN')
  if (!token) {
    error.value = 'Request failed.'
    return null
  }
  return token
}

async function onSubmit(): Promise<void> {
  if (submitting.value) return

  if (!validate()) return

  submitting.value = true
  error.value = ''

  const token = await fetchCsrfToken()
  if (token === null) {
    submitting.value = false
    return
  }

  const body = {
    name: name.value.trim(),
    managementIP: managementIP.value.trim(),
    assetNumber: assetNumber.value.trim() || undefined,
    deviceType: deviceType.value.trim(),
    deviceHeight: typeof deviceHeight.value === 'number' ? deviceHeight.value : Number(deviceHeight.value),
    system: system.value.trim() || undefined,
    owner: owner.value.trim() || undefined,
    notes: notes.value.trim() || undefined,
  }

  if (isEdit.value) {
    const result = await request<unknown>(`/api/servers/${serverId.value}`, {
      method: 'PUT',
      body,
      csrfToken: token,
    })

    if (!result.ok) {
      error.value = result.error
      submitting.value = false
      return
    }

    router.push(`/servers/${serverId.value}`)
  } else {
    const result = await request<unknown>('/api/servers', {
      method: 'POST',
      body,
      csrfToken: token,
    })

    if (!result.ok) {
      error.value = result.error
      submitting.value = false
      return
    }

    const data = result.data
    if (data !== null && typeof data === 'object' && typeof (data as Record<string, unknown>).id === 'string') {
      router.push(`/servers/${(data as Record<string, unknown>).id as string}`)
    } else {
      router.push('/servers')
    }
  }

  submitting.value = false
}

function onCancel(): void {
  if (isEdit.value) {
    router.push(`/servers/${serverId.value}`)
  } else {
    router.push('/servers')
  }
}

onMounted(() => {
  void loadServer()
})
</script>

<template>
  <div>
    <h2>{{ title }}</h2>

    <div v-if="loading">加载中...</div>

    <div v-if="error" role="alert" aria-live="polite">{{ error }}</div>

    <div v-if="validationErrors.length" role="alert" aria-live="polite" style="color: red; margin-bottom: 0.5em">
      <p v-for="(err, i) in validationErrors" :key="i" style="margin: 0">{{ err }}</p>
    </div>

    <form v-if="!loading" @submit.prevent="onSubmit" style="display: flex; flex-direction: column; gap: 0.5em; max-width: 400px">
      <label>
        名称
        <input v-model="name" type="text" />
      </label>
      <label>
        管理 IP
        <input v-model="managementIP" type="text" />
      </label>
      <label>
        资产编号
        <input v-model="assetNumber" type="text" placeholder="选填" />
      </label>
      <label>
        设备类型
        <input v-model="deviceType" type="text" />
      </label>
      <label>
        设备高度
        <input v-model.number="deviceHeight" type="number" min="1" />
      </label>
      <label>
        所属系统
        <input v-model="system" type="text" placeholder="选填" />
      </label>
      <label>
        负责人
        <input v-model="owner" type="text" placeholder="选填" />
      </label>
      <label v-if="isEdit">
        位置状态
        <input :value="positionStatus" type="text" readonly disabled />
      </label>
      <label>
        备注
        <textarea v-model="notes" rows="3" placeholder="选填"></textarea>
      </label>

      <div style="display: flex; gap: 0.5em; margin-top: 0.5em">
        <button type="submit" :disabled="submitting">
          {{ submitting ? '保存中...' : '保存' }}
        </button>
        <button type="button" :disabled="submitting" @click="onCancel">取消</button>
      </div>
    </form>
  </div>
</template>
