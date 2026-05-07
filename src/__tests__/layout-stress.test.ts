/**
 * Stress test suite for the flowchart layout engine. Eight realistic
 * medium-complexity diagrams (microservices, CI/CD, bidirectional pairs,
 * hub-and-spoke, deep mixed-direction nesting, shared-services fan-in,
 * error paths, dataflow) each get a `describe` block that asserts:
 *
 *   - bounded right-angle crossings (zero where structurally achievable)
 *   - containment of every leaf in its declared subgraph
 *   - direction directives respected on each subgraph
 *   - sibling declaration order preserved
 *   - no edge polyline threads a foreign subgraph's header strip
 *
 * A trailing `cross-cutting` block asserts layout determinism and that
 * the renderer's drawn hop count matches the layout-engine crossing
 * count for every sample.
 */
import { describe, it, expect } from 'bun:test'
import { parseMermaid, renderMermaidSVG } from '../index.ts'
import { layoutGraphSync } from '../layout.ts'
import { countRightAngleCrossings } from '../layout-engine.ts'
import type { PositionedGraph, PositionedNode, PositionedGroup } from '../types.ts'
import { SAMPLE_GRAPHS } from './sample-graphs/index.ts'

// Each `it` block reads its source from this map; the source itself lives
// in `sample-graphs/stress-suite.ts` so the comparison-page tooling reads
// the exact same scenarios.

const SAMPLES = {
  microservicesStack:           SAMPLE_GRAPHS['stress-microservices-stack']!.source,
  ciCdParallelFeedback:         SAMPLE_GRAPHS['stress-ci-cd-parallel-feedback']!.source,
  bidirectionalRequestResponse: SAMPLE_GRAPHS['stress-bidirectional-request-response']!.source,
  hubAndSpoke:                  SAMPLE_GRAPHS['stress-hub-and-spoke']!.source,
  mixedDirectionSandwich:       SAMPLE_GRAPHS['stress-mixed-direction-sandwich']!.source,
  sharedServicesFanIn:          SAMPLE_GRAPHS['stress-shared-services-fan-in']!.source,
  errorPathCluster:             SAMPLE_GRAPHS['stress-error-path-cluster']!.source,
  dataflowFanOutFanIn:          SAMPLE_GRAPHS['stress-dataflow-fan-out-fan-in']!.source,
} as const

// ============================================================================
// Helpers
// ============================================================================

interface Rect { x: number; y: number; width: number; height: number }

function layout(src: string): PositionedGraph {
  return layoutGraphSync(parseMermaid(src))
}

function rectContains(outer: Rect, inner: Rect, tol = 0.01): boolean {
  return inner.x >= outer.x - tol &&
         inner.y >= outer.y - tol &&
         inner.x + inner.width  <= outer.x + outer.width + tol &&
         inner.y + inner.height <= outer.y + outer.height + tol
}

function rectsOverlap(a: Rect, b: Rect): boolean {
  return !(
    a.x + a.width <= b.x ||
    b.x + b.width <= a.x ||
    a.y + a.height <= b.y ||
    b.y + b.height <= a.y
  )
}

function findGroup(groups: PositionedGroup[], idOrLabel: string): PositionedGroup | undefined {
  for (const g of groups) {
    if (g.id === idOrLabel || g.label === idOrLabel) return g
    const nested = findGroup(g.children, idOrLabel)
    if (nested) return nested
  }
  return undefined
}

function group(g: PositionedGraph, idOrLabel: string): PositionedGroup {
  const found = findGroup(g.groups, idOrLabel)
  if (!found) throw new Error(`Group "${idOrLabel}" not found`)
  return found
}

function node(g: PositionedGraph, id: string): PositionedNode {
  const found = g.nodes.find(n => n.id === id)
  if (!found) throw new Error(`Node "${id}" not found`)
  return found
}

/**
 * Walk every leaf in `g` and assert it sits inside its declared subgraph
 * by id. The map keys are leaf ids; values are the id (or label) of the
 * subgraph the leaf is supposed to be in.
 */
function expectContainment(g: PositionedGraph, leafToSubgraph: Record<string, string>): void {
  for (const [leafId, subgraphIdOrLabel] of Object.entries(leafToSubgraph)) {
    const leaf = node(g, leafId)
    const sg = group(g, subgraphIdOrLabel)
    expect(
      rectContains(sg, leaf),
      `leaf "${leafId}" is not inside its declared subgraph "${subgraphIdOrLabel}"`,
    ).toBe(true)
  }
}

/**
 * For each subgraph in the diagram, walk every edge polyline. If the edge
 * has BOTH endpoints outside the subgraph (or both inside but not
 * terminating in this subgraph specifically), no segment of the polyline
 * may pass through that subgraph's header strip — the top HEADER_HEIGHT
 * pixels of the subgraph's bbox. Returns a list of offending pairs for a
 * descriptive failure message.
 */
const HEADER_HEIGHT = 28
function findHeaderThreads(g: PositionedGraph): Array<{ edge: string; subgraph: string }> {
  const offenders: Array<{ edge: string; subgraph: string }> = []
  // Flatten groups
  const allGroups: PositionedGroup[] = []
  function collect(gs: PositionedGroup[]): void {
    for (const grp of gs) { allGroups.push(grp); collect(grp.children) }
  }
  collect(g.groups)

  // Build leaf-to-subgraph-ids ancestry. (A leaf is "inside" any subgraph
  // whose bbox contains it.)
  const leafContainers = new Map<string, Set<string>>()
  for (const n of g.nodes) {
    const set = new Set<string>()
    for (const grp of allGroups) if (rectContains(grp, n)) set.add(grp.id)
    leafContainers.set(n.id, set)
  }

  function edgeName(e: typeof g.edges[0]): string { return `${e.source} → ${e.target}` }

  for (const grp of allGroups) {
    const headerStripY1 = grp.y
    const headerStripY2 = grp.y + HEADER_HEIGHT
    for (const e of g.edges) {
      // If this edge has an endpoint INSIDE grp, the header may be crossed
      // legitimately when the edge enters/exits.
      const sourceInside = leafContainers.get(e.source)?.has(grp.id) ?? false
      const targetInside = leafContainers.get(e.target)?.has(grp.id) ?? false
      if (sourceInside || targetInside) continue
      // Walk segments. If any segment intersects (grp.x..grp.x+grp.width,
      // headerStripY1..headerStripY2) STRICTLY inside, flag it.
      const pts = e.points
      for (let i = 0; i + 1 < pts.length; i++) {
        const p1 = pts[i]!
        const p2 = pts[i + 1]!
        const minX = Math.min(p1.x, p2.x), maxX = Math.max(p1.x, p2.x)
        const minY = Math.min(p1.y, p2.y), maxY = Math.max(p1.y, p2.y)
        const xOverlap = maxX > grp.x + 0.5 && minX < grp.x + grp.width - 0.5
        const yOverlap = maxY > headerStripY1 + 0.5 && minY < headerStripY2 - 0.5
        if (xOverlap && yOverlap) {
          offenders.push({ edge: edgeName(e), subgraph: grp.label || grp.id })
          break
        }
      }
    }
  }
  return offenders
}

function expectNoNodeOverlaps(g: PositionedGraph): void {
  for (let i = 0; i < g.nodes.length; i++) {
    for (let j = i + 1; j < g.nodes.length; j++) {
      const a = g.nodes[i]!, b = g.nodes[j]!
      expect(rectsOverlap(a, b), `nodes "${a.id}" and "${b.id}" overlap`).toBe(false)
    }
  }
}

/**
 * Count distinct-edge segment pairs that share a colinear interval longer
 * than `minLen`. Used to detect "drawing arrows on top of each other".
 */
function findColinearOverlaps(g: PositionedGraph, minLen = 6): Array<{ a: string; b: string; axis: 'H' | 'V' }> {
  interface Seg { eId: string; axis: 'H' | 'V'; pos: number; lo: number; hi: number }
  const EPS = 0.5
  const segs: Seg[] = []
  for (const e of g.edges) {
    const pts = e.points
    const id = `${e.source}→${e.target}` + (e.label ? `[${e.label}]` : '')
    for (let i = 0; i + 1 < pts.length; i++) {
      const p1 = pts[i]!, p2 = pts[i + 1]!
      const dx = p2.x - p1.x, dy = p2.y - p1.y
      if (Math.abs(dy) < EPS && Math.abs(dx) > EPS) {
        segs.push({ eId: id, axis: 'H', pos: (p1.y + p2.y) / 2, lo: Math.min(p1.x, p2.x), hi: Math.max(p1.x, p2.x) })
      } else if (Math.abs(dx) < EPS && Math.abs(dy) > EPS) {
        segs.push({ eId: id, axis: 'V', pos: (p1.x + p2.x) / 2, lo: Math.min(p1.y, p2.y), hi: Math.max(p1.y, p2.y) })
      }
    }
  }
  const overlaps: Array<{ a: string; b: string; axis: 'H' | 'V' }> = []
  for (let i = 0; i < segs.length; i++) {
    for (let j = i + 1; j < segs.length; j++) {
      const s1 = segs[i]!, s2 = segs[j]!
      if (s1.eId === s2.eId) continue
      if (s1.axis !== s2.axis) continue
      if (Math.abs(s1.pos - s2.pos) > EPS) continue
      const overlap = Math.min(s1.hi, s2.hi) - Math.max(s1.lo, s2.lo)
      if (overlap > minLen) {
        overlaps.push({ a: s1.eId, b: s2.eId, axis: s1.axis })
      }
    }
  }
  return overlaps
}

// ============================================================================
// Per-sample blocks
// ============================================================================

describe('stress: microservices-stack', () => {
  const g = layout(SAMPLES.microservicesStack)

  it('renders with zero right-angle crossings', () => {
    expect(countRightAngleCrossings(g.edges)).toBe(0)
  })

  it('preserves containment of each leaf in its declared subgraph', () => {
    expectContainment(g, {
      Web: 'Client Layer', Mobile: 'Client Layer', Desktop: 'Client Layer', API: 'Client Layer',
      Auth: 'Service Layer', Users: 'Service Layer', Orders: 'Service Layer', Payments: 'Service Layer',
      AuthDB: 'Data Layer', UserDB: 'Data Layer', OrdersDB: 'Data Layer', PaymentsDB: 'Data Layer', AuditLog: 'Data Layer',
    })
  })

  it('respects LR root: Client Layer left of Service Layer left of Data Layer', () => {
    expect(group(g, 'Service Layer').x).toBeGreaterThan(group(g, 'Client Layer').x)
    expect(group(g, 'Data Layer').x).toBeGreaterThan(group(g, 'Service Layer').x)
  })

  it('does not thread any foreign subgraph header', () => {
    expect(findHeaderThreads(g), 'edges threading foreign headers').toEqual([])
  })

  it('has no node overlaps', () => {
    expectNoNodeOverlaps(g)
  })
})

describe('stress: ci-cd-parallel-feedback', () => {
  const g = layout(SAMPLES.ciCdParallelFeedback)

  // The Gate→Source feedback edge is a back-edge that wraps around the entire
  // graph, and the 4-into-1 fan-in to Gate from differently-x'd test stages
  // forces some crossings; both are realistic patterns we don't expect ELK
  // Layered to fully resolve.
  it('keeps right-angle crossings to a small bounded number', () => {
    expect(countRightAngleCrossings(g.edges)).toBeLessThanOrEqual(6)
  })

  it('preserves containment', () => {
    expectContainment(g, {
      Source: 'Build', Compile: 'Build', Artifact: 'Build',
      Unit: 'Tests', Integration: 'Tests', E2E: 'Tests', Security: 'Tests',
    })
  })

  it('Tests subgraph lays out LR (children stacked horizontally)', () => {
    const tests = group(g, 'Tests')
    expect(tests.width).toBeGreaterThan(tests.height)
    // Unit/Integration/E2E/Security ordered left to right in declaration order.
    expect(node(g, 'Integration').x).toBeGreaterThan(node(g, 'Unit').x)
    expect(node(g, 'E2E').x).toBeGreaterThan(node(g, 'Integration').x)
    expect(node(g, 'Security').x).toBeGreaterThan(node(g, 'E2E').x)
  })

  it('Build subgraph above Tests above Gate above Deploy', () => {
    expect(group(g, 'Tests').y).toBeGreaterThan(group(g, 'Build').y)
    expect(node(g, 'Gate').y).toBeGreaterThan(group(g, 'Tests').y)
    expect(node(g, 'Deploy').y).toBeGreaterThan(node(g, 'Gate').y)
  })

  it('does not thread any foreign subgraph header', () => {
    expect(findHeaderThreads(g)).toEqual([])
  })
})

describe('stress: bidirectional-request-response', () => {
  const g = layout(SAMPLES.bidirectionalRequestResponse)

  it('renders with zero right-angle crossings', () => {
    expect(countRightAngleCrossings(g.edges)).toBe(0)
  })

  it('Client left of Server (declaration order)', () => {
    expect(group(g, 'Server').x).toBeGreaterThan(group(g, 'Client').x)
  })

  it('preserves containment', () => {
    expectContainment(g, {
      UI: 'Client', Cache: 'Client', Network: 'Client',
      Endpoint: 'Server', Handler: 'Server', DB: 'Server',
    })
  })

  it('bidirectional edges between Client and Server share no colinear segment longer than 6px', () => {
    expect(findColinearOverlaps(g)).toEqual([])
  })
})

describe('stress: hub-and-spoke', () => {
  const g = layout(SAMPLES.hubAndSpoke)

  // Coordinator and Scheduler share the Orchestrator subgraph but participate
  // at opposite ends of the bidirectional flow with Compute. ELK Layered
  // can't lay this out in a planar way — putting both halves of the hub in
  // one compound forces a 2-cycle that has to be broken. We accept the
  // residual crossings and assert they stay bounded.
  it('keeps right-angle crossings to a small bounded number', () => {
    expect(countRightAngleCrossings(g.edges)).toBeLessThanOrEqual(6)
  })

  it('preserves containment', () => {
    expectContainment(g, {
      Coordinator: 'Orchestrator', Scheduler: 'Orchestrator',
      IngestSource: 'Ingest', Validator: 'Ingest',
      Worker1: 'Compute', Worker2: 'Compute',
      WriteBack: 'Storage',
      Pager: 'Notify', Slack: 'Notify',
    })
  })

  it('does not thread any foreign subgraph header', () => {
    expect(findHeaderThreads(g)).toEqual([])
  })

  it('has no node overlaps', () => {
    expectNoNodeOverlaps(g)
  })
})

describe('stress: mixed-direction-sandwich', () => {
  const g = layout(SAMPLES.mixedDirectionSandwich)

  // src has 3 fan-out edges to nodes at three different nesting levels (a, d,
  // e). ELK routes them as best it can but the deep nesting plus shared
  // source forces a small number of right-angle interior crossings.
  it('keeps right-angle crossings to a small bounded number', () => {
    expect(countRightAngleCrossings(g.edges)).toBeLessThanOrEqual(2)
  })

  it('full nesting chain holds: L1 ⊃ L2 ⊃ L3 ⊃ L4 ⊃ d/e/f', () => {
    expect(rectContains(group(g, 'Outer LR'), group(g, 'Inner TB'))).toBe(true)
    expect(rectContains(group(g, 'Inner TB'), group(g, 'Deep LR'))).toBe(true)
    expect(rectContains(group(g, 'Deep LR'), group(g, 'Deepest TB'))).toBe(true)
    expect(rectContains(group(g, 'Deepest TB'), node(g, 'd'))).toBe(true)
    expect(rectContains(group(g, 'Deepest TB'), node(g, 'e'))).toBe(true)
    expect(rectContains(group(g, 'Deepest TB'), node(g, 'f'))).toBe(true)
  })

  it('Deepest TB stacks d/e/f vertically (TB direction)', () => {
    expect(node(g, 'e').y).toBeGreaterThan(node(g, 'd').y)
    expect(node(g, 'f').y).toBeGreaterThan(node(g, 'e').y)
  })

  it('Inner TB lays out top-to-bottom', () => {
    const inner = group(g, 'Inner TB')
    expect(inner.height).toBeGreaterThan(inner.width)
  })
})

describe('stress: shared-services-fan-in', () => {
  const g = layout(SAMPLES.sharedServicesFanIn)

  // Eight cross-hier edges from three feature columns into three stacked
  // services produce a fan-in pattern whose minimum-crossing layout depends
  // on column ordering; ELK's heuristic doesn't always find it. Threshold
  // is set to the count it actually achieves so a future improvement that
  // brings it down is allowed but a regression that pushes it up fails.
  it('keeps right-angle crossings to a small bounded number', () => {
    expect(countRightAngleCrossings(g.edges)).toBeLessThanOrEqual(5)
  })

  it('preserves containment', () => {
    expectContainment(g, {
      Auth: 'Shared Services', Logging: 'Shared Services', Metrics: 'Shared Services',
      A1: 'Feature A', A2: 'Feature A',
      B1: 'Feature B', B2: 'Feature B',
      C1: 'Feature C', C2: 'Feature C',
    })
  })

  it('does not thread any foreign subgraph header', () => {
    expect(findHeaderThreads(g)).toEqual([])
  })
})

describe('stress: error-path-cluster', () => {
  const g = layout(SAMPLES.errorPathCluster)

  // The RetryStep→Login back-edge has to wrap around the full height of the
  // graph (Login is at the top, RetryStep is near the bottom) and that
  // wraparound necessarily crosses a couple of forward edges from Happy and
  // Error Path into Monitoring.
  it('keeps right-angle crossings to a small bounded number', () => {
    expect(countRightAngleCrossings(g.edges)).toBeLessThanOrEqual(2)
  })

  it('preserves containment', () => {
    expectContainment(g, {
      Login: 'Happy Path', Verify: 'Happy Path', Authorize: 'Happy Path', Success: 'Happy Path',
      Reject: 'Error Path', Notify: 'Error Path', RetryStep: 'Error Path',
      Alerts: 'Monitoring', Dashboard: 'Monitoring',
    })
  })

  it('Happy Path internal flow goes top-to-bottom', () => {
    expect(node(g, 'Verify').y).toBeGreaterThan(node(g, 'Login').y)
    expect(node(g, 'Authorize').y).toBeGreaterThan(node(g, 'Verify').y)
    expect(node(g, 'Success').y).toBeGreaterThan(node(g, 'Authorize').y)
  })

  it('does not thread any foreign subgraph header', () => {
    expect(findHeaderThreads(g)).toEqual([])
  })
})

describe('stress: dataflow-fan-out-fan-in', () => {
  const g = layout(SAMPLES.dataflowFanOutFanIn)

  it('renders with zero right-angle crossings', () => {
    expect(countRightAngleCrossings(g.edges)).toBe(0)
  })

  it('preserves containment', () => {
    expectContainment(g, {
      P1: 'Processors', P2: 'Processors', P3: 'Processors', P4: 'Processors',
      R1: 'Reducers', R2: 'Reducers',
    })
  })

  it('Processors stacks TB inside an LR root', () => {
    const procs = group(g, 'Processors')
    expect(procs.height).toBeGreaterThan(procs.width)
    expect(node(g, 'P2').y).toBeGreaterThan(node(g, 'P1').y)
    expect(node(g, 'P3').y).toBeGreaterThan(node(g, 'P2').y)
    expect(node(g, 'P4').y).toBeGreaterThan(node(g, 'P3').y)
  })

  it('Splitter left of Processors left of Reducers left of Combine', () => {
    expect(group(g, 'Processors').x).toBeGreaterThan(node(g, 'Splitter').x)
    expect(group(g, 'Reducers').x).toBeGreaterThan(group(g, 'Processors').x)
    expect(node(g, 'Combine').x).toBeGreaterThan(group(g, 'Reducers').x)
  })

  it('does not thread any foreign subgraph header', () => {
    expect(findHeaderThreads(g)).toEqual([])
  })
})

// ============================================================================
// Cross-cutting
// ============================================================================

describe('stress: cross-cutting', () => {
  const SAMPLE_LIST = Object.entries(SAMPLES)

  it('layout is deterministic — same input produces identical output', () => {
    for (const [name, src] of SAMPLE_LIST) {
      const a = layout(src)
      const b = layout(src)
      expect(JSON.stringify(a), `non-deterministic layout for ${name}`).toBe(JSON.stringify(b))
    }
  })

  it('rendered hop count equals computed crossing count for every sample', () => {
    for (const [name, src] of SAMPLE_LIST) {
      const g = layout(src)
      const crossings = countRightAngleCrossings(g.edges)
      const svg = renderMermaidSVG(src, { bg: '#fff', fg: '#000' })
      const hops = (svg.match(/Q\d+\.\d+/g) ?? []).length
      expect(hops, `${name}: hops (${hops}) ≠ crossings (${crossings})`).toBe(crossings)
    }
  })
})
