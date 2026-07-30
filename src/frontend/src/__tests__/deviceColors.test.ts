import { describe, it, expect } from 'vitest'
import { getDeviceColor } from '../utils/deviceColors'

describe('getDeviceColor', () => {
  it('returns blue shades for server type (服务器)', () => {
    const c0 = getDeviceColor('服务器', 0)
    const c1 = getDeviceColor('服务器', 1)
    expect(c0.background).not.toBe(c1.background)
    expect(c0.background).toMatch(/^#/)
    expect(c1.background).toMatch(/^#/)
  })

  it('returns green shades for network device keywords', () => {
    for (const kw of ['网络设备', '交换机', '路由器', 'switch', 'router']) {
      const c = getDeviceColor(kw, 0)
      expect(c.background).toBeTruthy()
    }
  })

  it('returns orange shades for storage device keywords', () => {
    for (const kw of ['存储设备', '磁盘阵列', 'storage']) {
      const c = getDeviceColor(kw, 0)
      expect(c.background).toBeTruthy()
    }
  })

  it('returns red shades for security device keywords', () => {
    for (const kw of ['安全设备', '防火墙', 'firewall']) {
      const c = getDeviceColor(kw, 0)
      expect(c.background).toBeTruthy()
    }
  })

  it('returns gray for unknown device types', () => {
    const c = getDeviceColor('其他设备', 0)
    expect(c.background).toBeTruthy()
  })

  it('returns default gray for undefined/null device type', () => {
    const c = getDeviceColor(undefined, 0)
    expect(c.background).toBeTruthy()
  })

  it('alternates between primary and secondary on even/odd index', () => {
    const c0 = getDeviceColor('服务器', 0)
    const c1 = getDeviceColor('服务器', 1)
    const c2 = getDeviceColor('服务器', 2)
    expect(c0.background).toBe(c2.background)
    expect(c0.background).not.toBe(c1.background)
  })

  it('returns text, tagBg, and tagText colors', () => {
    const c = getDeviceColor('服务器', 0)
    expect(c.text).toBeTruthy()
    expect(c.tagBg).toBeTruthy()
    expect(c.tagText).toBeTruthy()
  })
})
