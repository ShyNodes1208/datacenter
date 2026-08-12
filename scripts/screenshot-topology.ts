#!/usr/bin/env npx tsx
/**
 * Playwright screenshot script for 2.5D topology acceptance.
 * Usage: npx tsx scripts/screenshot-topology.ts
 * Requires: backend (5142) + frontend (5173) dev servers running.
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'fs'
import { join } from 'path'

const BASE = process.env.BASE_URL ?? 'http://localhost:5173'
const OUT = join(process.cwd(), 'screenshots')
const VIEWPORT = { width: 1536, height: 1024 }

const SHANGHAI_ID = '64D083F6-CFFB-408E-AE45-5EA0E1914A51'

async function login(page: import('playwright').Page): Promise<void> {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  const userInput = page.locator('input[name="username"], input[type="text"]').first()
  await userInput.waitFor({ state: 'visible', timeout: 5000 })
  await userInput.fill('admin')
  const pwInput = page.locator('input[name="password"], input[type="password"]').first()
  await pwInput.fill('admin123')
  await page.click('button[type="submit"]')
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 })
}

async function shot(page: import('playwright').Page, name: string): Promise<void> {
  await page.setViewportSize(VIEWPORT)
  await page.waitForTimeout(800)
  await page.screenshot({ path: join(OUT, name), fullPage: false })
  console.log(`[OK] ${name}`)
}

async function clickFirstRoomCable(page: import('playwright').Page): Promise<void> {
  const clicked = await page.evaluate(() => {
    const w = window as any
    const stage = w.__topologyKonvaStage
    if (!stage) return false
    // Konva find returns a Collection — try different access patterns
    let node: any = null
    try {
      const nodes = stage.find('.room-cable-bundle')
      if (nodes && Array.isArray(nodes)) {
        node = nodes[0]
      } else if (nodes && typeof nodes.length === 'number' && nodes.length > 0) {
        // Collection: access by index
        node = nodes[0]
      }
    } catch (e) { return false }
    if (!node) return false
    node.fire('click', {}, true)
    return true
  })
  if (!clicked) {
    throw new Error('No room-cable-bundle Konva node found on canvas')
  }
  await page.waitForTimeout(500)
}

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: VIEWPORT })
  const page = await context.newPage()

  await login(page)

  // ── 1. HOME-ROOM-LIST.png ──
  console.log('1/7: Home room list...')
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  await page.locator('.room-thumb').first().waitFor({ state: 'visible', timeout: 8000 })
  await page.locator('[data-testid="view-room-topology"]').first().waitFor({ state: 'visible', timeout: 8000 })
  await shot(page, 'HOME-ROOM-LIST.png')

  // ── 2. ROOM-TOPOLOGY-DEFAULT.png ──
  console.log('2/7: Room topology default...')
  await page.goto(`${BASE}/topology`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)
  await page.locator('.topology-canvas').waitFor({ state: 'visible', timeout: 10000 })
  await shot(page, 'ROOM-TOPOLOGY-DEFAULT.png')

  // ── 3. ROOM-TOPOLOGY-LINK-SELECTED.png ──
  console.log('3/7: Room topology link selected...')
  await clickFirstRoomCable(page)
  await page.locator('[aria-label="链路详情"]').waitFor({ state: 'visible', timeout: 5000 })
  await shot(page, 'ROOM-TOPOLOGY-LINK-SELECTED.png')

  // ── 4. ROOM-TOPOLOGY-ANIMATION-NOTICE.png ──
  console.log('4/7: Room topology animation notice...')
  // Find the animation toggle — it's the checkbox inside .anim-toggle label
  const animCheckbox = page.locator('.anim-toggle input[type="checkbox"]').first()
  await animCheckbox.waitFor({ state: 'visible', timeout: 5000 })
  await animCheckbox.check()
  await page.waitForTimeout(500)
  // The badge should appear when animation is on
  await page.locator('[data-testid="non-realtime-badge"]').waitFor({ state: 'visible', timeout: 5000 })
  await shot(page, 'ROOM-TOPOLOGY-ANIMATION-NOTICE.png')

  // ── 5. SHANGHAI-DEVICE-TOPOLOGY.png ──
  console.log('5/7: Shanghai device topology...')
  await page.goto(`${BASE}/topology?roomId=${SHANGHAI_ID}&view=devices`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(3000)
  await page.locator('.topology-canvas--devices').waitFor({ state: 'visible', timeout: 10000 })
  await shot(page, 'SHANGHAI-DEVICE-TOPOLOGY.png')

  // ── 6. SHANGHAI-DEVICE-LINK-SELECTED.png ──
  console.log('6/7: Shanghai device link selected...')
  const cableClicked = await page.evaluate(() => {
    const bundles = document.querySelectorAll(
      '.cable-overlay [data-testid="device-cable-bundle"]',
    )
    if (bundles.length === 0) return false
    const target = bundles[0] as SVGElement
    target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    return true
  })
  if (!cableClicked) {
    throw new Error(
      'No device CableLayer bundle found in .cable-overlay — cannot capture link-selected screenshot',
    )
  }
  await page.locator('[aria-label="线路详情"]').waitFor({ state: 'visible', timeout: 5000 })
  await shot(page, 'SHANGHAI-DEVICE-LINK-SELECTED.png')

  // ── 7. SHANGHAI-DEVICE-TYPES.png ──
  console.log('7/7: Shanghai device types...')
  const canvas = page.locator('.topology-canvas--devices')
  const canvasBox = await canvas.boundingBox()
  if (!canvasBox) {
    throw new Error('Device topology canvas has no bounding box')
  }
  await page.mouse.move(canvasBox.x + canvasBox.width / 2, canvasBox.y + canvasBox.height / 2)
  for (let i = 0; i < 3; i++) {
    await page.mouse.wheel(0, -100)
    await page.waitForTimeout(200)
  }
  await page.waitForTimeout(500)
  await shot(page, 'SHANGHAI-DEVICE-TYPES.png')

  await browser.close()
  console.log('\nAll 7 screenshots saved to screenshots/')
}

main().catch((err) => {
  console.error('Screenshot error:', err)
  process.exit(1)
})
