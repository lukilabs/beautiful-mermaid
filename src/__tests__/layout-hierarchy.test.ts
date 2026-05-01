/**
 * Layout property tests for flowcharts.
 *
 * The assertions check structural properties of the laid-out graph (direction
 * respect, containment, no overlaps) rather than pixel-exact dimensions, so
 * the tests stay green across ELK spacing tweaks but fail loudly on the
 * regressions that string-match SVG tests miss.
 *
 * Background: v1.0.0 introduced ELK and per-subgraph direction overrides, but
 * the only related test was a parser-level check (`g.subgraphs[0].direction`).
 * No test verified the direction reached ELK or that nested subgraphs with
 * cross-hierarchy edges laid out without sprawl. This file fills that gap.
 */
import { describe, it, expect } from 'bun:test'
import { parseMermaid } from '../index.ts'
import { layoutGraphSync } from '../layout.ts'
import type { PositionedGraph, PositionedNode, PositionedGroup } from '../types.ts'
import { samples } from '../../samples-data.ts'

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

/**
 * Assert that no two leaf nodes overlap. Pretty-prints which pair overlaps so
 * a sample-set failure points directly at the offending nodes.
 */
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
// Property: a subgraph's `direction` directive reaches ELK (sealed compounds)
//
// When no cross-hierarchy edge crosses a subgraph's boundary, the directive
// must take effect on the subgraph's interior. This is the contract that the
// pre-fix code violated quietly: the parser produced `direction: 'LR'` on the
// AST and the value flowed all the way to ELK as `elk.direction: 'RIGHT'`,
// but ELK ignored it because the root used hierarchyHandling 'SEPARATE'
// (an invalid enum value, silently treated as default).
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
// Property: nested subgraphs with cross-hierarchy edges do not sprawl
//
// The original v1.0.0 bug. When any subgraph had a `direction` directive,
// beautiful-mermaid passed hierarchyHandling 'SEPARATE' (an invalid enum
// value) and rewrote cross-hierarchy edges to use per-edge ports on each
// compound boundary. With nested subgraphs and many cross-hier edges, ELK
// scattered ports across all sides of a compound and its interior widened
// regardless of the requested direction.
//
// The properties asserted here would have failed pre-fix:
//   - inner.height > inner.width when its content is a vertical chain
//   - dy > dx between consecutive inner nodes in a TB chain
// ============================================================================

describe('layoutGraph – nested subgraph with cross-hierarchy edges', () => {
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
    // The LR override DIFFERS from the parent (TB), so the subgraph gets
    // SEPARATE_CHILDREN + ports with FIXED_SIDE constraints. The cross-hier
    // edges enter on the WEST side and leave on the EAST side, and ELK lays
    // out the interior LR.
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

  it('the website "Subgraph Direction Override" sample preserves its LR layout', () => {
    // Verbatim from samples-data.ts. LR pipeline inside a TD parent, with
    // cross-hierarchy edges at both endpoints. Pre-fix this rendered LR
    // correctly; the first iteration of the fix (which dropped SEPARATE_CHILDREN
    // whenever cross-hier edges were involved) regressed it to vertical.
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

  it('three-cluster TB diagram with one nested subgraph and many cross-hier edges does not sprawl', () => {
    // Anonymized stress case: structure mirrors a real-world failure mode —
    // sibling clusters at root, one cluster contains a nested cluster, both
    // outer and inner declare `direction TB` matching the parent, and many
    // cross-hierarchy edges cross 1-3 subgraph boundaries.
    const g = layout(`graph TB
      subgraph rootA [Group A]
        docs[contract doc]
      end

      ext_in1[Input 1]
      ext_in2[Input 2]

      subgraph rootB [Group B]
        direction TB
        subgraph inner [Inner Common]
          direction TB
          v[validator]
          d[defaults]
          t[tagger]
          v --> d --> t
        end
        rd1[reader 1]
        rd2[reader 2]
        ud[unified data]
        wr1[writer 1]
        wr2[writer 2]
        rd1 --> ud
        rd2 --> ud
        ud --> wr1
        ud --> wr2
      end

      ext_out1[Output 1]
      ext_out2[Output 2]

      ext_in1 --> v
      ext_in2 --> v
      t --> rd1
      t --> rd2
      wr1 --> ext_out1
      wr2 --> ext_out2
      docs -. "schemas" .-> v
      docs -. "defines" .-> ud`)

    const inner = group(g, 'Inner Common')
    const rootB = group(g, 'Group B')

    // Inner holds a 3-node vertical chain in TB direction — must stack.
    expect(inner.height).toBeGreaterThan(inner.width)

    // Inner's vertical chain ordered top-to-bottom.
    const v = node(g, 'v'), d = node(g, 'd'), t = node(g, 't')
    expect(d.y).toBeGreaterThan(v.y)
    expect(t.y).toBeGreaterThan(d.y)

    // Outer cluster also stacks (TB direction) — taller than wide.
    expect(rootB.height).toBeGreaterThan(rootB.width)

    // Containment holds at every level.
    expect(rectContains(rootB, inner)).toBe(true)
    expect(rectContains(inner, v)).toBe(true)
    expect(rectContains(inner, d)).toBe(true)
    expect(rectContains(inner, t)).toBe(true)

    // The whole diagram is decisively height-dominant. The widest "row" of
    // this diagram (3-4 nodes side by side) bounds the natural width to
    // something like 4× the typical node width; the chain depth gives ~10
    // vertical layers. So a clean TB layout has height/width well above 1.5.
    // Pre-fix layouts came out roughly square (≈1.05) because the broken
    // hierarchy handling spread cross-hierarchy edge routing horizontally.
    expect(g.height / g.width).toBeGreaterThan(1.5)

    expectNoNodeOverlaps(g)
  })
})

// ============================================================================
// Property: direction permutations — different combinations of nested
// subgraphs and direction directives all preserve their declared layouts
// ============================================================================

describe('layoutGraph – direction permutations', () => {
  it('LR root with TB-direction nested subgraph keeps the inner content vertical', () => {
    const g = layout(`graph LR
      src[Source] --> a
      subgraph stack [TB Stack]
        direction TB
        a --> b --> c
      end
      c --> sink[Sink]`)

    const a = node(g, 'a'), b = node(g, 'b'), c = node(g, 'c')
    expect(b.y).toBeGreaterThan(a.y)
    expect(c.y).toBeGreaterThan(b.y)

    const stack = group(g, 'TB Stack')
    expect(stack.height).toBeGreaterThan(stack.width)
    // Outer flow is LR — diagram width should dominate height.
    expect(g.width).toBeGreaterThan(g.height)
  })

  it('TD root with mixed-direction sibling subgraphs preserves each independently', () => {
    const g = layout(`graph TD
      hub[Hub]
      hub --> l1
      hub --> r1
      subgraph leftSide [LR pipeline]
        direction LR
        l1 --> l2 --> l3
      end
      subgraph rightSide [BT stack]
        direction BT
        r1 --> r2 --> r3
      end
      l3 --> tail[Tail]
      r3 --> tail`)

    const l1 = node(g, 'l1'), l2 = node(g, 'l2'), l3 = node(g, 'l3')
    const r1 = node(g, 'r1'), r2 = node(g, 'r2'), r3 = node(g, 'r3')

    // Left side: LR — l1 < l2 < l3 along x.
    expect(l2.x).toBeGreaterThan(l1.x)
    expect(l3.x).toBeGreaterThan(l2.x)

    // Right side: BT — r1 starts below r2 below r3.
    expect(r2.y).toBeLessThan(r1.y)
    expect(r3.y).toBeLessThan(r2.y)

    const left = group(g, 'LR pipeline')
    const right = group(g, 'BT stack')
    expect(left.width).toBeGreaterThan(left.height)
    expect(right.height).toBeGreaterThan(right.width)
  })

  it('three-level nesting with one direction switch in the middle preserves the LR flow', () => {
    // outer.dir TB == root.dir TB → outer inherits, no SEPARATE
    // middle.dir LR != effective parent (root TB) → SEPARATE
    // inner.dir LR == middle.dir LR → inner inherits, no SEPARATE (and is
    // explicitly INCLUDE_CHILDREN so the leaf nodes flatten into middle's
    // interior layout, where the cross-hier port can reach them)
    const g = layout(`graph TB
      src[Source] --> a
      subgraph outer [TB Outer]
        direction TB
        subgraph middle [LR Middle]
          direction LR
          subgraph inner [LR Inner]
            direction LR
            a --> b --> c
          end
        end
      end
      c --> sink[Sink]`)

    const a = node(g, 'a'), b = node(g, 'b'), c = node(g, 'c')
    expect(b.x).toBeGreaterThan(a.x)
    expect(c.x).toBeGreaterThan(b.x)

    const middle = group(g, 'LR Middle')
    expect(middle.width).toBeGreaterThan(middle.height)
  })

  it('multiple cross-hierarchy edges into a non-matching direction subgraph keep the LR flow', () => {
    // Subgraph declared first so a/b/c parse as members of `row`, not the
    // root level (Mermaid registers a node at the level it first appears).
    const g = layout(`graph TD
      subgraph row [LR Row]
        direction LR
        a --> b --> c
      end
      s1 --> a
      s2 --> a
      c --> t1
      c --> t2`)

    const a = node(g, 'a'), b = node(g, 'b'), c = node(g, 'c')
    expect(b.x).toBeGreaterThan(a.x)
    expect(c.x).toBeGreaterThan(b.x)

    const row = group(g, 'LR Row')
    expect(row.width).toBeGreaterThan(row.height)
    // Containment under multiple incoming/outgoing ports.
    expect(rectContains(row, a)).toBe(true)
    expect(rectContains(row, b)).toBe(true)
    expect(rectContains(row, c)).toBe(true)
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
// Property: every flowchart in the canonical sample set lays out cleanly
//
// Pulls from samples-data.ts so the maintainer's full reference set acts as
// regression coverage. New samples added to that file are auto-tested.
// ============================================================================

describe('layoutGraph – canonical website samples', () => {
  const flowchartSamples = samples.filter(s => s.category === 'Flowchart')

  for (const sample of flowchartSamples) {
    it(`renders sample without sprawl or overlap: ${sample.title}`, () => {
      const g = layout(sample.source)

      expect(Number.isFinite(g.width)).toBe(true)
      expect(Number.isFinite(g.height)).toBe(true)
      expect(g.width).toBeGreaterThan(0)
      expect(g.height).toBeGreaterThan(0)
      expect(g.nodes.length).toBeGreaterThan(0)

      expectNoNodeOverlaps(g, sample.title)

      // Every leaf node is inside the diagram bounds.
      for (const n of g.nodes) {
        expect(n.x).toBeGreaterThanOrEqual(0)
        expect(n.y).toBeGreaterThanOrEqual(0)
        expect(n.x + n.width).toBeLessThanOrEqual(g.width + 0.01)
        expect(n.y + n.height).toBeLessThanOrEqual(g.height + 0.01)
      }
    })
  }
})
