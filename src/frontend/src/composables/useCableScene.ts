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
  /** Substring match on either endpoint device name (case-insensitive). */
  deviceNameQuery?: string
  /** Match either endpoint device type; empty = no type filter. */
  deviceTypes?: string[]
  /** 正常 | 告警 — based on endpoint OperationalStatus = 异常. */
  lineStatuses?: string[]
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
  operationalStatus: string
  startU: number
  endU: number
}

export interface EndpointInfo {
  deviceId: string
  deviceName: string
  portName: string
  speed: string | null
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
  /** Resolved display stroke (purpose / alert mapping). */
  strokeColor: string
  count: number
  sourceRackId: string
  targetRackId: string
  route: Point[]
  opacity: number
  highlighted: boolean
  /** Decorative flow animation; only selected cables may be true (VIS-003). */
  animated: boolean
  isAggregated: boolean
  /** Registration direction only; bidirectional only when data provides it. */
  direction: 'forward' | 'bidirectional'
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
  sourceSpeed: string | null
  targetDevice: string
  targetPort: string
  targetSpeed: string | null
  cableType: string
  purpose: string
  sourceRack: string
  targetRack: string
  bandwidth: string
  directionLabel: string
  pathLabel: string
}

export interface BuildCableSceneOptions {
  expandToCables?: boolean
  selectedCableId?: string | null
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

/** CR-002 purpose → network display colors (frontend-only mapping). */
export const NETWORK_COLORS = {
  management: '#39D9FF',
  business: '#9567FF',
  storage: '#FFB341',
  alert: '#FF4D5A',
} as const

export const PURPOSE_COLORS: Record<string, string> = {
  正常: NETWORK_COLORS.management,
  存储: NETWORK_COLORS.storage,
  上联: NETWORK_COLORS.business,
}

export const PURPOSE_DASH: Record<string, string> = {
  正常: 'none',
  存储: '6,4',
  上联: '2,4',
}

/** Unselected cable opacity when another cable/device is focused (FR-VIS-10). */
export const UNSELECTED_OPACITY = 0.22

/** Selected cable stroke width in canvas pixels (FR-VIS-10). */
export const SELECTED_STROKE_WIDTH = 4

/** Static arrow spacing along a route (FR-VIS-09). */
export const ARROW_SPACING_PX = 80

/** Decorative animation period in ms (FR-VIS-11). */
export const ANIMATION_PERIOD_MS = 1400

/** CableType → stroke color (legacy / room-level aggregation). */
export const CABLE_TYPE_COLORS: Record<string, string> = {
  铜缆: '#e67e22',
  光纤: '#f1c40f',
  DAC: '#3498db',
  网线: '#2ecc71',
}

export function cableTypeSceneColor(type: string): string {
  return CABLE_TYPE_COLORS[type] ?? '#95a5a6'
}

/** Map Cable.Purpose (+ CableType 网线) to display label. */
export function purposeDisplayName(purpose: string, cableType?: string): string {
  if (purpose === '上联') return '业务网络'
  if (purpose === '存储') return '存储网络'
  if (purpose === '正常' || cableType === '网线') return '管理网络'
  return purpose || '管理网络'
}

/** Purpose → network color; 网线 falls back to management. */
export function purposeNetworkColor(purpose: string, cableType?: string): string {
  if (purpose === '上联') return NETWORK_COLORS.business
  if (purpose === '存储') return NETWORK_COLORS.storage
  if (purpose === '正常' || cableType === '网线') return NETWORK_COLORS.management
  return PURPOSE_COLORS[purpose] ?? NETWORK_COLORS.management
}

/** Alert overrides purpose color when either endpoint device is 异常. */
export function resolveCableStrokeColor(
  purpose: string,
  cableType: string,
  sourceStatus?: string,
  targetStatus?: string,
): string {
  if (sourceStatus === '异常' || targetStatus === '异常') return NETWORK_COLORS.alert
  return purposeNetworkColor(purpose, cableType)
}

export function isPortInfoMissing(portName: string | null | undefined): boolean {
  return !portName || !String(portName).trim()
}

export function formatPortLabel(portName: string | null | undefined): string {
  return isPortInfoMissing(portName) ? '端口信息缺失' : String(portName).trim()
}

export interface ArrowMarker {
  x: number
  y: number
  angle: number
}

export function routeLength(route: Point[]): number {
  let total = 0
  for (let i = 1; i < route.length; i++) {
    total += Math.hypot(route[i].x - route[i - 1].x, route[i].y - route[i - 1].y)
  }
  return total
}

/** Place static direction arrows along the route (at least one; every spacing px). */
export function staticArrowPositions(
  route: Point[],
  spacing: number = ARROW_SPACING_PX,
): ArrowMarker[] {
  if (route.length < 2) return []
  const total = routeLength(route)
  if (total <= 0) return []

  const markers: ArrowMarker[] = []
  const count = Math.max(1, Math.floor(total / spacing))
  for (let n = 0; n < count; n++) {
    const target = count === 1 ? total / 2 : (n + 1) * spacing
    if (target > total && n > 0) break
    const at = Math.min(target, total)
    let acc = 0
    for (let i = 1; i < route.length; i++) {
      const dx = route[i].x - route[i - 1].x
      const dy = route[i].y - route[i - 1].y
      const segLen = Math.hypot(dx, dy)
      if (acc + segLen >= at) {
        const t = segLen > 0 ? (at - acc) / segLen : 0
        markers.push({
          x: route[i - 1].x + dx * t,
          y: route[i - 1].y + dy * t,
          angle: Math.atan2(dy, dx),
        })
        break
      }
      acc += segLen
    }
  }
  return markers
}

const DEFAULT_DEVICE: DeviceInfo = {
  deviceId: '',
  deviceName: '',
  rackId: '',
  deviceType: '',
  operationalStatus: '',
  startU: 1,
  endU: 2,
}

export function rackCenter(r: RackInfo): Point {
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
}

/** Per-device connected port → stable edge slot (index among sorted port names). */
export type PortSlotMap = Map<string, { index: number; count: number }>

export function portSlotKey(deviceId: string, portName: string): string {
  return `${deviceId}|${portName}`
}

/** Build stable port slots from connected endpoints so multi-port devices get distinct anchors. */
export function buildPortSlotMap(cables: CableInfo[]): PortSlotMap {
  const portsByDevice = new Map<string, Set<string>>()
  for (const cable of cables) {
    for (const endpoint of [cable.source, cable.target]) {
      const set = portsByDevice.get(endpoint.deviceId) ?? new Set<string>()
      set.add(endpoint.portName)
      portsByDevice.set(endpoint.deviceId, set)
    }
  }

  const slots: PortSlotMap = new Map()
  for (const [deviceId, ports] of portsByDevice) {
    const sorted = [...ports].sort((a, b) => a.localeCompare(b))
    sorted.forEach((portName, index) => {
      slots.set(portSlotKey(deviceId, portName), { index, count: sorted.length })
    })
  }
  return slots
}

export interface DeviceEdgePortOptions {
  portName?: string
  slotIndex?: number
  slotCount?: number
}

export function deviceEdgePoint(
  device: DeviceInfo,
  rack: RackInfo,
  direction: 'left' | 'right' | 'top' | 'bottom',
  port?: DeviceEdgePortOptions,
): Point {
  const uHeight = device.endU - device.startU + 1
  const deviceTopY = rack.y + (device.startU - 1) * 20
  const deviceHeight = uHeight * 20
  const deviceWidth = rack.width

  const slotCount = port?.slotCount ?? 0
  const slotIndex = port?.slotIndex ?? 0
  // Evenly distribute ports along the edge; single port stays centered.
  const t = slotCount > 1 ? (slotIndex + 1) / (slotCount + 1) : 0.5

  switch (direction) {
    case 'left':
      return { x: rack.x, y: deviceTopY + deviceHeight * t }
    case 'right':
      return { x: rack.x + deviceWidth, y: deviceTopY + deviceHeight * t }
    case 'top':
      return { x: rack.x + deviceWidth * t, y: deviceTopY }
    case 'bottom':
      return { x: rack.x + deviceWidth * t, y: deviceTopY + deviceHeight }
  }
}

function edgePortOptions(
  deviceId: string,
  portName: string,
  portSlots: PortSlotMap,
): DeviceEdgePortOptions {
  const slot = portSlots.get(portSlotKey(deviceId, portName))
  return {
    portName,
    slotIndex: slot?.index ?? 0,
    slotCount: slot?.count ?? 1,
  }
}

export function routeBetweenRacks(
  srcRack: RackInfo,
  srcDevice: DeviceInfo,
  tgtRack: RackInfo,
  tgtDevice: DeviceInfo,
  srcPort?: DeviceEdgePortOptions,
  tgtPort?: DeviceEdgePortOptions,
): Point[] {
  const startEdge = srcRack.x + srcRack.width / 2 < tgtRack.x + tgtRack.width / 2 ? 'right' : 'left'
  const endEdge = srcRack.x + srcRack.width / 2 < tgtRack.x + tgtRack.width / 2 ? 'left' : 'right'

  const start = deviceEdgePoint(srcDevice, srcRack, startEdge, srcPort)
  const end = deviceEdgePoint(tgtDevice, tgtRack, endEdge, tgtPort)

  // Exit into the inter-rack cable corridor, then travel vertically in the aisle.
  const exitPad = 28
  const exitStartX = startEdge === 'right' ? start.x + exitPad : start.x - exitPad
  const exitEndX = endEdge === 'left' ? end.x - exitPad : end.x + exitPad
  const leftRackRight = Math.min(srcRack.x + srcRack.width, tgtRack.x + tgtRack.width)
  const rightRackLeft = Math.max(srcRack.x, tgtRack.x)
  const midX = leftRackRight < rightRackLeft
    ? (leftRackRight + rightRackLeft) / 2
    : (exitStartX + exitEndX) / 2

  return [
    start,
    { x: exitStartX, y: start.y },
    { x: midX, y: start.y },
    { x: midX, y: end.y },
    { x: exitEndX, y: end.y },
    end,
  ]
}

export function sameRackRoute(
  rack: RackInfo,
  src: DeviceInfo,
  tgt: DeviceInfo,
  srcPort?: DeviceEdgePortOptions,
  tgtPort?: DeviceEdgePortOptions,
): Point[] {
  const start = deviceEdgePoint(src, rack, 'left', srcPort)
  const end = deviceEdgePoint(tgt, rack, 'left', tgtPort)
  // Stay in the left cable channel; avoid crossing the rack name band above.
  const midX = rack.x - 40
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
  portSlots: PortSlotMap = new Map(),
): Point[] {
  const srcRackId = cable.source.rackId ?? '__none__'
  const tgtRackId = cable.target.rackId ?? '__none__'
  const srcRack = rackMap.get(srcRackId)
  const tgtRack = rackMap.get(tgtRackId)
  if (!srcRack || !tgtRack) return []

  const srcDevice = resolveDevice(deviceMap, cable.source.deviceId, srcRackId, cable.source.deviceName)
  const tgtDevice = resolveDevice(deviceMap, cable.target.deviceId, tgtRackId, cable.target.deviceName)
  const srcPort = edgePortOptions(cable.source.deviceId, cable.source.portName, portSlots)
  const tgtPort = edgePortOptions(cable.target.deviceId, cable.target.portName, portSlots)

  if (srcRackId === tgtRackId) {
    return sameRackRoute(srcRack, srcDevice, tgtDevice, srcPort, tgtPort)
  }
  return routeBetweenRacks(srcRack, srcDevice, tgtRack, tgtDevice, srcPort, tgtPort)
}

function strokeForCable(
  c: CableInfo,
  deviceMap: Map<string, DeviceInfo>,
): string {
  const src = deviceMap.get(c.source.deviceId)
  const tgt = deviceMap.get(c.target.deviceId)
  return resolveCableStrokeColor(
    c.purpose,
    c.cableType,
    src?.operationalStatus,
    tgt?.operationalStatus,
  )
}

export function aggregateCables(
  cables: CableInfo[],
  rackMap: Map<string, RackInfo>,
  devices: DeviceInfo[] = [],
): CableBundle[] {
  const deviceMap = new Map(devices.map(d => [d.deviceId, d]))
  const portSlots = buildPortSlotMap(cables)
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
    const route = sample ? routeForCable(sample, rackMap, deviceMap, portSlots) : []

    bundles.push({
      id: key,
      purpose,
      cableType,
      strokeColor: sample ? strokeForCable(sample, deviceMap) : purposeNetworkColor(purpose, cableType),
      count: group.length,
      sourceRackId,
      targetRackId,
      route,
      opacity: 1,
      highlighted: false,
      animated: false,
      isAggregated: group.length > 1,
      direction: 'forward',
    })
  }

  return bundles
}

function cableToBundle(
  c: CableInfo,
  rackMap: Map<string, RackInfo>,
  deviceMap: Map<string, DeviceInfo>,
  portSlots: PortSlotMap,
  overrides: Partial<CableBundle> = {},
): CableBundle {
  return {
    id: c.cableId,
    purpose: c.purpose,
    cableType: c.cableType,
    strokeColor: strokeForCable(c, deviceMap),
    count: 1,
    sourceRackId: c.source.rackId ?? '__none__',
    targetRackId: c.target.rackId ?? '__none__',
    route: routeForCable(c, rackMap, deviceMap, portSlots),
    opacity: 1,
    highlighted: false,
    animated: false,
    isAggregated: false,
    direction: 'forward',
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

function buildLegend(visibleCables: CableInfo[], deviceMap: Map<string, DeviceInfo>): LegendItem[] {
  const legendMap = new Map<string, LegendItem>()
  for (const c of visibleCables) {
    const color = strokeForCable(c, deviceMap)
    const label = color === NETWORK_COLORS.alert
      ? '告警/异常'
      : purposeDisplayName(c.purpose, c.cableType)
    const key = `${label}|${color}`
    if (!legendMap.has(key)) {
      legendMap.set(key, {
        purpose: label,
        cableType: c.cableType,
        color,
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
    sourcePort: formatPortLabel(c.source.portName),
    sourceSpeed: c.source.speed,
    targetDevice: c.target.deviceName,
    targetPort: formatPortLabel(c.target.portName),
    targetSpeed: c.target.speed,
    cableType: c.cableType,
    purpose: purposeDisplayName(c.purpose, c.cableType),
    sourceRack: c.source.rackCode ?? '-',
    targetRack: c.target.rackCode ?? '-',
    bandwidth: '未配置',
    directionLabel: '单向',
    pathLabel: `${c.source.rackCode ?? '-'} / ${c.source.deviceName} / ${formatPortLabel(c.source.portName)} → ${c.target.rackCode ?? '-'} / ${c.target.deviceName} / ${formatPortLabel(c.target.portName)}`,
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
  options?: BuildCableSceneOptions,
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
  const deviceNameQuery = filters.deviceNameQuery?.trim().toLowerCase() ?? ''
  if (deviceNameQuery) {
    visibleCables = visibleCables.filter(c =>
      c.source.deviceName.toLowerCase().includes(deviceNameQuery)
      || c.target.deviceName.toLowerCase().includes(deviceNameQuery),
    )
  }
  if (filters.deviceTypes && filters.deviceTypes.length > 0) {
    const types = new Set(filters.deviceTypes)
    visibleCables = visibleCables.filter((c) => {
      const srcType = deviceMap.get(c.source.deviceId)?.deviceType ?? ''
      const tgtType = deviceMap.get(c.target.deviceId)?.deviceType ?? ''
      return types.has(srcType) || types.has(tgtType)
    })
  }
  if (filters.lineStatuses && filters.lineStatuses.length > 0) {
    visibleCables = visibleCables.filter((c) => {
      const src = deviceMap.get(c.source.deviceId)?.operationalStatus
      const tgt = deviceMap.get(c.target.deviceId)?.operationalStatus
      const alert = src === '异常' || tgt === '异常'
      const status = alert ? '告警' : '正常'
      return filters.lineStatuses!.includes(status)
    })
  }
  // Only cables whose both endpoint racks exist in the current room snapshot are renderable
  // (AC-DEV-03 / AC-DEV-06). Cross-room cables are excluded from scene, legend, and filters.
  visibleCables = visibleCables.filter(c => {
    const srcRackId = c.source.rackId
    const tgtRackId = c.target.rackId
    return (
      typeof srcRackId === 'string'
      && typeof tgtRackId === 'string'
      && rackMap.has(srcRackId)
      && rackMap.has(tgtRackId)
    )
  })

  const resolvedRoomId = focus.level === 'room' ? focus.roomId : roomId
  const portSlots = buildPortSlotMap(visibleCables)

  if (options?.expandToCables) {
    let bundles = visibleCables.map(c => cableToBundle(c, rackMap, deviceMap, portSlots))
    const selectedCableId = options.selectedCableId ?? null

    if (selectedCableId) {
      for (const b of bundles) {
        const selected = b.id === selectedCableId
        b.opacity = selected ? 1 : UNSELECTED_OPACITY
        b.highlighted = selected
        b.animated = selected
      }
    } else if (focus.level === 'device') {
      for (const b of bundles) {
        const cable = visibleCables.find(c => c.cableId === b.id)
        const related = !!cable
          && (cable.source.deviceId === focus.deviceId || cable.target.deviceId === focus.deviceId)
        b.opacity = related ? 1 : UNSELECTED_OPACITY
        b.highlighted = related
        b.animated = false
      }
    }

    return {
      bundles,
      highlightedPath: null,
      legend: buildLegend(visibleCables, deviceMap),
      detailRows: buildDetailRows(visibleCables),
      breadcrumbs: buildBreadcrumbs(snapshot, focus, resolvedRoomId),
    }
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
        .map(b => ({ ...b, opacity: 0.15, highlighted: false, animated: false }))
      const deviceBundles = deviceCables.map(c =>
        cableToBundle(c, rackMap, deviceMap, portSlots, { opacity: 1, highlighted: true, animated: false }),
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
          sourceLabel: `${portCable.source.deviceName} / ${formatPortLabel(portCable.source.portName)}`,
          targetLabel: `${portCable.target.deviceName} / ${formatPortLabel(portCable.target.portName)}`,
          route: routeForCable(portCable, rackMap, deviceMap, portSlots),
        }
      }
      for (const b of bundles) {
        b.opacity = 0.1
      }
      break
    }
  }

  return {
    bundles,
    highlightedPath,
    legend: buildLegend(visibleCables, deviceMap),
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
    speed: typeof r.speed === 'string' ? r.speed : null,
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
      operationalStatus: typeof d.operationalStatus === 'string' ? d.operationalStatus : '',
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

/** Compute scale + offset so all racks fit inside a viewport (device-level canvas). */
export function computeFitToScreenTransform(
  racks: Array<{ x: number; y: number; width: number; height: number }>,
  viewport: { width: number; height: number },
  options?: { padding?: number; maxScale?: number; minScale?: number },
): { scale: number; x: number; y: number } {
  const padding = options?.padding ?? 40
  const maxScale = options?.maxScale ?? 2
  const minScale = options?.minScale ?? 0.2

  if (racks.length === 0 || viewport.width <= 0 || viewport.height <= 0) {
    return { scale: 1, x: 0, y: 0 }
  }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const rack of racks) {
    // Include rack chrome (label above, padding around) used by device layout.
    minX = Math.min(minX, rack.x - 8)
    minY = Math.min(minY, rack.y - 28)
    maxX = Math.max(maxX, rack.x + rack.width + 8)
    maxY = Math.max(maxY, rack.y + rack.height + 12)
  }

  const contentW = Math.max(1, maxX - minX + padding * 2)
  const contentH = Math.max(1, maxY - minY + padding * 2)
  const scale = Math.min(maxScale, Math.max(minScale, Math.min(viewport.width / contentW, viewport.height / contentH)))
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  return {
    scale,
    x: viewport.width / 2 - cx * scale,
    y: viewport.height / 2 - cy * scale,
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
