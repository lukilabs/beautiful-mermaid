import { describe, it, expect } from 'bun:test'
import { renderMermaid } from '../index.ts'

const MAP = `mindmap
  root((Mindmap))
    Origins
      Long history
    Research
      [Shapes]
      (Branches)
      {{Hexagon}}`

describe('mindmap – SVG rendering', () => {
  it('renders without throwing', async () => {
    const svg = await renderMermaid(MAP)
    expect(svg).toContain('<svg')
    expect(svg).toContain('</svg>')
  })

  it('emits node labels', async () => {
    const svg = await renderMermaid(MAP)
    expect(svg).toContain('Mindmap')
    expect(svg).toContain('Origins')
    expect(svg).toContain('Long history')
  })

  it('emits connector edges between parent and child', async () => {
    const svg = await renderMermaid(MAP)
    expect(svg).toContain('mindmap-edge')
  })

  it('renders shapes', async () => {
    const svg = await renderMermaid(MAP)
    expect(svg).toContain('mindmap-shape')
    expect(svg).toContain('<ellipse')
    expect(svg).toContain('<polygon')
  })

  it('uses CSS variables for colors', async () => {
    const svg = await renderMermaid(MAP)
    expect(svg).not.toContain('NaN')
    expect(svg).toContain('var(--_')
  })
})
