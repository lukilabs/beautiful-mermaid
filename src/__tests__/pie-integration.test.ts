import { describe, it, expect } from 'bun:test'
import { renderMermaid } from '../index.ts'

const PIE = `pie showData
  title "Revenue by Product"
  "Product A" : 45
  "Product B" : 30
  "Product C" : 25`

describe('pie – SVG rendering', () => {
  it('renders without throwing', async () => {
    const svg = await renderMermaid(PIE)
    expect(svg).toContain('<svg')
    expect(svg).toContain('</svg>')
  })

  it('emits donut slice paths with color classes', async () => {
    const svg = await renderMermaid(PIE)
    expect(svg).toContain('data-pie-colors="2"')
    expect(svg).toContain('class="pie-slice pie-color-0"')
    expect(svg).toContain('class="pie-slice pie-color-2"')
  })

  it('emits the title', async () => {
    const svg = await renderMermaid(PIE)
    expect(svg).toContain('Revenue by Product')
  })

  it('emits legend labels and percentages', async () => {
    const svg = await renderMermaid(PIE)
    expect(svg).toContain('Product A')
    expect(svg).toContain('45%')
    expect(svg).toContain('Product B')
    expect(svg).toContain('30%')
  })

  it('emits value labels when showData', async () => {
    const svg = await renderMermaid(PIE)
    expect(svg).toContain('data-value="45"')
    expect(svg).toContain('data-value="30"')
  })

  it('uses CSS variables for slice colors (theme switching works)', async () => {
    const svg = await renderMermaid(PIE)
    expect(svg).not.toContain('NaN')
    expect(svg).toContain('--pie-color-0')
  })

  it('renders a single-slice pie as a full ring', async () => {
    const svg = await renderMermaid('pie\n  "All" : 100')
    expect(svg).toContain('fill-rule="evenodd"')
    expect(svg).toContain('All')
    expect(svg).toContain('100%')
  })
})
