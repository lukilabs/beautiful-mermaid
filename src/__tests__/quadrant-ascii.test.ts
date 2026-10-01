import { describe, it, expect } from 'bun:test'
import { renderMermaidAscii } from '../ascii/index.ts'

const CHART = `quadrantChart
  title Reach
  x-axis Low --> High
  y-axis Low --> High
  quadrant-1 Expand
  quadrant-4 Re-evaluate
  A: [0.3, 0.6]
  B: [0.8, 0.9]`

describe('quadrant – ASCII rendering', () => {
  it('renders the title and labels', () => {
    const out = renderMermaidAscii(CHART, { colorMode: 'none' })
    expect(out).toContain('Reach')
    expect(out).toContain('Expand')
    expect(out).toContain('Re-evaluate')
  })

  it('renders points and axis labels', () => {
    const out = renderMermaidAscii(CHART, { colorMode: 'none' })
    expect(out).toContain('A')
    expect(out).toContain('B')
    expect(out).toContain('High')
  })

  it('uses grid divider characters', () => {
    const out = renderMermaidAscii(CHART, { colorMode: 'none' })
    expect(out).toContain('│')
    expect(out).toContain('─')
  })
})
