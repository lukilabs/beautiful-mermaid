/**
 * Final touch-ups on the positioned graph: clip edges to non-rectangular
 * shapes, expand canvas bounds to wrap any escapees.
 */

import type { PositionedGraph } from '../types.ts'
import { ARROW_HEAD } from '../styles.ts'
import { clipEdgeToShape } from '../shape-clipping.ts'
import type { ExtractionResult } from './elk-layout.ts'

function clipEndpoints(extraction: ExtractionResult): void {
  for (const edge of extraction.edges) {
    const s = extraction.nodeMap.get(edge.source)
    const t = extraction.nodeMap.get(edge.target)
    if (s) edge.points = clipEdgeToShape(edge.points, s, true)
    if (t) edge.points = clipEdgeToShape(edge.points, t, false)
  }
}

function computeCanvasBounds(
  extraction: ExtractionResult,
  elkWidth: number,
  elkHeight: number,
  padding: number
): { width: number; height: number } {
  let width = elkWidth
  let height = elkHeight
  const arrowMargin = ARROW_HEAD.width

  for (const edge of extraction.edges) {
    for (const p of edge.points) {
      width = Math.max(width, p.x + arrowMargin + padding)
      height = Math.max(height, p.y + arrowMargin + padding)
      if (p.x < 0) width += -p.x
      if (p.y < 0) height += -p.y
    }
    if (edge.labelPosition) {
      width = Math.max(width, edge.labelPosition.x + 60 + padding)
      height = Math.max(height, edge.labelPosition.y + 20 + padding)
    }
  }

  return { width, height }
}

export function postprocess(
  extraction: ExtractionResult,
  elkWidth: number,
  elkHeight: number,
  padding: number
): PositionedGraph {
  clipEndpoints(extraction)
  const { width, height } = computeCanvasBounds(extraction, elkWidth, elkHeight, padding)
  return {
    width,
    height,
    nodes: extraction.nodes,
    edges: extraction.edges,
    groups: extraction.groups,
  }
}
