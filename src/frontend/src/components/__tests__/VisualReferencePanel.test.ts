import { describe, expect, it } from 'vitest'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import VisualReferencePanel from '../VisualReferencePanel.vue'

async function renderPanel(): Promise<string> {
  return renderToString(createSSRApp(VisualReferencePanel))
}

describe('VisualReferencePanel', () => {
  it('renders both exact visual reference resources', async () => {
    const html = await renderPanel()
    expect(html).toContain('/visual-reference/room-overview.png')
    expect(html).toContain('/visual-reference/cable-connection-strategy.html')
    expect(html).toContain('打开原始图片')
    expect(html).toContain('打开原始 HTML')
  })

  it('provides descriptive image alt text, lazy loading, and iframe title', async () => {
    const html = await renderPanel()
    expect(html).toContain('alt="去除冷热通道后的 V2 机房整体 2.5D 视觉参考图"')
    expect(html).toContain('loading="lazy"')
    expect(html).toContain('title="线缆连接策略可视化"')
  })

  it('keeps the cable reference in the required sandbox', async () => {
    const html = await renderPanel()
    expect(html).toContain('sandbox="allow-scripts"')
    expect(html).toContain('referrerpolicy="no-referrer"')
    expect(html).toContain('aria-label="视觉参考资源"')
  })
})
