import { describe, expect, it } from 'vitest'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import DashboardSummaryCards from '../DashboardSummaryCards.vue'

async function renderCards(props: {
  loading: boolean
  error: string
  summary: { totalServers: number; totalRacks: number; totalCables: number } | null
}): Promise<string> {
  const app = createSSRApp(DashboardSummaryCards, props)
  return renderToString(app)
}

describe('DashboardSummaryCards', () => {
  it('renders loading skeleton for all three stat labels', async () => {
    const html = await renderCards({
      loading: true,
      error: '',
      summary: null,
    })

    expect(html).toContain('aria-label="统计概览"')
    expect(html).toContain('dash-stat-card--skeleton')
    expect(html).toContain('服务器')
    expect(html).toContain('机柜')
    expect(html).toContain('线缆')
    expect(html).not.toContain('role="alert"')
  })

  it('renders summary counts on success', async () => {
    const html = await renderCards({
      loading: false,
      error: '',
      summary: { totalServers: 3, totalRacks: 5, totalCables: 7 },
    })

    expect(html).toContain('>3<')
    expect(html).toContain('>5<')
    expect(html).toContain('>7<')
    expect(html).toContain('服务器')
    expect(html).toContain('机柜')
    expect(html).toContain('线缆')
    expect(html).not.toContain('dash-stat-card--skeleton')
  })

  it('renders error alert when API fails', async () => {
    const html = await renderCards({
      loading: false,
      error: '服务不可用',
      summary: null,
    })

    expect(html).toContain('role="alert"')
    expect(html).toContain('aria-live="polite"')
    expect(html).toContain('服务不可用')
    expect(html).not.toContain('dash-stat-card--skeleton')
  })
})
