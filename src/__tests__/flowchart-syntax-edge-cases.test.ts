/**
 * Flowchart syntax that generated diagrams commonly use: quoted labels
 * containing brackets, Mermaid entity codes, and invisible links between subgraphs.
 */
import { describe, it, expect } from 'bun:test'
import { parseMermaid } from '../parser.ts'
import { renderMermaidSVG, renderMermaidASCII } from '../index.ts'

describe('quoted labels', () => {
  it('keeps square brackets inside a quoted rectangle label', () => {
    const g = parseMermaid('flowchart LR\n  A["loop CLI [Container: bash]"]:::c --> B')
    expect(g.nodes.get('A')!.label).toBe('loop CLI [Container: bash]')
    expect(g.classAssignments.get('A')).toBe('c')
  })

  it('keeps square brackets inside a quoted stadium label', () => {
    const g = parseMermaid('flowchart LR\n  A(["Russ [Person]"])')
    expect(g.nodes.get('A')!.label).toBe('Russ [Person]')
    expect(g.nodes.get('A')!.shape).toBe('stadium')
  })
})

describe('Mermaid entity codes', () => {
  it('decodes named and numeric codes in labels', () => {
    const g = parseMermaid('flowchart LR\n  A["say #quot;hi#quot; #lt;x#gt; #35;9 #x5B;y#x5D;"]')
    expect(g.nodes.get('A')!.label).toBe('say "hi" <x> #9 [y]')
  })

  it('leaves unknown codes alone', () => {
    const g = parseMermaid('flowchart LR\n  A["#nope; ok"]')
    expect(g.nodes.get('A')!.label).toBe('#nope; ok')
  })

  it('decodes HTML entities in ASCII output as SVG output already does', () => {
    const out = renderMermaidASCII('flowchart LR\n  A["&quot;q&quot; &lt;y&gt;"]', { colorMode: 'none' })
    expect(out).toContain('"q" <y>')
  })
})

describe('invisible links (~~~)', () => {
  const src = [
    'flowchart LR',
    '  subgraph p1["Phase 1"]', '    A', '  end',
    '  subgraph p2["Phase 2"]', '    B', '  end',
    '  p1 ~~~ p2',
  ].join('\n')

  it('parses ~~~ as an invisible edge between subgraphs without inventing nodes', () => {
    const g = parseMermaid(src)
    expect(g.nodes.has('p1')).toBe(false)
    expect(g.nodes.has('p2')).toBe(false)
    expect(g.edges).toHaveLength(1)
    expect(g.edges[0]!.style).toBe('invisible')
  })

  it('does not draw invisible edges in SVG', () => {
    const svg = renderMermaidSVG('flowchart LR\n  A ~~~ B\n  A --> C')
    expect((svg.match(/<polyline/g) ?? []).length).toBe(1)
  })

  it('keeps linkStyle indexes counting invisible links, as Mermaid does', () => {
    // Index 1 is A --> C because the invisible A ~~~ B is index 0
    const svg = renderMermaidSVG('flowchart LR\n  A ~~~ B\n  A --> C\n  linkStyle 1 stroke:#ff0000')
    const drawn = svg.match(/<polyline[^>]*>/g) ?? []
    expect(drawn).toHaveLength(1)
    expect(drawn[0]).toContain('#ff0000')
  })

  it('leaves invisible edges and subgraph ids out of ASCII', () => {
    const out = renderMermaidASCII(src, { colorMode: 'none' })
    expect(out).toContain('Phase 1')
    expect(out).not.toContain('p1')
  })
})
