import { describe, it, expect } from 'bun:test'
import { parseMindmapDiagram } from '../mindmap/parser.ts'

const preprocess = (text: string): string[] =>
  text.split('\n').map(l => l.trimEnd()).filter(l => l.trim().length > 0 && !l.trim().startsWith('%%'))

describe('parseMindmapDiagram', () => {
  it('parses an indentation tree', () => {
    const m = parseMindmapDiagram(preprocess(`
      mindmap
        root
          A
            A1
          B
    `))
    expect(m.root.text).toBe('root')
    expect(m.root.children.map(c => c.text)).toEqual(['A', 'B'])
    expect(m.root.children[0]!.children[0]!.text).toBe('A1')
  })

  it('parses shapes', () => {
    const m = parseMindmapDiagram(preprocess(`
      mindmap
        root((Circle))
          [Square]
          (Rounded)
          {{Hexagon}}
          plain
    `))
    expect(m.root.shape).toBe('circle')
    expect(m.root.children.map(c => [c.text, c.shape])).toEqual([
      ['Square', 'square'],
      ['Rounded', 'rounded'],
      ['Hexagon', 'hexagon'],
      ['plain', 'default'],
    ])
  })

  it('parses a title', () => {
    const m = parseMindmapDiagram(preprocess(`
      mindmap
        title My Map
        root
    `))
    expect(m.title).toBe('My Map')
  })

  it('treats :::icon lines as plain text', () => {
    const m = parseMindmapDiagram(preprocess(`
      mindmap
        root
          item
            ::icon(fa fa-book)
    `))
    expect(m.root.children[0]!.children[0]!.text).toContain('icon')
  })

  it('throws when a node is more indented than its parent', () => {
    expect(() => parseMindmapDiagram(preprocess('mindmap\n  root\n        too deep'))).toThrow()
  })
})
