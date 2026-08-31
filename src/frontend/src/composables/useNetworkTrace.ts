import { useApi } from './useApi'

export type NetworkPathDevice = {
  deviceId: string
  deviceName: string
  deviceType: string
  rackCode: string | null
}

export type NetworkPathHop = {
  fromDeviceId: string
  fromDeviceName: string
  fromPortId: string
  fromPortName: string
  cableId: string
  cableType: string
  toDeviceId: string
  toDeviceName: string
  toPortId: string
  toPortName: string
}

export type NetworkPath = {
  pathFound: boolean
  warning: string
  reason: string | null
  devices: NetworkPathDevice[]
  hops: NetworkPathHop[]
}

export type ReachableEndpoint = {
  deviceId: string
  deviceName: string
  deviceType: string
  rackCode: string | null
  portId: string
  portName: string
  hopCount: number
}

export type ReachableNetworkPath = {
  warning: string
  maxHops: number
  totalEndpointCount: number
  returnedEndpointCount: number
  isTruncated: boolean
  endpoints: ReachableEndpoint[]
}

export type TraceResult<T> = {
  data: T | null
  error: string | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object'
}

function parsePathDevice(value: unknown): NetworkPathDevice | null {
  if (!isRecord(value)
    || typeof value.deviceId !== 'string'
    || typeof value.deviceName !== 'string'
    || typeof value.deviceType !== 'string') return null
  return {
    deviceId: value.deviceId,
    deviceName: value.deviceName,
    deviceType: value.deviceType,
    rackCode: typeof value.rackCode === 'string' ? value.rackCode : null,
  }
}

function parsePathHop(value: unknown): NetworkPathHop | null {
  if (!isRecord(value)) return null
  const keys = [
    'fromDeviceId', 'fromDeviceName', 'fromPortId', 'fromPortName', 'cableId',
    'cableType', 'toDeviceId', 'toDeviceName', 'toPortId', 'toPortName',
  ] as const
  if (keys.some(key => typeof value[key] !== 'string')) return null
  return {
    fromDeviceId: value.fromDeviceId as string,
    fromDeviceName: value.fromDeviceName as string,
    fromPortId: value.fromPortId as string,
    fromPortName: value.fromPortName as string,
    cableId: value.cableId as string,
    cableType: value.cableType as string,
    toDeviceId: value.toDeviceId as string,
    toDeviceName: value.toDeviceName as string,
    toPortId: value.toPortId as string,
    toPortName: value.toPortName as string,
  }
}

function parseNetworkPath(value: unknown): NetworkPath | null {
  if (!isRecord(value)
    || typeof value.pathFound !== 'boolean'
    || typeof value.warning !== 'string'
    || (value.reason !== null && typeof value.reason !== 'string')
    || (value.devices !== null && !Array.isArray(value.devices))
    || (value.hops !== null && !Array.isArray(value.hops))) return null

  const devices = (value.devices ?? []).map(parsePathDevice)
  const hops = (value.hops ?? []).map(parsePathHop)
  if (devices.some(device => device === null) || hops.some(hop => hop === null)) return null
  return {
    pathFound: value.pathFound,
    warning: value.warning,
    reason: typeof value.reason === 'string' ? value.reason : null,
    devices: devices as NetworkPathDevice[],
    hops: hops as NetworkPathHop[],
  }
}

function parseEndpoint(value: unknown): ReachableEndpoint | null {
  if (!isRecord(value)
    || typeof value.deviceId !== 'string'
    || typeof value.deviceName !== 'string'
    || typeof value.deviceType !== 'string'
    || typeof value.portId !== 'string'
    || typeof value.portName !== 'string'
    || typeof value.hopCount !== 'number') return null
  return {
    deviceId: value.deviceId,
    deviceName: value.deviceName,
    deviceType: value.deviceType,
    rackCode: typeof value.rackCode === 'string' ? value.rackCode : null,
    portId: value.portId,
    portName: value.portName,
    hopCount: value.hopCount,
  }
}

function parseReachableNetworkPath(value: unknown): ReachableNetworkPath | null {
  if (!isRecord(value)
    || typeof value.warning !== 'string'
    || typeof value.maxHops !== 'number'
    || typeof value.totalEndpointCount !== 'number'
    || typeof value.returnedEndpointCount !== 'number'
    || typeof value.isTruncated !== 'boolean'
    || !Array.isArray(value.endpoints)) return null
  const endpoints = value.endpoints.map(parseEndpoint)
  if (endpoints.some(endpoint => endpoint === null)) return null
  return {
    warning: value.warning,
    maxHops: value.maxHops,
    totalEndpointCount: value.totalEndpointCount,
    returnedEndpointCount: value.returnedEndpointCount,
    isTruncated: value.isTruncated,
    endpoints: endpoints as ReachableEndpoint[],
  }
}

export function useNetworkTrace() {
  const { request } = useApi()

  async function findPath(sourcePortId: string, targetServerId: string): Promise<TraceResult<NetworkPath>> {
    const params = new URLSearchParams({ sourcePortId, targetServerId })
    const result = await request<unknown>(`/api/network-path/by-port?${params.toString()}`, { method: 'GET' })
    if (!result.ok) return { data: null, error: result.error }
    const path = parseNetworkPath(result.data)
    return path ? { data: path, error: null } : { data: null, error: 'Request failed.' }
  }

  async function findReachable(sourcePortId: string, maxHops = 4): Promise<TraceResult<ReachableNetworkPath>> {
    if (maxHops < 1 || maxHops > 10) {
      return { data: null, error: '最大跳数必须在 1 到 10 之间' }
    }
    const params = new URLSearchParams({ sourcePortId, maxHops: String(maxHops), limit: '100' })
    const result = await request<unknown>(`/api/network-path/reachable?${params.toString()}`, { method: 'GET' })
    if (!result.ok) return { data: null, error: result.error }
    const path = parseReachableNetworkPath(result.data)
    return path ? { data: path, error: null } : { data: null, error: 'Request failed.' }
  }

  return { findPath, findReachable }
}
