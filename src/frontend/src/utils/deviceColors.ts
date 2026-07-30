export interface DeviceColorResult {
  background: string
  text: string
  tagBg: string
  tagText: string
}

interface ColorPair {
  primary: string
  secondary: string
}

/** Keyword → color pair. Checked case-insensitively against deviceType. */
const COLOR_MAP: Record<string, ColorPair> = {
  '服务器':   { primary: '#3B82F6', secondary: '#60A5FA' },
  'server':   { primary: '#3B82F6', secondary: '#60A5FA' },
  '交换':     { primary: '#10B981', secondary: '#34D399' },
  '路由':     { primary: '#10B981', secondary: '#34D399' },
  'switch':   { primary: '#10B981', secondary: '#34D399' },
  'router':   { primary: '#10B981', secondary: '#34D399' },
  '网络':     { primary: '#10B981', secondary: '#34D399' },
  'network':  { primary: '#10B981', secondary: '#34D399' },
  '存储':     { primary: '#F59E0B', secondary: '#FBBF24' },
  'storage':  { primary: '#F59E0B', secondary: '#FBBF24' },
  '磁盘':     { primary: '#F59E0B', secondary: '#FBBF24' },
  '防火':     { primary: '#EF4444', secondary: '#F87171' },
  'firewall': { primary: '#EF4444', secondary: '#F87171' },
  '安全':     { primary: '#EF4444', secondary: '#F87171' },
  'security': { primary: '#EF4444', secondary: '#F87171' },
}

const DEFAULT_COLOR: ColorPair = { primary: '#6B7280', secondary: '#9CA3AF' }

function matchColorPair(deviceType: string): ColorPair {
  const lower = deviceType.toLowerCase()
  for (const [keyword, pair] of Object.entries(COLOR_MAP)) {
    if (lower.includes(keyword.toLowerCase())) {
      return pair
    }
  }
  return DEFAULT_COLOR
}

/**
 * Returns foreground/background colors for a device block.
 *
 * @param deviceType - The device's DeviceType string (Server model field).
 * @param index      - Sequential index among same-type adjacent devices; even → primary, odd → secondary.
 */
export function getDeviceColor(deviceType: string | undefined, index: number): DeviceColorResult {
  const pair = matchColorPair(deviceType ?? '')
  const bg = index % 2 === 0 ? pair.primary : pair.secondary

  return {
    background: bg,
    text: '#ffffff',
    tagBg: 'rgba(255, 255, 255, 0.2)',
    tagText: '#ffffff',
  }
}
