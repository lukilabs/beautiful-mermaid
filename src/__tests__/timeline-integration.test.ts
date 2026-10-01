import { describe, it, expect } from 'bun:test'
import { renderMermaid } from '../index.ts'

const LR = `timeline
  title History of Social Media
  section Platforms
    2002 : LinkedIn
    2004 : Facebook
  section Mobile
    2007 : iPhone`

const TD = `timeline TD
  title Releases
  section 2024
    Q1 : Alpha
    Q2 : Beta
  section 2025
    Q1 : Stable`

describe('timeline – SVG rendering', () => {
  it('renders without throwing (LR)', async () => {
    const svg = await renderMermaid(LR)
    expect(svg).toContain('<svg')
    expect(svg).toContain('</svg>')
  })

  it('renders without throwing (TD)', async () => {
    const svg = await renderMermaid(TD)
    expect(svg).toContain('<svg')
    expect(svg).toContain('</svg>')
  })

  it('emits section names and periods', async () => {
    const svg = await renderMermaid(LR)
    expect(svg).toContain('Platforms')
    expect(svg).toContain('2002')
    expect(svg).toContain('LinkedIn')
  })

  it('emits events', async () => {
    const svg = await renderMermaid(LR)
    expect(svg).toContain('Facebook')
    expect(svg).toContain('iPhone')
  })

  it('emits the title', async () => {
    const svg = await renderMermaid(LR)
    expect(svg).toContain('History of Social Media')
  })

  it('renders flat boxes without per-section colors', async () => {
    const svg = await renderMermaid(LR)
    expect(svg).toContain('timeline-box')
    expect(svg).toContain('var(--_node-fill)')
    expect(svg).not.toContain('timeline-period-color-')
    expect(svg).not.toContain('timeline-dot-color-')
    expect(svg).not.toContain('data-timeline-colors')
  })

  it('does not render a label for the implicit default section', async () => {
    const svg = await renderMermaid(`timeline
  title Releases
  2024 : Alpha
  2025 : Beta`)
    expect(svg).not.toContain('DEFAULT')
    expect(svg).not.toMatch(/class="timeline-section-label"/)
    expect(svg).toContain('2024')
    expect(svg).toContain('2025')
  })
})
