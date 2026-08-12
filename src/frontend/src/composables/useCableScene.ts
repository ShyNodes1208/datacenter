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
  status: string
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

/** CR-002 / TASK palette purpose → network display colors. */
export const NETWORK_COLORS = {
  management: '#35e6ff',
  business: '#9868ff',
  storage: '#ffad3b',
  alert: '#ff4d5f',
  generic: '#3388ff',
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

/** Map Cable.Purpose (+ CableType legacy) to display label. */
export function purposeDisplayName(purpose: string, cableType?: string): string {
  if (purpose === '管理网络' || purpose === '业务网络' || purpose === '存储网络') return purpose
  if (purpose === '上联') return '业务网络'
  if (purpose === '存储') return '存储网络'
  if (purpose === '正常' || cableType === '网线') return '管理网络'
  return purpose || '管理网络'
}

/** Purpose → network color; legacy 上联/存储/正常 supported. */
export function purposeNetworkColor(purpose: string, cableType?: string): string {
  const label = purposeDisplayName(purpose, cableType)
  if (label === '业务网络') return NETWORK_COLORS.business
  if (label === '存储网络') return NETWORK_COLORS.storage
  if (label === '管理网络') return NETWORK_COLORS.management
  return NETWORK_COLORS.generic
}

/** Alert from cable Status or endpoint OperationalStatus. */
export function resolveCableStrokeColor(
  purpose: string,
  cableType: string,
  sourceStatus?: string,
  targetStatus?: string,
  cableStatus?: string,
): string {
  if (cableStatus === '告警' || sourceStatus === '异常' || targetStatus === '异常') {
    return NETWORK_COLORS.alert
  }
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
  // Use the same U_PX=24 as panel rendering for consistent port positioning
  const unitPx = rack.height >= 120 ? 24 : (rack.height / Math.max(1, uHeight || 1))
  const deviceTopY = rack.y + (device.startU - 1) * unitPx
  const deviceHeight = Math.max(uHeight * unitPx, 16)
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
  exitOffsets?: { src: number; tgt: number },
): Point[] {
  const startEdge = srcRack.x + srcRack.width / 2 < tgtRack.x + tgtRack.width / 2 ? 'right' : 'left'
  const endEdge = srcRack.x + srcRack.width / 2 < tgtRack.x + tgtRack.width / 2 ? 'left' : 'right'

  const start = deviceEdgePoint(srcDevice, srcRack, startEdge, srcPort)
  const end = deviceEdgePoint(tgtDevice, tgtRack, endEdge, tgtPort)
  const srcY = start.y + (exitOffsets?.src ?? 0) * SAME_PORT_EXIT_STEP_PX
  const tgtY = end.y + (exitOffsets?.tgt ?? 0) * SAME_PORT_EXIT_STEP_PX

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
    { x: exitStartX, y: srcY },
    { x: midX, y: srcY },
    { x: midX, y: tgtY },
    { x: exitEndX, y: tgtY },
    end,
  ]
}

/** Per-index exit-channel step for same-port multi-cable fan-out (FR-VIS-08). */
export const SAME_PORT_EXIT_STEP_PX = 6

export type PortLabelSide = 'left' | 'right'

/** Fixed vertical pitch for same-device / same-side port label stacks (FIX Round 3). */
export const LABEL_STACK_STEP_Y = 14

export const LABEL_DEFAULT_HEIGHT = 14
export const LABEL_DEFAULT_WIDTH = 64

export interface LabelRect {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Place the port label outside the device panel (further outward from the port edge).
 * Same-rack left exits → label on the left corridor side (not inside the panel/name).
 */
export function portLabelSide(route: Point[], endpoint: 'start' | 'end'): PortLabelSide {
  if (route.length < 2) return 'left'
  if (endpoint === 'start') {
    const dx = route[1]!.x - route[0]!.x
    return dx < 0 ? 'left' : 'right'
  }
  const last = route[route.length - 1]!
  const prev = route[route.length - 2]!
  // Cable approaches from the left → port is on the left edge → label further left.
  return prev.x <= last.x ? 'left' : 'right'
}

/**
 * Outward clearance so the label sits beyond the cable corridor for this endpoint
 * (all route X on the outward side), not into fan-out / mid channels.
 */
export function routeLocalOutwardClearance(
  route: Point[],
  endpoint: 'start' | 'end',
  side: PortLabelSide,
  point: Point,
): number {
  const xs = route.map((p) => p.x)
  const pad = 8
  if (side === 'left') {
    return Math.max(52, point.x - Math.min(...xs) + pad)
  }
  return Math.max(52, Math.max(...xs) - point.x + pad)
}

export function portLabelRect(
  point: Point,
  side: PortLabelSide,
  options?: { width?: number; height?: number; gap?: number; outwardClearance?: number },
): LabelRect {
  const width = options?.width ?? LABEL_DEFAULT_WIDTH
  const height = options?.height ?? LABEL_DEFAULT_HEIGHT
  // Clear the exit channel (~40px) plus a small gap so labels sit outside both
  // the device panel and the cable corridor.
  const outward = options?.outwardClearance ?? options?.gap ?? 52
  return {
    x: side === 'left' ? point.x - outward - width : point.x + outward,
    y: point.y - height / 2,
    width,
    height,
  }
}

export function rectsOverlap(a: LabelRect, b: LabelRect, pad = 0): boolean {
  return !(
    a.x + a.width + pad <= b.x
    || b.x + b.width + pad <= a.x
    || a.y + a.height + pad <= b.y
    || b.y + b.height + pad <= a.y
  )
}

/** Matches TopologyView device-name text box (panel inset + name offset). */
export function deviceNameLabelRect(device: DeviceInfo, rack: RackInfo): LabelRect {
  const uHeight = Math.max(1, device.endU - device.startU + 1)
  const unitPx = rack.height / Math.max(1, Math.ceil(rack.height / 24))
  const panelH = Math.max(16, uHeight * unitPx - 4)
  const panelW = rack.width - 20
  const groupX = rack.x + 10
  const groupY = rack.y + (device.startU - 1) * unitPx + 2
  return {
    x: groupX + 8,
    y: groupY + Math.max(4, panelH / 2 - 7),
    width: Math.max(0, panelW - 28),
    height: 14,
  }
}

export interface PortLabelPlacement {
  key: string
  deviceId: string
  portName: string
  point: Point
  side: PortLabelSide
  rect: LabelRect
}

export interface PortLabelLayoutOptions {
  /** Inclusive canvas height in scene coordinates; labels clamp to [0, canvasHeight]. */
  canvasHeight?: number
}

/**
 * Deterministically stack labels that share the same device edge side with a fixed
 * vertical step. Prefer centering on port Y, then shift as a block to clear the
 * device-name band and stay inside the canvas. No retry/random search.
 */
function stackGroupVertically(
  group: PortLabelPlacement[],
  nameRect: LabelRect | null,
  canvasHeight: number,
): void {
  if (group.length === 0) return
  group.sort((a, b) => (
    a.point.y - b.point.y
    || a.portName.localeCompare(b.portName)
    || a.key.localeCompare(b.key)
  ))

  const n = group.length
  const span = (n - 1) * LABEL_STACK_STEP_Y
  const meanY = group.reduce((sum, p) => sum + p.point.y, 0) / n
  let startTop = meanY - span / 2 - LABEL_DEFAULT_HEIGHT / 2

  const applyStart = (top: number) => {
    for (let i = 0; i < n; i++) {
      const p = group[i]!
      p.rect = { ...p.rect, y: top + i * LABEL_STACK_STEP_Y }
    }
  }

  applyStart(startTop)

  if (nameRect) {
    const hitsName = group.some((p) => rectsOverlap(p.rect, nameRect, 2))
    if (hitsName) {
      const below = nameRect.y + nameRect.height + 2
      const above = nameRect.y - 2 - LABEL_DEFAULT_HEIGHT - span
      // Prefer the side with more room relative to the ports' natural band.
      const belowDist = Math.abs(below - startTop)
      const aboveDist = Math.abs(above - startTop)
      startTop = belowDist <= aboveDist ? below : above
      applyStart(startTop)
    }
  }

  const maxStart = Math.max(0, canvasHeight - LABEL_DEFAULT_HEIGHT - span)
  startTop = Math.min(Math.max(0, startTop), maxStart)
  applyStart(startTop)
}

/**
 * One label per physical port (deviceId+portName). Same-device same-side labels are
 * stacked with LABEL_STACK_STEP_Y (deterministic; no retry cap).
 */
export function buildUniquePortLabelPlacements(
  bundles: Array<{ id: string; opacity: number; route: Point[] }>,
  cables: CableInfo[],
  devices: DeviceInfo[],
  racks: RackInfo[],
  options?: PortLabelLayoutOptions,
): PortLabelPlacement[] {
  const cableById = new Map(cables.map((c) => [c.cableId, c]))
  const rackById = new Map(racks.map((r) => [r.rackId, r]))
  const deviceById = new Map(devices.map((d) => [d.deviceId, d]))
  const seen = new Map<string, PortLabelPlacement>()
  const clearanceByKey = new Map<string, number>()

  for (const bundle of bundles) {
    if (bundle.opacity <= 0 || bundle.route.length < 2) continue
    const cable = cableById.get(bundle.id)
    if (!cable) continue
    const endpoints: Array<{
      kind: 'start' | 'end'
      point: Point
      deviceId: string
      portName: string
    }> = [
      {
        kind: 'start',
        point: bundle.route[0]!,
        deviceId: cable.source.deviceId,
        portName: cable.source.portName,
      },
      {
        kind: 'end',
        point: bundle.route[bundle.route.length - 1]!,
        deviceId: cable.target.deviceId,
        portName: cable.target.portName,
      },
    ]
    for (const ep of endpoints) {
      const key = portSlotKey(ep.deviceId, ep.portName)
      const side = portLabelSide(bundle.route, ep.kind)
      const clearance = routeLocalOutwardClearance(bundle.route, ep.kind, side, ep.point)
      const prevClearance = clearanceByKey.get(key) ?? 0
      clearanceByKey.set(key, Math.max(prevClearance, clearance))

      const existing = seen.get(key)
      if (existing) {
        existing.rect = portLabelRect(existing.point, existing.side, {
          outwardClearance: clearanceByKey.get(key),
        })
        continue
      }
      seen.set(key, {
        key,
        deviceId: ep.deviceId,
        portName: ep.portName,
        point: ep.point,
        side,
        rect: portLabelRect(ep.point, side, { outwardClearance: clearance }),
      })
    }
  }

  const placements = [...seen.values()]
  const inferredHeight = Math.max(
    options?.canvasHeight ?? 0,
    ...racks.map((r) => r.y + r.height + 100),
    LABEL_DEFAULT_HEIGHT,
  )

  // Assign each label an X column per device, placed outside that device's
  // cable corridor extent so different devices form independent stacks.
  // We collect the furthest route X for each device+side from the bundles.
  const deviceRouteMinX = new Map<string, number>()
  const deviceRouteMaxX = new Map<string, number>()
  const cableForBundle = new Map(bundles.map((b) => [b.id, cableById.get(b.id)].filter(Boolean) as [string, CableInfo]))
  for (const bundle of bundles) {
    if (bundle.opacity <= 0 || bundle.route.length < 2) continue
    const cable = cableForBundle.get(bundle.id)
    if (!cable) continue
    for (const ep of [
      { deviceId: cable.source.deviceId, kind: 'start' as const },
      { deviceId: cable.target.deviceId, kind: 'end' as const },
    ]) {
      const side = portLabelSide(bundle.route, ep.kind)
      const routeXs = bundle.route.map((p) => p.x)
      const routeMin = Math.min(...routeXs)
      const routeMax = Math.max(...routeXs)
      const dk = `${ep.deviceId}|${side}`
      deviceRouteMinX.set(dk, Math.min(deviceRouteMinX.get(dk) ?? Infinity, routeMin))
      deviceRouteMaxX.set(dk, Math.max(deviceRouteMaxX.get(dk) ?? -Infinity, routeMax))
    }
  }
  const ROUTE_GAP = 8
  for (const p of placements) {
    const dk = `${p.deviceId}|${p.side}`
    if (p.side === 'left') {
      const minX = deviceRouteMinX.get(dk)
      if (minX !== undefined && minX < Infinity) {
        p.rect.x = minX - ROUTE_GAP - p.rect.width
      }
    } else {
      const maxX = deviceRouteMaxX.get(dk)
      if (maxX !== undefined && maxX > -Infinity) {
        p.rect.x = maxX + ROUTE_GAP
      }
    }
  }

  // Primary: equal stack per device edge side.
  const byDeviceSide = new Map<string, PortLabelPlacement[]>()
  for (const p of placements) {
    const gkey = `${p.deviceId}|${p.side}`
    const list = byDeviceSide.get(gkey) ?? []
    list.push(p)
    byDeviceSide.set(gkey, list)
  }
  for (const [gkey, group] of byDeviceSide) {
    const deviceId = gkey.slice(0, gkey.lastIndexOf('|'))
    const device = deviceById.get(deviceId)
    const rack = device ? rackById.get(device.rackId) : undefined
    const nameRect = device && rack ? deviceNameLabelRect(device, rack) : null
    stackGroupVertically(group, nameRect, inferredHeight)
  }

  // Secondary: same-side labels that share an X column (typical same-rack corridor)
  // must remain non-overlapping after per-device stacks.
  const bySideColumn = new Map<string, PortLabelPlacement[]>()
  for (const p of placements) {
    const col = Math.round(p.rect.x / 8)
    const ckey = `${p.side}|${col}`
    const list = bySideColumn.get(ckey) ?? []
    list.push(p)
    bySideColumn.set(ckey, list)
  }
  for (const [, group] of bySideColumn) {
    if (group.length < 2) continue
    const stillOverlap = group.some((a, i) =>
      group.some((b, j) => i < j && rectsOverlap(a.rect, b.rect, 0)),
    )
    if (!stillOverlap) continue
    stackGroupVertically(group, null, inferredHeight)
  }

  // Tertiary: push labels outward if ANY visible route crosses them, then
  // re-stack the affected column.  A label column keyed to device A's route
  // extents can still be crossed by device B's longer route.
  const allRoutes = bundles
    .filter((b) => b.opacity > 0 && b.route.length >= 2)
    .map((b) => b.route)
  const COL_PUSH_STEP = 8
  const MAX_PUSH_PASSES = 20
  for (let pass = 0; pass < MAX_PUSH_PASSES; pass++) {
    let pushed = false
    for (const p of placements) {
      const hit = allRoutes.some((r) => routeIntersectsRect(r, p.rect))
      if (!hit) continue
      pushed = true
      if (p.side === 'left') {
        p.rect.x -= COL_PUSH_STEP
      } else {
        p.rect.x += COL_PUSH_STEP
      }
    }
    if (!pushed) break
    // Re-stack any columns that drifted after the push.
    const cols = new Map<string, PortLabelPlacement[]>()
    for (const p of placements) {
      const col = Math.round(p.rect.x / 8)
      const ck = `${p.side}|${col}`
      const list = cols.get(ck) ?? []
      list.push(p)
      cols.set(ck, list)
    }
    for (const [, group] of cols) {
      if (group.length < 2) continue
      const overlap = group.some((a, i) =>
        group.some((b, j) => i < j && rectsOverlap(a.rect, b.rect, 0)),
      )
      if (!overlap) continue
      stackGroupVertically(group, null, inferredHeight)
    }
  }

  for (const p of placements) {
    const maxY = Math.max(0, inferredHeight - p.rect.height)
    p.rect = {
      ...p.rect,
      y: Math.min(Math.max(0, p.rect.y), maxY),
    }
  }

  return placements
}

function orient(a: Point, b: Point, c: Point): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
}

function onSegment(a: Point, b: Point, c: Point): boolean {
  return (
    Math.min(a.x, b.x) <= c.x + 1e-9
    && c.x <= Math.max(a.x, b.x) + 1e-9
    && Math.min(a.y, b.y) <= c.y + 1e-9
    && c.y <= Math.max(a.y, b.y) + 1e-9
  )
}

function segmentsIntersect(a1: Point, a2: Point, b1: Point, b2: Point): boolean {
  const o1 = orient(a1, a2, b1)
  const o2 = orient(a1, a2, b2)
  const o3 = orient(b1, b2, a1)
  const o4 = orient(b1, b2, a2)
  if (o1 === 0 && onSegment(a1, a2, b1)) return true
  if (o2 === 0 && onSegment(a1, a2, b2)) return true
  if (o3 === 0 && onSegment(b1, b2, a1)) return true
  if (o4 === 0 && onSegment(b1, b2, a2)) return true
  return (o1 > 0) !== (o2 > 0) && (o3 > 0) !== (o4 > 0)
}

/** True when any route segment crosses or touches the label rectangle. */
export function routeIntersectsRect(route: Point[], rect: LabelRect): boolean {
  if (route.length < 2) return false
  const corners: Point[] = [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x + rect.width, y: rect.y + rect.height },
    { x: rect.x, y: rect.y + rect.height },
  ]
  const edges: Array<[Point, Point]> = [
    [corners[0]!, corners[1]!],
    [corners[1]!, corners[2]!],
    [corners[2]!, corners[3]!],
    [corners[3]!, corners[0]!],
  ]
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1]!
    const b = route[i]!
    const midInside =
      a.x >= rect.x && a.x <= rect.x + rect.width && a.y >= rect.y && a.y <= rect.y + rect.height
    const endInside =
      b.x >= rect.x && b.x <= rect.x + rect.width && b.y >= rect.y && b.y <= rect.y + rect.height
    if (midInside || endInside) return true
    for (const [e1, e2] of edges) {
      if (segmentsIntersect(a, b, e1, e2)) return true
    }
  }
  return false
}

/**
 * Devices matching name/type filters. Empty filters → all devices.
 * Used by device-level drawing so node visibility tracks the filter bar (FIX-2).
 */
export function filterVisibleDevices(
  devices: DeviceInfo[],
  filters: Pick<CableFilters, 'deviceNameQuery' | 'deviceTypes'>,
): DeviceInfo[] {
  const nameQuery = filters.deviceNameQuery?.trim().toLowerCase() ?? ''
  const types = filters.deviceTypes ?? []
  if (!nameQuery && types.length === 0) return devices
  return devices.filter((d) => {
    const nameOk = !nameQuery || d.deviceName.toLowerCase().includes(nameQuery)
    const typeOk = types.length === 0 || types.includes(d.deviceType)
    return nameOk && typeOk
  })
}

/**
 * Centered exit-offset index per cable at each endpoint port.
 * Key: `${cableId}|${portSlotKey(deviceId, portName)}` → index (…,-1,0,1,…).
 */
export function buildSamePortExitOffsets(cables: CableInfo[]): Map<string, number> {
  const groups = new Map<string, string[]>()
  for (const cable of cables) {
    for (const endpoint of [cable.source, cable.target]) {
      const key = portSlotKey(endpoint.deviceId, endpoint.portName)
      const list = groups.get(key) ?? []
      if (!list.includes(cable.cableId)) list.push(cable.cableId)
      groups.set(key, list)
    }
  }
  const offsets = new Map<string, number>()
  for (const [portKey, cableIds] of groups) {
    cableIds.forEach((cableId, index) => {
      const centered = index - (cableIds.length - 1) / 2
      offsets.set(`${cableId}|${portKey}`, centered)
    })
  }
  return offsets
}

export function sameRackRoute(
  rack: RackInfo,
  src: DeviceInfo,
  tgt: DeviceInfo,
  srcPort?: DeviceEdgePortOptions,
  tgtPort?: DeviceEdgePortOptions,
  exitOffsets?: { src: number; tgt: number },
): Point[] {
  const start = deviceEdgePoint(src, rack, 'left', srcPort)
  const end = deviceEdgePoint(tgt, rack, 'left', tgtPort)
  // Stay in the left cable channel; fan same-port cables by exit-channel X offset.
  const srcOff = (exitOffsets?.src ?? 0) * SAME_PORT_EXIT_STEP_PX
  const tgtOff = (exitOffsets?.tgt ?? 0) * SAME_PORT_EXIT_STEP_PX
  const midXSrc = rack.x - 40 - srcOff
  const midXTgt = rack.x - 40 - tgtOff
  if (Math.abs(midXSrc - midXTgt) < 0.5) {
    return [start, { x: midXSrc, y: start.y }, { x: midXSrc, y: end.y }, end]
  }
  const midY = (start.y + end.y) / 2
  return [
    start,
    { x: midXSrc, y: start.y },
    { x: midXSrc, y: midY },
    { x: midXTgt, y: midY },
    { x: midXTgt, y: end.y },
    end,
  ]
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
  exitOffsets: Map<string, number> = new Map(),
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
  const srcKey = `${cable.cableId}|${portSlotKey(cable.source.deviceId, cable.source.portName)}`
  const tgtKey = `${cable.cableId}|${portSlotKey(cable.target.deviceId, cable.target.portName)}`
  const offsets = {
    src: exitOffsets.get(srcKey) ?? 0,
    tgt: exitOffsets.get(tgtKey) ?? 0,
  }

  if (srcRackId === tgtRackId) {
    return sameRackRoute(srcRack, srcDevice, tgtDevice, srcPort, tgtPort, offsets)
  }
  return routeBetweenRacks(srcRack, srcDevice, tgtRack, tgtDevice, srcPort, tgtPort, offsets)
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
    c.status,
  )
}

export function aggregateCables(
  cables: CableInfo[],
  rackMap: Map<string, RackInfo>,
  devices: DeviceInfo[] = [],
): CableBundle[] {
  const deviceMap = new Map(devices.map(d => [d.deviceId, d]))
  const portSlots = buildPortSlotMap(cables)
  const exitOffsets = buildSamePortExitOffsets(cables)
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
    const route = sample ? routeForCable(sample, rackMap, deviceMap, portSlots, exitOffsets) : []

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
  exitOffsets: Map<string, number> = new Map(),
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
    route: routeForCable(c, rackMap, deviceMap, portSlots, exitOffsets),
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
  // Device name/type: keep a cable only when BOTH endpoints stay visible (no dangling ends).
  const hasDeviceNameFilter = !!(filters.deviceNameQuery?.trim())
  const hasDeviceTypeFilter = !!(filters.deviceTypes && filters.deviceTypes.length > 0)
  if (hasDeviceNameFilter || hasDeviceTypeFilter) {
    const visibleIds = new Set(
      filterVisibleDevices(snapshot.devices, {
        deviceNameQuery: filters.deviceNameQuery,
        deviceTypes: filters.deviceTypes,
      }).map((d) => d.deviceId),
    )
    visibleCables = visibleCables.filter(
      (c) => visibleIds.has(c.source.deviceId) && visibleIds.has(c.target.deviceId),
    )
  }
  if (filters.lineStatuses && filters.lineStatuses.length > 0) {
    visibleCables = visibleCables.filter((c) => {
      // Use cable's own Status field first; fall back to endpoint operational status
      const cableAlert = c.status === '告警'
      const srcAlert = deviceMap.get(c.source.deviceId)?.operationalStatus === '异常'
      const tgtAlert = deviceMap.get(c.target.deviceId)?.operationalStatus === '异常'
      const status = (cableAlert || srcAlert || tgtAlert) ? '告警' : '正常'
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
  const exitOffsets = buildSamePortExitOffsets(visibleCables)

  if (options?.expandToCables) {
    let bundles = visibleCables.map(c => cableToBundle(c, rackMap, deviceMap, portSlots, exitOffsets))
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
        cableToBundle(c, rackMap, deviceMap, portSlots, exitOffsets, {
          opacity: 1,
          highlighted: true,
          animated: false,
        }),
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
          route: routeForCable(portCable, rackMap, deviceMap, portSlots, exitOffsets),
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
      status: typeof c.status === 'string' ? c.status : '正常',
      source,
      target,
    })
  }

  return { racks, devices, cables }
}

const LEGACY_RACK_CODE_PREFIX = 'R-页面验证机房-'

export function isExcludedDeviceRack(code: string): boolean {
  return code.startsWith('STUB-') || code.startsWith(LEGACY_RACK_CODE_PREFIX)
}

/** Drop legacy/stub racks from device-level topology (停用 racks are excluded by API). */
export function filterActiveDeviceSnapshot(snapshot: CableSnapshot): CableSnapshot {
  const racks = snapshot.racks.filter((r) => !isExcludedDeviceRack(r.code))
  const rackIds = new Set(racks.map((r) => r.rackId))
  const devices = snapshot.devices.filter((d) => rackIds.has(d.rackId))
  const deviceIds = new Set(devices.map((d) => d.deviceId))
  const cables = snapshot.cables.filter(
    (c) => deviceIds.has(c.source.deviceId) && deviceIds.has(c.target.deviceId),
  )
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
