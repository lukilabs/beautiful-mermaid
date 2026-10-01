import { describe, it, expect } from 'bun:test'
import { parseQuadrantDiagram } from '../quadrant/parser.ts'

const preprocess = (text: string): string[] =>
  text.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('%%'))

describe('parseQuadrantDiagram', () => {
  it('parses title, axes and quadrant labels', () => {
    const c = parseQuadrantDiagram(preprocess(`
      quadrantChart
        title Reach and engagement
        x-axis Low Reach --> High Reach
        y-axis Low Engagement --> High Engagement
        quadrant-1 We should expand
        quadrant-2 Need to promote
        quadrant-3 Re-evaluate
        quadrant-4 May be improved
    `))
    expect(c.title).toBe('Reach and engagement')
    expect(c.xAxis).toEqual({ low: 'Low Reach', high: 'High Reach', min: 0, max: 1 })
    expect(c.yAxis).toEqual({ low: 'Low Engagement', high: 'High Engagement', min: 0, max: 1 })
    expect(c.quadrantLabels).toEqual(['We should expand', 'Need to promote', 'Re-evaluate', 'May be improved'])
  })

  it('parses points', () => {
    const c = parseQuadrantDiagram(preprocess(`
      quadrantChart
        Campaign A: [0.3, 0.6]
        Campaign B: [0.8, 0.9]
    `))
    expect(c.points).toEqual([
      { label: 'Campaign A', x: 0.3, y: 0.6 },
      { label: 'Campaign B', x: 0.8, y: 0.9 },
    ])
  })

  it('defaults axes to 0..1', () => {
    const c = parseQuadrantDiagram(preprocess('quadrantChart\n  P: [0.5, 0.5]'))
    expect(c.xAxis?.min).toBe(0)
    expect(c.xAxis?.max).toBe(1)
  })

  it('throws on invalid point', () => {
    expect(() => parseQuadrantDiagram(preprocess('quadrantChart\n  P: [0.5]'))).toThrow()
  })
})
