export interface Point {
  x: number
  y: number
}

export type CableFocus =
  | { level: 'room'; roomId: string }
  | { level: 'rack'; rackId: string }
  | { level: 'device'; deviceId: string }
  | { level: 'port'; portId: string }

export interface CableFilters {
  purposes: string[]
  cableTypes: string[]
}

export interface RackInfo {
  rackId: string
  code: string
  x: number
  y: number
  width: number
  height: number
}

export interface DeviceInfo {
  deviceId: string
  deviceName: string
  rackId: string
  deviceType: string
  startU: number
  endU: number
}

export interface EndpointInfo {
  deviceId: string
  deviceName: string
  portName: string
  rackId: string | null
  rackCode: string | null
}

export interface CableInfo {
  cableId: string
  cableType: string
  purpose: string
  source: EndpointInfo
  target: EndpointInfo
}

export interface CableSnapshot {
  racks: RackInfo[]
  devices: DeviceInfo[]
  cables: CableInfo[]
}

export interface CableBundle {
  id: string
  purpose: string
  cableType: string
  count: number
  sourceRackId: string
  targetRackId: string
  route: Point[]
  opacity: number
  highlighted: boolean
  isAggregated: boolean
}

export interface PortPath {
  cableId: string
  sourceLabel: string
  targetLabel: string
  route: Point[]
}

export interface LegendItem {
  purpose: string
  cableType: string
  color: string
  dashArray: string
  count: number
}

export interface DetailRow {
  sourceDevice: string
  sourcePort: string
  targetDevice: string
  targetPort: string
  cableType: string
  purpose: string
  sourceRack: string
  targetRack: string
}

export interface BreadcrumbItem {
  label: string
  level: CableFocus['level']
  id: string
}

export interface CableScene {
  bundles: CableBundle[]
  highlightedPath: PortPath | null
  legend: LegendItem[]
  detailRows: DetailRow[]
  breadcrumbs: BreadcrumbItem[]
}

export const PURPOSE_COLORS: Record<string, string> = {
  正常: '#3B82F6',
  存储: '#F59E0B',
  上联: '#10B981',
}

export const PURPOSE_DASH: Record<string, string> = {
  正常: 'none',
  存储: '6,4',
  上联: '2,4',
}

const DEFAULT_DEVICE: DeviceInfo = {
  deviceId: '',
  deviceName: '',
  rackId: '',
  deviceType: '',
  startU: 1,
  endU: 2,
}

export function rackCenter(r: RackInfo): Point {
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
}

export function deviceEdgePoint(
  device: DeviceInfo,
  rack: RackInfo,
  direction: 'left' | 'right' | 'top' | 'bottom',
): Point {
  const uHeight = device.endU - device.startU + 1
  const deviceTopY = rack.y + (device.startU - 1) * 20
  const deviceCenterY = deviceTopY + uHeight * 10

  switch (direction) {
    case 'left':
      return { x: rack.x, y: deviceCenterY }
    case 'right':
      return { x: rack.x + rack.width, y: deviceCenterY }
    case 'top':
      return { x: rackCenter(rack).x, y: deviceTopY }
    case 'bottom':
      return { x: rackCenter(rack).x, y: deviceTopY + uHeight * 20 }
  }
}

export function routeBetweenRacks(
  srcRack: RackInfo,
  srcDevice: DeviceInfo,
  tgtRack: RackInfo,
  tgtDevice: DeviceInfo,
): Point[] {
  const startEdge = srcRack.x + srcRack.width / 2 < tgtRack.x + tgtRack.width / 2 ? 'right' : 'left'
  const endEdge = srcRack.x + srcRack.width / 2 < tgtRack.x + tgtRack.width / 2 ? 'left' : 'right'

  const start = deviceEdgePoint(srcDevice, srcRack, startEdge)
  const end = deviceEdgePoint(tgtDevice, tgtRack, endEdge)
  const midX = (start.x + end.x) / 2

  return [start, { x: midX, y: start.y }, { x: midX, y: end.y }, end]
}

export function sameRackRoute(rack: RackInfo, src: DeviceInfo, tgt: DeviceInfo): Point[] {
  const start = deviceEdgePoint(src, rack, 'left')
  const end = deviceEdgePoint(tgt, rack, 'left')
  const midX = rack.x - 30
  return [start, { x: midX, y: start.y }, { x: midX, y: end.y }, end]
}

function bundleKey(c: CableInfo): string {
  const srcRack = c.source.rackId ?? '__none__'
  const tgtRack = c.target.rackId ?? '__none__'
  const [a, b] = srcRack < tgtRack ? [srcRack, tgtRack] : [tgtRack, srcRack]
  return `${a}|${b}|${c.purpose}|${c.cableType}`
}

function resolveDevice(
  deviceMap: Map<string, DeviceInfo>,
  deviceId: string,
  rackId: string,
  deviceName: string,
): DeviceInfo {
  return deviceMap.get(deviceId) ?? { ...DEFAULT_DEVICE, deviceId, deviceName, rackId }
}

function routeForCable(
  cable: CableInfo,
  rackMap: Map<string, RackInfo>,
  deviceMap: Map<string, DeviceInfo>,
): Point[] {
  const srcRackId = cable.source.rackId ?? '__none__'
  const tgtRackId = cable.target.rackId ?? '__none__'
  const srcRack = rackMap.get(srcRackId)
  const tgtRack = rackMap.get(tgtRackId)
  if (!srcRack || !tgtRack) return []

  const srcDevice = resolveDevice(deviceMap, cable.source.deviceId, srcRackId, cable.source.deviceName)
  const tgtDevice = resolveDevice(deviceMap, cable.target.deviceId, tgtRackId, cable.target.deviceName)

  if (srcRackId === tgtRackId) {
    return sameRackRoute(srcRack, srcDevice, tgtDevice)
  }
  return routeBetweenRacks(srcRack, srcDevice, tgtRack, tgtDevice)
}

export function aggregateCables(
  cables: CableInfo[],
  rackMap: Map<string, RackInfo>,
  devices: DeviceInfo[] = [],
): CableBundle[] {
  const deviceMap = new Map(devices.map(d => [d.deviceId, d]))
  const groups = new Map<string, CableInfo[]>()

  for (const c of cables) {
    const key = bundleKey(c)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(c)
  }

  const bundles: CableBundle[] = []
  for (const [key, group] of groups) {
    const parts = key.split('|')
    const sourceRackId = parts[0] ?? '__none__'
    const targetRackId = parts[1] ?? '__none__'
    const purpose = parts[2] ?? '正常'
    const cableType = parts[3] ?? ''

    const sample = group[0]
    const route = sample ? routeForCable(sample, rackMap, deviceMap) : []

    bundles.push({
      id: key,
      purpose,
      cableType,
      count: group.length,
      sourceRackId,
      targetRackId,
      route,
      opacity: 1,
      highlighted: false,
      isAggregated: group.length > 1,
    })
  }

  return bundles
}

function cableToBundle(
  c: CableInfo,
  rackMap: Map<string, RackInfo>,
  deviceMap: Map<string, DeviceInfo>,
  overrides: Partial<CableBundle> = {},
): CableBundle {
  return {
    id: c.cableId,
    purpose: c.purpose,
    cableType: c.cableType,
    count: 1,
    sourceRackId: c.source.rackId ?? '__none__',
    targetRackId: c.target.rackId ?? '__none__',
    route: routeForCable(c, rackMap, deviceMap),
    opacity: 1,
    highlighted: false,
    isAggregated: false,
    ...overrides,
  }
}

function bundleContainsDevice(bundleId: string, cables: CableInfo[], deviceId: string): boolean {
  return cables.some(
    c => bundleKey(c) === bundleId && (c.source.deviceId === deviceId || c.target.deviceId === deviceId),
  )
}

export function parsePortId(portId: string): { deviceId: string; portName: string } {
  const sep = portId.indexOf('|')
  if (sep === -1) return { deviceId: portId, portName: '' }
  return { deviceId: portId.slice(0, sep), portName: portId.slice(sep + 1) }
}

export function formatPortId(deviceId: string, portName: string): string {
  return `${deviceId}|${portName}`
}

function buildLegend(visibleCables: CableInfo[]): LegendItem[] {
  const legendMap = new Map<string, LegendItem>()
  for (const c of visibleCables) {
    const key = `${c.purpose}|${c.cableType}`
    if (!legendMap.has(key)) {
      legendMap.set(key, {
        purpose: c.purpose,
        cableType: c.cableType,
        color: PURPOSE_COLORS[c.purpose] ?? '#95a5a6',
        dashArray: PURPOSE_DASH[c.purpose] ?? 'none',
        count: 0,
      })
    }
    legendMap.get(key)!.count++
  }
  return Array.from(legendMap.values())
}

function buildDetailRows(visibleCables: CableInfo[]): DetailRow[] {
  return visibleCables.map(c => ({
    sourceDevice: c.source.deviceName,
    sourcePort: c.source.portName,
    targetDevice: c.target.deviceName,
    targetPort: c.target.portName,
    cableType: c.cableType,
    purpose: c.purpose,
    sourceRack: c.source.rackCode ?? '-',
    targetRack: c.target.rackCode ?? '-',
  }))
}

function buildBreadcrumbs(snapshot: CableSnapshot, focus: CableFocus, roomId: string): BreadcrumbItem[] {
  const rackMap = new Map(snapshot.racks.map(r => [r.rackId, r]))
  const deviceMap = new Map(snapshot.devices.map(d => [d.deviceId, d]))
  const items: BreadcrumbItem[] = []

  if (focus.level !== 'room') {
    items.push({ label: '机柜总览', level: 'room', id: roomId })
  }

  if (focus.level === 'rack') {
    const rack = rackMap.get(focus.rackId)
    items.push({ label: rack?.code ?? focus.rackId, level: 'rack', id: focus.rackId })
    return items
  }

  if (focus.level === 'device') {
    const device = deviceMap.get(focus.deviceId)
    const rack = device ? rackMap.get(device.rackId) : undefined
    if (rack) {
      items.push({ label: rack.code, level: 'rack', id: rack.rackId })
    }
    items.push({ label: device?.deviceName ?? focus.deviceId, level: 'device', id: focus.deviceId })
    return items
  }

  if (focus.level === 'port') {
    const { deviceId, portName } = parsePortId(focus.portId)
    const device = deviceMap.get(deviceId)
    const rack = device ? rackMap.get(device.rackId) : undefined
    if (rack) {
      items.push({ label: rack.code, level: 'rack', id: rack.rackId })
    }
    if (device) {
      items.push({ label: device.deviceName, level: 'device', id: device.deviceId })
    }
    items.push({ label: portName || focus.portId, level: 'port', id: focus.portId })
  }

  return items
}

export function buildCableScene(
  snapshot: CableSnapshot,
  focus: CableFocus,
  filters: CableFilters,
  roomId: string,
): CableScene {
  const rackMap = new Map(snapshot.racks.map(r => [r.rackId, r]))
  const deviceMap = new Map(snapshot.devices.map(d => [d.deviceId, d]))

  let visibleCables = snapshot.cables
  if (filters.purposes.length > 0) {
    visibleCables = visibleCables.filter(c => filters.purposes.includes(c.purpose))
  }
  if (filters.cableTypes.length > 0) {
    visibleCables = visibleCables.filter(c => filters.cableTypes.includes(c.cableType))
  }

  const aggregatedBundles = aggregateCables(visibleCables, rackMap, snapshot.devices)
  let bundles = aggregatedBundles
  let highlightedPath: PortPath | null = null

  switch (focus.level) {
    case 'room':
      for (const b of bundles) {
        if (b.sourceRackId === b.targetRackId) {
          b.opacity = 0
        }
      }
      break

    case 'rack':
      for (const b of bundles) {
        if (b.sourceRackId !== focus.rackId && b.targetRackId !== focus.rackId) {
          b.opacity = 0.15
        }
      }
      break

    case 'device': {
      const deviceCables = visibleCables.filter(
        c => c.source.deviceId === focus.deviceId || c.target.deviceId === focus.deviceId,
      )
      const unrelatedBundles = aggregatedBundles
        .filter(b => !bundleContainsDevice(b.id, visibleCables, focus.deviceId))
        .map(b => ({ ...b, opacity: 0.15, highlighted: false }))
      const deviceBundles = deviceCables.map(c =>
        cableToBundle(c, rackMap, deviceMap, { opacity: 1, highlighted: true }),
      )
      bundles = [...unrelatedBundles, ...deviceBundles]
      break
    }

    case 'port': {
      const { deviceId, portName } = parsePortId(focus.portId)
      const portCable = visibleCables.find(
        c =>
          (c.source.deviceId === deviceId && c.source.portName === portName) ||
          (c.target.deviceId === deviceId && c.target.portName === portName),
      )
      if (portCable) {
        highlightedPath = {
          cableId: portCable.cableId,
          sourceLabel: `${portCable.source.deviceName} / ${portCable.source.portName}`,
          targetLabel: `${portCable.target.deviceName} / ${portCable.target.portName}`,
          route: routeForCable(portCable, rackMap, deviceMap),
        }
      }
      for (const b of bundles) {
        b.opacity = 0.1
      }
      break
    }
  }

  const resolvedRoomId = focus.level === 'room' ? focus.roomId : roomId

  return {
    bundles,
    highlightedPath,
    legend: buildLegend(visibleCables),
    detailRows: buildDetailRows(visibleCables),
    breadcrumbs: buildBreadcrumbs(snapshot, focus, resolvedRoomId),
  }
}

function parseEndpoint(raw: unknown): EndpointInfo | null {
  if (raw === null || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (typeof r.deviceId !== 'string' || typeof r.deviceName !== 'string' || typeof r.portName !== 'string') return null
  return {
    deviceId: r.deviceId,
    deviceName: r.deviceName,
    portName: r.portName,
    rackId: typeof r.rackId === 'string' ? r.rackId : null,
    rackCode: typeof r.rackCode === 'string' ? r.rackCode : null,
  }
}

export function parseCableSnapshot(raw: unknown): CableSnapshot | null {
  if (raw === null || typeof raw !== 'object') return null
  const root = raw as Record<string, unknown>
  if (!Array.isArray(root.racks) || !Array.isArray(root.devices) || !Array.isArray(root.cables)) return null

  const racks: RackInfo[] = []
  for (const item of root.racks) {
    if (item === null || typeof item !== 'object') continue
    const r = item as Record<string, unknown>
    if (typeof r.rackId !== 'string' || typeof r.code !== 'string') continue
    if (typeof r.x !== 'number' || typeof r.y !== 'number') continue
    racks.push({
      rackId: r.rackId,
      code: r.code,
      x: r.x,
      y: r.y,
      width: typeof r.width === 'number' ? r.width : 60,
      height: typeof r.height === 'number' ? r.height : 100,
    })
  }

  const devices: DeviceInfo[] = []
  for (const item of root.devices) {
    if (item === null || typeof item !== 'object') continue
    const d = item as Record<string, unknown>
    if (typeof d.deviceId !== 'string' || typeof d.deviceName !== 'string' || typeof d.rackId !== 'string') continue
    if (typeof d.startU !== 'number' || typeof d.endU !== 'number') continue
    devices.push({
      deviceId: d.deviceId,
      deviceName: d.deviceName,
      rackId: d.rackId,
      deviceType: typeof d.deviceType === 'string' ? d.deviceType : '',
      startU: d.startU,
      endU: d.endU,
    })
  }

  const cables: CableInfo[] = []
  for (const item of root.cables) {
    if (item === null || typeof item !== 'object') continue
    const c = item as Record<string, unknown>
    const source = parseEndpoint(c.source)
    const target = parseEndpoint(c.target)
    if (typeof c.cableId !== 'string' || typeof c.cableType !== 'string' || !source || !target) continue
    cables.push({
      cableId: c.cableId,
      cableType: c.cableType,
      purpose: typeof c.purpose === 'string' ? c.purpose : '正常',
      source,
      target,
    })
  }

  return { racks, devices, cables }
}

function virtualU(u: number, heightU: number, rackDisplayHeight: number): number {
  return (u - 1) * (rackDisplayHeight / heightU) / 20 + 1
}

export function mapSnapshotToFloorplan(
  snapshot: CableSnapshot,
  toCanvasX: (db: number) => number,
  toCanvasY: (db: number) => number,
  options: { rulerSize: number; rackWidth: number; rackHeight: number },
): CableSnapshot {
  const heightUByRack = new Map(
    snapshot.racks.map(r => [r.rackId, Math.max(1, Math.round(r.height / 20))]),
  )

  return {
    racks: snapshot.racks.map(r => ({
      ...r,
      x: toCanvasX(r.x) + options.rulerSize,
      y: toCanvasY(r.y) + options.rulerSize,
      width: options.rackWidth,
      height: options.rackHeight,
    })),
    devices: snapshot.devices.map(d => {
      const heightU = heightUByRack.get(d.rackId) ?? 42
      return {
        ...d,
        startU: virtualU(d.startU, heightU, options.rackHeight),
        endU: virtualU(d.endU, heightU, options.rackHeight),
      }
    }),
    cables: snapshot.cables,
  }
}

export function mapSnapshotRelativeToRack(
  snapshot: CableSnapshot,
  anchorRackId: string,
  options: { rackWidth: number; rackHeight: number; offsetX?: number; offsetY?: number },
): CableSnapshot {
  const anchor = snapshot.racks.find(r => r.rackId === anchorRackId)
  if (!anchor) return snapshot

  const ox = options.offsetX ?? 80
  const oy = options.offsetY ?? 60
  const heightUByRack = new Map(
    snapshot.racks.map(r => [r.rackId, Math.max(1, Math.round(r.height / 20))]),
  )

  return {
    racks: snapshot.racks.map(r => ({
      ...r,
      x: r.x - anchor.x + ox,
      y: r.y - anchor.y + oy,
      width: options.rackWidth,
      height: options.rackHeight,
    })),
    devices: snapshot.devices.map(d => {
      const heightU = heightUByRack.get(d.rackId) ?? 42
      return {
        ...d,
        startU: virtualU(d.startU, heightU, options.rackHeight),
        endU: virtualU(d.endU, heightU, options.rackHeight),
      }
    }),
    cables: snapshot.cables,
  }
}
