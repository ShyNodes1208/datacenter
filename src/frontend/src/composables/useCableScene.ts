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
  /** Alert members inside an aggregate (focused-rack mode). */
  alertCount?: number
  sourceRackId: string
  targetRackId: string
  /** Peer rack when aggregated under focusedRackId. */
  peerRackId?: string
  corridor?: CorridorSide
  lane?: number
  /** Display label e.g. ×6⚠2 */
  countLabel?: string
  route: Point[]
  opacity: number
  highlighted: boolean
  /** Decorative flow animation; only selected cables may be true (VIS-003). */
  animated: boolean
  isAggregated: boolean
  /** Member cable ids (aggregated or single). */
  memberIds: string[]
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
  /** Device-level aggregated bundle key (sourceRack|targetRack|purpose) or peer|purpose when focused. */
  selectedBundleId?: string | null
  /** Device-level rack focus (corridor aggregation mode). */
  focusedRackId?: string | null
  /** Expanded peer|purpose (or legacy) bundle key — members drawn as individual cables. */
  expandedBundleKey?: string | null
}

export type CorridorSide = 'upper' | 'lower'

/** Vertical gap from rack edge to first corridor lane. */
export const CORRIDOR_BASE_GAP = 32
/** Spacing between parallel lanes in one corridor. */
export const CORRIDOR_LANE_SPACING = 9
/** Hard cap on distinct lanes per corridor; overflow reuses lanes. */
export const CORRIDOR_MAX_LANES = 8
/** Dim opacity for unrelated cables while a rack is focused (idle leftovers). */
export const FOCUSED_UNRELATED_OPACITY = 0.08
/** Dim opacity for non-expanded bundles while one bundle is expanded. */
export const EXPANDED_OTHER_OPACITY = 0.1
/** Unrelated rack chrome opacity while focused (TopologyView). */
export const FOCUSED_DIM_RACK_OPACITY = 0.4
/** Horizontal span (px) above which unconfigured purposes prefer the upper corridor. */
export const UNCONFIGURED_SPAN_UPPER_THRESHOLD = 400

export interface CorridorLayout {
  upperBaseY: number
  lowerBaseY: number
  racks: RackInfo[]
}

export interface LaneInterval {
  id: string
  side: CorridorSide
  x1: number
  x2: number
  key: string
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

/** Device-level U height in scene pixels. Shared by TopologyView panels and cable anchors. */
export const DEVICE_U_PX = 20

/** Idle (no selection/focus) cable opacity — keeps lines below device panels. */
export const DEFAULT_CABLE_OPACITY = 0.22

/** Unrelated cable opacity when another cable/device is focused (FR-VIS-10 / P0-3). */
export const UNSELECTED_OPACITY = 0.1

/** Idle cable stroke width in canvas pixels. */
export const DEFAULT_STROKE_WIDTH = 1.25

/** Selected cable stroke width in canvas pixels (FR-VIS-10 / P0-3). */
export const SELECTED_STROKE_WIDTH = 4.5

/** Semantic zoom: hide ordinary device names / port chrome below this scale. */
export const SEMANTIC_SCALE_NAME = 0.55

/** Semantic zoom: show focused-device port anchors/labels at or above this scale. */
export const SEMANTIC_SCALE_PORT = 0.9

/** Hysteresis band around semantic thresholds to avoid flicker while zooming. */
export const SEMANTIC_SCALE_HYSTERESIS = 0.03

/** 2.5D iso depth on rack front face (TopologyView drawIsoRack / hit overlay). */
export const RACK_VISUAL_DEPTH_X = 16
/** Title band above rack front face included in rack hit target. */
export const RACK_HIT_TITLE_BAND = 28
/** Horizontal offset outside rack array when no column gap exists (single-column layouts). */
export const RACK_OUTER_AISLE_PAD = 40

/** Device-level rack grid layout constants (shared by layout + TopologyView). */
export const DEVICE_RACK_W = 240
export const DEVICE_RACK_GAP_X = 340
export const DEVICE_ROW_GAP_Y = 48
export const DEVICE_LAYOUT_ORIGIN_X = 80
export const DEVICE_LAYOUT_ORIGIN_Y = 110
export const DEVICE_COMPACT_EMPTY_RACK_H = 240
/** Reserve for cable channels + legend when scoring fitScale. */
export const DEVICE_LAYOUT_MARGIN_X = 96
export const DEVICE_LAYOUT_MARGIN_Y = 72
export const DEVICE_LAYOUT_MAX_FIT_SCALE = 2

/** Static arrow spacing along a route (FR-VIS-09). */
export const ARROW_SPACING_PX = 80

/** Decorative animation period in ms (FR-VIS-11). */
export const ANIMATION_PERIOD_MS = 1400

export interface SemanticZoomState {
  showDeviceNames: boolean
  showPortAnchors: boolean
  showPortLabels: boolean
}

/** Resolve semantic zoom flags with hysteresis (no framework state required). */
export function resolveSemanticZoom(
  scale: number,
  previous: SemanticZoomState | null = null,
): SemanticZoomState {
  const h = SEMANTIC_SCALE_HYSTERESIS
  const prev = previous ?? {
    showDeviceNames: scale >= SEMANTIC_SCALE_NAME,
    showPortAnchors: scale >= SEMANTIC_SCALE_PORT,
    showPortLabels: scale >= SEMANTIC_SCALE_PORT,
  }

  const showDeviceNames = prev.showDeviceNames
    ? scale >= SEMANTIC_SCALE_NAME - h
    : scale >= SEMANTIC_SCALE_NAME
  const showPorts = prev.showPortAnchors
    ? scale >= SEMANTIC_SCALE_PORT - h
    : scale >= SEMANTIC_SCALE_PORT

  return {
    showDeviceNames,
    showPortAnchors: showPorts,
    showPortLabels: showPorts,
  }
}

export function rackDisplayHeight(
  devices: Array<{ endU: number }>,
  emptyHeight = DEVICE_COMPACT_EMPTY_RACK_H,
  uPx = DEVICE_U_PX,
): number {
  if (devices.length === 0) return emptyHeight
  const maxEndU = Math.max(...devices.map((d) => d.endU))
  return maxEndU > 0 ? Math.max(maxEndU * uPx + 32, 120) : emptyHeight
}

export function measureDeviceGridLayout(
  rackHeights: number[],
  colCount: number,
  options?: {
    gapX?: number
    rowGapY?: number
    originX?: number
    originY?: number
    rackW?: number
    extraHeight?: number
  },
): { contentW: number; contentH: number; rows: number; rowHeights: number[] } {
  const gapX = options?.gapX ?? DEVICE_RACK_GAP_X
  const rowGapY = options?.rowGapY ?? DEVICE_ROW_GAP_Y
  const originX = options?.originX ?? DEVICE_LAYOUT_ORIGIN_X
  const originY = options?.originY ?? DEVICE_LAYOUT_ORIGIN_Y
  const rackW = options?.rackW ?? DEVICE_RACK_W
  const extraHeight = options?.extraHeight ?? 0
  const n = rackHeights.length
  const cols = Math.max(1, Math.min(colCount, Math.max(1, n)))
  const rows = Math.max(1, Math.ceil(n / cols))
  const rowHeights: number[] = []
  for (let row = 0; row < rows; row++) {
    const slice = rackHeights.slice(row * cols, row * cols + cols)
    rowHeights.push(slice.length ? Math.max(...slice) : DEVICE_COMPACT_EMPTY_RACK_H)
  }
  const contentW = n === 0
    ? originX + rackW
    : originX + (cols - 1) * gapX + rackW + originX
  const rowsH = rowHeights.reduce((sum, h) => sum + h, 0)
  const contentH = originY + rowsH + Math.max(0, rows - 1) * rowGapY + extraHeight + originY
  return { contentW, contentH, rows, rowHeights }
}

/**
 * Choose column count maximizing fitScale = min(availW/contentW, availH/contentH, maxScale).
 * Ties prefer fewer columns (more horizontal cable channel).
 */
export function selectDeviceLayoutColumns(
  rackHeights: number[],
  availW: number,
  availH: number,
  options?: {
    maxScale?: number
    marginX?: number
    marginY?: number
    extraHeight?: number
    gapX?: number
    rowGapY?: number
    originX?: number
    originY?: number
    rackW?: number
  },
): { colCount: number; contentW: number; contentH: number; fitScale: number; rows: number } {
  const n = rackHeights.length
  const maxScale = options?.maxScale ?? DEVICE_LAYOUT_MAX_FIT_SCALE
  const marginX = options?.marginX ?? DEVICE_LAYOUT_MARGIN_X
  const marginY = options?.marginY ?? DEVICE_LAYOUT_MARGIN_Y
  const usableW = Math.max(1, availW - marginX)
  const usableH = Math.max(1, availH - marginY)

  if (n === 0) {
    return { colCount: 1, contentW: 1, contentH: 1, fitScale: 1, rows: 1 }
  }

  let best = {
    colCount: 1,
    contentW: 1,
    contentH: 1,
    fitScale: -1,
    rows: n,
  }

  for (let cols = 1; cols <= n; cols++) {
    const measured = measureDeviceGridLayout(rackHeights, cols, options)
    const fitScale = Math.min(
      maxScale,
      usableW / measured.contentW,
      usableH / measured.contentH,
    )
    if (
      fitScale > best.fitScale + 1e-9
      || (Math.abs(fitScale - best.fitScale) <= 1e-9 && cols < best.colCount)
    ) {
      best = {
        colCount: cols,
        contentW: measured.contentW,
        contentH: measured.contentH,
        fitScale,
        rows: measured.rows,
      }
    }
  }

  return best
}

export interface DeviceLayoutResult {
  snapshot: CableSnapshot
  colCount: number
  contentW: number
  contentH: number
  fitScale: number
  rows: number
}

/** Layout device-level racks into an adaptive grid; floor devices stay below the last row. */
export function layoutDeviceLevelSnapshot(
  snapshot: CableSnapshot,
  options: {
    availW: number
    availH: number
    /** When set, skip column search and use this count (panel open / locked layout). */
    lockedColCount?: number | null
  },
): DeviceLayoutResult {
  const filtered = filterActiveDeviceSnapshot(snapshot)
  const floorRack = filtered.racks.find((r) => r.code === 'FLOOR')
  const rackRacks = filtered.racks
    .filter((r) => r.code !== 'FLOOR' && !r.code.startsWith('STUB-'))
    .sort((a, b) => a.code.localeCompare(b.code))
  const floorDevices = floorRack
    ? filtered.devices.filter((d) => d.rackId === floorRack.rackId)
    : []

  const devicesByRack = new Map<string, DeviceInfo[]>()
  for (const device of filtered.devices) {
    if (floorRack && device.rackId === floorRack.rackId) continue
    const list = devicesByRack.get(device.rackId) ?? []
    list.push(device)
    devicesByRack.set(device.rackId, list)
  }

  const rackHeights = rackRacks.map((rack) => {
    const devices = (devicesByRack.get(rack.rackId) ?? [])
      .slice()
      .sort((a, b) => a.startU - b.startU || a.deviceName.localeCompare(b.deviceName))
    return rackDisplayHeight(devices)
  })

  const floorExtra = floorDevices.length > 0
    ? (floorDevices.some((d) =>
      d.deviceType.includes('存储') || d.deviceType.includes('备份')
      || d.deviceName.startsWith('STORAGE') || d.deviceName.startsWith('BAK'),
    ) ? 180 + 120 : 120) + DEVICE_ROW_GAP_Y
    : 0

  const selected = options.lockedColCount != null && options.lockedColCount > 0
    ? (() => {
      const cols = Math.max(1, Math.min(options.lockedColCount!, Math.max(1, rackRacks.length || 1)))
      const measured = measureDeviceGridLayout(rackHeights, cols, { extraHeight: floorExtra })
      const usableW = Math.max(1, options.availW - DEVICE_LAYOUT_MARGIN_X)
      const usableH = Math.max(1, options.availH - DEVICE_LAYOUT_MARGIN_Y)
      return {
        colCount: cols,
        contentW: measured.contentW,
        contentH: measured.contentH,
        fitScale: Math.min(
          DEVICE_LAYOUT_MAX_FIT_SCALE,
          usableW / measured.contentW,
          usableH / measured.contentH,
        ),
        rows: measured.rows,
      }
    })()
    : selectDeviceLayoutColumns(rackHeights, options.availW, options.availH, {
      extraHeight: floorExtra,
    })

  const colCount = rackRacks.length === 0 ? 1 : selected.colCount
  const laidRacks: RackInfo[] = []
  const laidDevices: DeviceInfo[] = []
  let cursorY = DEVICE_LAYOUT_ORIGIN_Y
  const rowCount = Math.max(1, Math.ceil(rackRacks.length / colCount))

  for (let row = 0; row < rowCount && rackRacks.length > 0; row++) {
    const slice = rackRacks.slice(row * colCount, row * colCount + colCount)
    let rowMaxH = DEVICE_COMPACT_EMPTY_RACK_H
    for (let col = 0; col < slice.length; col++) {
      const rack = slice[col]!
      const devices = (devicesByRack.get(rack.rackId) ?? [])
        .slice()
        .sort((a, b) => a.startU - b.startU || a.deviceName.localeCompare(b.deviceName))
      const height = rackDisplayHeight(devices)
      rowMaxH = Math.max(rowMaxH, height)
      laidRacks.push({
        ...rack,
        x: DEVICE_LAYOUT_ORIGIN_X + col * DEVICE_RACK_GAP_X,
        y: cursorY,
        width: DEVICE_RACK_W,
        height,
      })
      for (const device of devices) {
        laidDevices.push({ ...device })
      }
    }
    cursorY += rowMaxH + DEVICE_ROW_GAP_Y
  }

  if (floorDevices.length > 0) {
    // Reserve lower-corridor space between rack rows and floor pseudo-racks.
    const corridorReserve = CORRIDOR_BASE_GAP + CORRIDOR_MAX_LANES * CORRIDOR_LANE_SPACING
    const baseY = laidRacks.length > 0 ? cursorY + corridorReserve : DEVICE_LAYOUT_ORIGIN_Y
    const network = floorDevices.filter((d) =>
      d.deviceType.includes('交换') || d.deviceType.includes('防火')
      || d.deviceName.startsWith('SW-') || d.deviceName.startsWith('FW-'),
    )
    const storage = floorDevices.filter((d) =>
      d.deviceType.includes('存储') || d.deviceType.includes('备份')
      || d.deviceName.startsWith('STORAGE') || d.deviceName.startsWith('BAK'),
    )
    const classified = new Set([
      ...network.map((d) => d.deviceId),
      ...storage.map((d) => d.deviceId),
    ])
    const other = floorDevices.filter((d) => !classified.has(d.deviceId))
    const placeFloorDevice = (device: DeviceInfo, x: number, y: number) => {
      const floorId = `floor-${device.deviceId}`
      laidRacks.push({
        rackId: floorId,
        code: device.deviceName,
        x,
        y,
        width: DEVICE_RACK_W,
        height: Math.max(device.endU - device.startU + 1, 1) * DEVICE_U_PX + 16,
      })
      laidDevices.push({
        ...device,
        rackId: floorId,
        startU: 1,
        endU: Math.max(1, device.endU - device.startU + 1),
      })
    }
    network.forEach((device, i) => {
      placeFloorDevice(device, DEVICE_LAYOUT_ORIGIN_X + i * DEVICE_RACK_GAP_X, baseY)
    })
    storage.forEach((device, i) => {
      placeFloorDevice(device, DEVICE_LAYOUT_ORIGIN_X + i * DEVICE_RACK_GAP_X, baseY + 180)
    })
    // Unclassified FLOOR devices: keep last row so nothing is dropped from layout/cables.
    other.forEach((device, i) => {
      placeFloorDevice(device, DEVICE_LAYOUT_ORIGIN_X + i * DEVICE_RACK_GAP_X, baseY + 360)
    })
  }

  const deviceRackByDeviceId = new Map(laidDevices.map((d) => [d.deviceId, d.rackId]))
  const rackCodeByRackId = new Map(laidRacks.map((r) => [r.rackId, r.code]))
  const remappedCables = filtered.cables.map((c) => {
    const srcRackId = deviceRackByDeviceId.get(c.source.deviceId) ?? c.source.rackId
    const tgtRackId = deviceRackByDeviceId.get(c.target.deviceId) ?? c.target.rackId
    return {
      ...c,
      source: {
        ...c.source,
        rackId: srcRackId,
        rackCode: (srcRackId && rackCodeByRackId.get(srcRackId)) ?? c.source.rackCode,
      },
      target: {
        ...c.target,
        rackId: tgtRackId,
        rackCode: (tgtRackId && rackCodeByRackId.get(tgtRackId)) ?? c.target.rackCode,
      },
    }
  })

  const bounds = laidRacks.length === 0
    ? { contentW: selected.contentW, contentH: selected.contentH }
    : {
      contentW: Math.max(
        ...laidRacks.map((r) => r.x + r.width),
      ) + DEVICE_LAYOUT_ORIGIN_X,
      contentH: Math.max(
        ...laidRacks.map((r) => r.y + r.height),
      ) + DEVICE_LAYOUT_ORIGIN_Y,
    }

  return {
    snapshot: {
      racks: laidRacks,
      devices: laidDevices,
      cables: remappedCables,
    },
    colCount,
    contentW: bounds.contentW,
    contentH: bounds.contentH,
    fitScale: selected.fitScale,
    rows: selected.rows,
  }
}

/** Racks used by "适应机柜" (exclude floor pseudo-racks). */
export function isPrimaryDeviceRack(rack: { rackId: string; code: string }): boolean {
  return rack.code !== 'FLOOR' && !rack.rackId.startsWith('floor-')
}

export function computeCorridorLayout(racks: RackInfo[]): CorridorLayout {
  const primary = racks.filter((r) => isPrimaryDeviceRack(r))
  const use = primary.length > 0 ? primary : racks
  if (use.length === 0) {
    return { upperBaseY: CORRIDOR_BASE_GAP, lowerBaseY: 400, racks: [] }
  }
  const minY = Math.min(...use.map((r) => r.y))
  const maxY = Math.max(...use.map((r) => r.y + r.height))
  return {
    upperBaseY: minY - CORRIDOR_BASE_GAP,
    lowerBaseY: maxY + CORRIDOR_BASE_GAP,
    racks: use,
  }
}

/**
 * Purpose → corridor.
 * 管理/正常/上联 → upper; 业务网络/存储 → lower.
 * Unconfigured: fewer occupied corridor wins; ties use span threshold.
 */
export function corridorForPurpose(
  purpose: string,
  opts?: { spanPx?: number; upperCount?: number; lowerCount?: number },
): CorridorSide {
  if (purpose === '上联' || purpose === '正常' || purpose === '管理网络') return 'upper'
  if (purpose === '存储' || purpose === '存储网络' || purpose === '业务网络') return 'lower'
  const upperCount = opts?.upperCount ?? 0
  const lowerCount = opts?.lowerCount ?? 0
  if (upperCount !== lowerCount) {
    return upperCount < lowerCount ? 'upper' : 'lower'
  }
  return (opts?.spanPx ?? 0) >= UNCONFIGURED_SPAN_UPPER_THRESHOLD ? 'upper' : 'lower'
}

export function corridorLaneY(layout: CorridorLayout, side: CorridorSide, lane: number): number {
  const clamped = Math.max(0, Math.min(CORRIDOR_MAX_LANES - 1, lane))
  if (side === 'upper') return layout.upperBaseY - clamped * CORRIDOR_LANE_SPACING
  return layout.lowerBaseY + clamped * CORRIDOR_LANE_SPACING
}

export function rackConvergePoint(rack: RackInfo, side: CorridorSide): Point {
  return {
    x: rack.x + rack.width / 2,
    y: side === 'upper' ? rack.y : rack.y + rack.height,
  }
}

/** Peer rack id for a cable relative to focused rack; null if unrelated or same-rack. */
export function peerRackId(focusedRackId: string, cable: CableInfo): string | null {
  const src = cable.source.rackId ?? '__none__'
  const tgt = cable.target.rackId ?? '__none__'
  if (src === focusedRackId && tgt !== focusedRackId) return tgt
  if (tgt === focusedRackId && src !== focusedRackId) return src
  return null
}

/** Direction-independent aggregate key: peerRack|purpose. */
export function focusedPeerBundleKey(focusedRackId: string, cable: CableInfo): string | null {
  const peer = peerRackId(focusedRackId, cable)
  if (!peer) return null
  return `${peer}|${cable.purpose}`
}

export function bundleCountLabel(count: number, alertCount: number): string {
  if (alertCount > 0) return `×${count}⚠${alertCount}`
  return `×${count}`
}

/**
 * Greedy lane assignment per corridor.
 * Larger spans prefer outer lanes; non-overlapping intervals reuse lanes;
 * capacity capped at CORRIDOR_MAX_LANES with stable reuse on overflow.
 */
export function assignCorridorLanes(intervals: LaneInterval[]): Map<string, number> {
  const result = new Map<string, number>()
  const bySide: Record<CorridorSide, LaneInterval[]> = { upper: [], lower: [] }
  for (const item of intervals) bySide[item.side].push(item)

  for (const side of ['upper', 'lower'] as CorridorSide[]) {
    const items = bySide[side].slice().sort((a, b) => {
      const spanA = Math.abs(a.x2 - a.x1)
      const spanB = Math.abs(b.x2 - b.x1)
      return spanB - spanA
        || Math.min(a.x1, a.x2) - Math.min(b.x1, b.x2)
        || Math.max(a.x1, a.x2) - Math.max(b.x1, b.x2)
        || a.key.localeCompare(b.key)
    })
    const laneEnds: Array<Array<{ x1: number; x2: number }>> = Array.from(
      { length: CORRIDOR_MAX_LANES },
      () => [],
    )
    for (const item of items) {
      const x1 = Math.min(item.x1, item.x2)
      const x2 = Math.max(item.x1, item.x2)
      let assigned = -1
      for (let lane = CORRIDOR_MAX_LANES - 1; lane >= 0; lane--) {
        const overlaps = laneEnds[lane]!.some((seg) => !(x2 <= seg.x1 || x1 >= seg.x2))
        if (!overlaps) {
          assigned = lane
          break
        }
      }
      if (assigned < 0) {
        let hash = 0
        for (let i = 0; i < item.key.length; i++) hash = (hash * 31 + item.key.charCodeAt(i)) | 0
        assigned = Math.abs(hash) % CORRIDOR_MAX_LANES
      }
      laneEnds[assigned]!.push({ x1, x2 })
      result.set(item.id, assigned)
    }
  }
  return result
}

/** True when a horizontal segment at y overlaps a rack body (open interval on Y). */
export function horizontalSegIntersectsRack(
  x1: number,
  x2: number,
  y: number,
  rack: RackInfo,
): boolean {
  if (y <= rack.y || y >= rack.y + rack.height) return false
  const left = Math.min(x1, x2)
  const right = Math.max(x1, x2)
  return right > rack.x && left < rack.x + rack.width
}

/** True when a vertical segment at x overlaps a rack body (open interval on X). */
export function verticalSegIntersectsRack(
  x: number,
  y1: number,
  y2: number,
  rack: RackInfo,
): boolean {
  const top = Math.min(y1, y2)
  const bottom = Math.max(y1, y2)
  if (bottom <= rack.y || top >= rack.y + rack.height) return false
  return x > rack.x && x < rack.x + rack.width
}

/** All orthogonal route segments must avoid unrelated rack interiors (H + V). */
export function routeSegmentsClear(
  route: Point[],
  racks: RackInfo[],
  endpointRackIds: Set<string>,
): boolean {
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1]!
    const b = route[i]!
    if (Math.abs(a.y - b.y) <= 0.5) {
      for (const rack of racks) {
        if (endpointRackIds.has(rack.rackId)) continue
        if (horizontalSegIntersectsRack(a.x, b.x, a.y, rack)) return false
      }
    } else if (Math.abs(a.x - b.x) <= 0.5) {
      for (const rack of racks) {
        if (endpointRackIds.has(rack.rackId)) continue
        if (verticalSegIntersectsRack(a.x, a.y, b.y, rack)) return false
      }
    }
  }
  return true
}

/** CSS pixel bounds for device-level rack hit overlay (full 2.5D visual outline). */
export function rackHitTargetStyle(
  rack: Pick<RackInfo, 'x' | 'y' | 'width' | 'height'>,
  options?: { titleBand?: number; depthX?: number },
): Record<string, string> {
  const titleBand = options?.titleBand ?? RACK_HIT_TITLE_BAND
  const depthX = options?.depthX ?? RACK_VISUAL_DEPTH_X
  return {
    left: `${rack.x}px`,
    top: `${rack.y - titleBand}px`,
    width: `${rack.width + depthX}px`,
    height: `${rack.height + titleBand}px`,
  }
}

/** Pick a vertical aisle X in the nearest column gap beside a rack. */
export function rackColumnAisleX(rack: RackInfo, racks: RackInfo[]): number {
  const rightNeighbor = racks
    .filter((r) => r.rackId !== rack.rackId && r.x >= rack.x + rack.width - 0.5)
    .sort((a, b) => a.x - b.x)[0]
  const leftNeighbor = racks
    .filter((r) => r.rackId !== rack.rackId && r.x + r.width <= rack.x + 0.5)
    .sort((a, b) => b.x - a.x)[0]
  if (rightNeighbor) {
    return (rack.x + rack.width + rightNeighbor.x) / 2
  }
  if (leftNeighbor) {
    return (leftNeighbor.x + leftNeighbor.width + rack.x) / 2
  }
  const primary = racks.filter((r) => isPrimaryDeviceRack(r))
  const use = primary.length > 0 ? primary : racks
  if (use.length === 0) return rack.x + rack.width / 2
  const minX = Math.min(...use.map((r) => r.x))
  const maxRight = Math.max(...use.map((r) => r.x + r.width))
  const rightAisle = maxRight + RACK_OUTER_AISLE_PAD
  const leftAisle = minX - RACK_OUTER_AISLE_PAD
  const rackCenter = rack.x + rack.width / 2
  const distRight = Math.abs(rightAisle - rackCenter)
  const distLeft = Math.abs(leftAisle - rackCenter)
  return distRight <= distLeft ? rightAisle : leftAisle
}

/** Pick a vertical aisle X in a column gap so multi-row vertical stubs avoid rack bodies. */
export function corridorAisleX(
  srcRack: RackInfo,
  tgtRack: RackInfo,
  racks: RackInfo[],
): number {
  const leftRight = Math.min(srcRack.x + srcRack.width, tgtRack.x + tgtRack.width)
  const rightLeft = Math.max(srcRack.x, tgtRack.x)
  if (leftRight < rightLeft - 0.5) {
    return (leftRight + rightLeft) / 2
  }
  return rackColumnAisleX(srcRack, racks)
}

/** Horizontal corridor segment must not cross unrelated rack bodies. */
export function corridorHorizontalClear(
  route: Point[],
  racks: RackInfo[],
  endpointRackIds: Set<string>,
): boolean {
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1]!
    const b = route[i]!
    if (Math.abs(a.y - b.y) > 0.5) continue
    for (const rack of racks) {
      if (endpointRackIds.has(rack.rackId)) continue
      if (horizontalSegIntersectsRack(a.x, b.x, a.y, rack)) return false
    }
  }
  return true
}

function corridorDevicePortPoint(
  device: DeviceInfo,
  rack: RackInfo,
  side: CorridorSide,
  slotIndex = 0,
  slotCount = 1,
): Point {
  const uHeight = device.endU - device.startU + 1
  const unitPx = rack.height >= 120 ? DEVICE_U_PX : (rack.height / Math.max(1, uHeight || 1))
  const deviceTopY = rack.y + (device.startU - 1) * unitPx
  const deviceHeight = Math.max(uHeight * unitPx, 16)
  const t = slotCount > 1 ? (slotIndex + 1) / (slotCount + 1) : 0.5
  return {
    x: rack.x + rack.width * t,
    y: side === 'upper' ? deviceTopY : deviceTopY + deviceHeight,
  }
}

export interface CorridorRouteOptions {
  layout: CorridorLayout
  side: CorridorSide
  lane: number
  includeInternal?: boolean
  srcDevice?: DeviceInfo
  tgtDevice?: DeviceInfo
  srcSlot?: { index: number; count: number }
  tgtSlot?: { index: number; count: number }
  memberOffset?: number
}

/** Orthogonal corridor route: port stubs → aisle exit → corridor lane → aisle entry → peer. */
export function routeViaCorridor(
  srcRack: RackInfo,
  tgtRack: RackInfo,
  options: CorridorRouteOptions,
): Point[] {
  const side = options.side
  const laneY = corridorLaneY(options.layout, side, options.lane) + (options.memberOffset ?? 0)
  const srcConv = rackConvergePoint(srcRack, side)
  const tgtConv = rackConvergePoint(tgtRack, side)
  const racks = options.layout.racks
  const srcAisleX = rackColumnAisleX(srcRack, racks)
  const tgtAisleX = rackColumnAisleX(tgtRack, racks)
  const points: Point[] = []
  if (options.includeInternal && options.srcDevice) {
    points.push(corridorDevicePortPoint(
      options.srcDevice,
      srcRack,
      side,
      options.srcSlot?.index ?? 0,
      options.srcSlot?.count ?? 1,
    ))
  }
  points.push(srcConv)
  if (Math.abs(srcConv.x - srcAisleX) > 0.5) {
    points.push({ x: srcAisleX, y: srcConv.y })
  }
  points.push({ x: srcAisleX, y: laneY })
  if (Math.abs(tgtAisleX - srcAisleX) > 0.5) {
    points.push({ x: tgtAisleX, y: laneY })
  }
  if (Math.abs(tgtConv.y - laneY) > 0.5) {
    points.push({ x: tgtAisleX, y: tgtConv.y })
  }
  if (Math.abs(tgtConv.x - tgtAisleX) > 0.5) {
    points.push({ x: tgtConv.x, y: tgtConv.y })
  }
  const last = points[points.length - 1]!
  if (Math.abs(last.x - tgtConv.x) > 0.5 || Math.abs(last.y - tgtConv.y) > 0.5) {
    points.push(tgtConv)
  }
  if (options.includeInternal && options.tgtDevice) {
    points.push(corridorDevicePortPoint(
      options.tgtDevice,
      tgtRack,
      side,
      options.tgtSlot?.index ?? 0,
      options.tgtSlot?.count ?? 1,
    ))
  }
  return points
}

/** Conservation helper: related cross-rack cables vs peer|purpose groups. */
export function focusedAggregationStats(
  cables: CableInfo[],
  focusedRackId: string,
): {
  relatedCount: number
  bundleMemberSum: number
  keys: string[]
  alertByKey: Record<string, number>
} {
  const related = cables.filter(
    (c) => (c.source.rackId === focusedRackId || c.target.rackId === focusedRackId)
      && (c.source.rackId !== c.target.rackId),
  )
  const groups = new Map<string, CableInfo[]>()
  for (const c of related) {
    const key = focusedPeerBundleKey(focusedRackId, c)!
    const list = groups.get(key)
    if (list) list.push(c)
    else groups.set(key, [c])
  }
  const alertByKey: Record<string, number> = {}
  let sum = 0
  for (const [key, group] of groups) {
    sum += group.length
    alertByKey[key] = group.filter((c) => c.status === '告警').length
  }
  return {
    relatedCount: related.length,
    bundleMemberSum: sum,
    keys: [...groups.keys()].sort(),
    alertByKey,
  }
}

function buildFocusedRackBundles(
  cables: CableInfo[],
  focusedRackId: string,
  rackMap: Map<string, RackInfo>,
  deviceMap: Map<string, DeviceInfo>,
  portSlots: PortSlotMap,
  exitOffsets: Map<string, number>,
  expandedBundleKey: string | null,
  selectedCableId: string | null,
): CableBundle[] {
  const racks = [...rackMap.values()]
  const layout = computeCorridorLayout(racks)
  const related = cables.filter(
    (c) => c.source.rackId === focusedRackId || c.target.rackId === focusedRackId,
  )
  const sameRack: CableInfo[] = []
  const groups = new Map<string, CableInfo[]>()
  for (const c of related) {
    const key = focusedPeerBundleKey(focusedRackId, c)
    if (!key) {
      sameRack.push(c)
      continue
    }
    const list = groups.get(key)
    if (list) list.push(c)
    else groups.set(key, [c])
  }

  let upperCount = 0
  let lowerCount = 0
  const sideByKey = new Map<string, CorridorSide>()
  for (const [key, group] of groups) {
    const sample = group[0]!
    const peer = peerRackId(focusedRackId, sample)!
    const a = rackMap.get(focusedRackId)
    const b = rackMap.get(peer)
    const spanPx = a && b
      ? Math.abs((a.x + a.width / 2) - (b.x + b.width / 2))
      : 0
    const side = corridorForPurpose(sample.purpose, { spanPx, upperCount, lowerCount })
    sideByKey.set(key, side)
    if (side === 'upper') upperCount++
    else lowerCount++
  }

  const intervals: LaneInterval[] = []
  for (const [key, group] of groups) {
    const sample = group[0]!
    const peer = peerRackId(focusedRackId, sample)!
    const a = rackMap.get(focusedRackId)
    const b = rackMap.get(peer)
    if (!a || !b) continue
    intervals.push({
      id: key,
      side: sideByKey.get(key) ?? 'upper',
      x1: a.x + a.width / 2,
      x2: b.x + b.width / 2,
      key,
    })
  }
  const lanes = assignCorridorLanes(intervals)
  const bundles: CableBundle[] = []

  for (const [key, group] of groups) {
    const sample = group[0]!
    const peer = peerRackId(focusedRackId, sample)!
    const side = sideByKey.get(key) ?? 'upper'
    const lane = lanes.get(key) ?? 0
    const fromRack = rackMap.get(focusedRackId)
    const toRack = rackMap.get(peer)
    if (!fromRack || !toRack) continue
    const purposeColor = purposeNetworkColor(sample.purpose, sample.cableType)
    const alertCount = group.filter((c) => c.status === '告警').length

    if (expandedBundleKey === key) {
      group.forEach((c, idx) => {
        const fromDeviceId = c.source.rackId === focusedRackId ? c.source.deviceId : c.target.deviceId
        const toDeviceId = c.source.rackId === focusedRackId ? c.target.deviceId : c.source.deviceId
        const fromPortName = c.source.rackId === focusedRackId ? c.source.portName : c.target.portName
        const toPortName = c.source.rackId === focusedRackId ? c.target.portName : c.source.portName
        const fromDevice = resolveDevice(deviceMap, fromDeviceId, focusedRackId, fromDeviceId)
        const toDevice = resolveDevice(deviceMap, toDeviceId, peer, toDeviceId)
        const fromSlot = edgePortOptions(fromDeviceId, fromPortName, portSlots)
        const toSlot = edgePortOptions(toDeviceId, toPortName, portSlots)
        const offset = (idx - (group.length - 1) / 2) * 3
        const route = routeViaCorridor(fromRack, toRack, {
          layout,
          side,
          lane,
          includeInternal: true,
          srcDevice: fromDevice,
          tgtDevice: toDevice,
          srcSlot: { index: fromSlot.slotIndex ?? 0, count: fromSlot.slotCount ?? 1 },
          tgtSlot: { index: toSlot.slotIndex ?? 0, count: toSlot.slotCount ?? 1 },
          memberOffset: offset,
        })
        const selected = selectedCableId === c.cableId
        bundles.push({
          id: c.cableId,
          purpose: c.purpose,
          cableType: c.cableType,
          strokeColor: isAlertCable(c) ? NETWORK_COLORS.alert : purposeColor,
          count: 1,
          alertCount: isAlertCable(c) ? 1 : 0,
          sourceRackId: c.source.rackId ?? focusedRackId,
          targetRackId: c.target.rackId ?? peer,
          peerRackId: peer,
          corridor: side,
          lane,
          route,
          opacity: selected || !selectedCableId ? 1 : EXPANDED_OTHER_OPACITY,
          highlighted: selected,
          animated: selected,
          isAggregated: false,
          memberIds: [c.cableId],
          direction: 'forward',
        })
      })
      continue
    }

    bundles.push({
      id: key,
      purpose: sample.purpose,
      cableType: sample.cableType,
      strokeColor: purposeColor,
      count: group.length,
      alertCount,
      sourceRackId: focusedRackId,
      targetRackId: peer,
      peerRackId: peer,
      corridor: side,
      lane,
      route: routeViaCorridor(fromRack, toRack, { layout, side, lane, includeInternal: false }),
      opacity: expandedBundleKey ? EXPANDED_OTHER_OPACITY : 1,
      highlighted: false,
      animated: false,
      isAggregated: true,
      memberIds: group.map((c) => c.cableId),
      direction: 'forward',
      countLabel: bundleCountLabel(group.length, alertCount),
    })
  }

  for (const c of sameRack) {
    bundles.push(cableToBundle(c, rackMap, deviceMap, portSlots, exitOffsets, {
      opacity: expandedBundleKey ? EXPANDED_OTHER_OPACITY : 1,
      highlighted: selectedCableId === c.cableId,
      animated: selectedCableId === c.cableId,
      alertCount: isAlertCable(c) ? 1 : 0,
    }))
  }

  if (selectedCableId && expandedBundleKey) {
    const selected = bundles.find((b) => b.id === selectedCableId)
    if (selected) {
      for (const b of bundles) {
        if (b.id === selectedCableId) {
          b.opacity = 1
          b.highlighted = true
          b.animated = true
        } else {
          b.opacity = Math.min(b.opacity, EXPANDED_OTHER_OPACITY)
          b.highlighted = false
          b.animated = false
        }
      }
    }
  }

  return bundles
}

/** Rewrite cross-rack idle/device bundles onto corridor lanes (no internal stubs). */
export function applyIdleCorridorRoutes(
  bundles: CableBundle[],
  racks: RackInfo[],
  cables: CableInfo[],
): CableBundle[] {
  const rackMap = new Map(racks.map((r) => [r.rackId, r]))
  const layout = computeCorridorLayout(racks)
  const cableById = new Map(cables.map((c) => [c.cableId, c]))
  let upperCount = 0
  let lowerCount = 0
  const intervals: LaneInterval[] = []
  const meta = new Map<string, { side: CorridorSide; src: RackInfo; tgt: RackInfo }>()

  for (const b of bundles) {
    if (b.sourceRackId === b.targetRackId) continue
    const src = rackMap.get(b.sourceRackId)
    const tgt = rackMap.get(b.targetRackId)
    if (!src || !tgt) continue
    const sample = cableById.get(b.memberIds[0] ?? '')
    const purpose = sample?.purpose ?? b.purpose
    const spanPx = Math.abs((src.x + src.width / 2) - (tgt.x + tgt.width / 2))
    const side = corridorForPurpose(purpose, { spanPx, upperCount, lowerCount })
    if (side === 'upper') upperCount++
    else lowerCount++
    meta.set(b.id, { side, src, tgt })
    intervals.push({
      id: b.id,
      side,
      x1: src.x + src.width / 2,
      x2: tgt.x + tgt.width / 2,
      key: b.id,
    })
  }
  const lanes = assignCorridorLanes(intervals)
  return bundles.map((b) => {
    const m = meta.get(b.id)
    if (!m) return b
    const lane = lanes.get(b.id) ?? 0
    return {
      ...b,
      corridor: m.side,
      lane,
      route: routeViaCorridor(m.src, m.tgt, {
        layout,
        side: m.side,
        lane,
        includeInternal: false,
      }),
    }
  })
}

export function visualStrokeWidthForBundle(bundle: {
  highlighted: boolean
  isAggregated: boolean
  count: number
}): number {
  if (bundle.highlighted) return SELECTED_STROKE_WIDTH
  if (bundle.isAggregated) {
    return Math.max(DEFAULT_STROKE_WIDTH, (3 + Math.min(bundle.count, 10)) * 0.55)
  }
  return DEFAULT_STROKE_WIDTH
}

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
  // Tall racks use DEVICE_U_PX (same as TopologyView panels); compact floor pseudo-racks scale to height.
  const unitPx = rack.height >= 120 ? DEVICE_U_PX : (rack.height / Math.max(1, uHeight || 1))
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
  const unitPx = DEVICE_U_PX
  const panelH = Math.max(16, uHeight * unitPx - 4)
  const panelW = rack.width - 20
  const groupX = rack.x + 10
  const groupY = rack.y + (device.startU - 1) * unitPx + 2
  const type = device.deviceType
  const typeLower = type.toLowerCase()
  const compactKind =
    type.includes('交换') || typeLower.includes('switch')
    || type.includes('防火') || typeLower.includes('firewall')
    || type.includes('存储') || typeLower.includes('storage')
    || type.includes('备份')
  if (panelH < 24 || compactKind) {
    const bodyW = 120
    return {
      x: groupX + bodyW + 4,
      y: groupY + 2,
      width: Math.max(0, panelW - bodyW - 4),
      height: 14,
    }
  }
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

/** Device-level aggregate key: direction-sensitive rack pair + purpose (no cable type). */
export function deviceBundleKey(c: CableInfo): string {
  const srcRack = c.source.rackId ?? '__none__'
  const tgtRack = c.target.rackId ?? '__none__'
  return `${srcRack}|${tgtRack}|${c.purpose}`
}

function isAlertCable(c: CableInfo): boolean {
  return c.status === '告警'
}

function isSameRackCable(c: CableInfo): boolean {
  return (c.source.rackId ?? '__none__') === (c.target.rackId ?? '__none__')
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
      opacity: DEFAULT_CABLE_OPACITY,
      highlighted: false,
      animated: false,
      isAggregated: group.length > 1,
      memberIds: group.map((c) => c.cableId),
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
    opacity: DEFAULT_CABLE_OPACITY,
    highlighted: false,
    animated: false,
    isAggregated: false,
    memberIds: [c.cableId],
    direction: 'forward',
    ...overrides,
  }
}

/**
 * Device-level default aggregation: cross-rack + same purpose (≥2),
 * exclude alert cables and same-rack cables.
 * SVG paint/hit order: singles → aggregated → alerts (alerts on top).
 */
export function aggregateDeviceLevelCables(
  cables: CableInfo[],
  rackMap: Map<string, RackInfo>,
  devices: DeviceInfo[] = [],
): CableBundle[] {
  const deviceMap = new Map(devices.map((d) => [d.deviceId, d]))
  const portSlots = buildPortSlotMap(cables)
  const exitOffsets = buildSamePortExitOffsets(cables)

  const singles: CableInfo[] = []
  const alerts: CableInfo[] = []
  const groups = new Map<string, CableInfo[]>()

  for (const c of cables) {
    if (isAlertCable(c)) {
      alerts.push(c)
      continue
    }
    if (isSameRackCable(c)) {
      singles.push(c)
      continue
    }
    const key = deviceBundleKey(c)
    const group = groups.get(key)
    if (group) group.push(c)
    else groups.set(key, [c])
  }

  const aggregated: CableBundle[] = []

  for (const [key, group] of groups) {
    if (group.length < 2) {
      singles.push(...group)
      continue
    }
    const sample = group[0]!
    const parts = key.split('|')
    aggregated.push({
      id: key,
      purpose: parts[2] ?? sample.purpose,
      cableType: sample.cableType,
      strokeColor: purposeNetworkColor(sample.purpose, sample.cableType),
      count: group.length,
      sourceRackId: parts[0] ?? sample.source.rackId ?? '__none__',
      targetRackId: parts[1] ?? sample.target.rackId ?? '__none__',
      route: routeForCable(sample, rackMap, deviceMap, portSlots, exitOffsets),
      opacity: DEFAULT_CABLE_OPACITY,
      highlighted: false,
      animated: false,
      isAggregated: true,
      memberIds: group.map((c) => c.cableId),
      direction: 'forward',
    })
  }

  const bundles: CableBundle[] = []
  for (const c of singles) {
    bundles.push(cableToBundle(c, rackMap, deviceMap, portSlots, exitOffsets))
  }
  bundles.push(...aggregated)
  for (const c of alerts) {
    bundles.push(cableToBundle(c, rackMap, deviceMap, portSlots, exitOffsets))
  }

  return bundles
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
    const selectedCableId = options.selectedCableId ?? null
    const selectedBundleId = options.selectedBundleId ?? null
    const focusedRackId = options.focusedRackId ?? null
    const expandedBundleKey = options.expandedBundleKey ?? null
    // Device focus keeps per-cable expand; rack focus uses corridor peer aggregation.
    const expandAll = focus.level === 'device'

    if (focusedRackId && !expandAll) {
      const focusedBundles = buildFocusedRackBundles(
        visibleCables,
        focusedRackId,
        rackMap,
        deviceMap,
        portSlots,
        exitOffsets,
        expandedBundleKey,
        selectedCableId,
      )
      return {
        bundles: focusedBundles,
        highlightedPath: null,
        legend: buildLegend(visibleCables, deviceMap),
        detailRows: buildDetailRows(visibleCables),
        breadcrumbs: buildBreadcrumbs(snapshot, focus, resolvedRoomId),
      }
    }

    let bundles: CableBundle[] = expandAll
      ? visibleCables.map((c) => cableToBundle(c, rackMap, deviceMap, portSlots, exitOffsets))
      : aggregateDeviceLevelCables(visibleCables, rackMap, snapshot.devices)

    // Idle / device-expand: rewrite cross-rack routes onto upper/lower corridors.
    bundles = applyIdleCorridorRoutes(bundles, snapshot.racks, visibleCables)

    if (selectedCableId) {
      for (const b of bundles) {
        b.opacity = UNSELECTED_OPACITY
        b.highlighted = false
        b.animated = false
      }
      const selectedCable = visibleCables.find((c) => c.cableId === selectedCableId)
      if (selectedCable) {
        const existing = bundles.find((b) => b.id === selectedCableId)
        if (existing) {
          existing.opacity = 1
          existing.highlighted = true
          existing.animated = true
        } else {
          // Keep aggregation; overlay the selected member as an independent highlight path.
          const overlay = cableToBundle(selectedCable, rackMap, deviceMap, portSlots, exitOffsets, {
            opacity: 1,
            highlighted: true,
            animated: true,
          })
          const routed = applyIdleCorridorRoutes([overlay], snapshot.racks, visibleCables)
          bundles.push(routed[0]!)
        }
      }
    } else if (expandedBundleKey) {
      // Expand selected aggregate: replace bundle with member cables on corridor lanes.
      const agg = bundles.find((b) => b.id === expandedBundleKey && b.isAggregated)
      if (agg) {
        const memberCables = visibleCables.filter((c) => agg.memberIds.includes(c.cableId))
        const layout = computeCorridorLayout(snapshot.racks)
        const side = agg.corridor ?? corridorForPurpose(agg.purpose)
        const lane = agg.lane ?? 0
        const srcRack = rackMap.get(agg.sourceRackId)
        const tgtRack = rackMap.get(agg.targetRackId)
        const expandedMembers: CableBundle[] = []
        if (srcRack && tgtRack) {
          memberCables.forEach((c, idx) => {
            const srcDevice = resolveDevice(
              deviceMap,
              c.source.deviceId,
              c.source.rackId ?? agg.sourceRackId,
              c.source.deviceName,
            )
            const tgtDevice = resolveDevice(
              deviceMap,
              c.target.deviceId,
              c.target.rackId ?? agg.targetRackId,
              c.target.deviceName,
            )
            const srcPort = edgePortOptions(c.source.deviceId, c.source.portName, portSlots)
            const tgtPort = edgePortOptions(c.target.deviceId, c.target.portName, portSlots)
            expandedMembers.push({
              id: c.cableId,
              purpose: c.purpose,
              cableType: c.cableType,
              strokeColor: strokeForCable(c, deviceMap),
              count: 1,
              sourceRackId: c.source.rackId ?? agg.sourceRackId,
              targetRackId: c.target.rackId ?? agg.targetRackId,
              corridor: side,
              lane,
              route: routeViaCorridor(srcRack, tgtRack, {
                layout,
                side,
                lane,
                includeInternal: true,
                srcDevice,
                tgtDevice,
                srcSlot: { index: srcPort.slotIndex ?? 0, count: srcPort.slotCount ?? 1 },
                tgtSlot: { index: tgtPort.slotIndex ?? 0, count: tgtPort.slotCount ?? 1 },
                memberOffset: (idx - (memberCables.length - 1) / 2) * 3,
              }),
              opacity: 1,
              highlighted: false,
              animated: false,
              isAggregated: false,
              memberIds: [c.cableId],
              direction: 'forward',
            })
          })
        }
        bundles = [
          ...bundles.filter((b) => b.id !== expandedBundleKey).map((b) => ({
            ...b,
            opacity: EXPANDED_OTHER_OPACITY,
            highlighted: false,
            animated: false,
          })),
          ...expandedMembers,
        ]
      } else {
        for (const b of bundles) {
          const selected = b.id === expandedBundleKey
          b.opacity = selected ? 1 : UNSELECTED_OPACITY
          b.highlighted = selected
          b.animated = selected
        }
      }
    } else if (selectedBundleId) {
      for (const b of bundles) {
        const selected = b.id === selectedBundleId
        b.opacity = selected ? 1 : UNSELECTED_OPACITY
        b.highlighted = selected
        b.animated = selected
      }
    } else if (focus.level === 'device') {
      for (const b of bundles) {
        const cable = visibleCables.find((c) => c.cableId === b.id)
        const related = !!cable
          && (cable.source.deviceId === focus.deviceId || cable.target.deviceId === focus.deviceId)
        b.opacity = related ? 1 : UNSELECTED_OPACITY
        b.highlighted = related
        b.animated = false
      }
    }
    // else: keep DEFAULT_CABLE_OPACITY from builders (idle denoise)

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

/** Stage pan/zoom transform used by device-level viewport keep logic. */
export type ViewportTransform = { scale: number; x: number; y: number }

const VIEWPORT_EPS = 1e-6

export function viewportTransformsEqual(
  a: ViewportTransform,
  b: ViewportTransform,
  eps = VIEWPORT_EPS,
): boolean {
  return Math.abs(a.scale - b.scale) <= eps
    && Math.abs(a.x - b.x) <= eps
    && Math.abs(a.y - b.y) <= eps
}

/** Zoom around a screen point (wheel / +/-). */
export function zoomViewportAroundPoint(
  current: ViewportTransform,
  newScale: number,
  point: { x: number; y: number },
): ViewportTransform {
  const scale = newScale
  if (current.scale <= 0 || scale === current.scale) {
    return { scale, x: current.x, y: current.y }
  }
  return {
    scale,
    x: point.x - (point.x - current.x) * (scale / current.scale),
    y: point.y - (point.y - current.y) * (scale / current.scale),
  }
}

/** ResizeObserver: refit only when size changed and user has not adjusted. */
export function shouldAutoFitOnDeviceResize(
  userAdjusted: boolean,
  sizeChanged: boolean,
  mode: string | null | undefined,
): boolean {
  return sizeChanged && mode === 'devices' && !userAdjusted
}

/**
 * Behavioral model of device viewport keep (selection / panel / first fit / RO / manual fit).
 * TopologyView must follow the same rules; tests assert this contract without Konva/DOM.
 */
export function applyDeviceViewportAction(
  state: {
    transform: ViewportTransform
    userAdjusted: boolean
    fitAppliedForSnapshot: string | null
  },
  action:
    | { type: 'first-enter-fit'; snapshotKey: string; fit: ViewportTransform }
    | { type: 'user-zoom'; newScale: number; point: { x: number; y: number } }
    | { type: 'user-pan'; dx: number; dy: number }
    | { type: 'cable-click' }
    | { type: 'device-click' }
    | { type: 'rack-click' }
    | { type: 'bundle-expand' }
    | { type: 'bundle-collapse' }
    | { type: 'panel-open' }
    | { type: 'panel-close' }
    | { type: 'resize'; sizeChanged: boolean; mode: string; fit: ViewportTransform }
    | { type: 'manual-fit'; fit: ViewportTransform },
): {
  transform: ViewportTransform
  userAdjusted: boolean
  fitAppliedForSnapshot: string | null
} {
  switch (action.type) {
    case 'first-enter-fit': {
      if (state.fitAppliedForSnapshot === action.snapshotKey) {
        return { ...state, transform: { ...state.transform } }
      }
      return {
        transform: { ...action.fit },
        userAdjusted: false,
        fitAppliedForSnapshot: action.snapshotKey,
      }
    }
    case 'user-zoom':
      return {
        transform: zoomViewportAroundPoint(state.transform, action.newScale, action.point),
        userAdjusted: true,
        fitAppliedForSnapshot: state.fitAppliedForSnapshot,
      }
    case 'user-pan':
      return {
        transform: {
          scale: state.transform.scale,
          x: state.transform.x + action.dx,
          y: state.transform.y + action.dy,
        },
        userAdjusted: true,
        fitAppliedForSnapshot: state.fitAppliedForSnapshot,
      }
    case 'cable-click':
    case 'device-click':
    case 'rack-click':
    case 'bundle-expand':
    case 'bundle-collapse':
    case 'panel-open':
    case 'panel-close':
      // Selection / overlay panel / rack focus must not alter stage transform.
      return {
        transform: { ...state.transform },
        userAdjusted: state.userAdjusted,
        fitAppliedForSnapshot: state.fitAppliedForSnapshot,
      }
    case 'resize': {
      if (!shouldAutoFitOnDeviceResize(state.userAdjusted, action.sizeChanged, action.mode)) {
        return {
          transform: { ...state.transform },
          userAdjusted: state.userAdjusted,
          fitAppliedForSnapshot: state.fitAppliedForSnapshot,
        }
      }
      return {
        transform: { ...action.fit },
        userAdjusted: false,
        fitAppliedForSnapshot: state.fitAppliedForSnapshot,
      }
    }
    case 'manual-fit':
      return {
        transform: { ...action.fit },
        userAdjusted: false,
        fitAppliedForSnapshot: state.fitAppliedForSnapshot,
      }
    default:
      return {
        transform: { ...state.transform },
        userAdjusted: state.userAdjusted,
        fitAppliedForSnapshot: state.fitAppliedForSnapshot,
      }
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
