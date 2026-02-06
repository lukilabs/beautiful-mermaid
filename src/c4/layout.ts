// @ts-expect-error — dagre types are declared for the package root, not the dist path;
// importing the pre-built browser bundle avoids Bun.build hanging on 30+ CJS file resolution
import dagre from '@dagrejs/dagre/dist/dagre.js'
import type {
  C4Diagram,
  C4Element,
  C4Boundary,
  PositionedC4Diagram,
  PositionedC4Element,
  PositionedC4Relationship,
  PositionedC4Boundary,
} from './types.ts'
import type { RenderOptions } from '../types.ts'
import { estimateTextWidth, FONT_SIZES, FONT_WEIGHTS } from '../styles.ts'
import { centerToTopLeft, snapToOrthogonal, clipEndpointsToNodes } from '../dagre-adapter.ts'

// ============================================================================
// C4 diagram layout engine
//
// Uses dagre for positioning element boxes, then calculates boundary positions
// by finding the bounding box of their child elements with padding.
//
// Element box sizing:
//   - Person: 160 wide, 180 tall (taller for stick figure silhouette)
//   - System/Container/Component: min 160 wide, height based on text content
//   - Boundaries: wrap children with padding
// ============================================================================

/** Layout constants for C4 diagrams */
const C4 = {
  padding: 40,
  boxPadX: 16,
  boxPadY: 12,
  personWidth: 160,
  personHeight: 180,
  minBoxWidth: 160,
  minBoxHeight: 80,
  lineHeight: 18,
  boundaryPadding: 30,
  boundaryHeaderHeight: 28,
  nodeSpacing: 60,
  layerSpacing: 80,
  titleFontSize: 14,
  titleFontWeight: 600,
  descFontSize: 11,
  descFontWeight: 400,
  techFontSize: 10,
  techFontWeight: 400,
} as const

/**
 * Lay out a parsed C4 diagram using dagre.
 * Returns positioned element boxes, relationship paths, and boundary rectangles.
 *
 * Kept async for API compatibility — dagre itself is synchronous.
 */
export async function layoutC4Diagram(
  diagram: C4Diagram,
  _options: RenderOptions = {}
): Promise<PositionedC4Diagram> {
  if (diagram.elements.length === 0) {
    return { width: 0, height: 0, elements: [], relationships: [], boundaries: [] }
  }

  // 1. Calculate box dimensions for each element
  const elementSizes = new Map<string, { width: number; height: number }>()

  for (const element of diagram.elements) {
    const size = calculateElementSize(element)
    elementSizes.set(element.alias, size)
  }

  // 2. Build dagre graph
  const g = new dagre.graphlib.Graph({ directed: true })
  g.setGraph({
    rankdir: 'TB',
    acyclicer: 'greedy',
    nodesep: C4.nodeSpacing,
    ranksep: C4.layerSpacing,
    marginx: C4.padding,
    marginy: C4.padding,
  })
  g.setDefaultEdgeLabel(() => ({}))

  for (const element of diagram.elements) {
    const size = elementSizes.get(element.alias)!
    g.setNode(element.alias, { width: size.width, height: size.height })
  }

  for (let i = 0; i < diagram.relationships.length; i++) {
    const rel = diagram.relationships[i]!
    const labelText = rel.technology ? `${rel.label} [${rel.technology}]` : rel.label
    g.setEdge(rel.from, rel.to, {
      _index: i,
      label: labelText,
      width: estimateTextWidth(labelText, FONT_SIZES.edgeLabel, FONT_WEIGHTS.edgeLabel) + 8,
      height: FONT_SIZES.edgeLabel + 6,
      labelpos: 'c',
    })
  }

  // 3. Run dagre layout
  try {
    dagre.layout(g)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`Dagre layout failed (C4 diagram): ${message}`)
  }

  // 4. Extract positioned elements
  const positionedElements: PositionedC4Element[] = diagram.elements.map(element => {
    const dagreNode = g.node(element.alias)
    const size = elementSizes.get(element.alias)!
    const topLeft = centerToTopLeft(dagreNode.x, dagreNode.y, dagreNode.width, dagreNode.height)
    return {
      kind: element.kind,
      alias: element.alias,
      label: element.label,
      description: element.description,
      technology: element.technology,
      external: element.external,
      x: topLeft.x,
      y: topLeft.y,
      width: dagreNode.width ?? size.width,
      height: dagreNode.height ?? size.height,
    }
  })

  // Build element lookup for boundary calculation
  const elementLookup = new Map<string, PositionedC4Element>()
  for (const el of positionedElements) {
    elementLookup.set(el.alias, el)
  }

  // 5. Extract relationship paths
  const relationships: PositionedC4Relationship[] = g.edges().map(edgeObj => {
    const dagreEdge = g.edge(edgeObj)
    const rel = diagram.relationships[dagreEdge._index as number]!
    const rawPoints = dagreEdge.points ?? []
    // TB layout -> vertical-first bends
    const orthoPoints = snapToOrthogonal(rawPoints, true)

    const srcNode = g.node(edgeObj.v)
    const tgtNode = g.node(edgeObj.w)
    const points = clipEndpointsToNodes(
      orthoPoints,
      srcNode ? { cx: srcNode.x, cy: srcNode.y, hw: srcNode.width / 2, hh: srcNode.height / 2 } : null,
      tgtNode ? { cx: tgtNode.x, cy: tgtNode.y, hw: tgtNode.width / 2, hh: tgtNode.height / 2 } : null,
    )

    return {
      from: rel.from,
      to: rel.to,
      label: rel.label,
      technology: rel.technology,
      points,
    }
  })

  // 6. Calculate boundary positions from child element bounding boxes
  const positionedBoundaries = layoutBoundaries(diagram.boundaries, elementLookup)

  // 7. Calculate overall diagram size
  // Account for boundaries that may extend beyond element positions
  let maxW = g.graph().width ?? 600
  let maxH = g.graph().height ?? 400
  for (const b of flattenBoundaries(positionedBoundaries)) {
    maxW = Math.max(maxW, b.x + b.width + C4.padding)
    maxH = Math.max(maxH, b.y + b.height + C4.padding)
  }

  return {
    width: maxW,
    height: maxH,
    title: diagram.title,
    elements: positionedElements,
    relationships,
    boundaries: positionedBoundaries,
  }
}

// ============================================================================
// Element sizing
// ============================================================================

/** Calculate the box size for a C4 element based on its text content */
function calculateElementSize(element: C4Element): { width: number; height: number } {
  if (element.kind === 'Person') {
    return { width: C4.personWidth, height: C4.personHeight }
  }

  // Calculate width from text content
  const labelW = estimateTextWidth(element.label, FONT_SIZES.nodeLabel, FONT_WEIGHTS.nodeLabel)
  let maxTextW = labelW

  if (element.technology) {
    const techText = `[${element.technology}]`
    const techW = estimateTextWidth(techText, C4.techFontSize, C4.techFontWeight)
    maxTextW = Math.max(maxTextW, techW)
  }

  if (element.description) {
    const descW = estimateTextWidth(element.description, C4.descFontSize, C4.descFontWeight)
    maxTextW = Math.max(maxTextW, descW)
  }

  const width = Math.max(C4.minBoxWidth, maxTextW + C4.boxPadX * 2)

  // Calculate height from text lines
  let textLines = 1 // label
  if (element.technology) textLines++
  if (element.description) textLines++

  const height = Math.max(C4.minBoxHeight, textLines * C4.lineHeight + C4.boxPadY * 2)

  return { width, height }
}

// ============================================================================
// Boundary layout
// ============================================================================

/** Recursively lay out boundaries based on their child element positions */
function layoutBoundaries(
  boundaries: C4Boundary[],
  elementLookup: Map<string, PositionedC4Element>,
): PositionedC4Boundary[] {
  return boundaries.map(boundary => {
    // Recursively position child boundaries first
    const children = layoutBoundaries(boundary.childBoundaries, elementLookup)

    // Collect all bounding rects: direct child elements + child boundary rects
    const rects: Array<{ x: number; y: number; right: number; bottom: number }> = []

    for (const element of boundary.elements) {
      const pos = elementLookup.get(element.alias)
      if (pos) {
        rects.push({
          x: pos.x,
          y: pos.y,
          right: pos.x + pos.width,
          bottom: pos.y + pos.height,
        })
      }
    }

    for (const child of children) {
      rects.push({
        x: child.x,
        y: child.y,
        right: child.x + child.width,
        bottom: child.y + child.height,
      })
    }

    if (rects.length === 0) {
      // Empty boundary — give it a minimal size
      return {
        alias: boundary.alias,
        label: boundary.label,
        kind: boundary.kind,
        x: 0,
        y: 0,
        width: C4.minBoxWidth,
        height: C4.minBoxHeight,
        children,
      }
    }

    // Find bounding box of all children
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity

    for (const rect of rects) {
      minX = Math.min(minX, rect.x)
      minY = Math.min(minY, rect.y)
      maxX = Math.max(maxX, rect.right)
      maxY = Math.max(maxY, rect.bottom)
    }

    // Add padding around children
    return {
      alias: boundary.alias,
      label: boundary.label,
      kind: boundary.kind,
      x: minX - C4.boundaryPadding,
      y: minY - C4.boundaryPadding - C4.boundaryHeaderHeight,
      width: (maxX - minX) + C4.boundaryPadding * 2,
      height: (maxY - minY) + C4.boundaryPadding * 2 + C4.boundaryHeaderHeight,
      children,
    }
  })
}

/** Flatten nested boundaries into a single array for size calculations */
function flattenBoundaries(boundaries: PositionedC4Boundary[]): PositionedC4Boundary[] {
  const result: PositionedC4Boundary[] = []
  for (const b of boundaries) {
    result.push(b)
    result.push(...flattenBoundaries(b.children))
  }
  return result
}
