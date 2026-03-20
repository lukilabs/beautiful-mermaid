/**
 * Shape-aware edge clipping utilities.
 *
 * ELK.js treats all nodes as rectangles for edge routing. For non-rectangular
 * shapes like diamonds, this causes edges to terminate at the bounding box
 * boundary instead of the actual shape vertices.
 *
 * This module provides utilities to clip edge endpoints to actual shape
 * boundaries after ELK layout is complete.
 */

import type { Point, PositionedNode } from './types.ts'

/**
 * Clip an edge endpoint to the actual shape boundary of a node.
 *
 * @param points - The edge points array
 * @param node - The node to clip to
 * @param isStart - True if clipping the start point (source), false for end (target)
 * @returns New points array with clipped endpoint
 */
export function clipEdgeToShape(points: Point[], node: PositionedNode, isStart: boolean): Point[] {
  if (points.length < 2) return points

  // Only clip non-rectangular shapes
  if (node.shape === 'rectangle' || node.shape === 'rounded' || node.shape === 'stadium') {
    return points
  }

  const result = [...points]

  if (node.shape === 'diamond') {
    if (isStart) {
      result[0] = clipToDiamond(points[0]!, points[1]!, node)
    } else {
      const lastIdx = points.length - 1
      result[lastIdx] = clipToDiamond(points[lastIdx]!, points[lastIdx - 1]!, node)
    }
  }
  // Future: add clipping for hexagon, circle, etc.

  return result
}

/**
 * Clip a point to the diamond shape boundary using ray-polygon intersection.
 *
 * Diamond vertices are at the midpoints of the bounding box sides:
 * - Top: (cx, y)
 * - Right: (x + w, cy)
 * - Bottom: (cx, y + h)
 * - Left: (x, cy)
 *
 * For orthogonal edges, we extend the final segment as a ray and find where
 * it intersects the diamond boundary. This preserves orthogonality while
 * ensuring the edge terminates at the actual diamond shape.
 *
 * @param endpoint - The edge endpoint to clip
 * @param adjacent - The adjacent point (to determine ray direction)
 * @param node - The diamond node
 * @returns Clipped point on the diamond boundary
 */
function clipToDiamond(endpoint: Point, adjacent: Point, node: PositionedNode): Point {
  const cx = node.x + node.width / 2
  const cy = node.y + node.height / 2
  const _halfW = node.width / 2
  const _halfH = node.height / 2

  // Diamond vertices
  const top: Point = { x: cx, y: node.y }
  const right: Point = { x: node.x + node.width, y: cy }
  const bottom: Point = { x: cx, y: node.y + node.height }
  const left: Point = { x: node.x, y: cy }

  // Determine approach direction from adjacent point
  const dx = endpoint.x - adjacent.x
  const dy = endpoint.y - adjacent.y

  // For orthogonal edges, one of dx or dy will be ~0
  const isVertical = Math.abs(dx) < Math.abs(dy)

  if (isVertical) {
    // Vertical ray at x = endpoint.x
    const rayX = endpoint.x

    if (dy > 0) {
      // Coming from above (moving down) → intersect with top half of diamond
      // Top half edges: left-top (left → top) and top-right (top → right)
      if (rayX <= cx) {
        // Intersect with left-top edge (from left vertex to top vertex)
        return intersectVerticalRayWithEdge(rayX, left, top) ?? top
      } else {
        // Intersect with top-right edge (from top vertex to right vertex)
        return intersectVerticalRayWithEdge(rayX, top, right) ?? top
      }
    } else {
      // Coming from below (moving up) → intersect with bottom half of diamond
      // Bottom half edges: left-bottom (bottom → left) and bottom-right (right → bottom)
      if (rayX <= cx) {
        // Intersect with bottom-left edge (from bottom vertex to left vertex)
        return intersectVerticalRayWithEdge(rayX, bottom, left) ?? bottom
      } else {
        // Intersect with bottom-right edge (from right vertex to bottom vertex)
        return intersectVerticalRayWithEdge(rayX, right, bottom) ?? bottom
      }
    }
  } else {
    // Horizontal ray at y = endpoint.y
    const rayY = endpoint.y

    if (dx > 0) {
      // Coming from left (moving right) → intersect with left half of diamond
      // Left half edges: top-left (top → left) and left-bottom (left → bottom)
      if (rayY <= cy) {
        // Intersect with top-left edge (from top vertex to left vertex)
        return intersectHorizontalRayWithEdge(rayY, top, left) ?? left
      } else {
        // Intersect with left-bottom edge (from left vertex to bottom vertex)
        return intersectHorizontalRayWithEdge(rayY, left, bottom) ?? left
      }
    } else {
      // Coming from right (moving left) → intersect with right half of diamond
      // Right half edges: top-right (top → right) and right-bottom (right → bottom)
      if (rayY <= cy) {
        // Intersect with top-right edge (from top vertex to right vertex)
        return intersectHorizontalRayWithEdge(rayY, top, right) ?? right
      } else {
        // Intersect with right-bottom edge (from right vertex to bottom vertex)
        return intersectHorizontalRayWithEdge(rayY, right, bottom) ?? right
      }
    }
  }
}

/**
 * Find intersection of a horizontal ray (y = rayY) with a line segment.
 * Returns the intersection point or null if no intersection.
 */
function intersectHorizontalRayWithEdge(rayY: number, p1: Point, p2: Point): Point | null {
  const dy = p2.y - p1.y
  if (Math.abs(dy) < 0.001) {
    // Edge is horizontal, no single intersection
    return null
  }

  const t = (rayY - p1.y) / dy
  if (t < 0 || t > 1) {
    // Intersection outside the edge segment
    return null
  }

  const x = p1.x + t * (p2.x - p1.x)
  return { x, y: rayY }
}

/**
 * Find intersection of a vertical ray (x = rayX) with a line segment.
 * Returns the intersection point or null if no intersection.
 */
function intersectVerticalRayWithEdge(rayX: number, p1: Point, p2: Point): Point | null {
  const dx = p2.x - p1.x
  if (Math.abs(dx) < 0.001) {
    // Edge is vertical, no single intersection
    return null
  }

  const t = (rayX - p1.x) / dx
  if (t < 0 || t > 1) {
    // Intersection outside the edge segment
    return null
  }

  const y = p1.y + t * (p2.y - p1.y)
  return { x: rayX, y }
}
