import { describe, it, expect } from 'bun:test'
import { renderMermaid } from '../index.ts'

const CHART = `quadrantChart
  title Reach and engagement
  x-axis Low Reach --> High Reach
  y-axis Low Engagement --> High Engagement
  quadrant-1 We should expand
  quadrant-2 Need to promote
  quadrant-3 Re-evaluate
  quadrant-4 May be improved
  Campaign A: [0.3, 0.6]
  Campaign B: [0.8, 0.9]`

describe('quadrant – SVG rendering', () => {
  it('renders without throwing', async () => {
    const svg = await renderMermaid(CHART)
    expect(svg).toContain('<svg')
    expect(svg).toContain('</svg>')
  })

  it('emits the title and axis labels', async () => {
    const svg = await renderMermaid(CHART)
    expect(svg).toContain('Reach and engagement')
    expect(svg).toContain('Low Reach')
    expect(svg).toContain('High Engagement')
  })

  it('emits quadrant labels', async () => {
    const svg = await renderMermaid(CHART)
    expect(svg).toContain('We should expand')
    expect(svg).toContain('Re-evaluate')
  })

  it('emits points', async () => {
    const svg = await renderMermaid(CHART)
    expect(svg).toContain('Campaign A')
    expect(svg).toContain('Campaign B')
  })

  it('uses CSS variables for colors', async () => {
    const svg = await renderMermaid(CHART)
    expect(svg).not.toContain('NaN')
    expect(svg).toContain('var(--_')
  })
})
