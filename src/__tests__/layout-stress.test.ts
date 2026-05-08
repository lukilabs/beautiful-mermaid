/**
 * Stress test suite for the flowchart layout engine.
 *
 * One parameterised describe block per sample in ALL_SAMPLE_GRAPHS. Each
 * iteration runs every applicable check: bounded right-angle crossings,
 * declared containment, no node overlaps, no edge polyline threading a
 * foreign subgraph header, axis ordering, nesting, subgraph aspect ratio,
 * absence of colinear edge overlaps, layout determinism, and matching
 * hop / crossing counts in the rendered SVG. Per-sample metadata in
 * `sample-graphs/` decides which checks apply.
 */
import { describe, it, expect } from 'bun:test'
import { parseMermaid, renderMermaidSVG } from '../index.ts'
import { layoutGraphSync } from '../layout.ts'
import { countRightAngleCrossings } from '../layout-engine.ts'
import type { PositionedGraph, PositionedNode, PositionedGroup } from '../types.ts'
import { ALL_SAMPLE_GRAPHS, type SampleGraph } from './sample-graphs/index.ts'

// ============================================================================
// Helpers
// ============================================================================

interface Rect { x: number; y: number; width: number; height: number }

/** Lay out the parsed mermaid source synchronously through the production engine. */
function layout(src: string): PositionedGraph {
  return layoutGraphSync(parseMermaid(src))
}

/** True when `inner`'s rectangle sits entirely within `outer` (with a small floating-point tolerance). */
function rectContains(outer: Rect, inner: Rect, tol = 0.01): boolean {
  return inner.x >= outer.x - tol &&
         inner.y >= outer.y - tol &&
         inner.x + inner.width  <= outer.x + outer.width + tol &&
         inner.y + inner.height <= outer.y + outer.height + tol
}

/** True when two rectangles share any interior area. */
function rectsOverlap(a: Rect, b: Rect): boolean {
  return !(
    a.x + a.width <= b.x ||
    b.x + b.width <= a.x ||
    a.y + a.height <= b.y ||
    b.y + b.height <= a.y
  )
}

/** Recursively find a positioned subgraph by id or label. */
function findGroup(groups: PositionedGroup[], idOrLabel: string): PositionedGroup | undefined {
  for (const g of groups) {
    if (g.id === idOrLabel || g.label === idOrLabel) return g
    const nested = findGroup(g.children, idOrLabel)
    if (nested) return nested
  }
  return undefined
}

/**
 * Resolves an item from the sample's metadata to its positioned rectangle.
 * Tries leaf nodes first, then subgraphs by id or label. Throws when neither
 * resolves so a typo in the sample data fails fast instead of silently
 * passing.
 */
function resolveRect(g: PositionedGraph, idOrLabel: string): Rect {
  const leaf = g.nodes.find(n => n.id === idOrLabel)
  if (leaf) return leaf
  const sub = findGroup(g.groups, idOrLabel)
  if (sub) return sub
  throw new Error(`No node or subgraph matches "${idOrLabel}"`)
}

const HEADER_HEIGHT = 28

/**
 * Returns the list of (edge, subgraph) pairs where an edge polyline
 * threads the top `HEADER_HEIGHT` strip of a subgraph it neither enters
 * nor exits — visually, a line cutting across a subgraph's title bar.
 */
function findHeaderThreads(g: PositionedGraph): Array<{ edge: string; subgraph: string }> {
  const offenders: Array<{ edge: string; subgraph: string }> = []
  const allGroups: PositionedGroup[] = []
  function collect(gs: PositionedGroup[]): void {
    for (const grp of gs) { allGroups.push(grp); collect(grp.children) }
  }
  collect(g.groups)

  const leafContainers = new Map<string, Set<string>>()
  for (const n of g.nodes) {
    const set = new Set<string>()
    for (const grp of allGroups) if (rectContains(grp, n)) set.add(grp.id)
    leafContainers.set(n.id, set)
  }

  for (const grp of allGroups) {
    const headerStripY1 = grp.y
    const headerStripY2 = grp.y + HEADER_HEIGHT
    for (const e of g.edges) {
      const sourceInside = leafContainers.get(e.source)?.has(grp.id) ?? false
      const targetInside = leafContainers.get(e.target)?.has(grp.id) ?? false
      if (sourceInside || targetInside) continue
      const pts = e.points
      for (let i = 0; i + 1 < pts.length; i++) {
        const p1 = pts[i]!
        const p2 = pts[i + 1]!
        const minX = Math.min(p1.x, p2.x), maxX = Math.max(p1.x, p2.x)
        const minY = Math.min(p1.y, p2.y), maxY = Math.max(p1.y, p2.y)
        const xOverlap = maxX > grp.x + 0.5 && minX < grp.x + grp.width - 0.5
        const yOverlap = maxY > headerStripY1 + 0.5 && minY < headerStripY2 - 0.5
        if (xOverlap && yOverlap) {
          offenders.push({ edge: `${e.source} → ${e.target}`, subgraph: grp.label || grp.id })
          break
        }
      }
    }
  }
  return offenders
}

/** Returns segment pairs from distinct edges that share a colinear interval longer than `minLen` — a proxy for "drawing arrows on top of each other". */
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
// Per-sample assertions, parameterised over every sample
// ============================================================================

for (const sample of ALL_SAMPLE_GRAPHS) {
  describe(`sample: ${sample.slug}`, () => {
    const g = layout(sample.source)
    const maxCrossings = sample.maxCrossings ?? 0

    it(`right-angle crossings ≤ ${maxCrossings}`, () => {
      expect(countRightAngleCrossings(g.edges)).toBeLessThanOrEqual(maxCrossings)
    })

    it('no two leaves overlap', () => {
      for (let i = 0; i < g.nodes.length; i++) {
        for (let j = i + 1; j < g.nodes.length; j++) {
          const a = g.nodes[i]!, b = g.nodes[j]!
          expect(rectsOverlap(a, b), `nodes "${a.id}" and "${b.id}" overlap`).toBe(false)
        }
      }
    })

    it('no edge threads a foreign subgraph header', () => {
      expect(findHeaderThreads(g)).toEqual([])
    })

    if (sample.containment) {
      const containment: Record<string, string> = sample.containment
      it('every leaf sits inside its declared subgraph', () => {
        for (const [leafId, subgraphIdOrLabel] of Object.entries(containment)) {
          const leaf = g.nodes.find(n => n.id === leafId)
          expect(leaf, `leaf "${leafId}" is missing from the laid-out graph`).toBeDefined()
          const sg = findGroup(g.groups, subgraphIdOrLabel)
          expect(sg, `subgraph "${subgraphIdOrLabel}" is missing from the laid-out graph`).toBeDefined()
          expect(
            rectContains(sg!, leaf!),
            `leaf "${leafId}" is not inside its declared subgraph "${subgraphIdOrLabel}"`,
          ).toBe(true)
        }
      })
    }

    if (sample.expectedAxisOrder) {
      for (const ordering of sample.expectedAxisOrder) {
        const ordering_ = ordering
        it(`${ordering_.axis}-axis order: ${ordering_.items.join(' < ')}`, () => {
          for (let i = 0; i + 1 < ordering_.items.length; i++) {
            const aRect = resolveRect(g, ordering_.items[i]!)
            const bRect = resolveRect(g, ordering_.items[i + 1]!)
            const aPos = ordering_.axis === 'x' ? aRect.x : aRect.y
            const bPos = ordering_.axis === 'x' ? bRect.x : bRect.y
            expect(
              bPos > aPos,
              `expected ${ordering_.items[i + 1]} (${ordering_.axis}=${bPos.toFixed(0)}) to be after ${ordering_.items[i]} (${ordering_.axis}=${aPos.toFixed(0)}) on the ${ordering_.axis}-axis`,
            ).toBe(true)
          }
        })
      }
    }

    if (sample.expectedNesting) {
      for (const chain of sample.expectedNesting) {
        const chain_ = chain
        it(`nesting chain: ${chain_.join(' ⊃ ')}`, () => {
          for (let i = 0; i + 1 < chain_.length; i++) {
            const outer = resolveRect(g, chain_[i]!)
            const inner = resolveRect(g, chain_[i + 1]!)
            expect(
              rectContains(outer, inner),
              `expected "${chain_[i + 1]}" to be inside "${chain_[i]}"`,
            ).toBe(true)
          }
        })
      }
    }

    if (sample.expectedSubgraphAspect) {
      for (const aspect of sample.expectedSubgraphAspect) {
        const aspect_ = aspect
        const dim = aspect_.taller ? 'taller than wide' : aspect_.wider ? 'wider than tall' : 'unspecified aspect'
        it(`${aspect_.subgraph} is ${dim}`, () => {
          const sg = findGroup(g.groups, aspect_.subgraph)
          expect(sg, `subgraph "${aspect_.subgraph}" is missing from the laid-out graph`).toBeDefined()
          if (aspect_.taller) expect(sg!.height).toBeGreaterThan(sg!.width)
          if (aspect_.wider) expect(sg!.width).toBeGreaterThan(sg!.height)
        })
      }
    }

    if (sample.expectNoColinearOverlap) {
      it('no two distinct edges share a colinear segment longer than 6px', () => {
        expect(findColinearOverlaps(g)).toEqual([])
      })
    }

    if (sample.minGraphHeightOverWidth !== undefined) {
      const min = sample.minGraphHeightOverWidth
      it(`graph height / width ≥ ${min}`, () => {
        expect(g.height / g.width).toBeGreaterThanOrEqual(min)
      })
    }

    if (sample.minGraphWidthOverHeight !== undefined) {
      const min = sample.minGraphWidthOverHeight
      it(`graph width / height ≥ ${min}`, () => {
        expect(g.width / g.height).toBeGreaterThanOrEqual(min)
      })
    }

    it('layout is deterministic — same input produces identical output', () => {
      const replay = layout(sample.source)
      expect(JSON.stringify(replay)).toBe(JSON.stringify(g))
    })

    it('rendered hop count equals computed crossing count', () => {
      const crossings = countRightAngleCrossings(g.edges)
      const svg = renderMermaidSVG(sample.source, { bg: '#fff', fg: '#000' })
      const hops = (svg.match(/Q\d+\.\d+/g) ?? []).length
      expect(hops, `hops (${hops}) ≠ crossings (${crossings})`).toBe(crossings)
    })
  })
}

// Re-export type for IDE convenience
export type { SampleGraph }
