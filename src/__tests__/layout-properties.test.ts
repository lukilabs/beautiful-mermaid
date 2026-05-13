/**
 * Unit tests on structural properties of the layout engine.
 *
 * Every test builds its own small inline mermaid source and asserts a
 * single property — overall graph direction, subgraph direction
 * directive respect, containment, sibling non-overlap, cross-subgraph edge
 * direction preservation. No test reads from the shared sample-graphs
 * fixtures: the inputs are minimal, fully self-contained, and changes
 * to the curated samples don't affect this file.
 *
 * Sample-driven coverage (parameterised assertions over the curated
 * stress samples plus a sanity pass over `samples-data.ts`) lives in
 * `layout-samples.test.ts`.
 */
import { describe, it, expect } from 'bun:test'
import { parseMermaid } from '../index.ts'
import { layoutGraphSync } from '../layout.ts'
import type { PositionedGraph, PositionedNode, PositionedGroup } from '../types.ts'

// ============================================================================
// Helpers
// ============================================================================

interface Rect { x: number; y: number; width: number; height: number }

function rectsOverlap(a: Rect, b: Rect): boolean {
  return !(
    a.x + a.width <= b.x ||
    b.x + b.width <= a.x ||
    a.y + a.height <= b.y ||
    b.y + b.height <= a.y
  )
}

function rectContains(outer: Rect, inner: Rect): boolean {
  return inner.x >= outer.x &&
         inner.y >= outer.y &&
         inner.x + inner.width  <= outer.x + outer.width &&
         inner.y + inner.height <= outer.y + outer.height
}

function layout(source: string): PositionedGraph {
  return layoutGraphSync(parseMermaid(source))
}

function node(graph: PositionedGraph, id: string): PositionedNode {
  const found = graph.nodes.find(n => n.id === id)
  if (!found) throw new Error(`Node "${id}" not found in laid-out graph`)
  return found
}

function findGroup(groups: PositionedGroup[], idOrLabel: string): PositionedGroup | undefined {
  for (const g of groups) {
    if (g.id === idOrLabel || g.label === idOrLabel) return g
    const nested = findGroup(g.children, idOrLabel)
    if (nested) return nested
  }
  return undefined
}

function group(graph: PositionedGraph, idOrLabel: string): PositionedGroup {
  const g = findGroup(graph.groups, idOrLabel)
  if (!g) throw new Error(`Group "${idOrLabel}" not found in laid-out graph`)
  return g
}

function expectNoNodeOverlaps(graph: PositionedGraph, label = ''): void {
  for (let i = 0; i < graph.nodes.length; i++) {
    for (let j = i + 1; j < graph.nodes.length; j++) {
      const a = graph.nodes[i]!
      const b = graph.nodes[j]!
      expect(
        rectsOverlap(a, b),
        `${label ? label + ': ' : ''}nodes "${a.id}" and "${b.id}" overlap`
      ).toBe(false)
    }
  }
}

// ============================================================================
// Property: an overall graph direction shapes the whole layout
// ============================================================================

describe('layoutGraph – overall graph direction', () => {
  it('graph TD/TB stacks a chain top-to-bottom', () => {
    const g = layout('graph TD\n  A --> B --> C --> D')
    const a = node(g, 'A'), b = node(g, 'B'), c = node(g, 'C'), d = node(g, 'D')
    expect(b.y).toBeGreaterThan(a.y)
    expect(c.y).toBeGreaterThan(b.y)
    expect(d.y).toBeGreaterThan(c.y)
    // Vertical extent dominates for a 4-node chain.
    expect(g.height).toBeGreaterThan(g.width)
  })

  it('graph LR lays a chain left-to-right', () => {
    const g = layout('graph LR\n  A --> B --> C --> D')
    const a = node(g, 'A'), b = node(g, 'B'), c = node(g, 'C'), d = node(g, 'D')
    expect(b.x).toBeGreaterThan(a.x)
    expect(c.x).toBeGreaterThan(b.x)
    expect(d.x).toBeGreaterThan(c.x)
    expect(g.width).toBeGreaterThan(g.height)
  })

  it('graph BT inverts: chain successors land above their predecessors', () => {
    const g = layout('graph BT\n  A --> B --> C --> D')
    const a = node(g, 'A'), b = node(g, 'B'), c = node(g, 'C'), d = node(g, 'D')
    expect(b.y).toBeLessThan(a.y)
    expect(c.y).toBeLessThan(b.y)
    expect(d.y).toBeLessThan(c.y)
  })

  it('graph RL: chain successors land left of their predecessors', () => {
    const g = layout('graph RL\n  A --> B --> C --> D')
    const a = node(g, 'A'), b = node(g, 'B'), c = node(g, 'C'), d = node(g, 'D')
    expect(b.x).toBeLessThan(a.x)
    expect(c.x).toBeLessThan(b.x)
    expect(d.x).toBeLessThan(c.x)
  })
})

// ============================================================================
// Property: a subgraph's `direction` directive reaches ELK
//
// When no cross-subgraph edge crosses a subgraph's boundary, the directive
// must take effect on the subgraph's interior. The pre-fix code violated
// this contract quietly: the parser produced `direction: 'LR'` on the AST
// and the value flowed all the way to ELK as `elk.direction: 'RIGHT'`, but
// ELK ignored it because the root used `hierarchyHandling: 'SEPARATE'` —
// an invalid enum value, silently treated as default.
// ============================================================================

describe('layoutGraph – subgraph direction directive', () => {
  it('LR subgraph inside TD parent stacks its content horizontally', () => {
    const g = layout(`graph TD
      subgraph one [LR Group]
        direction LR
        A --> B
      end
      C --> D`)
    const a = node(g, 'A'), b = node(g, 'B')
    expect(b.x).toBeGreaterThan(a.x)
    expect(Math.abs(a.y - b.y)).toBeLessThan(Math.abs(b.x - a.x))
  })

  it('TB subgraph inside LR parent stacks its content vertically', () => {
    const g = layout(`graph LR
      subgraph one [TB Group]
        direction TB
        A --> B --> C
      end
      D --> E`)
    const a = node(g, 'A'), b = node(g, 'B'), c = node(g, 'C')
    expect(b.y).toBeGreaterThan(a.y)
    expect(c.y).toBeGreaterThan(b.y)
    expect(Math.abs(a.x - b.x)).toBeLessThan(Math.abs(b.y - a.y))
  })

  it('a TD-direction subgraph in an LR parent is taller than wide', () => {
    const g = layout(`graph LR
      subgraph stack [Stack]
        direction TB
        a --> b --> c --> d
      end
      x --> y`)
    const stack = group(g, 'Stack')
    expect(stack.height).toBeGreaterThan(stack.width)
  })

  it('an LR-direction subgraph in a TD parent is wider than tall', () => {
    const g = layout(`graph TD
      subgraph row [Row]
        direction LR
        a --> b --> c --> d
      end
      x --> y`)
    const row = group(g, 'Row')
    expect(row.width).toBeGreaterThan(row.height)
  })
})

// ============================================================================
// Property: nested subgraphs with cross-subgraph edges respect direction
//
// When external edges enter a subgraph through cross-subgraph ports, the
// subgraph's own direction directive must still control its interior
// layout. The pre-fix code mis-set `hierarchyHandling` and gave the
// subgraph's ports no `port.side` constraint, so ELK ignored the directive
// the moment a single external edge touched the subgraph's boundary.
// ============================================================================

describe('layoutGraph – nested subgraph with cross-subgraph edges', () => {
  it('inner TB subgraph keeps a vertical chain stacked when external edges enter it', () => {
    const g = layout(`graph TB
      subgraph outer
        direction TB
        subgraph inner
          direction TB
          a --> b --> c
        end
      end
      ext_in --> a
      c --> ext_out`)

    const a = node(g, 'a'), b = node(g, 'b'), c = node(g, 'c')
    expect(Math.abs(b.y - a.y)).toBeGreaterThan(Math.abs(b.x - a.x))
    expect(Math.abs(c.y - b.y)).toBeGreaterThan(Math.abs(c.x - b.x))

    const inner = group(g, 'inner')
    expect(inner.height).toBeGreaterThan(inner.width)
  })

  it('an LR-direction inner subgraph crossed by external edges keeps its LR layout', () => {
    const g = layout(`graph TB
      subgraph outer
        direction TB
        subgraph row [Row]
          direction LR
          a --> b --> c
        end
      end
      ext1 --> a
      c --> ext2`)

    const a = node(g, 'a'), b = node(g, 'b'), c = node(g, 'c')
    expect(b.x).toBeGreaterThan(a.x)
    expect(c.x).toBeGreaterThan(b.x)
    expect(Math.abs(a.y - b.y)).toBeLessThan(Math.abs(b.x - a.x))

    const row = group(g, 'Row')
    const outer = group(g, 'outer')
    expect(rectContains(outer, row)).toBe(true)
    expect(rectContains(row, a)).toBe(true)
    expect(rectContains(row, b)).toBe(true)
    expect(rectContains(row, c)).toBe(true)
    expect(row.width).toBeGreaterThan(row.height)
    expectNoNodeOverlaps(g)
  })

  it('an LR pipeline inside a TD parent keeps its horizontal layout when cross-subgraph edges enter and exit', () => {
    const g = layout(`graph TD
      subgraph pipeline [Processing Pipeline]
        direction LR
        A[Input] --> B[Parse] --> C[Transform] --> D[Output]
      end
      E[Source] --> A
      D --> F[Sink]`)

    const a = node(g, 'A'), b = node(g, 'B'), c = node(g, 'C'), d = node(g, 'D')
    expect(b.x).toBeGreaterThan(a.x)
    expect(c.x).toBeGreaterThan(b.x)
    expect(d.x).toBeGreaterThan(c.x)

    const pipeline = group(g, 'Processing Pipeline')
    expect(pipeline.width).toBeGreaterThan(pipeline.height)
    expect(g.width).toBeGreaterThan(g.height)
  })
})

// ============================================================================
// Property: groups geometrically contain their children
// ============================================================================

describe('layoutGraph – containment property', () => {
  it('every leaf node is inside its declared subgraph', () => {
    const g = layout(`graph TD
      subgraph A
        x --> y
      end
      subgraph B
        p --> q
      end
      y --> p`)

    const ga = group(g, 'A'), gb = group(g, 'B')
    expect(rectContains(ga, node(g, 'x'))).toBe(true)
    expect(rectContains(ga, node(g, 'y'))).toBe(true)
    expect(rectContains(gb, node(g, 'p'))).toBe(true)
    expect(rectContains(gb, node(g, 'q'))).toBe(true)
  })

  it('a nested subgraph fits inside its parent', () => {
    const g = layout(`graph TD
      subgraph outer
        subgraph inner
          x --> y
        end
      end`)

    const outer = group(g, 'outer'), inner = group(g, 'inner')
    expect(rectContains(outer, inner)).toBe(true)
    expect(rectContains(inner, node(g, 'x'))).toBe(true)
    expect(rectContains(inner, node(g, 'y'))).toBe(true)
  })
})

// ============================================================================
// Property: sibling clusters and root-level nodes do not overlap
// ============================================================================

describe('layoutGraph – non-overlap property', () => {
  it('sibling subgraphs and root-level nodes do not overlap one another', () => {
    const g = layout(`graph TD
      subgraph A
        a1 --> a2
      end
      subgraph B
        b1 --> b2
      end
      ext[External]`)

    const ga = group(g, 'A'), gb = group(g, 'B'), ext = node(g, 'ext')
    expect(rectsOverlap(ga, gb)).toBe(false)
    expect(rectsOverlap(ext, ga)).toBe(false)
    expect(rectsOverlap(ext, gb)).toBe(false)
  })
})

// ============================================================================
// Property: SEPARATE_CHILDREN reason 2 — leaf-migration prevention
//
// When a subgraph has no direction directive but directly contains a leaf
// that is an endpoint of a cross-subgraph edge, reason 2 forces
// SEPARATE_CHILDREN. Without that, INCLUDE_CHILDREN inheritance lets ELK
// migrate the leaf out of its declared subgraph rectangle so it can be
// placed in a more convenient layer of the parent's layered flow.
// ============================================================================

function endpointReachesTarget(graph: PositionedGraph, source: string, target: string): boolean {
  const t = graph.nodes.find(n => n.id === target)
  if (!t) return false
  const edge = graph.edges.find(e => e.source === source && e.target === target)
  if (!edge || edge.points.length === 0) return false
  const tail = edge.points[edge.points.length - 1]!
  return tail.x >= t.x && tail.x <= t.x + t.width
      && tail.y >= t.y && tail.y <= t.y + t.height
}

function sameLayout(a: PositionedGraph, b: PositionedGraph): boolean {
  if (a.nodes.length !== b.nodes.length) return false
  for (let i = 0; i < a.nodes.length; i++) {
    const na = a.nodes[i]!
    const nb = b.nodes.find(n => n.id === na.id)
    if (!nb) return false
    if (Math.abs(na.x - nb.x) > 0.5 || Math.abs(na.y - nb.y) > 0.5) return false
  }
  return true
}

describe('layoutGraph – SEPARATE_CHILDREN reason 2 (leaf-migration prevention)', () => {
  const source = `graph TB
    Outside
    subgraph wrapper [Wrapper]
      Inside
    end
    Outside --> Inside`

  it('leaf endpoint stays inside its undirected subgraph when a cross-subgraph edge targets it', () => {
    const g = layout(source)
    const wrapper = group(g, 'Wrapper')
    expect(rectContains(wrapper, node(g, 'Inside'))).toBe(true)
  })

  it('the cross-subgraph edge polyline actually reaches the inside leaf', () => {
    const g = layout(source)
    expect(endpointReachesTarget(g, 'Outside', 'Inside')).toBe(true)
  })

  it('the layout is deterministic — re-running on the same source produces the same coordinates', () => {
    expect(sameLayout(layout(source), layout(source))).toBe(true)
  })
})

// ============================================================================
// Property: SEPARATE_CHILDREN reason 3 — port-passthrough subgraphs
//
// A cross-subgraph edge passes through an intermediate subgraph that has no
// direction directive of its own and contains no leaf endpoint of the
// edge — its only stake is owning the boundary port the chain hops through.
// Reason 3 marks the passthrough subgraph SEPARATE so its FIXED_ORDER port
// constraints stick. Without it, the port loses its declared side and the
// assembled polyline can't reach the inner leaf.
// ============================================================================

describe('layoutGraph – SEPARATE_CHILDREN reason 3 (port-passthrough)', () => {
  const source = `graph TB
    Outside
    subgraph outer [Outer]
      subgraph inner [Inner]
        DeepLeaf
      end
    end
    Outside --> DeepLeaf`

  it('the deep leaf stays inside its innermost subgraph through the passthrough', () => {
    const g = layout(source)
    const inner = group(g, 'Inner')
    expect(rectContains(inner, node(g, 'DeepLeaf'))).toBe(true)
  })

  it('the cross-subgraph edge polyline reaches the deep leaf after crossing the passthrough subgraph', () => {
    const g = layout(source)
    expect(endpointReachesTarget(g, 'Outside', 'DeepLeaf')).toBe(true)
  })

  it('the layout is deterministic — re-running on the same source produces the same coordinates', () => {
    expect(sameLayout(layout(source), layout(source))).toBe(true)
  })
})
