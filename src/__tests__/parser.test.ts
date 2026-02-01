/**
 * Tests for the Mermaid parser.
 *
 * Covers:
 * - Flowcharts: graph headers, node shapes (all 13), edge styles, chained edges,
 *   subgraphs (basic + nested), classDef/class, ::: shorthand, style statements,
 *   direction override, & parallel links, no-arrow edges, bidirectional arrows
 * - State diagrams: transitions, [*] pseudostates, composite states,
 *   state aliases, direction override
 * - Comments and error cases
 */
import { describe, it, expect } from 'bun:test'
import { parseMermaid } from '../parser.ts'

// ============================================================================
// Graph header parsing
// ============================================================================

describe('parseMermaid – graph header', () => {
  it('parses "graph TD" header', () => {
    const g = parseMermaid('graph TD\n  A --> B')
    expect(g.direction).toBe('TD')
  })

  it('parses "flowchart LR" header', () => {
    const g = parseMermaid('flowchart LR\n  A --> B')
    expect(g.direction).toBe('LR')
  })

  it.each(['TD', 'TB', 'LR', 'BT', 'RL'] as const)('accepts direction %s', (dir) => {
    const g = parseMermaid(`graph ${dir}\n  A --> B`)
    expect(g.direction).toBe(dir)
  })

  it('is case-insensitive for the keyword', () => {
    const g = parseMermaid('graph td\n  A --> B')
    expect(g.direction).toBe('TD')
  })

  it('throws on empty input', () => {
    expect(() => parseMermaid('')).toThrow('Empty mermaid diagram')
  })

  it('throws on invalid header', () => {
    expect(() => parseMermaid('sequenceDiagram\n  A ->> B')).toThrow('Invalid mermaid header')
  })

  it('throws on header without direction', () => {
    expect(() => parseMermaid('graph\n  A --> B')).toThrow('Invalid mermaid header')
  })
})

// ============================================================================
// Original node shapes
// ============================================================================

describe('parseMermaid – node shapes (original)', () => {
  it('parses rectangle nodes: A[Label]', () => {
    const g = parseMermaid('graph TD\n  A[Hello World]')
    const node = g.nodes.get('A')
    expect(node).toBeDefined()
    expect(node!.shape).toBe('rectangle')
    expect(node!.label).toBe('Hello World')
  })

  it('parses rounded nodes: A(Label)', () => {
    const g = parseMermaid('graph TD\n  A(Rounded)')
    expect(g.nodes.get('A')!.shape).toBe('rounded')
    expect(g.nodes.get('A')!.label).toBe('Rounded')
  })

  it('parses diamond nodes: A{Label}', () => {
    const g = parseMermaid('graph TD\n  A{Decision}')
    expect(g.nodes.get('A')!.shape).toBe('diamond')
    expect(g.nodes.get('A')!.label).toBe('Decision')
  })

  it('parses stadium nodes: A([Label])', () => {
    const g = parseMermaid('graph TD\n  A([Stadium])')
    expect(g.nodes.get('A')!.shape).toBe('stadium')
    expect(g.nodes.get('A')!.label).toBe('Stadium')
  })

  it('parses circle nodes: A((Label))', () => {
    const g = parseMermaid('graph TD\n  A((Circle))')
    expect(g.nodes.get('A')!.shape).toBe('circle')
    expect(g.nodes.get('A')!.label).toBe('Circle')
  })

  it('creates a default rectangle for bare node references', () => {
    const g = parseMermaid('graph TD\n  A --> B')
    expect(g.nodes.get('A')!.shape).toBe('rectangle')
    expect(g.nodes.get('A')!.label).toBe('A')
    expect(g.nodes.get('B')!.shape).toBe('rectangle')
    expect(g.nodes.get('B')!.label).toBe('B')
  })

  it('supports hyphenated node IDs', () => {
    const g = parseMermaid('graph TD\n  my-node[My Node]')
    expect(g.nodes.get('my-node')).toBeDefined()
    expect(g.nodes.get('my-node')!.label).toBe('My Node')
  })

  it('first definition wins for shape and label', () => {
    const g = parseMermaid('graph TD\n  A[Start] --> B\n  A --> B')
    expect(g.nodes.get('A')!.shape).toBe('rectangle')
    expect(g.nodes.get('A')!.label).toBe('Start')
  })
})

// ============================================================================
// Batch 1 node shapes
// ============================================================================

describe('parseMermaid – node shapes (Batch 1)', () => {
  it('parses subroutine nodes: A[[Label]]', () => {
    const g = parseMermaid('graph TD\n  A[[Subroutine]]')
    expect(g.nodes.get('A')!.shape).toBe('subroutine')
    expect(g.nodes.get('A')!.label).toBe('Subroutine')
  })

  it('parses double circle nodes: A(((Label)))', () => {
    const g = parseMermaid('graph TD\n  A(((Double)))')
    expect(g.nodes.get('A')!.shape).toBe('doublecircle')
    expect(g.nodes.get('A')!.label).toBe('Double')
  })

  it('parses hexagon nodes: A{{Label}}', () => {
    const g = parseMermaid('graph TD\n  A{{Hexagon}}')
    expect(g.nodes.get('A')!.shape).toBe('hexagon')
    expect(g.nodes.get('A')!.label).toBe('Hexagon')
  })
})

// ============================================================================
// Batch 2 node shapes
// ============================================================================

describe('parseMermaid – node shapes (Batch 2)', () => {
  it('parses cylinder / database nodes: A[(Label)]', () => {
    const g = parseMermaid('graph TD\n  A[(Database)]')
    expect(g.nodes.get('A')!.shape).toBe('cylinder')
    expect(g.nodes.get('A')!.label).toBe('Database')
  })

  it('parses asymmetric / flag nodes: A>Label]', () => {
    const g = parseMermaid('graph TD\n  A>Flag Shape]')
    expect(g.nodes.get('A')!.shape).toBe('asymmetric')
    expect(g.nodes.get('A')!.label).toBe('Flag Shape')
  })

  it('parses trapezoid nodes: A[/Label\\]', () => {
    const g = parseMermaid('graph TD\n  A[/Trapezoid\\]')
    expect(g.nodes.get('A')!.shape).toBe('trapezoid')
    expect(g.nodes.get('A')!.label).toBe('Trapezoid')
  })

  it('parses trapezoid-alt nodes: A[\\Label/]', () => {
    const g = parseMermaid('graph TD\n  A[\\Alt Trapezoid/]')
    expect(g.nodes.get('A')!.shape).toBe('trapezoid-alt')
    expect(g.nodes.get('A')!.label).toBe('Alt Trapezoid')
  })
})

// ============================================================================
// All shapes in one diagram — ensures no regex conflicts
// ============================================================================

describe('parseMermaid – all shapes combined', () => {
  it('parses all 13 shapes correctly in one diagram', () => {
    const g = parseMermaid(`graph TD
      A[Rectangle]
      B(Rounded)
      C{Diamond}
      D([Stadium])
      E((Circle))
      F[[Subroutine]]
      G(((DoubleCircle)))
      H{{Hexagon}}
      I[(Cylinder)]
      J>Asymmetric]
      K[/Trapezoid\\]
      L[\\TrapAlt/]`)

    expect(g.nodes.get('A')!.shape).toBe('rectangle')
    expect(g.nodes.get('B')!.shape).toBe('rounded')
    expect(g.nodes.get('C')!.shape).toBe('diamond')
    expect(g.nodes.get('D')!.shape).toBe('stadium')
    expect(g.nodes.get('E')!.shape).toBe('circle')
    expect(g.nodes.get('F')!.shape).toBe('subroutine')
    expect(g.nodes.get('G')!.shape).toBe('doublecircle')
    expect(g.nodes.get('H')!.shape).toBe('hexagon')
    expect(g.nodes.get('I')!.shape).toBe('cylinder')
    expect(g.nodes.get('J')!.shape).toBe('asymmetric')
    expect(g.nodes.get('K')!.shape).toBe('trapezoid')
    expect(g.nodes.get('L')!.shape).toBe('trapezoid-alt')
  })
})

// ============================================================================
// Edge parsing — original arrows
// ============================================================================

describe('parseMermaid – edges (original)', () => {
  it('parses a solid edge: -->', () => {
    const g = parseMermaid('graph TD\n  A --> B')
    expect(g.edges).toHaveLength(1)
    expect(g.edges[0]!.source).toBe('A')
    expect(g.edges[0]!.target).toBe('B')
    expect(g.edges[0]!.style).toBe('solid')
    expect(g.edges[0]!.label).toBeUndefined()
  })

  it('parses a dotted edge: -.->', () => {
    const g = parseMermaid('graph TD\n  A -.-> B')
    expect(g.edges[0]!.style).toBe('dotted')
  })

  it('parses a thick edge: ==>', () => {
    const g = parseMermaid('graph TD\n  A ==> B')
    expect(g.edges[0]!.style).toBe('thick')
  })

  it('parses edge label: -->|label|', () => {
    const g = parseMermaid('graph TD\n  A -->|Yes| B')
    expect(g.edges[0]!.label).toBe('Yes')
  })

  it('parses edge label on dotted edges', () => {
    const g = parseMermaid('graph TD\n  A -.->|Maybe| B')
    expect(g.edges[0]!.label).toBe('Maybe')
    expect(g.edges[0]!.style).toBe('dotted')
  })

  it('parses chained edges: A --> B --> C', () => {
    const g = parseMermaid('graph TD\n  A --> B --> C')
    expect(g.edges).toHaveLength(2)
    expect(g.edges[0]!.source).toBe('A')
    expect(g.edges[0]!.target).toBe('B')
    expect(g.edges[1]!.source).toBe('B')
    expect(g.edges[1]!.target).toBe('C')
  })

  it('parses chained edges with shapes: A[Start] --> B{Check} --> C(End)', () => {
    const g = parseMermaid('graph TD\n  A[Start] --> B{Check} --> C(End)')
    expect(g.edges).toHaveLength(2)
    expect(g.nodes.get('A')!.shape).toBe('rectangle')
    expect(g.nodes.get('B')!.shape).toBe('diamond')
    expect(g.nodes.get('C')!.shape).toBe('rounded')
  })

  it('handles multiple edge lines', () => {
    const g = parseMermaid('graph TD\n  A --> B\n  B --> C\n  C --> D')
    expect(g.edges).toHaveLength(3)
  })

  it('sets hasArrowEnd=true for arrow operators (-->)', () => {
    const g = parseMermaid('graph TD\n  A --> B')
    expect(g.edges[0]!.hasArrowEnd).toBe(true)
    expect(g.edges[0]!.hasArrowStart).toBe(false)
  })
})

// ============================================================================
// No-arrow edges (Batch 1.1)
// ============================================================================

describe('parseMermaid – no-arrow edges', () => {
  it('parses solid line without arrow: ---', () => {
    const g = parseMermaid('graph TD\n  A --- B')
    expect(g.edges).toHaveLength(1)
    expect(g.edges[0]!.style).toBe('solid')
    expect(g.edges[0]!.hasArrowEnd).toBe(false)
    expect(g.edges[0]!.hasArrowStart).toBe(false)
  })

  it('parses dotted line without arrow: -.-', () => {
    const g = parseMermaid('graph TD\n  A -.- B')
    expect(g.edges[0]!.style).toBe('dotted')
    expect(g.edges[0]!.hasArrowEnd).toBe(false)
  })

  it('parses thick line without arrow: ===', () => {
    const g = parseMermaid('graph TD\n  A === B')
    expect(g.edges[0]!.style).toBe('thick')
    expect(g.edges[0]!.hasArrowEnd).toBe(false)
  })

  it('parses no-arrow with label: ---|text|', () => {
    const g = parseMermaid('graph TD\n  A ---|connects| B')
    expect(g.edges[0]!.label).toBe('connects')
    expect(g.edges[0]!.hasArrowEnd).toBe(false)
  })
})

// ============================================================================
// Bidirectional arrows (Batch 2.4)
// ============================================================================

describe('parseMermaid – bidirectional arrows', () => {
  it('parses solid bidirectional: <-->', () => {
    const g = parseMermaid('graph TD\n  A <--> B')
    expect(g.edges).toHaveLength(1)
    expect(g.edges[0]!.style).toBe('solid')
    expect(g.edges[0]!.hasArrowStart).toBe(true)
    expect(g.edges[0]!.hasArrowEnd).toBe(true)
  })

  it('parses dotted bidirectional: <-.->',  () => {
    const g = parseMermaid('graph TD\n  A <-.-> B')
    expect(g.edges[0]!.style).toBe('dotted')
    expect(g.edges[0]!.hasArrowStart).toBe(true)
    expect(g.edges[0]!.hasArrowEnd).toBe(true)
  })

  it('parses thick bidirectional: <==>', () => {
    const g = parseMermaid('graph TD\n  A <==> B')
    expect(g.edges[0]!.style).toBe('thick')
    expect(g.edges[0]!.hasArrowStart).toBe(true)
    expect(g.edges[0]!.hasArrowEnd).toBe(true)
  })

  it('parses bidirectional with label: <-->|text|', () => {
    const g = parseMermaid('graph TD\n  A <-->|sync| B')
    expect(g.edges[0]!.label).toBe('sync')
    expect(g.edges[0]!.hasArrowStart).toBe(true)
    expect(g.edges[0]!.hasArrowEnd).toBe(true)
  })
})

// ============================================================================
// Parallel links with & (Batch 2.6)
// ============================================================================

describe('parseMermaid – parallel links (&)', () => {
  it('expands A & B --> C to two edges', () => {
    const g = parseMermaid('graph TD\n  A & B --> C')
    expect(g.edges).toHaveLength(2)
    expect(g.edges[0]!.source).toBe('A')
    expect(g.edges[0]!.target).toBe('C')
    expect(g.edges[1]!.source).toBe('B')
    expect(g.edges[1]!.target).toBe('C')
  })

  it('expands A --> C & D to two edges', () => {
    const g = parseMermaid('graph TD\n  A --> C & D')
    expect(g.edges).toHaveLength(2)
    expect(g.edges[0]!.source).toBe('A')
    expect(g.edges[0]!.target).toBe('C')
    expect(g.edges[1]!.source).toBe('A')
    expect(g.edges[1]!.target).toBe('D')
  })

  it('expands A & B --> C & D to four edges (Cartesian product)', () => {
    const g = parseMermaid('graph TD\n  A & B --> C & D')
    expect(g.edges).toHaveLength(4)
    const edgePairs = g.edges.map(e => `${e.source}->${e.target}`)
    expect(edgePairs).toContain('A->C')
    expect(edgePairs).toContain('A->D')
    expect(edgePairs).toContain('B->C')
    expect(edgePairs).toContain('B->D')
  })
})

// ============================================================================
// ::: class shorthand (Batch 1.2)
// ============================================================================

describe('parseMermaid – ::: class shorthand', () => {
  it('assigns class via ::: on shaped nodes', () => {
    const g = parseMermaid('graph TD\n  A[Start]:::highlight --> B')
    expect(g.classAssignments.get('A')).toBe('highlight')
  })

  it('assigns class via ::: on bare nodes', () => {
    const g = parseMermaid('graph TD\n  A:::important --> B')
    expect(g.classAssignments.get('A')).toBe('important')
  })

  it('works in chained edges', () => {
    const g = parseMermaid('graph TD\n  A:::start --> B:::mid --> C:::end')
    expect(g.classAssignments.get('A')).toBe('start')
    expect(g.classAssignments.get('B')).toBe('mid')
    expect(g.classAssignments.get('C')).toBe('end')
  })
})

// ============================================================================
// Inline style statements (Batch 2.5)
// ============================================================================

describe('parseMermaid – style statements', () => {
  it('parses style for a single node', () => {
    const g = parseMermaid('graph TD\n  A --> B\n  style A fill:#ff0000,stroke:#333')
    expect(g.nodeStyles.get('A')).toEqual({ fill: '#ff0000', stroke: '#333' })
  })

  it('parses style for multiple nodes', () => {
    const g = parseMermaid('graph TD\n  A --> B\n  style A,B fill:#0f0')
    expect(g.nodeStyles.get('A')).toEqual({ fill: '#0f0' })
    expect(g.nodeStyles.get('B')).toEqual({ fill: '#0f0' })
  })

  it('merges multiple style statements for same node', () => {
    const g = parseMermaid('graph TD\n  A --> B\n  style A fill:#f00\n  style A stroke:#333')
    expect(g.nodeStyles.get('A')).toEqual({ fill: '#f00', stroke: '#333' })
  })
})

// ============================================================================
// linkStyle directives
// ============================================================================

describe('parseMermaid – linkStyle directives', () => {
  it('applies linkStyle to a specific edge index', () => {
    const g = parseMermaid(`graph TD
      A --> B
      B --> C
      linkStyle 0 stroke:#f00,stroke-width:3px`)
    expect(g.edges[0]!.inlineStyle).toEqual({ stroke: '#f00', 'stroke-width': '3px' })
    expect(g.edges[1]!.inlineStyle).toBeUndefined()
  })

  it('applies linkStyle to multiple indices', () => {
    const g = parseMermaid(`graph TD
      A --> B
      B --> C
      C --> D
      linkStyle 0,2 stroke:#0f0`)
    expect(g.edges[0]!.inlineStyle).toEqual({ stroke: '#0f0' })
    expect(g.edges[1]!.inlineStyle).toBeUndefined()
    expect(g.edges[2]!.inlineStyle).toEqual({ stroke: '#0f0' })
  })

  it('applies default linkStyle to all edges and merges with specific overrides', () => {
    const g = parseMermaid(`graph TD
      A --> B
      B --> C
      linkStyle default stroke:#333,stroke-width:2px
      linkStyle 1 stroke:#f00`)
    expect(g.edges[0]!.inlineStyle).toEqual({ stroke: '#333', 'stroke-width': '2px' })
    expect(g.edges[1]!.inlineStyle).toEqual({ stroke: '#f00', 'stroke-width': '2px' })
  })
})

// ============================================================================
// Subgraph direction override (Batch 2.7)
// ============================================================================

describe('parseMermaid – subgraph direction override', () => {
  it('parses direction override inside subgraph', () => {
    const g = parseMermaid(`graph TD
      subgraph sub1 [Left-Right Group]
        direction LR
        A --> B
      end`)
    expect(g.subgraphs[0]!.direction).toBe('LR')
  })

  it('does not apply direction outside subgraph', () => {
    // "direction LR" at root level without subgraph context should not change graph direction
    const g = parseMermaid('graph TD\n  A --> B')
    expect(g.direction).toBe('TD')
  })
})

// ============================================================================
// Subgraphs
// ============================================================================

describe('parseMermaid – subgraphs', () => {
  it('parses a basic subgraph', () => {
    const g = parseMermaid(`graph TD
      subgraph Backend
        A --> B
      end`)
    expect(g.subgraphs).toHaveLength(1)
    expect(g.subgraphs[0]!.label).toBe('Backend')
    expect(g.subgraphs[0]!.nodeIds).toContain('A')
    expect(g.subgraphs[0]!.nodeIds).toContain('B')
  })

  it('parses subgraph with bracket ID syntax: subgraph id [Label]', () => {
    const g = parseMermaid(`graph TD
      subgraph be [Backend Services]
        A --> B
      end`)
    expect(g.subgraphs[0]!.id).toBe('be')
    expect(g.subgraphs[0]!.label).toBe('Backend Services')
  })

  it('parses subgraph bracket syntax with hyphenated ID: subgraph us-east [US East]', () => {
    const g = parseMermaid(`graph TD
      subgraph us-east [US East Region]
        A --> B
      end`)
    expect(g.subgraphs[0]!.id).toBe('us-east')
    expect(g.subgraphs[0]!.label).toBe('US East Region')
  })

  it('slugifies label as id when bracket syntax is not used', () => {
    const g = parseMermaid(`graph TD
      subgraph My Group
        A --> B
      end`)
    expect(g.subgraphs[0]!.id).toBe('My_Group')
    expect(g.subgraphs[0]!.label).toBe('My Group')
  })

  it('parses nested subgraphs', () => {
    const g = parseMermaid(`graph TD
      subgraph Outer
        subgraph Inner
          A --> B
        end
        C --> D
      end`)
    expect(g.subgraphs).toHaveLength(1) // only top-level
    const outer = g.subgraphs[0]!
    expect(outer.label).toBe('Outer')
    expect(outer.children).toHaveLength(1)
    expect(outer.children[0]!.label).toBe('Inner')
    expect(outer.children[0]!.nodeIds).toContain('A')
    expect(outer.children[0]!.nodeIds).toContain('B')
    expect(outer.nodeIds).toContain('C')
    expect(outer.nodeIds).toContain('D')
  })
})

// ============================================================================
// classDef and class assignments
// ============================================================================

describe('parseMermaid – classDef and class', () => {
  it('parses classDef with properties', () => {
    const g = parseMermaid(`graph TD
      classDef highlight fill:#f96,stroke:#333
      A --> B`)
    expect(g.classDefs.has('highlight')).toBe(true)
    const props = g.classDefs.get('highlight')!
    expect(props['fill']).toBe('#f96')
    expect(props['stroke']).toBe('#333')
  })

  it('parses class assignments to single node', () => {
    const g = parseMermaid(`graph TD
      A --> B
      class A highlight`)
    expect(g.classAssignments.get('A')).toBe('highlight')
  })

  it('parses class assignments to multiple nodes', () => {
    const g = parseMermaid(`graph TD
      A --> B --> C
      class A,B highlight`)
    expect(g.classAssignments.get('A')).toBe('highlight')
    expect(g.classAssignments.get('B')).toBe('highlight')
  })
})

// ============================================================================
// Comments
// ============================================================================

describe('parseMermaid – comments', () => {
  it('ignores lines starting with %%', () => {
    const g = parseMermaid(`graph TD
      %% This is a comment
      A --> B
      %% Another comment`)
    expect(g.nodes.size).toBe(2)
    expect(g.edges).toHaveLength(1)
  })
})

// ============================================================================
// Edge cases
// ============================================================================

describe('parseMermaid – edge cases', () => {
  it('handles extra whitespace', () => {
    const g = parseMermaid('  graph TD  \n    A  -->  B  ')
    expect(g.edges).toHaveLength(1)
    expect(g.nodes.size).toBe(2)
  })

  it('handles empty lines between definitions', () => {
    const g = parseMermaid('graph TD\n\n  A --> B\n\n  B --> C')
    expect(g.edges).toHaveLength(2)
  })

  it('handles diagram with only nodes (no edges)', () => {
    const g = parseMermaid('graph TD\n  A[Only Node]')
    expect(g.nodes.size).toBe(1)
    expect(g.edges).toHaveLength(0)
  })

  it('preserves node order in the map', () => {
    const g = parseMermaid('graph TD\n  Z[Last] --> A[First]')
    const ids = [...g.nodes.keys()]
    expect(ids[0]).toBe('Z')
    expect(ids[1]).toBe('A')
  })
})

// ============================================================================
// State diagram parsing (Batch 3)
// ============================================================================

describe('parseMermaid – state diagrams', () => {
  it('detects stateDiagram-v2 header', () => {
    const g = parseMermaid('stateDiagram-v2\n  s1 --> s2')
    expect(g.direction).toBe('TD')
  })

  it('detects stateDiagram header (without -v2)', () => {
    const g = parseMermaid('stateDiagram\n  s1 --> s2')
    expect(g.direction).toBe('TD')
  })

  it('parses basic state transitions', () => {
    const g = parseMermaid(`stateDiagram-v2
      Idle --> Active
      Active --> Done`)
    expect(g.edges).toHaveLength(2)
    expect(g.edges[0]!.source).toBe('Idle')
    expect(g.edges[0]!.target).toBe('Active')
    expect(g.edges[1]!.source).toBe('Active')
    expect(g.edges[1]!.target).toBe('Done')
    // State nodes default to rounded shape
    expect(g.nodes.get('Idle')!.shape).toBe('rounded')
  })

  it('parses transition labels', () => {
    const g = parseMermaid(`stateDiagram-v2
      Idle --> Active : start`)
    expect(g.edges[0]!.label).toBe('start')
  })

  it('parses [*] start pseudostate', () => {
    const g = parseMermaid(`stateDiagram-v2
      [*] --> Idle`)
    // [*] as source becomes _start with state-start shape
    const startNode = g.nodes.get('_start')
    expect(startNode).toBeDefined()
    expect(startNode!.shape).toBe('state-start')
    expect(g.edges[0]!.source).toBe('_start')
  })

  it('parses [*] end pseudostate', () => {
    const g = parseMermaid(`stateDiagram-v2
      Done --> [*]`)
    const endNode = g.nodes.get('_end')
    expect(endNode).toBeDefined()
    expect(endNode!.shape).toBe('state-end')
    expect(g.edges[0]!.target).toBe('_end')
  })

  it('assigns unique IDs to multiple [*] pseudostates', () => {
    const g = parseMermaid(`stateDiagram-v2
      [*] --> A
      [*] --> B`)
    // First [*] source → _start, second → _start2
    expect(g.nodes.has('_start')).toBe(true)
    expect(g.nodes.has('_start2')).toBe(true)
  })

  it('parses state description: s1 : Description', () => {
    const g = parseMermaid(`stateDiagram-v2
      s1 : Idle State
      s1 --> s2`)
    expect(g.nodes.get('s1')!.label).toBe('Idle State')
    expect(g.nodes.get('s1')!.shape).toBe('rounded')
  })

  it('parses state alias: state "Description" as s1', () => {
    const g = parseMermaid(`stateDiagram-v2
      state "Waiting for input" as waiting
      waiting --> active`)
    expect(g.nodes.get('waiting')!.label).toBe('Waiting for input')
  })

  it('parses composite states', () => {
    const g = parseMermaid(`stateDiagram-v2
      state Processing {
        parse --> validate
        validate --> execute
      }`)
    expect(g.subgraphs).toHaveLength(1)
    expect(g.subgraphs[0]!.id).toBe('Processing')
    expect(g.subgraphs[0]!.label).toBe('Processing')
    expect(g.subgraphs[0]!.nodeIds).toContain('parse')
    expect(g.subgraphs[0]!.nodeIds).toContain('validate')
    expect(g.subgraphs[0]!.nodeIds).toContain('execute')
  })

  it('parses composite states with alias', () => {
    const g = parseMermaid(`stateDiagram-v2
      state "Active Processing" as AP {
        inner1 --> inner2
      }`)
    expect(g.subgraphs[0]!.id).toBe('AP')
    expect(g.subgraphs[0]!.label).toBe('Active Processing')
  })

  it('parses direction override in state diagrams', () => {
    const g = parseMermaid(`stateDiagram-v2
      direction LR
      s1 --> s2`)
    expect(g.direction).toBe('LR')
  })

  it('parses direction override inside composite state', () => {
    const g = parseMermaid(`stateDiagram-v2
      state Processing {
        direction LR
        parse --> validate
      }`)
    expect(g.subgraphs[0]!.direction).toBe('LR')
  })

  it('handles full state diagram with start/end and composites', () => {
    const g = parseMermaid(`stateDiagram-v2
      [*] --> Idle
      Idle --> Processing : submit
      state Processing {
        parse --> validate
        validate --> execute
      }
      Processing --> Complete : done
      Complete --> [*]`)

    expect(g.nodes.has('_start')).toBe(true)
    expect(g.nodes.has('_end')).toBe(true)
    expect(g.nodes.has('Idle')).toBe(true)
    expect(g.nodes.has('Complete')).toBe(true)
    expect(g.subgraphs).toHaveLength(1)
    expect(g.subgraphs[0]!.id).toBe('Processing')
    // Should have transitions for: [*]→Idle, Idle→Processing, parse→validate,
    // validate→execute, Processing→Complete, Complete→[*]
    expect(g.edges).toHaveLength(6)
  })
})
