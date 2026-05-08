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
import { SAMPLE_GRAPHS } from './sample-graphs/index.ts'

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
 * True when point `p` sits on (or within `tol` of) the rectangle's boundary.
 * Used to assert that an edge polyline actually terminates at its target
 * leaf's bounding box rather than stopping short at some interior subgraph
 * boundary.
 */
function pointTouchesRect(p: Point, r: Rect, tol = 5): boolean {
  const onLeft   = Math.abs(p.x - r.x) < tol             && p.y >= r.y - tol && p.y <= r.y + r.height + tol
  const onRight  = Math.abs(p.x - (r.x + r.width)) < tol  && p.y >= r.y - tol && p.y <= r.y + r.height + tol
  const onTop    = Math.abs(p.y - r.y) < tol             && p.x >= r.x - tol && p.x <= r.x + r.width + tol
  const onBottom = Math.abs(p.y - (r.y + r.height)) < tol && p.x >= r.x - tol && p.x <= r.x + r.width + tol
  return onLeft || onRight || onTop || onBottom
}

/**
 * Assert that the cross-hierarchy edge from `src` to `tgt` exists and its
 * polyline terminates on `tgt`'s bounding box.
 */
function expectEdgeReachesTarget(g: PositionedGraph, src: string, tgt: string): void {
  const edge = g.edges.find(e => e.source === src && e.target === tgt)
  expect(edge, `edge ${src} → ${tgt} not found in laid-out graph`).toBeDefined()
  const last = edge!.points[edge!.points.length - 1]!
  const target = g.nodes.find(n => n.id === tgt)!
  expect(
    pointTouchesRect(last, target),
    `edge ${src} → ${tgt} ends at (${last.x.toFixed(0)}, ${last.y.toFixed(0)}) which is not on ${tgt}'s bounding box (${target.x.toFixed(0)}, ${target.y.toFixed(0)}, ${target.width.toFixed(0)}x${target.height.toFixed(0)})`
  ).toBe(true)
}

/** Need Point alias for the helper above. */
type Point = { x: number; y: number }

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
// Property: a subgraph's `direction` directive reaches ELK (sealed subgraphs)
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
// subgraph boundary. With nested subgraphs and many cross-hier edges, ELK
// scattered ports across all sides of a subgraph and its interior widened
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
    const g = layout(SAMPLE_GRAPHS['issue-83-tb-flowchart-flips-horizontal']!.source)

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
    const g = layout(SAMPLE_GRAPHS['perm-lr-with-tb-nested']!.source)

    const a = node(g, 'a'), b = node(g, 'b'), c = node(g, 'c')
    expect(b.y).toBeGreaterThan(a.y)
    expect(c.y).toBeGreaterThan(b.y)

    const stack = group(g, 'TB Stack')
    expect(stack.height).toBeGreaterThan(stack.width)
    // Outer flow is LR — diagram width should dominate height.
    expect(g.width).toBeGreaterThan(g.height)
  })

  it('TD root with mixed-direction sibling subgraphs preserves each independently', () => {
    const g = layout(SAMPLE_GRAPHS['perm-mixed-siblings']!.source)

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
    // interior layout, where the cross-hier port can reach them).
    const g = layout(SAMPLE_GRAPHS['perm-3-level-middle-switch']!.source)

    const a = node(g, 'a'), b = node(g, 'b'), c = node(g, 'c')
    expect(b.x).toBeGreaterThan(a.x)
    expect(c.x).toBeGreaterThan(b.x)

    const middle = group(g, 'LR Middle')
    expect(middle.width).toBeGreaterThan(middle.height)

    // The cross-hierarchy edge from `src` must terminate on `a`'s bounding
    // box, not stop at some interior subgraph boundary.
    const srcToA = g.edges.find(e => e.source === 'src' && e.target === 'a')!
    const lastPoint = srcToA.points[srcToA.points.length - 1]!
    const onLeft   = Math.abs(lastPoint.x - a.x) < 5             && lastPoint.y >= a.y - 5 && lastPoint.y <= a.y + a.height + 5
    const onRight  = Math.abs(lastPoint.x - (a.x + a.width)) < 5  && lastPoint.y >= a.y - 5 && lastPoint.y <= a.y + a.height + 5
    const onTop    = Math.abs(lastPoint.y - a.y) < 5             && lastPoint.x >= a.x - 5 && lastPoint.x <= a.x + a.width + 5
    const onBottom = Math.abs(lastPoint.y - (a.y + a.height)) < 5 && lastPoint.x >= a.x - 5 && lastPoint.x <= a.x + a.width + 5
    expect(onLeft || onRight || onTop || onBottom).toBe(true)
  })

  it('sibling subgraphs with RL and BT directions inside a TB parent each preserve their own direction', () => {
    // Both RL and BT differ from the TB root, so both get SEPARATE_CHILDREN
    // + FIXED_ORDER ports. Incoming RL ports pin to EAST, incoming BT ports
    // pin to SOUTH (the "start" side of each direction).
    const g = layout(SAMPLE_GRAPHS['perm-rl-and-bt-siblings']!.source)

    const rlA = node(g, 'rlA'), rlB = node(g, 'rlB'), rlC = node(g, 'rlC')
    const btA = node(g, 'btA'), btB = node(g, 'btB'), btC = node(g, 'btC')

    // RL row: each successor sits to the LEFT of the previous.
    expect(rlB.x).toBeLessThan(rlA.x)
    expect(rlC.x).toBeLessThan(rlB.x)

    // BT stack: each successor sits ABOVE the previous.
    expect(btB.y).toBeLessThan(btA.y)
    expect(btC.y).toBeLessThan(btB.y)

    // Subgraph aspect ratios reflect each direction.
    const rlRow = group(g, 'RL row')
    const btStack = group(g, 'BT stack')
    expect(rlRow.width).toBeGreaterThan(rlRow.height)
    expect(btStack.height).toBeGreaterThan(btStack.width)
  })

  it('RL-direction nested subgraph reverses the flow inside an LR parent', () => {
    // LR and RL flow along the same axis but in opposite directions. RL
    // still differs from LR per `directionToElk` (LEFT vs RIGHT), so the
    // subgraph gets SEPARATE_CHILDREN and the inner content lays out
    // right-to-left.
    const g = layout(SAMPLE_GRAPHS['perm-rl-in-lr']!.source)

    const a = node(g, 'a'), b = node(g, 'b'), c = node(g, 'c')
    // Inside the RL subgraph: x decreases along the chain.
    expect(b.x).toBeLessThan(a.x)
    expect(c.x).toBeLessThan(b.x)
  })

  it('four-level nesting with all subgraphs matching the root direction does not sprawl', () => {
    // Every subgraph declares the same direction as the root. None of them
    // need SEPARATE_CHILDREN — they all flatten via INCLUDE_CHILDREN. The
    // cross-hierarchy edge from src to the deepest leaf routes naturally
    // through the flat layout. A pre-fix layout-engine would have treated
    // this as "any direction directive present → flip root to SEPARATE"
    // and produced a sprawl; this test guards that regression at depth.
    const g = layout(SAMPLE_GRAPHS['perm-4-level-same-direction']!.source)

    const a = node(g, 'a'), b = node(g, 'b'), c = node(g, 'c')
    // Innermost chain stacks vertically.
    expect(b.y).toBeGreaterThan(a.y)
    expect(c.y).toBeGreaterThan(b.y)

    // All four levels nest cleanly inside each other.
    const l1 = group(g, 'Level 1')
    const l2 = group(g, 'Level 2')
    const l3 = group(g, 'Level 3')
    const l4 = group(g, 'Level 4')
    expect(rectContains(l1, l2)).toBe(true)
    expect(rectContains(l2, l3)).toBe(true)
    expect(rectContains(l3, l4)).toBe(true)
    expect(rectContains(l4, a)).toBe(true)

    // No horizontal sprawl: the diagram stays narrow even four levels deep.
    expect(g.height).toBeGreaterThan(g.width)
  })

  // --------------------------------------------------------------------------
  // Multi-level workflow tests: subgraphs nested 3+ levels deep with nodes
  // at every level, and cross-hierarchy edges that cross varying numbers of
  // subgraph boundaries (1, 2, 3, n). These exercise the edge-synthesis
  // path that completes the polyline when ELK leaves the port→leaf section
  // empty (which it does whenever the leaf is buried inside an
  // INCLUDE_CHILDREN descendant of a SEPARATE_CHILDREN ancestor).
  // --------------------------------------------------------------------------

  it('3-level nesting, nodes at every level, edges crossing 1 / 2 / 3 boundaries each reach their target', () => {
    // Structure:
    //   root: ext1
    //   outer { mid_a; middle { in_a; inner { deep_a → deep_b } } }
    // Cross-hierarchy edges at varying depths:
    //   ext1 → mid_a   (crosses outer boundary only)
    //   ext1 → in_a    (crosses outer + middle)
    //   ext1 → deep_a  (crosses outer + middle + inner)
    //   mid_a → in_a   (one level deeper)
    //   in_a → mid_a   (one level shallower)
    const g = layout(SAMPLE_GRAPHS['multi-3-level-every-level']!.source)

    expectEdgeReachesTarget(g, 'ext1', 'mid_a')
    expectEdgeReachesTarget(g, 'ext1', 'in_a')
    expectEdgeReachesTarget(g, 'ext1', 'deep_a')
    expectEdgeReachesTarget(g, 'mid_a', 'in_a')
    expectEdgeReachesTarget(g, 'in_a', 'mid_a')

    // Containment holds at every level.
    expect(rectContains(group(g, 'Outer'), group(g, 'Middle'))).toBe(true)
    expect(rectContains(group(g, 'Middle'), group(g, 'Inner'))).toBe(true)
    expect(rectContains(group(g, 'Outer'), node(g, 'mid_a'))).toBe(true)
    expect(rectContains(group(g, 'Middle'), node(g, 'in_a'))).toBe(true)
    expect(rectContains(group(g, 'Inner'), node(g, 'deep_a'))).toBe(true)
    expect(rectContains(group(g, 'Inner'), node(g, 'deep_b'))).toBe(true)

    expectNoNodeOverlaps(g)
  })

  it('cross-hierarchy edge between cousin nodes (siblings at the same depth, shared parent) reaches its target', () => {
    // Two child subgraphs with their own interior chains, both inside a
    // shared parent. The cross-hier edges l2 → r1 and r2 → l1 must each
    // exit one child subgraph, traverse the parent's interior, and enter
    // the other child subgraph.
    const g = layout(SAMPLE_GRAPHS['multi-cousin-cross-hier']!.source)

    expectEdgeReachesTarget(g, 'l2', 'r1')
    expectEdgeReachesTarget(g, 'r2', 'l1')

    expect(rectContains(group(g, 'Parent'), group(g, 'Left'))).toBe(true)
    expect(rectContains(group(g, 'Parent'), group(g, 'Right'))).toBe(true)
    expect(rectContains(group(g, 'Left'), node(g, 'l1'))).toBe(true)
    expect(rectContains(group(g, 'Left'), node(g, 'l2'))).toBe(true)
    expect(rectContains(group(g, 'Right'), node(g, 'r1'))).toBe(true)
    expect(rectContains(group(g, 'Right'), node(g, 'r2'))).toBe(true)
  })

  it('4-level nesting with edges spanning every depth combination', () => {
    // Edges with every distinct cross-hierarchy depth from a 4-level deep
    // graph: root↔level1, root↔level4, level1↔level3.
    const g = layout(SAMPLE_GRAPHS['multi-4-level-varied-depths']!.source)

    expectEdgeReachesTarget(g, 'root_node', 'l4_node')
    expectEdgeReachesTarget(g, 'root_node', 'l1_node')
    expectEdgeReachesTarget(g, 'l1_node', 'l3_node')
    expectEdgeReachesTarget(g, 'l4_node', 'root_node')

    // Full containment chain.
    expect(rectContains(group(g, 'Level 1'), group(g, 'Level 2'))).toBe(true)
    expect(rectContains(group(g, 'Level 2'), group(g, 'Level 3'))).toBe(true)
    expect(rectContains(group(g, 'Level 3'), group(g, 'Level 4'))).toBe(true)
    expect(rectContains(group(g, 'Level 4'), node(g, 'l4_node'))).toBe(true)
  })

  it('multi-level direction switches with nodes at varying levels keep edges connected', () => {
    // Each level alternates direction. Cross-hierarchy edges connect nodes
    // at different levels. Direction directives interact with edge
    // synthesis at every depth.
    const g = layout(SAMPLE_GRAPHS['multi-mixed-direction']!.source)

    expectEdgeReachesTarget(g, 'ext', 'l3_a')
    expectEdgeReachesTarget(g, 'l1_a', 'l3_b')
    expectEdgeReachesTarget(g, 'l2_a', 'l1_a')

    // The level-3 internal chain still flows TB inside its own subgraph.
    const l3a = node(g, 'l3_a'), l3b = node(g, 'l3_b')
    expect(l3b.y).toBeGreaterThan(l3a.y)
  })

  it('alternating direction nesting LR/LR/TB/LR/TB (no leaves between layers) preserves each direction', () => {
    // Direction swaps at every level except the root match:
    //   root LR → L1 LR (matches root, no SEPARATE) → L2 TB (SEPARATE)
    //   → L3 LR (SEPARATE) → L4 TB (SEPARATE).
    // Only the innermost layer has leaf nodes — every intermediate layer is
    // pure structure. With no cross-hierarchy edges to route through the
    // SEPARATE_CHILDREN boundaries, the multi-level case lays out cleanly.
    const g = layout(SAMPLE_GRAPHS['perm-alt-lr-tb']!.source)

    const a = node(g, 'a'), b = node(g, 'b'), c = node(g, 'c')
    // Innermost L4 is TB — a/b/c stack vertically.
    expect(b.y).toBeGreaterThan(a.y)
    expect(c.y).toBeGreaterThan(b.y)

    const l1 = group(g, 'Outer LR')
    const l2 = group(g, 'Inner TB')
    const l3 = group(g, 'Deeper LR')
    const l4 = group(g, 'Deepest TB')

    // Each layer fits inside its parent.
    expect(rectContains(l1, l2)).toBe(true)
    expect(rectContains(l2, l3)).toBe(true)
    expect(rectContains(l3, l4)).toBe(true)
    expect(rectContains(l4, a)).toBe(true)
  })

  it('alternating direction nesting TB/LR/TB/LR (no leaves between layers) preserves each direction', () => {
    // Mirror of the previous test starting from TB:
    //   root TB → L1 TB (matches root) → L2 LR (SEPARATE) → L3 TB (SEPARATE)
    //   → L4 LR (SEPARATE). Innermost has the chain; intermediates are empty.
    const g = layout(SAMPLE_GRAPHS['perm-alt-tb-lr']!.source)

    const a = node(g, 'a'), b = node(g, 'b'), c = node(g, 'c')
    // Innermost L4 is LR — a/b/c arrange horizontally.
    expect(b.x).toBeGreaterThan(a.x)
    expect(c.x).toBeGreaterThan(b.x)

    const l1 = group(g, 'Outer TB')
    const l2 = group(g, 'Inner LR')
    const l3 = group(g, 'Deeper TB')
    const l4 = group(g, 'Deepest LR')

    expect(rectContains(l1, l2)).toBe(true)
    expect(rectContains(l2, l3)).toBe(true)
    expect(rectContains(l3, l4)).toBe(true)
    expect(rectContains(l4, a)).toBe(true)
  })

  it('multiple cross-hierarchy edges into a non-matching direction subgraph keep the LR flow', () => {
    const g = layout(SAMPLE_GRAPHS['perm-many-cross-hier']!.source)

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
