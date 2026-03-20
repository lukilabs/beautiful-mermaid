/**
 * Edge Approach Direction Tests
 *
 * Verifies that edges approach target nodes from the correct direction:
 * - Edges entering from TOP should have a vertical final segment (coming from above)
 * - Edges entering from BOTTOM should have a vertical final segment (coming from below)
 * - Edges entering from LEFT should have a horizontal final segment (coming from left)
 * - Edges entering from RIGHT should have a horizontal final segment (coming from right)
 *
 * This prevents visual artifacts where an arrow points to the top of a node
 * but approaches horizontally, creating an awkward bend at the arrowhead.
 */

import { describe, expect, it } from 'bun:test'
import { layoutGraphSync } from '../layout.ts'
import { parseMermaid } from '../parser.ts'

interface Point {
  x: number
  y: number
}

/**
 * Determine if a segment is primarily vertical (dy > dx).
 */
function isVerticalSegment(p1: Point, p2: Point, tolerance = 1): boolean {
  const dx = Math.abs(p2.x - p1.x)
  const dy = Math.abs(p2.y - p1.y)
  return dy > dx || dx < tolerance
}

/**
 * Determine if a segment is primarily horizontal (dx > dy).
 */
function isHorizontalSegment(p1: Point, p2: Point, tolerance = 1): boolean {
  const dx = Math.abs(p2.x - p1.x)
  const dy = Math.abs(p2.y - p1.y)
  return dx > dy || dy < tolerance
}

/**
 * Get the final segment of an edge (last two points).
 */
function getFinalSegment(points: Point[]): { p1: Point; p2: Point } | null {
  if (points.length < 2) return null
  return {
    p1: points[points.length - 2]!,
    p2: points[points.length - 1]!,
  }
}

/**
 * Get the first segment of an edge (first two points).
 */
function getFirstSegment(points: Point[]): { p1: Point; p2: Point } | null {
  if (points.length < 2) return null
  return {
    p1: points[0]!,
    p2: points[1]!,
  }
}

/**
 * Determine which side of a node a point is on.
 */
function getApproachSide(
  point: Point,
  nodeX: number,
  nodeY: number,
  nodeWidth: number,
  nodeHeight: number,
): 'top' | 'bottom' | 'left' | 'right' {
  const cx = nodeX + nodeWidth / 2
  const cy = nodeY + nodeHeight / 2
  const _dx = point.x - cx
  const _dy = point.y - cy

  // Check which edge the point is closest to
  const distTop = Math.abs(point.y - nodeY)
  const distBottom = Math.abs(point.y - (nodeY + nodeHeight))
  const distLeft = Math.abs(point.x - nodeX)
  const distRight = Math.abs(point.x - (nodeX + nodeWidth))

  const minDist = Math.min(distTop, distBottom, distLeft, distRight)

  if (minDist === distTop) return 'top'
  if (minDist === distBottom) return 'bottom'
  if (minDist === distLeft) return 'left'
  return 'right'
}

// ============================================================================
// Test Cases
// ============================================================================

describe('Edge Approach Direction', () => {
  describe('TD layout - edges should approach targets vertically from top', () => {
    it('simple two-node vertical: final segment should be vertical', () => {
      const parsed = parseMermaid(`graph TD
        A --> B`)
      const positioned = layoutGraphSync(parsed, {})

      const edge = positioned.edges.find(e => e.source === 'A' && e.target === 'B')
      expect(edge).toBeDefined()

      const finalSeg = getFinalSegment(edge!.points)
      expect(finalSeg).not.toBeNull()

      // Edge enters B from top, so final segment should be vertical
      expect(isVerticalSegment(finalSeg!.p1, finalSeg!.p2)).toBe(true)
    })

    it('fan-out pattern: multiple edges to one target should all be vertical', () => {
      // This is the exact pattern from the screenshot
      const parsed = parseMermaid(`graph TD
        Input --> Processor
        Config --> Processor`)
      const positioned = layoutGraphSync(parsed, {})

      const processorNode = positioned.nodes.find(n => n.id === 'Processor')
      expect(processorNode).toBeDefined()

      // Both edges should approach Processor with vertical final segments
      for (const edge of positioned.edges) {
        if (edge.target === 'Processor') {
          const finalSeg = getFinalSegment(edge.points)
          expect(finalSeg).not.toBeNull()

          // The final segment should be vertical (approaching top edge)
          const isVertical = isVerticalSegment(finalSeg!.p1, finalSeg!.p2)
          expect(isVertical).toBe(true)
        }
      }
    })

    it('fan-in and fan-out pattern: all vertical approaches', () => {
      // Full pattern from the screenshot
      const parsed = parseMermaid(`graph TD
        Input --> Processor
        Config --> Processor
        Processor --> Output
        Processor --> Log`)
      const positioned = layoutGraphSync(parsed, {})

      // Check all edges
      for (const edge of positioned.edges) {
        const targetNode = positioned.nodes.find(n => n.id === edge.target)
        expect(targetNode).toBeDefined()

        const finalSeg = getFinalSegment(edge.points)
        expect(finalSeg).not.toBeNull()

        // Determine which side the edge approaches
        const approachSide = getApproachSide(
          finalSeg!.p2,
          targetNode!.x,
          targetNode!.y,
          targetNode!.width,
          targetNode!.height,
        )

        // For top/bottom approach, final segment must be vertical
        // For left/right approach, final segment must be horizontal
        if (approachSide === 'top' || approachSide === 'bottom') {
          expect(isVerticalSegment(finalSeg!.p1, finalSeg!.p2)).toBe(true)
        } else {
          expect(isHorizontalSegment(finalSeg!.p1, finalSeg!.p2)).toBe(true)
        }
      }
    })
  })

  describe('LR layout - edges should approach targets horizontally', () => {
    it('simple two-node horizontal: final segment should be horizontal', () => {
      const parsed = parseMermaid(`graph LR
        A --> B`)
      const positioned = layoutGraphSync(parsed, {})

      const edge = positioned.edges.find(e => e.source === 'A' && e.target === 'B')
      expect(edge).toBeDefined()

      const finalSeg = getFinalSegment(edge!.points)
      expect(finalSeg).not.toBeNull()

      // Edge enters B from left, so final segment should be horizontal
      expect(isHorizontalSegment(finalSeg!.p1, finalSeg!.p2)).toBe(true)
    })

    it('fan-out pattern in LR: final segments should be horizontal', () => {
      const parsed = parseMermaid(`graph LR
        Input --> Processor
        Config --> Processor`)
      const positioned = layoutGraphSync(parsed, {})

      for (const edge of positioned.edges) {
        if (edge.target === 'Processor') {
          const finalSeg = getFinalSegment(edge.points)
          expect(finalSeg).not.toBeNull()
          expect(isHorizontalSegment(finalSeg!.p1, finalSeg!.p2)).toBe(true)
        }
      }
    })
  })

  describe('Source exit direction matches side', () => {
    it('TD layout: edges should exit source vertically from bottom', () => {
      const parsed = parseMermaid(`graph TD
        A --> B
        A --> C`)
      const positioned = layoutGraphSync(parsed, {})

      for (const edge of positioned.edges) {
        if (edge.source === 'A') {
          const firstSeg = getFirstSegment(edge.points)
          expect(firstSeg).not.toBeNull()

          // Edge exits A from bottom, so first segment should be vertical
          expect(isVerticalSegment(firstSeg!.p1, firstSeg!.p2)).toBe(true)
        }
      }
    })

    it('LR layout: edges should exit source horizontally from right', () => {
      const parsed = parseMermaid(`graph LR
        A --> B
        A --> C`)
      const positioned = layoutGraphSync(parsed, {})

      for (const edge of positioned.edges) {
        if (edge.source === 'A') {
          const firstSeg = getFirstSegment(edge.points)
          expect(firstSeg).not.toBeNull()

          // Edge exits A from right, so first segment should be horizontal
          expect(isHorizontalSegment(firstSeg!.p1, firstSeg!.p2)).toBe(true)
        }
      }
    })
  })

  describe('Diamond shapes - approach direction preserved', () => {
    it('edges to diamond should approach with correct direction', () => {
      const parsed = parseMermaid(`graph TD
        A --> B{Decision}
        B -->|Yes| C
        B -->|No| D`)
      const positioned = layoutGraphSync(parsed, {})

      // Edge A → B should approach B's top vertically
      const edgeAB = positioned.edges.find(e => e.source === 'A' && e.target === 'B')
      expect(edgeAB).toBeDefined()

      const finalSegAB = getFinalSegment(edgeAB!.points)
      expect(finalSegAB).not.toBeNull()
      expect(isVerticalSegment(finalSegAB!.p1, finalSegAB!.p2)).toBe(true)
    })

    it('edges should terminate at diamond vertices, not bounding box', () => {
      // In TD layout, edges approaching from above should hit the top vertex,
      // and edges leaving downward should start from the bottom vertex.
      const parsed = parseMermaid(`graph TD
        A[Start] --> B{Decision}
        B --> C[End]`)
      const positioned = layoutGraphSync(parsed, {})

      const diamond = positioned.nodes.find(n => n.id === 'B')
      expect(diamond).toBeDefined()
      expect(diamond!.shape).toBe('diamond')

      // Calculate diamond vertices
      const cx = diamond!.x + diamond!.width / 2
      const topY = diamond!.y
      const bottomY = diamond!.y + diamond!.height

      // Edge A → B should end at the diamond's top vertex
      const edgeAB = positioned.edges.find(e => e.source === 'A' && e.target === 'B')
      expect(edgeAB).toBeDefined()
      const endPointAB = edgeAB!.points[edgeAB!.points.length - 1]!
      expect(endPointAB.x).toBeCloseTo(cx, 0)
      expect(endPointAB.y).toBeCloseTo(topY, 0)

      // Edge B → C should start from the diamond's bottom vertex
      const edgeBC = positioned.edges.find(e => e.source === 'B' && e.target === 'C')
      expect(edgeBC).toBeDefined()
      const startPointBC = edgeBC!.points[0]!
      expect(startPointBC.x).toBeCloseTo(cx, 0)
      expect(startPointBC.y).toBeCloseTo(bottomY, 0)
    })
  })
})
