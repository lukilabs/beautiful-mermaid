/**
 * Tests for the MCP server tool handlers.
 *
 * These tests exercise the MCP tool logic directly by importing
 * the underlying rendering functions, mirroring what each tool does.
 * This avoids needing a full stdio transport for unit testing.
 */
import { describe, it, expect } from 'bun:test'
import { renderMermaidSVG } from '../index.ts'
import { renderMermaidASCII } from '../ascii/index.ts'
import { parseMermaid } from '../parser.ts'
import { THEMES } from '../theme.ts'
import type { RenderOptions } from '../types.ts'

// ============================================================================
// render_svg tool logic
// ============================================================================

describe('MCP render_svg', () => {
  it('renders a flowchart to valid SVG', () => {
    const svg = renderMermaidSVG('graph TD\n  A --> B')
    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"')
    expect(svg).toContain('</svg>')
  })

  it('renders a sequence diagram to SVG', () => {
    const svg = renderMermaidSVG('sequenceDiagram\n  Alice->>Bob: Hello')
    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"')
  })

  it('renders a class diagram to SVG', () => {
    const svg = renderMermaidSVG('classDiagram\n  class Animal')
    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"')
  })

  it('renders an ER diagram to SVG', () => {
    const svg = renderMermaidSVG('erDiagram\n  CUSTOMER ||--o{ ORDER : places')
    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"')
  })

  it('applies a named theme', () => {
    const themeColors = THEMES['tokyo-night']
    expect(themeColors).toBeDefined()
    const options: RenderOptions = { ...themeColors }
    const svg = renderMermaidSVG('graph TD\n  A --> B', options)
    expect(svg).toContain(`--bg:${themeColors!.bg}`)
  })

  it('applies explicit color overrides on top of theme', () => {
    const themeColors = THEMES['github-dark']
    const options: RenderOptions = { ...themeColors, bg: '#000000' }
    const svg = renderMermaidSVG('graph TD\n  A --> B', options)
    expect(svg).toContain('--bg:#000000')
  })

  it('supports transparent background', () => {
    const svg = renderMermaidSVG('graph TD\n  A --> B', { transparent: true })
    // Transparent mode omits the background fill
    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"')
  })

  it('returns an error-like message for unknown theme names', () => {
    const available = Object.keys(THEMES)
    const unknownTheme = 'nonexistent-theme-xyz'
    expect(available).not.toContain(unknownTheme)
    // The MCP handler would check THEMES[name] and return an error.
    // Here we verify the lookup fails as expected.
    expect(THEMES[unknownTheme]).toBeUndefined()
  })
})

// ============================================================================
// render_ascii tool logic
// ============================================================================

describe('MCP render_ascii', () => {
  it('renders a flowchart to Unicode box-drawing', () => {
    const result = renderMermaidASCII('graph LR\n  A --> B', { colorMode: 'none' })
    expect(result).toContain('A')
    expect(result).toContain('B')
    // Unicode box-drawing uses ┌ ─ │ etc.
    expect(result).toContain('─')
  })

  it('renders a flowchart to ASCII when useAscii=true', () => {
    const result = renderMermaidASCII('graph LR\n  A --> B', { useAscii: true, colorMode: 'none' })
    expect(result).toContain('A')
    expect(result).toContain('B')
    // ASCII mode uses +, -, |
    expect(result).toContain('+')
    expect(result).toContain('-')
  })

  it('renders a sequence diagram to ASCII', () => {
    const result = renderMermaidASCII('sequenceDiagram\n  Alice->>Bob: Hello', { colorMode: 'none' })
    expect(result).toContain('Alice')
    expect(result).toContain('Bob')
  })

  it('renders a class diagram to ASCII', () => {
    const result = renderMermaidASCII('classDiagram\n  class Animal', { colorMode: 'none' })
    expect(result).toContain('Animal')
  })

  it('renders an ER diagram to ASCII', () => {
    const result = renderMermaidASCII('erDiagram\n  CUSTOMER ||--o{ ORDER : places', { colorMode: 'none' })
    expect(result).toContain('CUSTOMER')
    expect(result).toContain('ORDER')
  })
})

// ============================================================================
// list_themes tool logic
// ============================================================================

describe('MCP list_themes', () => {
  it('returns all built-in themes', () => {
    const themeNames = Object.keys(THEMES)
    expect(themeNames.length).toBeGreaterThan(0)
    // Verify known themes exist
    expect(themeNames).toContain('tokyo-night')
    expect(themeNames).toContain('github-dark')
    expect(themeNames).toContain('github-light')
    expect(themeNames).toContain('catppuccin-mocha')
    expect(themeNames).toContain('nord')
  })

  it('every theme has bg and fg colors', () => {
    for (const [name, colors] of Object.entries(THEMES)) {
      expect(colors.bg).toBeDefined()
      expect(colors.fg).toBeDefined()
    }
  })
})

// ============================================================================
// parse tool logic
// ============================================================================

describe('MCP parse', () => {
  it('parses a simple flowchart to structured graph', () => {
    const graph = parseMermaid('graph TD\n  A --> B')
    expect(graph.nodes).toBeDefined()
    expect(graph.edges).toBeDefined()
    expect(graph.nodes.size).toBeGreaterThanOrEqual(2)
    expect(graph.edges.length).toBeGreaterThanOrEqual(1)
  })

  it('parses node labels', () => {
    const graph = parseMermaid('graph TD\n  A[Start] --> B[End]')
    expect(graph.nodes.get('A')?.label).toBe('Start')
    expect(graph.nodes.get('B')?.label).toBe('End')
  })

  it('parses edge labels', () => {
    const graph = parseMermaid('graph TD\n  A -->|Yes| B')
    expect(graph.edges[0]?.label).toBe('Yes')
  })

  it('parses subgraphs', () => {
    const graph = parseMermaid('graph TD\n  subgraph Group\n    A --> B\n  end')
    expect(graph.subgraphs).toBeDefined()
    expect(graph.subgraphs.length).toBeGreaterThanOrEqual(1)
  })

  it('parses graph direction', () => {
    const graphTD = parseMermaid('graph TD\n  A --> B')
    expect(graphTD.direction).toBe('TD')

    const graphLR = parseMermaid('graph LR\n  A --> B')
    expect(graphLR.direction).toBe('LR')
  })

  it('returns structured data that can be serialized', () => {
    const graph = parseMermaid('graph TD\n  A --> B --> C')
    // MermaidGraph uses Maps, so we convert for JSON output (as the MCP tool does)
    const serializable = {
      direction: graph.direction,
      nodes: Object.fromEntries(graph.nodes),
      edges: graph.edges,
      subgraphs: graph.subgraphs,
    }
    const json = JSON.stringify(serializable)
    expect(json).toBeTruthy()
    const parsed = JSON.parse(json)
    expect(parsed.nodes).toBeDefined()
    expect(parsed.edges).toBeDefined()
    expect(Object.keys(parsed.nodes).length).toBeGreaterThanOrEqual(3)
  })
})
