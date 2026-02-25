import { describe, it, expect } from 'bun:test'
import { parseMermaid } from '../parser.ts'
import { renderMermaidSVG } from '../index.ts'

describe('linkStyle – parser', () => {
  it('parses linkStyle with single index', () => {
    const g = parseMermaid('graph TD\n  A --> B\n  linkStyle 0 stroke:#ff0000,stroke-width:2px')
    expect(g.linkStyles.get(0)).toEqual({ stroke: '#ff0000', 'stroke-width': '2px' })
  })

  it('parses linkStyle with comma-separated indices', () => {
    const g = parseMermaid('graph TD\n  A --> B\n  B --> C\n  linkStyle 0,1 stroke:#00ff00')
    expect(g.linkStyles.get(0)).toEqual({ stroke: '#00ff00' })
    expect(g.linkStyles.get(1)).toEqual({ stroke: '#00ff00' })
  })

  it('parses linkStyle default', () => {
    const g = parseMermaid('graph TD\n  A --> B\n  linkStyle default stroke:#888888,stroke-width:3px')
    expect(g.linkStyles.get('default')).toEqual({ stroke: '#888888', 'stroke-width': '3px' })
  })

  it('later linkStyle overrides earlier for same index', () => {
    const g = parseMermaid('graph TD\n  A --> B\n  linkStyle 0 stroke:#ff0000\n  linkStyle 0 stroke:#00ff00')
    expect(g.linkStyles.get(0)).toEqual({ stroke: '#00ff00' })
  })

  it('ignores linkStyle lines silently (no crash) when index out of range', () => {
    const g = parseMermaid('graph TD\n  A --> B\n  linkStyle 99 stroke:#ff0000')
    expect(g.linkStyles.get(99)).toEqual({ stroke: '#ff0000' })
    expect(g.edges).toHaveLength(1)
  })

  it('strips trailing semicolons from style values', () => {
    const g = parseMermaid('graph TD\n  A --> B\n  linkStyle 0 stroke:#ff0000,stroke-width:4px;')
    expect(g.linkStyles.get(0)).toEqual({ stroke: '#ff0000', 'stroke-width': '4px' })
  })
})

describe('linkStyle – state diagram parser', () => {
  it('parses linkStyle in state diagrams', () => {
    const g = parseMermaid('stateDiagram-v2\n  A --> B\n  linkStyle 0 stroke:#ff0000')
    expect(g.linkStyles.get(0)).toEqual({ stroke: '#ff0000' })
  })

  it('parses linkStyle default in state diagrams', () => {
    const g = parseMermaid('stateDiagram-v2\n  A --> B\n  B --> C\n  linkStyle default stroke:#888')
    expect(g.linkStyles.get('default')).toEqual({ stroke: '#888' })
  })
})

describe('linkStyle – SVG integration', () => {
  it('applies linkStyle stroke color to SVG edge', () => {
    const svg = renderMermaidSVG('graph TD\n  A --> B\n  linkStyle 0 stroke:#ff0000')
    expect(svg).toContain('stroke="#ff0000"')
  })

  it('applies linkStyle stroke-width to SVG edge', () => {
    const svg = renderMermaidSVG('graph TD\n  A --> B\n  linkStyle 0 stroke-width:3px')
    expect(svg).toContain('stroke-width="3px"')
  })

  it('applies linkStyle default to all edges', () => {
    const svg = renderMermaidSVG('graph TD\n  A --> B\n  B --> C\n  linkStyle default stroke:#00ff00')
    const matches = svg.match(/stroke="#00ff00"/g)
    expect(matches).not.toBeNull()
    expect(matches!.length).toBeGreaterThanOrEqual(2)
  })

  it('index-specific linkStyle overrides default', () => {
    const svg = renderMermaidSVG(
      'graph TD\n  A --> B\n  B --> C\n  linkStyle default stroke:#888\n  linkStyle 0 stroke:#ff0000'
    )
    expect(svg).toContain('stroke="#ff0000"')
    expect(svg).toContain('stroke="#888"')
  })

  it('arrowhead color matches custom stroke color', () => {
    const svg = renderMermaidSVG('graph TD\n  A --> B\n  linkStyle 0 stroke:#ff0000')
    // Should have a color-specific marker def (# is hex-encoded to "23")
    expect(svg).toContain('id="arrowhead-23ff0000"')
    expect(svg).toContain('fill="#ff0000"')
    // Edge should reference the colored marker
    expect(svg).toContain('marker-end="url(#arrowhead-23ff0000)"')
  })

  it('escapes XSS injection in stroke value', () => {
    const svg = renderMermaidSVG('graph TD\n  A --> B\n  linkStyle 0 stroke:red" onmouseover="alert(1)')
    // Quotes must be escaped — no attribute breakout
    expect(svg).not.toContain('stroke="red" onmouseover')
    expect(svg).toContain('stroke="red&quot; onmouseover=&quot;alert(1)"')
  })

  it('trailing semicolons do not leak into SVG attributes', () => {
    const svg = renderMermaidSVG('graph TD\n  A --> B\n  linkStyle 0 stroke:#ff0000,stroke-width:4px;')
    expect(svg).toContain('stroke-width="4px"')
    expect(svg).not.toContain('stroke-width="4px;"')
  })
})
