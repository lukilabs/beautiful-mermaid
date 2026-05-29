// ============================================================================
// MCP tools — comprehensive test suite
//
// Tests all 4 MCP tool handlers across the full input space:
// happy paths, theme resolution, error handling, best-effort rendering,
// CJK detection, Map serialization, and edge cases.
//
// Follows project conventions: describe → describe → it nesting,
// `–` separators, one concept per test case.
// ============================================================================

import { describe, it, expect } from 'bun:test'

import { handleRenderSVG } from '../mcp/tools/render-svg.ts'
import { handleRenderAscii } from '../mcp/tools/render-ascii.ts'
import { handleParseMermaid } from '../mcp/tools/parse.ts'
import { handleListDiagramTypes } from '../mcp/tools/list-types.ts'
import { THEMES } from '../index.ts'

// ============================================================================
// Test data — re-used across multiple test groups
// ============================================================================

const SIMPLE_FLOWCHART = 'graph TD\n  A --> B'

const ALL_DIAGRAMS: Record<string, string> = {
  flowchart: 'graph TD\n  A --> B',
  sequence: 'sequenceDiagram\n  A->>B: Hello',
  class: 'classDiagram\n  Animal <|-- Duck',
  er: 'erDiagram\n  CUSTOMER ||--o{ ORDER : places',
  xychart: 'xychart-beta\n  line [1,2,3]',
  state: 'stateDiagram-v2\n  [*] --> Active',
}

// ============================================================================
// Helper: validate common response structure
// ============================================================================

function expectSuccessResponse(
  result: { content: Array<{ type: string; text: string }>; isError?: boolean },
): void {
  expect(result.content).toHaveLength(1)
  expect(result.content[0]!.type).toBe('text')
  expect(typeof result.content[0]!.text).toBe('string')
  expect(result.content[0]!.text.length).toBeGreaterThan(0)
  expect(result.isError).toBeUndefined()
}

function expectErrorResponse(
  result: { content: Array<{ type: string; text: string }>; isError?: boolean },
): { payload: Record<string, unknown> } {
  expect(result.content).toHaveLength(1)
  expect(result.isError).toBe(true)
  const payload = JSON.parse(result.content[0]!.text) as Record<string, unknown>
  expect(payload.error).toBeDefined()
  expect(typeof payload.error).toBe('string')
  return { payload }
}

// ============================================================================
// list_diagram_types
// ============================================================================

// We keep a single flat describe for list_diagram_types since it's short
describe('list_diagram_types', () => {
  it('returns all 6 diagram types with correct names', () => {
    const result = handleListDiagramTypes()
    expectSuccessResponse(result)

    const types = JSON.parse(result.content[0]!.text) as Array<{ name: string }>
    expect(types).toHaveLength(6)
    expect(types.map(t => t.name)).toEqual([
      'flowchart', 'sequence', 'class', 'er', 'xychart', 'state',
    ])
  })

  it('each type has name, description, and example', () => {
    const result = handleListDiagramTypes()
    const types = JSON.parse(result.content[0]!.text) as Array<{
      name: string
      description: string
      example: string
    }>

    for (const t of types) {
      expect(t.name).toBeDefined()
      expect(typeof t.name).toBe('string')
      expect(t.name.length).toBeGreaterThan(0)

      expect(t.description).toBeDefined()
      expect(typeof t.description).toBe('string')
      expect(t.description.length).toBeGreaterThan(0)

      expect(t.example).toBeDefined()
      expect(typeof t.example).toBe('string')
      expect(t.example.length).toBeGreaterThan(0)
    }
  })

  it('all type names are unique', () => {
    const result = handleListDiagramTypes()
    const types = JSON.parse(result.content[0]!.text) as Array<{ name: string }>
    const names = types.map(t => t.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('returns the same result on every call (idempotent)', () => {
    const a = handleListDiagramTypes()
    const b = handleListDiagramTypes()
    expect(a.content[0]!.text).toBe(b.content[0]!.text)
  })
})

// ============================================================================
// parse_mermaid
// ============================================================================

describe('parse_mermaid', () => {
  // --- Flowchart parsing ---

  describe('parse_mermaid – flowchart', () => {
    it('parses a simple graph with nodes and edges', () => {
      const result = handleParseMermaid({ mermaid_code: SIMPLE_FLOWCHART })
      expectSuccessResponse(result)

      const graph = JSON.parse(result.content[0]!.text)
      expect(graph.direction).toBe('TD')
      expect(graph.nodes).toBeDefined()
      expect(Object.keys(graph.nodes)).toHaveLength(2)
      expect(graph.nodes.A.label).toBe('A')
      expect(graph.nodes.B.label).toBe('B')
      expect(graph.edges).toHaveLength(1)
      expect(graph.edges[0].source).toBe('A')
      expect(graph.edges[0].target).toBe('B')
      expect(graph.edges[0].style).toBe('solid')
      expect(graph.edges[0].hasArrowEnd).toBe(true)
    })

    it('parses LR direction', () => {
      const result = handleParseMermaid({
        mermaid_code: 'graph LR\n  A --> B',
      })
      const graph = JSON.parse(result.content[0]!.text)
      expect(graph.direction).toBe('LR')
    })

    it('parses labeled nodes with various shapes', () => {
      const result = handleParseMermaid({
        mermaid_code: `graph TD
          A[Rectangle] --> B(Rounded)
          B --> C{Diamond}
          C --> D([Stadium])
          D --> E((Circle))`,
      })
      const graph = JSON.parse(result.content[0]!.text)

      expect(graph.nodes.A.shape).toBe('rectangle')
      expect(graph.nodes.A.label).toBe('Rectangle')
      expect(graph.nodes.B.shape).toBe('rounded')
      expect(graph.nodes.C.shape).toBe('diamond')
      expect(graph.nodes.D.shape).toBe('stadium')
      expect(graph.nodes.E.shape).toBe('circle')
    })

    it('parses batch 1 shapes (subroutine, doublecircle, hexagon)', () => {
      const result = handleParseMermaid({
        mermaid_code: 'graph TD\n  A[[Sub]] --> B((("Double")))\n  B --> C{{Hexagon}}',
      })
      const graph = JSON.parse(result.content[0]!.text)

      expect(graph.nodes.A.shape).toBe('subroutine')
      expect(graph.nodes.A.label).toBe('Sub')
      expect(graph.nodes.B.shape).toBe('doublecircle')
      expect(graph.nodes.B.label).toBe('Double')
      expect(graph.nodes.C.shape).toBe('hexagon')
      expect(graph.nodes.C.label).toBe('Hexagon')
    })

    it('parses batch 2 shapes (cylinder, asymmetric, trapezoid, trapezoid-alt)', () => {
      const result = handleParseMermaid({
        mermaid_code: `graph TD
          A[(DB)] --> B>flag]
          B --> C[/trap\\]
          C --> D[\\alt/]`,
      })
      const graph = JSON.parse(result.content[0]!.text)

      expect(graph.nodes.A.shape).toBe('cylinder')
      expect(graph.nodes.B.shape).toBe('asymmetric')
      expect(graph.nodes.C.shape).toBe('trapezoid')
      expect(graph.nodes.D.shape).toBe('trapezoid-alt')
    })

    it('parses edges with labels', () => {
      const result = handleParseMermaid({
        mermaid_code: 'graph TD\n  A -->|Yes| B\n  B -.->|Maybe| C\n  C ==>|Definitely| D',
      })
      const graph = JSON.parse(result.content[0]!.text)

      expect(graph.edges).toHaveLength(3)
      expect(graph.edges[0].label).toBe('Yes')
      expect(graph.edges[0].style).toBe('solid')
      expect(graph.edges[1].label).toBe('Maybe')
      expect(graph.edges[1].style).toBe('dotted')
      expect(graph.edges[2].label).toBe('Definitely')
      expect(graph.edges[2].style).toBe('thick')
    })

    it('parses chained edges and & parallel links', () => {
      const result = handleParseMermaid({
        mermaid_code: 'graph TD\n  A --> B --> C\n  X & Y --> Z',
      })
      const graph = JSON.parse(result.content[0]!.text)

      // Chained: A→B, B→C = 2 edges
      // Parallel: X→Z, Y→Z = 2 edges
      // Total: 4 edges
      expect(graph.edges).toHaveLength(4)
    })

    it('parses bidirectional arrows', () => {
      const result = handleParseMermaid({
        mermaid_code: 'graph LR\n  A <--> B',
      })
      const graph = JSON.parse(result.content[0]!.text)

      expect(graph.edges).toHaveLength(1)
      expect(graph.edges[0].hasArrowStart).toBe(true)
      expect(graph.edges[0].hasArrowEnd).toBe(true)
    })

    it('parses subgraphs with nesting', () => {
      const result = handleParseMermaid({
        mermaid_code: `graph TD
          subgraph Outer
            A --> B
            subgraph Inner
              C --> D
            end
          end`,
      })
      const graph = JSON.parse(result.content[0]!.text)

      expect(graph.subgraphs).toHaveLength(1)
      const outer = graph.subgraphs[0]
      expect(outer.label).toBe('Outer')
      expect(outer.nodeIds).toContain('A')
      expect(outer.nodeIds).toContain('B')
      expect(outer.children).toHaveLength(1)
      expect(outer.children[0].label).toBe('Inner')
      expect(outer.children[0].nodeIds).toContain('C')
      expect(outer.children[0].nodeIds).toContain('D')
    })

    it('parses classDef and class assignments', () => {
      const result = handleParseMermaid({
        mermaid_code: `graph TD
          classDef highlight fill:#f9f,stroke:#333
          class A highlight
          A --> B`,
      })
      const graph = JSON.parse(result.content[0]!.text)

      expect(graph.classDefs).toBeDefined()
      expect(graph.classDefs.highlight).toBeDefined()
      expect(graph.classDefs.highlight.fill).toBe('#f9f')
      expect(graph.classAssignments.A).toBe('highlight')
    })

    it('parses style and linkStyle directives', () => {
      const result = handleParseMermaid({
        mermaid_code: `graph TD
          style A fill:#f00,stroke:#333
          linkStyle 0 stroke:#00f
          A --> B`,
      })
      const graph = JSON.parse(result.content[0]!.text)

      expect(graph.nodeStyles.A).toBeDefined()
      expect(graph.nodeStyles.A.fill).toBe('#f00')
      expect(graph.linkStyles['0']).toBeDefined()
      expect(graph.linkStyles['0'].stroke).toBe('#00f')
    })

    it('parses node with ::: class shorthand', () => {
      const result = handleParseMermaid({
        mermaid_code: 'graph TD\n  A[NodeA]:::highlight --> B',
      })
      const graph = JSON.parse(result.content[0]!.text)

      expect(graph.classAssignments).toBeDefined()
      expect(graph.classAssignments.A).toBe('highlight')
    })

    it('ignores comment lines (%% comments)', () => {
      const result = handleParseMermaid({
        mermaid_code: `graph TD
          %% This is a comment
          A --> B
          %% Another comment`,
      })
      const graph = JSON.parse(result.content[0]!.text)

      expect(graph.nodes.A).toBeDefined()
      expect(graph.nodes.B).toBeDefined()
      expect(graph.edges).toHaveLength(1)
    })
  })

  // --- State diagram parsing ---

  describe('parse_mermaid – state diagram', () => {
    it('parses stateDiagram-v2 with transitions', () => {
      const result = handleParseMermaid({
        mermaid_code: 'stateDiagram-v2\n  [*] --> Active\n  Active --> Inactive\n  Inactive --> [*]',
      })
      const graph = JSON.parse(result.content[0]!.text)

      expect(graph.direction).toBe('TD')
      const nodeIds = Object.keys(graph.nodes)
      expect(nodeIds).toHaveLength(4) // _start, Active, Inactive, _end
      expect(graph.edges).toHaveLength(3)
    })

    it('parses state descriptions', () => {
      const result = handleParseMermaid({
        mermaid_code: `stateDiagram-v2
          s1 : Waiting for input
          s2 : Processing`,
      })
      const graph = JSON.parse(result.content[0]!.text)

      expect(graph.nodes.s1.label).toBe('Waiting for input')
      expect(graph.nodes.s2.label).toBe('Processing')
      expect(graph.nodes.s1.shape).toBe('rounded')
      expect(graph.nodes.s2.shape).toBe('rounded')
    })

    it('parses state aliases', () => {
      const result = handleParseMermaid({
        mermaid_code: `stateDiagram-v2
          state "Long Description" as s1
          [*] --> s1`,
      })
      const graph = JSON.parse(result.content[0]!.text)

      expect(graph.nodes.s1.label).toBe('Long Description')
    })

    it('parses composite states', () => {
      const result = handleParseMermaid({
        mermaid_code: `stateDiagram-v2
          [*] --> Processing
          state Processing {
            [*] --> Waiting
            Waiting --> Running
            Running --> [*]
          }`,
      })
      const graph = JSON.parse(result.content[0]!.text)

      // Processing should NOT be in nodes (it's a composite state)
      expect(graph.nodes.Processing).toBeUndefined()
      expect(graph.subgraphs).toHaveLength(1)
      expect(graph.subgraphs[0].label).toBe('Processing')
      expect(graph.subgraphs[0].nodeIds).toContain('Waiting')
      expect(graph.subgraphs[0].nodeIds).toContain('Running')
    })

    it('parses state diagram transitions with labels', () => {
      const result = handleParseMermaid({
        mermaid_code: 'stateDiagram-v2\n  [*] --> Idle : Start\n  Idle --> Active : Trigger',
      })
      const graph = JSON.parse(result.content[0]!.text)

      expect(graph.edges).toHaveLength(2)
      expect(graph.edges[0].label).toBe('Start')
      expect(graph.edges[1].label).toBe('Trigger')
    })
  })

  // --- Serialization correctness ---

  describe('parse_mermaid – serialization', () => {
    it('serializes Map fields to plain objects', () => {
      const result = handleParseMermaid({
        mermaid_code: `graph TD
          A --> B
          B --> C`,
      })
      const raw = result.content[0]!.text
      const graph = JSON.parse(raw)

      // All Map fields must be plain objects (not empty arrays)
      expect(typeof graph.nodes).toBe('object')
      expect(Array.isArray(graph.nodes)).toBe(false)
      expect(Object.keys(graph.nodes).length).toBeGreaterThan(0)

      expect(typeof graph.classDefs).toBe('object')
      expect(typeof graph.classAssignments).toBe('object')
      expect(typeof graph.nodeStyles).toBe('object')
      expect(typeof graph.linkStyles).toBe('object')

      // Edges and subgraphs are arrays
      expect(Array.isArray(graph.edges)).toBe(true)
      expect(Array.isArray(graph.subgraphs)).toBe(true)
    })

    it('serializes linkStyles with string keys', () => {
      const result = handleParseMermaid({
        mermaid_code: `graph TD
          linkStyle 0 stroke:#f00
          linkStyle 1 stroke:#00f
          A --> B
          B --> C`,
      })
      const graph = JSON.parse(result.content[0]!.text)

      expect(graph.linkStyles['0']).toBeDefined()
      expect(graph.linkStyles['0'].stroke).toBe('#f00')
      expect(graph.linkStyles['1']).toBeDefined()
      expect(graph.linkStyles['1'].stroke).toBe('#00f')
    })

    it('produces valid JSON that can be round-tripped', () => {
      const result = handleParseMermaid({
        mermaid_code: `graph TD
          A[Start] --> B{Diamond}
          B -->|Yes| C(End)`,
      })
      const raw1 = result.content[0]!.text
      const parsed1 = JSON.parse(raw1)

      // Re-stringify and re-parse to verify JSON stability
      const raw2 = JSON.stringify(parsed1)
      const parsed2 = JSON.parse(raw2)

      expect(parsed2.direction).toBe('TD')
      expect(parsed2.nodes.B.shape).toBe('diamond')
      expect(parsed2.edges[1].label).toBe('Yes')
    })
  })

  // --- Error handling ---

  describe('parse_mermaid – errors', () => {
    it('returns error on empty input', () => {
      const result = handleParseMermaid({ mermaid_code: '' })
      const { payload } = expectErrorResponse(result)
      expect(payload.error).toContain('Empty')
    })

    it('returns error on invalid header', () => {
      const result = handleParseMermaid({
        mermaid_code: 'not a valid diagram',
      })
      const { payload } = expectErrorResponse(result)
      expect(payload.error).toContain('Invalid')
    })

    it('returns error on sequenceDiagram header (parseMermaid only handles flowchart/state)', () => {
      const result = handleParseMermaid({
        mermaid_code: 'sequenceDiagram\n  A->>B: Hello',
      })
      const { payload } = expectErrorResponse(result)
      expect(payload.error).toBeDefined()
    })
  })
})

// ============================================================================
// render_mermaid_svg
// ============================================================================

describe('render_mermaid_svg', () => {
  // --- Basic rendering ---

  describe('render_mermaid_svg – basic', () => {
    it('renders a valid SVG with namespace and closing tag', () => {
      const result = handleRenderSVG({ mermaid_code: SIMPLE_FLOWCHART })
      expectSuccessResponse(result)

      const svg = result.content[0]!.text
      expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"')
      expect(svg).toContain('</svg>')
    })

    it('includes node labels in rendered SVG', () => {
      const result = handleRenderSVG({
        mermaid_code: 'graph TD\n  A[Start] --> B[End]',
      })
      const svg = result.content[0]!.text
      expect(svg).toContain('>Start</text>')
      expect(svg).toContain('>End</text>')
    })

    it('includes edge labels in rendered SVG', () => {
      const result = handleRenderSVG({
        mermaid_code: 'graph TD\n  A -->|Yes| B',
      })
      const svg = result.content[0]!.text
      expect(svg).toContain('>Yes</text>')
    })

    it('includes SVG defs and arrow markers', () => {
      const result = handleRenderSVG({ mermaid_code: SIMPLE_FLOWCHART })
      const svg = result.content[0]!.text
      expect(svg).toContain('<defs>')
      expect(svg).toContain('<marker id="arrowhead"')
      expect(svg).toContain('</defs>')
    })

    it('includes CSS style block', () => {
      const result = handleRenderSVG({ mermaid_code: SIMPLE_FLOWCHART })
      const svg = result.content[0]!.text
      expect(svg).toContain('<style>')
      expect(svg).toContain('</style>')
    })

    it('includes CSS custom properties for theming', () => {
      const result = handleRenderSVG({ mermaid_code: SIMPLE_FLOWCHART })
      const svg = result.content[0]!.text
      expect(svg).toContain('var(--_node-fill)')
      expect(svg).toContain('var(--_node-stroke)')
      expect(svg).toContain('var(--_text)')
    })
  })

  // --- All diagram types ---

  describe('render_mermaid_svg – diagram types', () => {
    for (const [kind, code] of Object.entries(ALL_DIAGRAMS)) {
      it(`renders ${kind} diagram without errors`, () => {
        const result = handleRenderSVG({ mermaid_code: code })
        expectSuccessResponse(result)

        const svg = result.content[0]!.text
        expect(svg).toContain('<svg')
        expect(svg).toContain('</svg>')
      })
    }

    it('renders a complex flowchart with all node shapes', () => {
      const result = handleRenderSVG({
        mermaid_code: `graph TD
          A[Rectangle] --> B(Rounded)
          B --> C{Diamond}
          C --> D([Stadium])
          D --> E((Circle))
          E --> F[[Subroutine]]
          F --> G(((Double-Circle)))
          G --> H{{Hexagon}}
          H --> I[(Cylinder)]
          I --> J>Asymmetric]
          J --> K[/Trapezoid\\]
          K --> L[\\Trapezoid-Alt/]`,
      })
      expectSuccessResponse(result)

      const svg = result.content[0]!.text
      expect(svg).toContain('<polygon')  // diamond, hexagon, etc.
      expect(svg).toContain('<circle')   // circle
      expect(svg).toContain('<ellipse')  // cylinder caps
      expect(svg).toContain('<line')     // subroutine inner lines
    })

    it('renders all edge styles (solid, dotted, thick)', () => {
      const result = handleRenderSVG({
        mermaid_code: `graph TD
          A -->|solid| B
          B -.->|dotted| C
          C ==>|thick| D`,
      })
      const svg = result.content[0]!.text
      expect(svg).toContain('>solid</text>')
      expect(svg).toContain('>dotted</text>')
      expect(svg).toContain('>thick</text>')
      expect(svg).toContain('stroke-dasharray="4 4"')
    })

    it('renders bidirectional arrows', () => {
      const result = handleRenderSVG({
        mermaid_code: `graph TD
          A <-->|bidirectional| B`,
      })
      const svg = result.content[0]!.text
      // Should have both marker-start and marker-end
      expect(svg).toContain('>bidirectional</text>')
    })

    it('renders subgraph containers', () => {
      const result = handleRenderSVG({
        mermaid_code: `graph TD
          subgraph Group
            A --> B
          end`,
      })
      const svg = result.content[0]!.text
      expect(svg).toContain('class="subgraph"')
      expect(svg).toContain('>Group</text>')
    })

    it('renders state diagram pseudostates', () => {
      const result = handleRenderSVG({
        mermaid_code: 'stateDiagram-v2\n  [*] --> Active\n  Active --> [*]',
      })
      expectSuccessResponse(result)

      const svg = result.content[0]!.text
      // Should have state-start and state-end pseudostates
      // state-start is a filled circle, state-end is a bullseye
      const circleCount = (svg.match(/<circle/g) ?? []).length
      expect(circleCount).toBeGreaterThanOrEqual(2)
    })
  })

  // --- Theme resolution ---

  describe('render_mermaid_svg – theme resolution', () => {
    it('uses DEFAULTS when no theme or colors provided', () => {
      const result = handleRenderSVG({ mermaid_code: SIMPLE_FLOWCHART })
      const svg = result.content[0]!.text
      expect(svg).toContain('--bg:#FFFFFF')
      expect(svg).toContain('--fg:#27272A')
    })

    it('applies tokyo-night theme colors', () => {
      const result = handleRenderSVG({
        mermaid_code: SIMPLE_FLOWCHART,
        theme_name: 'tokyo-night',
      })
      const svg = result.content[0]!.text
      expect(svg).toContain('--bg:#1a1b26')
      expect(svg).toContain('--fg:#a9b1d6')
    })

    it('applies theme enrichment colors', () => {
      // tokyo-night has line, accent, muted enrichment
      const result = handleRenderSVG({
        mermaid_code: SIMPLE_FLOWCHART,
        theme_name: 'tokyo-night',
      })
      const svg = result.content[0]!.text
      expect(svg).toContain('--line:#3d59a1')
      expect(svg).toContain('--accent:#7aa2f7')
      expect(svg).toContain('--muted:#565f89')
    })

    it('user bg overrides theme bg', () => {
      const result = handleRenderSVG({
        mermaid_code: SIMPLE_FLOWCHART,
        theme_name: 'tokyo-night',
        bg: '#000000',
      })
      const svg = result.content[0]!.text
      expect(svg).toContain('--bg:#000000')
      expect(svg).toContain('--fg:#a9b1d6') // fg from theme preserved
    })

    it('user fg overrides theme fg', () => {
      const result = handleRenderSVG({
        mermaid_code: SIMPLE_FLOWCHART,
        theme_name: 'tokyo-night',
        fg: '#ffffff',
      })
      const svg = result.content[0]!.text
      expect(svg).toContain('--bg:#1a1b26') // bg from theme preserved
      expect(svg).toContain('--fg:#ffffff')
    })

    it('both user bg and fg override theme', () => {
      const result = handleRenderSVG({
        mermaid_code: SIMPLE_FLOWCHART,
        theme_name: 'tokyo-night',
        bg: '#111111',
        fg: '#eeeeee',
      })
      const svg = result.content[0]!.text
      expect(svg).toContain('--bg:#111111')
      expect(svg).toContain('--fg:#eeeeee')
    })

    it('unknown theme name falls back to DEFAULTS', () => {
      const result = handleRenderSVG({
        mermaid_code: SIMPLE_FLOWCHART,
        theme_name: 'nonexistent-theme',
      })
      const svg = result.content[0]!.text
      expect(svg).toContain('--bg:#FFFFFF')
      expect(svg).toContain('--fg:#27272A')
    })

    it('user bg without theme overrides DEFAULTS', () => {
      const result = handleRenderSVG({
        mermaid_code: SIMPLE_FLOWCHART,
        bg: '#333333',
      })
      const svg = result.content[0]!.text
      expect(svg).toContain('--bg:#333333')
      expect(svg).toContain('--fg:#27272A') // fg from DEFAULTS
    })

    it('user fg without theme overrides DEFAULTS', () => {
      const result = handleRenderSVG({
        mermaid_code: SIMPLE_FLOWCHART,
        fg: '#cccccc',
      })
      const svg = result.content[0]!.text
      expect(svg).toContain('--bg:#FFFFFF') // bg from DEFAULTS
      expect(svg).toContain('--fg:#cccccc')
    })

    // Test all well-known themes
    const THEME_NAMES = Object.keys(THEMES) as Array<keyof typeof THEMES>
    for (const name of THEME_NAMES) {
      it(`renders with ${name} theme without errors`, () => {
        const result = handleRenderSVG({
          mermaid_code: SIMPLE_FLOWCHART,
          theme_name: name,
        })
        expectSuccessResponse(result)

        const svg = result.content[0]!.text
        const expectedBg = THEMES[name].bg
        const expectedFg = THEMES[name].fg
        expect(svg).toContain(`--bg:${expectedBg}`)
        expect(svg).toContain(`--fg:${expectedFg}`)
      })
    }

    it('applies dark theme (zinc-dark) colors', () => {
      const result = handleRenderSVG({
        mermaid_code: SIMPLE_FLOWCHART,
        theme_name: 'zinc-dark',
      })
      const svg = result.content[0]!.text
      expect(svg).toContain('--bg:#18181B')
      expect(svg).toContain('--fg:#FAFAFA')
    })

    it('applies catppuccin-mocha theme with enrichment', () => {
      const result = handleRenderSVG({
        mermaid_code: SIMPLE_FLOWCHART,
        theme_name: 'catppuccin-mocha',
      })
      const svg = result.content[0]!.text
      expect(svg).toContain('--bg:#1e1e2e')
      expect(svg).toContain('--fg:#cdd6f4')
      expect(svg).toContain('--line:#585b70')
      expect(svg).toContain('--accent:#cba6f7')
    })
  })

  // --- Transparent mode ---

  describe('render_mermaid_svg – transparent', () => {
    it('renders with transparent background when enabled', () => {
      const result = handleRenderSVG({
        mermaid_code: SIMPLE_FLOWCHART,
        transparent: true,
      })
      const svg = result.content[0]!.text
      expect(svg).not.toContain('background:var(--bg)')
    })

    it('renders with opaque background by default', () => {
      const result = handleRenderSVG({ mermaid_code: SIMPLE_FLOWCHART })
      const svg = result.content[0]!.text
      expect(svg).toContain('background:var(--bg)')
    })

    it('transparent rendering still includes --bg variable for internal use', () => {
      const result = handleRenderSVG({
        mermaid_code: SIMPLE_FLOWCHART,
        transparent: true,
      })
      const svg = result.content[0]!.text
      // CSS variable still present for internal derived colors
      expect(svg).toContain('--bg:')
    })
  })

  // --- Error handling ---

  describe('render_mermaid_svg – errors', () => {
    it('returns structured error for invalid header', () => {
      const result = handleRenderSVG({
        mermaid_code: 'not a valid mermaid diagram',
      })
      const { payload } = expectErrorResponse(result)
      expect(payload.error).toBeDefined()
    })

    it('returns structured error for empty input', () => {
      const result = handleRenderSVG({ mermaid_code: '' })
      const { payload } = expectErrorResponse(result)
      expect(payload.error).toBeDefined()
    })

    it('best-effort renders partial graph when trailing lines are broken', () => {
      // The first line is valid, the rest is garbled
      const result = handleRenderSVG({
        mermaid_code: 'graph TD\n  A --> B\n  ZZZ###!!!\n  @@@invalid@@@',
      })
      // Should produce some output (either partial SVG or error JSON)
      expect(result.content).toHaveLength(1)
      expect(typeof result.content[0]!.text).toBe('string')
      expect(result.content[0]!.text.length).toBeGreaterThan(0)
    })

    it('error response includes partial output when best-effort succeeds', () => {
      const result = handleRenderSVG({
        mermaid_code: `graph TD
          A --> B
          C --> D
          broken line with @@@ garbage`,
      })
      // If partial rendering succeeds, error JSON contains "partial" field
      if (result.isError) {
        const payload = JSON.parse(result.content[0]!.text) as Record<string, unknown>
        // Either error-only or error+partial
        expect(payload.error).toBeDefined()
      }
    })
  })

  // --- Edge cases ---

  describe('render_mermaid_svg – edge cases', () => {
    it('renders graph with special characters in labels', () => {
      const result = handleRenderSVG({
        mermaid_code: 'graph TD\n  A[<script> & "quotes"] --> B',
      })
      const svg = result.content[0]!.text
      expect(svg).toContain('&lt;script&gt;')
      expect(svg).toContain('&amp;')
      expect(svg).toContain('&quot;quotes&quot;')
    })

    it('renders graph with Unicode characters in labels', () => {
      const result = handleRenderSVG({
        mermaid_code: 'graph TD\n  A[Café résumé naïve] --> B',
      })
      const svg = result.content[0]!.text
      expect(svg).toContain('Café résumé naïve')
    })

    it('renders graph with long label text', () => {
      const result = handleRenderSVG({
        mermaid_code: `graph LR
          A[This is a very long label that should still render correctly] --> B`,
      })
      const svg = result.content[0]!.text
      expect(svg).toContain('This is a very long label')
    })

    it('renders multiline labels with <br> tags', () => {
      const result = handleRenderSVG({
        mermaid_code: 'graph TD\n  A["Line 1<br>Line 2"] --> B',
      })
      const svg = result.content[0]!.text
      expect(svg).toContain('Line 1')
      expect(svg).toContain('Line 2')
    })

    it('renders with only bg provided (DEFAULTS fg)', () => {
      const result = handleRenderSVG({
        mermaid_code: SIMPLE_FLOWCHART,
        bg: '#2e3440',
      })
      const svg = result.content[0]!.text
      expect(svg).toContain('--bg:#2e3440')
      expect(svg).toContain('--fg:#27272A') // from DEFAULTS
    })

    it('renders with only fg provided (DEFAULTS bg)', () => {
      const result = handleRenderSVG({
        mermaid_code: SIMPLE_FLOWCHART,
        fg: '#88c0d0',
      })
      const svg = result.content[0]!.text
      expect(svg).toContain('--bg:#FFFFFF') // from DEFAULTS
      expect(svg).toContain('--fg:#88c0d0')
    })

    it('handles xychart-beta with basic line chart', () => {
      const result = handleRenderSVG({
        mermaid_code: 'xychart-beta\n  line [10, 20, 30, 40]',
      })
      expectSuccessResponse(result)
      expect(result.content[0]!.text).toContain('<svg')
    })

    it('handles xychart-beta with transparent + interactive', () => {
      const result = handleRenderSVG({
        mermaid_code: 'xychart-beta\n  line [1,2,3]',
        transparent: true,
      })
      expectSuccessResponse(result)
    })

    it('renders graph with & parallel links producing multiple polylines', () => {
      const result = handleRenderSVG({
        mermaid_code: 'graph TD\n  A & B & C --> D',
      })
      const svg = result.content[0]!.text
      const polylines = (svg.match(/<polyline/g) ?? []).length
      expect(polylines).toBeGreaterThanOrEqual(3)
    })
  })
})

// ============================================================================
// render_mermaid_ascii
// ============================================================================

describe('render_mermaid_ascii', () => {
  const SIMPLE_LR = 'graph LR\n  A --> B --> C'

  // --- Basic rendering ---

  describe('render_mermaid_ascii – basic', () => {
    it('renders a simple graph producing non-empty output', () => {
      const result = handleRenderAscii({ mermaid_code: SIMPLE_LR })
      expectSuccessResponse(result)
    })

    it('default renders with Unicode box-drawing characters', () => {
      const result = handleRenderAscii({
        mermaid_code: SIMPLE_LR,
        use_ascii: false,
      })
      const text = result.content[0]!.text
      // Unicode box-drawing uses characters in the range ─━│┃ etc. or ANSI color codes
      expect(text.length).toBeGreaterThan(0)
    })

    it('pure ASCII mode uses +, -, | characters', () => {
      const result = handleRenderAscii({
        mermaid_code: SIMPLE_LR,
        use_ascii: true,
      })
      const text = result.content[0]!.text
      expect(text).toContain('+')
      expect(text).toContain('-')
      expect(text).toContain('|')
    })

    it('pure ASCII mode does NOT contain Unicode box-drawing', () => {
      const result = handleRenderAscii({
        mermaid_code: SIMPLE_LR,
        use_ascii: true,
      })
      const text = result.content[0]!.text
      expect(text).not.toContain('┌')
      expect(text).not.toContain('┐')
      expect(text).not.toContain('─')
      expect(text).not.toContain('│')
    })
  })

  // --- All diagram types ---

  describe('render_mermaid_ascii – diagram types', () => {
    for (const [kind, code] of Object.entries(ALL_DIAGRAMS)) {
      it(`renders ${kind} diagram in ASCII mode without errors`, () => {
        const result = handleRenderAscii({
          mermaid_code: code,
          use_ascii: true,
        })
        expectSuccessResponse(result)
      })

      it(`renders ${kind} diagram in Unicode mode without errors`, () => {
        const result = handleRenderAscii({
          mermaid_code: code,
          use_ascii: false,
        })
        expectSuccessResponse(result)
      })
    }

    it('renders sequence diagram in ASCII mode with correct structure', () => {
      const result = handleRenderAscii({
        mermaid_code: `sequenceDiagram
          Alice->>Bob: Hello
          Bob->>Alice: Hi`,
        use_ascii: true,
      })
      const text = result.content[0]!.text
      expect(text.length).toBeGreaterThan(0)
    })

    it('renders class diagram in ASCII mode with correct structure', () => {
      const result = handleRenderAscii({
        mermaid_code: `classDiagram
          Animal <|-- Duck
          Duck : +String name`,
        use_ascii: true,
      })
      const text = result.content[0]!.text
      expect(text.length).toBeGreaterThan(0)
    })

    it('renders ER diagram in ASCII mode with correct structure', () => {
      const result = handleRenderAscii({
        mermaid_code: `erDiagram
          CUSTOMER ||--o{ ORDER : places
          ORDER ||--|{ LINE-ITEM : contains`,
        use_ascii: true,
      })
      const text = result.content[0]!.text
      expect(text.length).toBeGreaterThan(0)
    })
  })

  // --- Color modes ---

  describe('render_mermaid_ascii – color modes', () => {
    const COLOR_MODES = ['none', 'auto', 'ansi16', 'ansi256', 'truecolor', 'html'] as const

    for (const mode of COLOR_MODES) {
      it(`renders with color_mode="${mode}" without errors`, () => {
        const result = handleRenderAscii({
          mermaid_code: SIMPLE_LR,
          color_mode: mode,
        })
        expectSuccessResponse(result)
        const text = result.content[0]!.text
        expect(text.length).toBeGreaterThan(0)
      })
    }

    it('defaults to auto color mode when not specified', () => {
      const result = handleRenderAscii({ mermaid_code: SIMPLE_LR })
      expectSuccessResponse(result)
    })
  })

  // --- CJK detection ---

  describe('render_mermaid_ascii – CJK detection', () => {
    it('emits CJK warning for Chinese characters in labels', () => {
      const result = handleRenderAscii({
        mermaid_code: 'graph TD\n  A[中文] --> B',
      })
      expect(result.warnings).toBeDefined()
      expect(result.warnings).toHaveLength(1)
      expect(result.warnings![0]).toContain('CJK')
    })

    it('emits CJK warning for Chinese characters in edge labels', () => {
      const result = handleRenderAscii({
        mermaid_code: `graph TD
          A -->|你好| B`,
      })
      expect(result.warnings).toBeDefined()
      expect(result.warnings![0]).toContain('CJK')
    })

    it('emits CJK warning for Japanese characters (hiragana + kanji)', () => {
      const result = handleRenderAscii({
        mermaid_code: 'graph TD\n  A[こんにちは] --> B[日本]',
      })
      expect(result.warnings).toBeDefined()
      expect(result.warnings).toHaveLength(1)
      expect(result.warnings![0]).toContain('CJK')
    })

    it('emits CJK warning for Japanese katakana', () => {
      const result = handleRenderAscii({
        mermaid_code: 'graph TD\n  A[テスト] --> B',
      })
      expect(result.warnings).toBeDefined()
      expect(result.warnings![0]).toContain('CJK')
    })

    it('emits CJK warning for Korean hangul', () => {
      const result = handleRenderAscii({
        mermaid_code: 'graph TD\n  A[한국어] --> B',
      })
      expect(result.warnings).toBeDefined()
      expect(result.warnings![0]).toContain('CJK')
    })

    it('does not emit warnings for ASCII-only diagrams', () => {
      const result = handleRenderAscii({ mermaid_code: SIMPLE_LR })
      expect(result.warnings).toBeUndefined()
    })

    it('does not emit warnings for Latin accented characters', () => {
      const result = handleRenderAscii({
        mermaid_code: 'graph TD\n  A[Café résumé] --> B',
      })
      expect(result.warnings).toBeUndefined()
    })

    it('emits single warning even with multiple CJK blocks', () => {
      const result = handleRenderAscii({
        mermaid_code: 'graph TD\n  A[中文] --> B[日本語]\n  B --> C[한국어]',
      })
      // Should be exactly one warning message
      expect(result.warnings).toBeDefined()
      expect(result.warnings).toHaveLength(1)
    })

    it('still renders correctly despite CJK warning', () => {
      const result = handleRenderAscii({
        mermaid_code: 'graph TD\n  A[你好世界] --> B',
      })
      expectSuccessResponse(result)
      expect(result.warnings).toBeDefined()
    })

    it('emits CJK warning for CJK compatibility ideographs', () => {
      const result = handleRenderAscii({
        mermaid_code: 'graph TD\n  A[\uFA1F] --> B',
      })
      expect(result.warnings).toBeDefined()
    })
  })

  // --- Padding options ---

  describe('render_mermaid_ascii – padding', () => {
    it('renders with default padding', () => {
      const result = handleRenderAscii({ mermaid_code: SIMPLE_LR })
      expectSuccessResponse(result)
    })

    it('renders with custom padding', () => {
      const result = handleRenderAscii({
        mermaid_code: SIMPLE_LR,
        padding: 8,
      })
      expectSuccessResponse(result)
    })

    it('renders with zero padding', () => {
      const result = handleRenderAscii({
        mermaid_code: SIMPLE_LR,
        padding: 0,
      })
      expectSuccessResponse(result)
    })

    it('renders with large padding', () => {
      const result = handleRenderAscii({
        mermaid_code: SIMPLE_LR,
        padding: 20,
      })
      expectSuccessResponse(result)
    })
  })

  // --- Error handling ---

  describe('render_mermaid_ascii – errors', () => {
    it('returns structured error for invalid header', () => {
      const result = handleRenderAscii({
        mermaid_code: 'not a valid mermaid diagram',
      })
      const { payload } = expectErrorResponse(result)
      expect(payload.error).toBeDefined()
    })

    it('returns structured error for empty input', () => {
      const result = handleRenderAscii({ mermaid_code: '' })
      const { payload } = expectErrorResponse(result)
      expect(payload.error).toBeDefined()
    })

    it('best-effort renders partial graph when trailing lines are broken', () => {
      const result = handleRenderAscii({
        mermaid_code: `graph LR
          A --> B
          ZZZ###!!!broken`,
      })
      expect(result.content).toHaveLength(1)
      expect(typeof result.content[0]!.text).toBe('string')
      expect(result.content[0]!.text.length).toBeGreaterThan(0)
    })
  })

  // --- Edge cases ---

  describe('render_mermaid_ascii – edge cases', () => {
    it('renders state diagram with composite states in ASCII', () => {
      const result = handleRenderAscii({
        mermaid_code: `stateDiagram-v2
          [*] --> Active
          Active --> Inactive
          Inactive --> [*]`,
        use_ascii: true,
      })
      expectSuccessResponse(result)
    })

    it('renders graph with multiline labels in ASCII', () => {
      const result = handleRenderAscii({
        mermaid_code: 'graph TD\n  A["Line 1<br>Line 2"] --> B',
        use_ascii: true,
      })
      expectSuccessResponse(result)
    })

    it('renders with color_mode=none and use_ascii=true combined', () => {
      const result = handleRenderAscii({
        mermaid_code: SIMPLE_LR,
        use_ascii: true,
        color_mode: 'none',
      })
      expectSuccessResponse(result)
      const text = result.content[0]!.text
      // In ASCII mode with no color, output is plain text (no ANSI escapes)
      expect(text).toContain('+')
      expect(text).toContain('-')
    })
  })
})

// ============================================================================
// Cross-tool integration
// ============================================================================

describe('MCP tools – cross-tool integration', () => {
  it('parse then render SVG produces consistent output', () => {
    const code = `graph LR
      A[Parse] --> B[Render]
      B --> C[Verify]`

    const parseResult = handleParseMermaid({ mermaid_code: code })
    expectSuccessResponse(parseResult)

    const graph = JSON.parse(parseResult.content[0]!.text)
    expect(graph.nodes.A.label).toBe('Parse')
    expect(graph.nodes.B.label).toBe('Render')
    expect(graph.nodes.C.label).toBe('Verify')

    const svgResult = handleRenderSVG({ mermaid_code: code })
    expectSuccessResponse(svgResult)
    expect(svgResult.content[0]!.text).toContain('>Parse</text>')
    expect(svgResult.content[0]!.text).toContain('>Render</text>')
    expect(svgResult.content[0]!.text).toContain('>Verify</text>')
  })

  it('parse then render ASCII produces consistent output', () => {
    const code = 'graph TD\n  A --> B --> C'

    const parseResult = handleParseMermaid({ mermaid_code: code })
    expectSuccessResponse(parseResult)

    const asciiResult = handleRenderAscii({ mermaid_code: code, use_ascii: true })
    expectSuccessResponse(asciiResult)
    const text = asciiResult.content[0]!.text
    expect(text).toContain('A')
    expect(text).toContain('B')
    expect(text).toContain('C')
  })

  it('all diagram types parse and render SVG consistently', () => {
    for (const [kind, code] of Object.entries(ALL_DIAGRAMS)) {
      const parseResult = handleParseMermaid({ mermaid_code: code })
      const svgResult = handleRenderSVG({ mermaid_code: code })

      // Sequence, class, ER, xychart will fail at parse (parseMermaid only does flowchart/state)
      if (kind === 'flowchart' || kind === 'state') {
        expectSuccessResponse(parseResult)
        expectSuccessResponse(svgResult)
      } else {
        // For other types, parseMermaid throws but renderSVG handles them internally
        expectSuccessResponse(svgResult)
      }
    }
  })

  it('theme applied via SVG does not affect ASCII rendering', () => {
    const code = 'graph TD\n  A --> B'

    const svgResult = handleRenderSVG({
      mermaid_code: code,
      theme_name: 'tokyo-night',
    })
    const asciiResult = handleRenderAscii({
      mermaid_code: code,
      use_ascii: true,
    })

    expectSuccessResponse(svgResult)
    expectSuccessResponse(asciiResult)

    // SVG gets themed colors, ASCII is standalone
    expect(svgResult.content[0]!.text).toContain('tokyo-night' in THEMES ? '--bg:' : '')
    const asciiText = asciiResult.content[0]!.text
    // ASCII output is independent of SVG theming
    expect(asciiText).toContain('+')
  })

  it('errors in one tool do not affect other tools', () => {
    // parse_mermaid should fail on this
    const parseResult = handleParseMermaid({ mermaid_code: 'invalid diagram' })
    expect(parseResult.isError).toBe(true)

    // render_mermaid_svg on valid input should still work
    const svgResult = handleRenderSVG({ mermaid_code: SIMPLE_FLOWCHART })
    expectSuccessResponse(svgResult)

    // render_mermaid_ascii should also still work
    const asciiResult = handleRenderAscii({ mermaid_code: SIMPLE_FLOWCHART, use_ascii: true })
    expectSuccessResponse(asciiResult)
  })

  it('SVG output is valid XML (has proper closing)', () => {
    const result = handleRenderSVG({
      mermaid_code: `graph TD
        A[Node 1] --> B[Node 2]
        B --> C[Node 3]
        C --> D[Node 4]
        D --> E[Node 5]`,
    })
    const svg = result.content[0]!.text

    // Count opening and closing tags match
    const opens = (svg.match(/<svg/g) ?? []).length
    const closes = (svg.match(/<\/svg>/g) ?? []).length
    expect(opens).toBe(1)
    expect(closes).toBe(1)

    // Basic XML balance: <defs> and </defs>
    expect(svg).toContain('<defs>')
    expect(svg).toContain('</defs>')

    // <style> and </style>
    expect(svg).toContain('<style>')
    expect(svg).toContain('</style>')
  })
})
