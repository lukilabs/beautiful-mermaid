import { describe, it, expect } from 'bun:test'
import { parsePieDiagram } from '../pie/parser.ts'

const preprocess = (text: string): string[] =>
  text.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('%%'))

describe('parsePieDiagram', () => {
  it('parses title, sections and values', () => {
    const chart = parsePieDiagram(preprocess(`
      pie title "Revenue"
        "Product A" : 45
        "Product B" : 30
        "Product C" : 25
    `))
    expect(chart.title).toBe('Revenue')
    expect(chart.showData).toBe(false)
    expect(chart.slices).toEqual([
      { label: 'Product A', value: 45 },
      { label: 'Product B', value: 30 },
      { label: 'Product C', value: 25 },
    ])
  })

  it('parses showData flag from header', () => {
    const chart = parsePieDiagram(preprocess('pie showData\n  "A" : 1\n  "B" : 2'))
    expect(chart.showData).toBe(true)
  })

  it('accepts decimal values', () => {
    const chart = parsePieDiagram(preprocess('pie\n  "A" : 12.5'))
    expect(chart.slices[0]!.value).toBe(12.5)
  })

  it('throws on missing sections', () => {
    expect(() => parsePieDiagram(preprocess('pie'))).toThrow()
  })

  it('throws on invalid line', () => {
    expect(() => parsePieDiagram(preprocess('pie\n  not a valid section'))).toThrow()
  })

  it('throws on junk after the pie keyword', () => {
    expect(() => parsePieDiagram(preprocess('pie banana\n  "A" : 1'))).toThrow()
  })

  it('parses unquoted multi-word inline title (mermaid docs form)', () => {
    const chart = parsePieDiagram(preprocess(`
      pie title Pets adopted by volunteers
        "Dogs" : 386
        "Cats" : 85
        "Rats" : 15
    `))
    expect(chart.title).toBe('Pets adopted by volunteers')
    expect(chart.slices.map(s => s.value)).toEqual([386, 85, 15])
  })

  it('parses showData combined with an unquoted inline title', () => {
    const chart = parsePieDiagram(preprocess('pie showData title What VIM users use\n  "Vim" : 80'))
    expect(chart.showData).toBe(true)
    expect(chart.title).toBe('What VIM users use')
  })

  it('parses a standalone unquoted title line', () => {
    const chart = parsePieDiagram(preprocess('pie\n  title Revenue by Product\n  "A" : 1'))
    expect(chart.title).toBe('Revenue by Product')
  })
})
