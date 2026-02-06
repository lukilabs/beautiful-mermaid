// @ts-expect-error — dagre types are declared for the package root, not the dist path;
// importing the pre-built browser bundle avoids Bun.build hanging on 30+ CJS file resolution
import dagre from '@dagrejs/dagre/dist/dagre.js'
import type {
  ArchiMateDiagram,
  ArchiMateLayer,
  PositionedArchiMateDiagram,
  PositionedArchiMateElement,
  PositionedArchiMateLayer,
  PositionedArchiMateRelationship,
} from './types.ts'
import type { RenderOptions } from '../types.ts'
import { estimateTextWidth, FONT_SIZES, FONT_WEIGHTS } from '../styles.ts'
import { centerToTopLeft, snapToOrthogonal, clipEndpointsToNodes } from '../dagre-adapter.ts'

// ============================================================================
// ArchiMate diagram layout engine
//
// Uses dagre for positioning elements, then computes layer band bounding
// boxes from the positions of the elements within each layer.
//
// Layer order (top to bottom):
//   strategy → motivation → business → application → technology →
//   physical → implementation
//
// Elements within the same layer share a dagre rank via invisible edges
// to a virtual "layer anchor" node. This groups them visually.
// ============================================================================

/** Canonical layer ordering from top to bottom */
const LAYER_ORDER: readonly ArchiMateLayer[] = [
  'strategy',
  'motivation',
  'business',
  'application',
  'technology',
  'physical',
  'implementation',
]

/** Layout constants */
const ARCHIMATE = {
  /** Canvas padding around the entire diagram */
  padding: 40,
  /** Minimum element box width */
  minElementWidth: 120,
  /** Element box height */
  elementHeight: 50,
  /** Padding inside layer bands — all sides */
  layerPadding: 20,
  /** Extra top padding in layer bands for the layer label */
  layerLabelHeight: 24,
  /** Spacing between nodes within a rank */
  nodeSpacing: 40,
  /** Spacing between ranks (layers) */
  layerSpacing: 60,
  /** Font size for element type indicator */
  typeIndicatorSize: 9,
} as const

/**
 * Lay out a parsed ArchiMate diagram using dagre.
 * Returns positioned elements, layer bands, and relationship paths.
 *
 * Kept async for API compatibility — dagre itself is synchronous.
 */
export async function layoutArchiMateDiagram(
  diagram: ArchiMateDiagram,
  _options: RenderOptions = {}
): Promise<PositionedArchiMateDiagram> {
  if (diagram.elements.size === 0) {
    return { width: 0, height: 0, layers: [], elements: [], relationships: [] }
  }

  // 1. Determine which layers are present and their order
  const presentLayers: ArchiMateLayer[] = LAYER_ORDER.filter(
    layer => diagram.layers.has(layer) && diagram.layers.get(layer)!.length > 0
  )

  // 2. Calculate element box dimensions
  const elementSizes = new Map<string, { width: number; height: number }>()

  for (const [id, element] of diagram.elements) {
    const labelWidth = estimateTextWidth(
      element.label, FONT_SIZES.nodeLabel, FONT_WEIGHTS.nodeLabel
    )
    // Type indicator adds a bit of extra width
    const typeWidth = estimateTextWidth(
      element.type, ARCHIMATE.typeIndicatorSize, 400
    )
    const width = Math.max(
      ARCHIMATE.minElementWidth,
      labelWidth + 24,
      typeWidth + labelWidth / 2 + 24
    )
    elementSizes.set(id, { width, height: ARCHIMATE.elementHeight })
  }

  // 3. Build dagre graph
  const g = new dagre.graphlib.Graph({ directed: true })
  g.setGraph({
    rankdir: 'TB',
    acyclicer: 'greedy',
    nodesep: ARCHIMATE.nodeSpacing,
    ranksep: ARCHIMATE.layerSpacing,
    marginx: ARCHIMATE.padding,
    marginy: ARCHIMATE.padding,
  })
  g.setDefaultEdgeLabel(() => ({}))

  // Add element nodes
  for (const [id, element] of diagram.elements) {
    const size = elementSizes.get(id)!
    g.setNode(id, { width: size.width, height: size.height, layer: element.layer })
  }

  // Enforce layer ordering by adding invisible edges between elements
  // of consecutive layers. This ensures elements in higher layers
  // (strategy, business) appear above elements in lower layers
  // (application, technology).
  for (let i = 1; i < presentLayers.length; i++) {
    const upperLayer = presentLayers[i - 1]!
    const lowerLayer = presentLayers[i]!
    const upperElements = diagram.layers.get(upperLayer) ?? []
    const lowerElements = diagram.layers.get(lowerLayer) ?? []

    // Connect first element of upper layer to first element of lower layer
    // with a high-weight edge to enforce vertical ordering
    if (upperElements.length > 0 && lowerElements.length > 0) {
      g.setEdge(upperElements[0]!.id, lowerElements[0]!.id, {
        minlen: 2,
        weight: 10,
        _layerEdge: true,
      })
    }
  }

  // Add real relationship edges
  for (let i = 0; i < diagram.relationships.length; i++) {
    const rel = diagram.relationships[i]!
    // Only add edge if both endpoints exist
    if (diagram.elements.has(rel.source) && diagram.elements.has(rel.target)) {
      g.setEdge(rel.source, rel.target, {
        _index: i,
        label: rel.label ?? '',
        width: rel.label
          ? estimateTextWidth(rel.label, FONT_SIZES.edgeLabel, FONT_WEIGHTS.edgeLabel) + 8
          : 0,
        height: rel.label ? FONT_SIZES.edgeLabel + 6 : 0,
        labelpos: 'c',
      })
    }
  }

  // 4. Run dagre layout
  try {
    dagre.layout(g)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`Dagre layout failed (ArchiMate diagram): ${message}`)
  }

  // 5. Extract positioned elements (skip anchor nodes)
  const positionedElements: PositionedArchiMateElement[] = []

  for (const [id, element] of diagram.elements) {
    const dagreNode = g.node(id)
    if (!dagreNode) continue
    const topLeft = centerToTopLeft(dagreNode.x, dagreNode.y, dagreNode.width, dagreNode.height)
    positionedElements.push({
      id,
      label: element.label,
      type: element.type,
      layer: element.layer,
      x: topLeft.x,
      y: topLeft.y,
      width: dagreNode.width ?? elementSizes.get(id)!.width,
      height: dagreNode.height ?? elementSizes.get(id)!.height,
    })
  }

  // 6. Compute layer band positions from element bounding boxes
  const positionedLayers: PositionedArchiMateLayer[] = []

  for (const layer of presentLayers) {
    const layerElements = positionedElements.filter(e => e.layer === layer)
    if (layerElements.length === 0) continue

    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity

    for (const el of layerElements) {
      minX = Math.min(minX, el.x)
      minY = Math.min(minY, el.y)
      maxX = Math.max(maxX, el.x + el.width)
      maxY = Math.max(maxY, el.y + el.height)
    }

    // Add padding around the layer band
    positionedLayers.push({
      name: layer,
      x: minX - ARCHIMATE.layerPadding,
      y: minY - ARCHIMATE.layerPadding - ARCHIMATE.layerLabelHeight,
      width: (maxX - minX) + ARCHIMATE.layerPadding * 2,
      height: (maxY - minY) + ARCHIMATE.layerPadding * 2 + ARCHIMATE.layerLabelHeight,
    })
  }

  // Normalize layer band widths so they all share the same x and width
  if (positionedLayers.length > 0) {
    const globalMinX = Math.min(...positionedLayers.map(l => l.x))
    const globalMaxRight = Math.max(...positionedLayers.map(l => l.x + l.width))
    const globalWidth = globalMaxRight - globalMinX

    for (const layer of positionedLayers) {
      layer.x = globalMinX
      layer.width = globalWidth
    }
  }

  // 7. Extract relationship paths
  const relationships: PositionedArchiMateRelationship[] = []

  for (const edgeObj of g.edges()) {
    const dagreEdge = g.edge(edgeObj)
    // Skip invisible layer-ordering edges
    if (dagreEdge._layerEdge) continue

    const index = dagreEdge._index as number | undefined
    if (index === undefined) continue

    const rel = diagram.relationships[index]!
    const rawPoints = dagreEdge.points ?? []
    // TB layout → vertical-first bends
    const orthoPoints = snapToOrthogonal(rawPoints, true)

    // Clip endpoints to node boundaries
    const srcNode = g.node(edgeObj.v)
    const tgtNode = g.node(edgeObj.w)
    const points = clipEndpointsToNodes(
      orthoPoints,
      srcNode ? { cx: srcNode.x, cy: srcNode.y, hw: srcNode.width / 2, hh: srcNode.height / 2 } : null,
      tgtNode ? { cx: tgtNode.x, cy: tgtNode.y, hw: tgtNode.width / 2, hh: tgtNode.height / 2 } : null,
    )

    relationships.push({
      source: rel.source,
      target: rel.target,
      type: rel.type,
      label: rel.label,
      points,
    })
  }

  return {
    width: (g.graph().width as number) ?? 600,
    height: (g.graph().height as number) ?? 400,
    layers: positionedLayers,
    elements: positionedElements,
    relationships,
  }
}
