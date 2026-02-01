// @ts-expect-error — dagre types are declared for the package root, not the dist path;
// importing the pre-built browser bundle avoids Bun.build hanging on 30+ CJS file resolution
import dagre from '@dagrejs/dagre/dist/dagre.js'
import type { MermaidGraph, MermaidSubgraph, PositionedGraph, PositionedNode, PositionedEdge, PositionedGroup, Point, RenderOptions } from './types.ts'
import { estimateTextWidth, FONT_SIZES, FONT_WEIGHTS, NODE_PADDING, GROUP_HEADER_CONTENT_PAD } from './styles.ts'
import { centerToTopLeft, snapToOrthogonal, clipToDiamondBoundary, clipToCircleBoundary, clipEndpointsToNodes } from './dagre-adapter.ts'

/** Shapes that render as circles — need edge endpoint clipping to the circle boundary */
const CIRCULAR_SHAPES = new Set(['circle', 'doublecircle', 'state-start', 'state-end'])

/** Non-rectangular shapes — skip rectangular endpoint clipping for these (they use
 *  their own boundary equations via clipToDiamondBoundary / clipToCircleBoundary) */
const NON_RECT_SHAPES = new Set(['diamond', 'circle', 'doublecircle', 'state-start', 'state-end'])

// ============================================================================
// Layout engine — converts MermaidGraph to PositionedGraph via dagre
//
// Pipeline:
//   1. Estimate node sizes from label text + shape padding
//   2. Build dagre graph (nodes, edges, compound parents for subgraphs)
//   3. Run dagre.layout() synchronously
//   4. Extract positions back into our PositionedGraph format
//
// Dagre differences from ELK:
//   - Synchronous (no web worker / WASM)
//   - Node coords are center-based (converted to top-left via adapter)
//   - Edge points may not be orthogonal (post-processed via adapter)
//   - Compound nodes use setParent() instead of nested children JSON
//   - All coordinates are absolute (no container-relative offsets)
// ============================================================================

/** Default render options (layout-only — color defaults are in theme.ts) */
const DEFAULTS: Required<Pick<RenderOptions, 'font' | 'padding' | 'nodeSpacing' | 'layerSpacing'>> = {
  font: 'Inter',
  padding: 40,
  nodeSpacing: 24,
  layerSpacing: 40,
}

// ============================================================================
// Two-pass layout for subgraph direction overrides
//
// Dagre only supports a single global rankdir. When a subgraph has a different
// direction (e.g. `direction LR` inside a `graph TD`), we pre-compute its
// internal layout in a separate dagre pass, then inject the result as a
// fixed-size placeholder in the main layout.
// ============================================================================

/** Pre-computed layout data for a direction-overridden subgraph */
interface PreComputedSubgraph {
  id: string
  label: string
  /** Bounding box for the placeholder node in the main layout */
  width: number
  height: number
  /** Internal nodes positioned relative to (0,0) of the bounding box */
  nodes: PositionedNode[]
  /** Internal edges positioned relative to (0,0) of the bounding box */
  edges: PositionedEdge[]
  /** Nested subgroup boxes positioned relative to (0,0) */
  groups: PositionedGroup[]
  /** All node IDs contained in this subgraph */
  nodeIds: Set<string>
  /** Indices of edges in graph.edges[] that are internal to this subgraph */
  internalEdgeIndices: Set<number>
}

/**
 * Pre-compute the internal layout of a subgraph that has a direction override.
 *
 * Runs a separate dagre layout using the subgraph's direction as rankdir,
 * with only the subgraph's internal nodes and edges. Returns positioned
 * elements relative to a (0,0) origin, plus the overall bounding box.
 */
function preComputeSubgraphLayout(
  sg: MermaidSubgraph,
  graph: MermaidGraph,
  opts: Required<Pick<RenderOptions, 'font' | 'padding' | 'nodeSpacing' | 'layerSpacing'>>,
): PreComputedSubgraph {
  const subG = new dagre.graphlib.Graph({ directed: true, compound: true })
  subG.setGraph({
    rankdir: directionToDagre(sg.direction!),
    acyclicer: 'greedy',
    nodesep: opts.nodeSpacing,
    ranksep: opts.layerSpacing,
    // Tighter margins for subgraph internals — the parent group provides outer padding
    marginx: 16,
    marginy: 12,
  })
  subG.setDefaultEdgeLabel(() => ({}))

  // Collect all node IDs in this subgraph (including nested children)
  const nodeIds = new Set<string>()
  nodeIds.add(sg.id)
  collectSubgraphNodeIds(sg, nodeIds)

  // Add direct child nodes
  for (const nodeId of sg.nodeIds) {
    const node = graph.nodes.get(nodeId)
    if (node) {
      const size = estimateNodeSize(nodeId, node.label, node.shape)
      subG.setNode(nodeId, { label: node.label, width: size.width, height: size.height })
    }
  }

  // Add nested subgraphs as compound nodes (they keep the parent's direction)
  for (const child of sg.children) {
    addSubgraphToDagre(subG, child, graph)
  }

  // Identify and add internal edges (both endpoints inside this subgraph)
  const internalEdgeIndices = new Set<number>()
  for (let i = 0; i < graph.edges.length; i++) {
    const edge = graph.edges[i]!
    if (nodeIds.has(edge.source) && nodeIds.has(edge.target)) {
      internalEdgeIndices.add(i)
      const edgeLabel: Record<string, unknown> = { _index: i }
      if (edge.label) {
        edgeLabel.label = edge.label
        edgeLabel.width = estimateTextWidth(edge.label, FONT_SIZES.edgeLabel, FONT_WEIGHTS.edgeLabel) + 8
        edgeLabel.height = FONT_SIZES.edgeLabel + 6
        edgeLabel.labelpos = 'c'
      }
      subG.setEdge(edge.source, edge.target, edgeLabel)
    }
  }

  // Run layout on the isolated subgraph
  dagre.layout(subG)

  // Determine orthogonal bend direction for the overridden direction
  const verticalFirst = sg.direction === 'TD' || sg.direction === 'TB' || sg.direction === 'BT'

  // Build a set of subgraph IDs within this subgraph for node/group separation
  const nestedSubgraphIds = new Set<string>()
  for (const child of sg.children) {
    collectAllSubgraphIds(child, nestedSubgraphIds)
  }

  // Extract positioned nodes (skip nested subgraph compound nodes)
  const nodes: PositionedNode[] = []
  for (const nodeId of subG.nodes()) {
    if (nestedSubgraphIds.has(nodeId)) continue
    const mNode = graph.nodes.get(nodeId)
    if (!mNode) continue
    const dagreNode = subG.node(nodeId)
    if (!dagreNode) continue
    const topLeft = centerToTopLeft(dagreNode.x, dagreNode.y, dagreNode.width, dagreNode.height)
    nodes.push({
      id: nodeId,
      label: mNode.label,
      shape: mNode.shape,
      x: topLeft.x,
      y: topLeft.y,
      width: dagreNode.width,
      height: dagreNode.height,
      inlineStyle: resolveNodeStyle(graph, nodeId),
    })
  }

  // Extract positioned edges
  const edges: PositionedEdge[] = subG.edges().map(edgeObj => {
    const dagreEdge = subG.edge(edgeObj)
    const originalEdge = graph.edges[dagreEdge._index as number]!
    const rawPoints: Point[] = dagreEdge.points ?? []

    // Clip edge endpoints to non-rectangular shape boundaries.
    // Dagre computes endpoints on the rectangular bounding box, but diamonds
    // and circles are inscribed within the rectangle — endpoints float in the air.
    if (rawPoints.length > 0) {
      const srcShape = graph.nodes.get(edgeObj.v)?.shape
      if (srcShape === 'diamond') {
        const sn = subG.node(edgeObj.v)
        rawPoints[0] = clipToDiamondBoundary(rawPoints[0]!, sn.x, sn.y, sn.width / 2, sn.height / 2)
      } else if (srcShape && CIRCULAR_SHAPES.has(srcShape)) {
        const sn = subG.node(edgeObj.v)
        rawPoints[0] = clipToCircleBoundary(rawPoints[0]!, sn.x, sn.y, Math.min(sn.width, sn.height) / 2)
      }
      const tgtShape = graph.nodes.get(edgeObj.w)?.shape
      if (tgtShape === 'diamond') {
        const tn = subG.node(edgeObj.w)
        const last = rawPoints.length - 1
        rawPoints[last] = clipToDiamondBoundary(rawPoints[last]!, tn.x, tn.y, tn.width / 2, tn.height / 2)
      } else if (tgtShape && CIRCULAR_SHAPES.has(tgtShape)) {
        const tn = subG.node(edgeObj.w)
        const last = rawPoints.length - 1
        rawPoints[last] = clipToCircleBoundary(rawPoints[last]!, tn.x, tn.y, Math.min(tn.width, tn.height) / 2)
      }
    }

    const orthoPoints = snapToOrthogonal(rawPoints, verticalFirst)

    // Clip rectangular endpoints to the correct side after orthogonalization.
    // Non-rectangular shapes (diamond, circle) are already handled above.
    const srcShape = graph.nodes.get(edgeObj.v)?.shape
    const tgtShape = graph.nodes.get(edgeObj.w)?.shape
    const srcRect = (srcShape && !NON_RECT_SHAPES.has(srcShape)) || !srcShape
      ? (() => { const sn = subG.node(edgeObj.v); return sn ? { cx: sn.x, cy: sn.y, hw: sn.width / 2, hh: sn.height / 2 } : null })()
      : null
    const tgtRect = (tgtShape && !NON_RECT_SHAPES.has(tgtShape)) || !tgtShape
      ? (() => { const tn = subG.node(edgeObj.w); return tn ? { cx: tn.x, cy: tn.y, hw: tn.width / 2, hh: tn.height / 2 } : null })()
      : null
    const points = clipEndpointsToNodes(orthoPoints, srcRect, tgtRect)

    let labelPosition: Point | undefined
    if (originalEdge.label && dagreEdge.x != null && dagreEdge.y != null) {
      labelPosition = { x: dagreEdge.x, y: dagreEdge.y }
    }

    return {
      source: originalEdge.source,
      target: originalEdge.target,
      label: originalEdge.label,
      style: originalEdge.style,
      hasArrowStart: originalEdge.hasArrowStart,
      hasArrowEnd: originalEdge.hasArrowEnd,
      points,
      labelPosition,
      inlineStyle: originalEdge.inlineStyle,
    }
  })

  // Extract nested subgroup positions
  const groups: PositionedGroup[] = sg.children.map(child => extractGroup(subG, child))

  const graphInfo = subG.graph()
  return {
    id: sg.id,
    label: sg.label,
    width: graphInfo.width ?? 200,
    height: graphInfo.height ?? 100,
    nodes,
    edges,
    groups,
    nodeIds,
    internalEdgeIndices,
  }
}

/**
 * Lay out a parsed mermaid graph using dagre.
 * Returns a fully positioned graph ready for SVG rendering.
 *
 * Kept async for API compatibility — dagre itself is synchronous.
 */
export async function layoutGraph(
  graph: MermaidGraph,
  options: RenderOptions = {}
): Promise<PositionedGraph> {
  const opts = { ...DEFAULTS, ...options }

  // -------------------------------------------------------------------------
  // Phase 1: Pre-compute layouts for subgraphs with direction overrides.
  //
  // Dagre only supports a single global rankdir. Subgraphs with a different
  // direction (e.g. `direction LR` inside `graph TD`) get their own dagre
  // layout pass. The result is injected as a fixed-size placeholder in the
  // main layout, then composited back after positioning.
  // -------------------------------------------------------------------------
  const preComputed = new Map<string, PreComputedSubgraph>()
  for (const sg of graph.subgraphs) {
    if (sg.direction && sg.direction !== graph.direction) {
      preComputed.set(sg.id, preComputeSubgraphLayout(sg, graph, opts))
    }
  }

  // -------------------------------------------------------------------------
  // Phase 2: Build the main dagre graph.
  // Pre-computed subgraphs become fixed-size leaf nodes instead of compound nodes.
  // -------------------------------------------------------------------------
  const g = new dagre.graphlib.Graph({ directed: true, compound: true })
  g.setGraph({
    rankdir: directionToDagre(graph.direction),
    acyclicer: 'greedy',
    nodesep: opts.nodeSpacing,
    ranksep: opts.layerSpacing,
    marginx: opts.padding,
    marginy: opts.padding,
  })
  g.setDefaultEdgeLabel(() => ({}))

  // Collect node IDs that belong to subgraphs (to exclude from root level).
  // Also exclude the subgraph IDs themselves — in state diagrams, a composite
  // state like "Processing" exists as both a node (from transition references)
  // and a subgraph (from the composite definition). Without this exclusion,
  // dagre receives a duplicate node for the same ID.
  const subgraphNodeIds = new Set<string>()
  for (const sg of graph.subgraphs) {
    subgraphNodeIds.add(sg.id)
    collectSubgraphNodeIds(sg, subgraphNodeIds)
  }

  // Add top-level nodes (those not in any subgraph)
  for (const [id, node] of graph.nodes) {
    if (!subgraphNodeIds.has(id)) {
      const size = estimateNodeSize(id, node.label, node.shape)
      g.setNode(id, { label: node.label, width: size.width, height: size.height })
    }
  }

  // Add subgraph compound nodes and their children recursively.
  // Pre-computed subgraphs are added as fixed-size leaf nodes instead.
  for (const sg of graph.subgraphs) {
    if (preComputed.has(sg.id)) {
      const pc = preComputed.get(sg.id)!
      g.setNode(sg.id, { width: pc.width, height: pc.height })
    } else {
      addSubgraphToDagre(g, sg, graph)
    }
  }

  // Build redirect maps for edges that target/originate from compound nodes.
  // Dagre crashes when edges connect directly to compound parent nodes (known bug
  // in its ranking algorithm). Workaround: redirect edges to the first/last child
  // of the subgraph — "first" for incoming edges, "last" for outgoing.
  const subgraphEntryNode = new Map<string, string>()
  const subgraphExitNode = new Map<string, string>()
  for (const sg of graph.subgraphs) {
    if (!preComputed.has(sg.id)) {
      buildSubgraphRedirects(sg, subgraphEntryNode, subgraphExitNode)
    }
  }

  // For pre-computed subgraphs, redirect all internal node references to the
  // placeholder leaf node. External edges to/from internal nodes get routed
  // to the placeholder boundary; endpoints are fixed up after compositing.
  for (const [sgId, pc] of preComputed) {
    for (const nodeId of pc.nodeIds) {
      subgraphEntryNode.set(nodeId, sgId)
      subgraphExitNode.set(nodeId, sgId)
    }
  }

  // Add edges — skip internal edges of pre-computed subgraphs (handled by pre-computation).
  // Track cross-boundary edges for post-layout endpoint fixup.
  const allInternalIndices = new Set<number>()
  for (const pc of preComputed.values()) {
    for (const idx of pc.internalEdgeIndices) allInternalIndices.add(idx)
  }

  // Weight heuristic for stable rank ordering in cyclic graphs (e.g. state diagrams).
  //
  // Dagre's acyclicer reverses feedback edges to break cycles, but equal-weight edges
  // give the ranking algorithm freedom to collapse nodes onto the same rank.
  // Fix: "spine" edges (those that introduce a node as a target for the first time)
  // get higher weight, biasing dagre to keep them short (1 rank apart). Feedback
  // edges (target already introduced) keep default weight, allowing them to stretch.
  const introducedTargets = new Set<string>()

  for (let i = 0; i < graph.edges.length; i++) {
    if (allInternalIndices.has(i)) continue

    const edge = graph.edges[i]!
    const source = subgraphExitNode.get(edge.source) ?? edge.source
    const target = subgraphEntryNode.get(edge.target) ?? edge.target
    const edgeLabel: Record<string, unknown> = { _index: i }
    if (edge.label) {
      edgeLabel.label = edge.label
      edgeLabel.width = estimateTextWidth(edge.label, FONT_SIZES.edgeLabel, FONT_WEIGHTS.edgeLabel) + 8
      edgeLabel.height = FONT_SIZES.edgeLabel + 6
      edgeLabel.labelpos = 'c'
    }

    // Spine edges get higher weight to maintain sequential ordering
    if (!introducedTargets.has(target)) {
      edgeLabel.weight = 2
      introducedTargets.add(target)
    }

    g.setEdge(source, target, edgeLabel)
  }

  // -------------------------------------------------------------------------
  // Phase 3: Run synchronous layout — mutates g in place.
  // -------------------------------------------------------------------------
  try {
    dagre.layout(g)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`Dagre layout failed: ${message}`)
  }

  // -------------------------------------------------------------------------
  // Phase 4: Extract positions and compose pre-computed layouts.
  // -------------------------------------------------------------------------
  return extractPositionedGraph(g, graph, opts.padding, preComputed)
}

// ============================================================================
// Dagre graph construction helpers
// ============================================================================

/** Convert mermaid direction to dagre rankdir value */
function directionToDagre(dir: MermaidGraph['direction']): string {
  switch (dir) {
    case 'LR': return 'LR'
    case 'RL': return 'RL'
    case 'BT': return 'BT'
    case 'TD':
    case 'TB':
    default: return 'TB'
  }
}

/** Estimate node size based on label text + shape padding */
function estimateNodeSize(id: string, label: string, shape: string): { width: number; height: number } {
  const textWidth = estimateTextWidth(label, FONT_SIZES.nodeLabel, FONT_WEIGHTS.nodeLabel)

  let width = textWidth + NODE_PADDING.horizontal * 2
  let height = FONT_SIZES.nodeLabel + NODE_PADDING.vertical * 2

  // Diamonds need extra space because text is inside a rotated square
  if (shape === 'diamond') {
    const side = Math.max(width, height) + NODE_PADDING.diamondExtra
    width = side
    height = side
  }

  // Circles and double circles: bounding box must be square, diameter must fit text rect
  // For a rect (w x h) inscribed in a circle: diameter >= sqrt(w^2 + h^2)
  if (shape === 'circle' || shape === 'doublecircle') {
    const diameter = Math.ceil(Math.sqrt(width * width + height * height)) + 8
    width = shape === 'doublecircle' ? diameter + 12 : diameter
    height = width
  }

  // Hexagons need extra horizontal padding for the angled sides
  if (shape === 'hexagon') {
    width += NODE_PADDING.horizontal
  }

  // Trapezoids need extra horizontal padding for angled edges
  if (shape === 'trapezoid' || shape === 'trapezoid-alt') {
    width += NODE_PADDING.horizontal
  }

  // Asymmetric flag shape needs left padding for the pointed end
  if (shape === 'asymmetric') {
    width += 12
  }

  // Cylinder needs extra vertical space for the ellipse cap
  if (shape === 'cylinder') {
    height += 14
  }

  // State diagram pseudostates — small fixed-size circles
  if (shape === 'state-start' || shape === 'state-end') {
    width = 28
    height = 28
  }

  // Minimum sizes for aesthetics
  width = Math.max(width, 60)
  height = Math.max(height, 36)

  return { width, height }
}

/**
 * Recursively add a subgraph and its children to the dagre graph.
 *
 * Dagre compound nodes work via setParent(child, parent) — unlike ELK's
 * nested children[] JSON tree. We set padding on compound nodes so dagre
 * allocates space for children plus the subgraph header label.
 */
function addSubgraphToDagre(
  g: dagre.graphlib.Graph,
  sg: MermaidSubgraph,
  graph: MermaidGraph,
  parentId?: string,
): void {
  // Register the subgraph as a compound node.
  // Note: dagre ignores paddingX/paddingY/clusterLabelPos on compound nodes —
  // they're not in dagre's nodeNumAttrs. Header space is handled by post-processing
  // in extractPositionedGraph() via expandGroupsForHeaders().
  g.setNode(sg.id, { label: sg.label })

  // Set parent if this is a nested subgraph
  if (parentId) {
    g.setParent(sg.id, parentId)
  }

  // Add direct child nodes inside this subgraph
  for (const nodeId of sg.nodeIds) {
    const node = graph.nodes.get(nodeId)
    if (node) {
      const size = estimateNodeSize(nodeId, node.label, node.shape)
      g.setNode(nodeId, { label: node.label, width: size.width, height: size.height })
      g.setParent(nodeId, sg.id)
    }
  }

  // Add nested subgraphs recursively
  for (const child of sg.children) {
    addSubgraphToDagre(g, child, graph, sg.id)
  }
}

/**
 * Build redirect maps for subgraph entry/exit nodes.
 *
 * Dagre's ranking algorithm crashes when edges connect to compound parent nodes.
 * This maps each subgraph ID to its first child (entry) and last child (exit),
 * so edges targeting a subgraph get redirected to a real leaf node inside it.
 * Handles nested subgraphs by recursing into children.
 */
function buildSubgraphRedirects(
  sg: MermaidSubgraph,
  entryMap: Map<string, string>,
  exitMap: Map<string, string>,
): void {
  // Recurse into nested subgraphs FIRST so their entries are available
  // for transitive resolution when we set this subgraph's redirects.
  for (const child of sg.children) {
    buildSubgraphRedirects(child, entryMap, exitMap)
  }

  // Collect all direct child IDs (both leaf nodes and nested subgraphs)
  const childIds = [...sg.nodeIds, ...sg.children.map(c => c.id)]

  if (childIds.length === 0) {
    // Empty subgraph — no children to redirect to.
    // Dagre treats it as a regular node (no setParent calls) so edges
    // targeting it won't trigger the compound-node ranking crash.
    // Map it to itself so consumers of the redirect maps always get a result.
    entryMap.set(sg.id, sg.id)
    exitMap.set(sg.id, sg.id)
    return
  }

  // For nested subgraphs as entry/exit: resolve transitively to a leaf node
  const firstChild = childIds[0]!
  const lastChild = childIds[childIds.length - 1]!
  entryMap.set(sg.id, entryMap.get(firstChild) ?? firstChild)
  exitMap.set(sg.id, exitMap.get(lastChild) ?? lastChild)
}

/**
 * Resolve the final inline style for a node by merging classDef base styles
 * with any explicit `style` overrides. The renderer only reads inlineStyle,
 * so class-based styles must be folded in at construction time.
 */
function resolveNodeStyle(graph: MermaidGraph, nodeId: string): Record<string, string> | undefined {
  const className = graph.classAssignments.get(nodeId)
  const classProps = className ? graph.classDefs.get(className) : undefined
  const inlineProps = graph.nodeStyles.get(nodeId)
  if (!classProps && !inlineProps) return undefined
  // Class styles as base, explicit inline `style` overrides on top
  return { ...classProps, ...inlineProps }
}

/** Recursively collect all node IDs that belong to any subgraph */
function collectSubgraphNodeIds(sg: MermaidSubgraph, out: Set<string>): void {
  for (const id of sg.nodeIds) {
    out.add(id)
  }
  for (const child of sg.children) {
    collectSubgraphNodeIds(child, out)
  }
}

// ============================================================================
// Position extraction — convert dagre layout results to our PositionedGraph
// ============================================================================

function extractPositionedGraph(
  g: dagre.graphlib.Graph,
  graph: MermaidGraph,
  padding: number,
  preComputed?: Map<string, PreComputedSubgraph>,
): PositionedGraph {
  const nodes: PositionedNode[] = []
  const groups: PositionedGroup[] = []

  // Build a set of subgraph IDs for distinguishing compound nodes from leaf nodes
  const subgraphIds = new Set<string>()
  for (const sg of graph.subgraphs) {
    collectAllSubgraphIds(sg, subgraphIds)
  }

  // Collect all pre-computed internal node IDs (they're not in the dagre graph)
  const preComputedNodeIds = new Set<string>()
  if (preComputed) {
    for (const pc of preComputed.values()) {
      for (const nodeId of pc.nodeIds) preComputedNodeIds.add(nodeId)
    }
  }

  // Extract leaf nodes (non-subgraph nodes, non-pre-computed-internal nodes)
  for (const nodeId of g.nodes()) {
    if (subgraphIds.has(nodeId)) continue

    const mNode = graph.nodes.get(nodeId)
    if (!mNode) continue

    const dagreNode = g.node(nodeId)
    if (!dagreNode) continue

    const topLeft = centerToTopLeft(dagreNode.x, dagreNode.y, dagreNode.width, dagreNode.height)

    nodes.push({
      id: nodeId,
      label: mNode.label,
      shape: mNode.shape,
      x: topLeft.x,
      y: topLeft.y,
      width: dagreNode.width,
      height: dagreNode.height,
      inlineStyle: resolveNodeStyle(graph, nodeId),
    })
  }

  // Extract subgraph groups recursively from the original subgraph tree structure.
  // For pre-computed subgraphs, the dagre leaf node position provides the group box.
  for (const sg of graph.subgraphs) {
    groups.push(extractGroup(g, sg))
  }

  // Vertical-first bends for TD/BT layouts; horizontal-first for LR/RL
  const verticalFirst = graph.direction === 'TD' || graph.direction === 'TB' || graph.direction === 'BT'

  // Extract edges — dagre gives us flat points arrays (no sections/container offsets)
  const edges: PositionedEdge[] = g.edges().map(edgeObj => {
    const dagreEdge = g.edge(edgeObj)
    // Retrieve the original edge index stored during graph construction
    const originalEdge = graph.edges[dagreEdge._index as number]!
    const rawPoints: Point[] = dagreEdge.points ?? []

    // Clip edge endpoints to non-rectangular shape boundaries.
    // Dagre computes endpoints on the rectangular bounding box, but diamonds
    // and circles are inscribed within the rectangle — endpoints float in the air.
    if (rawPoints.length > 0) {
      const srcShape = graph.nodes.get(edgeObj.v)?.shape
      if (srcShape === 'diamond') {
        const sn = g.node(edgeObj.v)
        rawPoints[0] = clipToDiamondBoundary(rawPoints[0]!, sn.x, sn.y, sn.width / 2, sn.height / 2)
      } else if (srcShape && CIRCULAR_SHAPES.has(srcShape)) {
        const sn = g.node(edgeObj.v)
        rawPoints[0] = clipToCircleBoundary(rawPoints[0]!, sn.x, sn.y, Math.min(sn.width, sn.height) / 2)
      }
      const tgtShape = graph.nodes.get(edgeObj.w)?.shape
      if (tgtShape === 'diamond') {
        const tn = g.node(edgeObj.w)
        const last = rawPoints.length - 1
        rawPoints[last] = clipToDiamondBoundary(rawPoints[last]!, tn.x, tn.y, tn.width / 2, tn.height / 2)
      } else if (tgtShape && CIRCULAR_SHAPES.has(tgtShape)) {
        const tn = g.node(edgeObj.w)
        const last = rawPoints.length - 1
        rawPoints[last] = clipToCircleBoundary(rawPoints[last]!, tn.x, tn.y, Math.min(tn.width, tn.height) / 2)
      }
    }

    // Post-process to orthogonal segments (direction-aware bend order)
    const orthoPoints = snapToOrthogonal(rawPoints, verticalFirst)

    // Clip rectangular endpoints to the correct side after orthogonalization.
    // Non-rectangular shapes (diamond, circle) are already handled above.
    const srcShapeForClip = graph.nodes.get(edgeObj.v)?.shape
    const tgtShapeForClip = graph.nodes.get(edgeObj.w)?.shape
    const srcRect = (srcShapeForClip && !NON_RECT_SHAPES.has(srcShapeForClip)) || !srcShapeForClip
      ? (() => { const sn = g.node(edgeObj.v); return sn ? { cx: sn.x, cy: sn.y, hw: sn.width / 2, hh: sn.height / 2 } : null })()
      : null
    const tgtRect = (tgtShapeForClip && !NON_RECT_SHAPES.has(tgtShapeForClip)) || !tgtShapeForClip
      ? (() => { const tn = g.node(edgeObj.w); return tn ? { cx: tn.x, cy: tn.y, hw: tn.width / 2, hh: tn.height / 2 } : null })()
      : null
    const points = clipEndpointsToNodes(orthoPoints, srcRect, tgtRect)

    // Dagre returns edge label center position directly as edge.x, edge.y
    let labelPosition: Point | undefined
    if (originalEdge.label && dagreEdge.x != null && dagreEdge.y != null) {
      labelPosition = { x: dagreEdge.x, y: dagreEdge.y }
    }

    return {
      source: originalEdge.source,
      target: originalEdge.target,
      label: originalEdge.label,
      style: originalEdge.style,
      hasArrowStart: originalEdge.hasArrowStart,
      hasArrowEnd: originalEdge.hasArrowEnd,
      points,
      labelPosition,
      inlineStyle: originalEdge.inlineStyle,
    }
  })

  // ---------------------------------------------------------------------------
  // Compose pre-computed subgraph layouts into the main layout.
  //
  // The main dagre graph positioned each pre-computed subgraph as a leaf node.
  // Now we inject the internal elements at the correct offset and fix cross-
  // boundary edge endpoints so they connect to actual internal nodes.
  // ---------------------------------------------------------------------------
  if (preComputed && preComputed.size > 0) {
    // Build a map of all composed node positions for endpoint fixup
    const nodePositionMap = new Map<string, { cx: number; cy: number }>()
    for (const n of nodes) {
      nodePositionMap.set(n.id, { cx: n.x + n.width / 2, cy: n.y + n.height / 2 })
    }

    for (const [sgId, pc] of preComputed) {
      // Get the placeholder's position from dagre (center-based)
      const placeholder = g.node(sgId)
      if (!placeholder) continue
      const topLeft = centerToTopLeft(placeholder.x, placeholder.y, placeholder.width, placeholder.height)

      // Inject internal nodes at the correct offset
      for (const pcNode of pc.nodes) {
        const composed = {
          ...pcNode,
          x: pcNode.x + topLeft.x,
          y: pcNode.y + topLeft.y,
        }
        nodes.push(composed)
        nodePositionMap.set(composed.id, {
          cx: composed.x + composed.width / 2,
          cy: composed.y + composed.height / 2,
        })
      }

      // Inject internal edges at the correct offset
      for (const pcEdge of pc.edges) {
        edges.push({
          ...pcEdge,
          points: pcEdge.points.map(p => ({ x: p.x + topLeft.x, y: p.y + topLeft.y })),
          labelPosition: pcEdge.labelPosition
            ? { x: pcEdge.labelPosition.x + topLeft.x, y: pcEdge.labelPosition.y + topLeft.y }
            : undefined,
        })
      }

      // Update the group's nested children positions (from pre-computation)
      const group = findGroupById(groups, sgId)
      if (group && pc.groups.length > 0) {
        group.children = pc.groups.map(cg => offsetGroup(cg, topLeft.x, topLeft.y))
      }
    }

    // Fix cross-boundary edge endpoints.
    // Edges that originally connected to internal nodes were redirected to the
    // placeholder during main layout. Now replace the endpoint with the actual
    // composed node position and re-run orthogonal snapping.
    for (const edge of edges) {
      // Skip edges that are from pre-computed layouts (already correctly routed)
      if (preComputedNodeIds.has(edge.source) && preComputedNodeIds.has(edge.target)) continue

      let modified = false

      // Fix source endpoint — if the source is inside a pre-computed subgraph
      if (preComputedNodeIds.has(edge.source)) {
        const pos = nodePositionMap.get(edge.source)
        if (pos && edge.points.length > 0) {
          edge.points[0] = { x: pos.cx, y: pos.cy }
          modified = true
        }
      }

      // Fix target endpoint — if the target is inside a pre-computed subgraph
      if (preComputedNodeIds.has(edge.target)) {
        const pos = nodePositionMap.get(edge.target)
        if (pos && edge.points.length > 0) {
          edge.points[edge.points.length - 1] = { x: pos.cx, y: pos.cy }
          modified = true
        }
      }

      // Re-snap to orthogonal after modifying endpoints
      if (modified) {
        edge.points = snapToOrthogonal(edge.points, verticalFirst)
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Post-process: add header space to subgraph groups.
  //
  // Dagre's compound node bounds tightly wrap children — it ignores paddingX/paddingY
  // (those aren't in dagre's nodeNumAttrs). This means the subgraph header label
  // overlaps with the first child node.
  //
  // Fix: expand each labeled group upward by headerHeight so the header band
  // occupies its own space above the children. Process depth-first so child
  // expansions are incorporated before parent bounds are recalculated.
  // ---------------------------------------------------------------------------
  const headerHeight = FONT_SIZES.groupHeader + 16
  expandGroupsForHeaders(groups, headerHeight)

  // After expanding groups upward, some may extend above dagre's original margins.
  // Compute the global minimum Y and shift everything down uniformly if needed.
  const flatGroups = flattenAllGroups(groups)
  const allYs = [
    ...nodes.map(n => n.y),
    ...flatGroups.map(g => g.y),
  ]
  const currentMinY = allYs.length > 0 ? Math.min(...allYs) : padding
  let graphWidth = g.graph().width ?? 800
  let graphHeight = g.graph().height ?? 600

  if (currentMinY < padding) {
    const dy = padding - currentMinY
    for (const n of nodes) n.y += dy
    for (const e of edges) {
      for (const p of e.points) p.y += dy
      if (e.labelPosition) e.labelPosition.y += dy
    }
    for (const fg of flatGroups) fg.y += dy
    graphHeight += dy
  }

  // Also expand graph height if any group extends beyond the original bottom margin
  const maxBottom = Math.max(
    ...nodes.map(n => n.y + n.height),
    ...flatGroups.map(g => g.y + g.height),
    ...edges.flatMap(e => e.points.map(p => p.y)),
  )
  if (maxBottom + padding > graphHeight) {
    graphHeight = maxBottom + padding
  }

  return {
    width: graphWidth,
    height: graphHeight,
    nodes,
    edges,
    groups,
  }
}

/**
 * Extract a positioned group from a subgraph in the dagre layout.
 * Dagre gives compound nodes absolute coordinates (center-based),
 * so no container-relative offset math is needed.
 */
function extractGroup(
  g: dagre.graphlib.Graph,
  sg: MermaidSubgraph,
): PositionedGroup {
  const dagreNode = g.node(sg.id)
  const topLeft = dagreNode
    ? centerToTopLeft(dagreNode.x, dagreNode.y, dagreNode.width, dagreNode.height)
    : { x: 0, y: 0 }

  return {
    id: sg.id,
    label: sg.label,
    x: topLeft.x,
    y: topLeft.y,
    width: dagreNode?.width ?? 0,
    height: dagreNode?.height ?? 0,
    children: sg.children.map(child => extractGroup(g, child)),
  }
}

// ============================================================================
// Header space post-processing
//
// Dagre ignores paddingX/paddingY on compound nodes (not in nodeNumAttrs).
// These helpers expand group boxes upward to create space for header labels.
// ============================================================================

/**
 * Expand all groups upward to make room for header labels.
 * Processes depth-first so child expansions are accounted for when
 * parent bounds are recalculated.
 */
function expandGroupsForHeaders(groups: PositionedGroup[], headerHeight: number): void {
  for (const group of groups) {
    expandGroupForHeader(group, headerHeight)
  }
}

/**
 * Recursively expand a single group and its children for header space.
 *
 * Algorithm (depth-first):
 *   1. Expand all children first
 *   2. Re-fit this group's bounds to encompass any expanded children
 *   3. Expand this group upward by headerHeight for its own header
 */
function expandGroupForHeader(group: PositionedGroup, headerHeight: number): void {
  // Step 1: process children first
  for (const child of group.children) {
    expandGroupForHeader(child, headerHeight)
  }

  // Step 2: re-fit bounds to encompass expanded children.
  // After children expand upward, they may extend above this group's dagre-computed top.
  if (group.children.length > 0) {
    let minY = group.y
    let maxY = group.y + group.height
    for (const child of group.children) {
      minY = Math.min(minY, child.y)
      maxY = Math.max(maxY, child.y + child.height)
    }
    group.height = maxY - minY
    group.y = minY
  }

  // Step 3: expand upward for this group's own header band + content padding.
  // The content padding (GROUP_HEADER_CONTENT_PAD) creates a gap between the header
  // band bottom and the content area, preventing nested subgraph headers from being
  // flush against their parent's header band.
  if (group.label) {
    const expansion = headerHeight + GROUP_HEADER_CONTENT_PAD
    group.y -= expansion
    group.height += expansion
  }
}

/** Flatten a group tree into a flat array of all groups (including nested). */
function flattenAllGroups(groups: PositionedGroup[]): PositionedGroup[] {
  const result: PositionedGroup[] = []
  for (const g of groups) {
    result.push(g)
    result.push(...flattenAllGroups(g.children))
  }
  return result
}

/** Find a group by ID in a nested group tree (depth-first). */
function findGroupById(groups: PositionedGroup[], id: string): PositionedGroup | undefined {
  for (const g of groups) {
    if (g.id === id) return g
    const found = findGroupById(g.children, id)
    if (found) return found
  }
  return undefined
}

/** Create a copy of a positioned group with all positions offset by (dx, dy). */
function offsetGroup(group: PositionedGroup, dx: number, dy: number): PositionedGroup {
  return {
    ...group,
    x: group.x + dx,
    y: group.y + dy,
    children: group.children.map(c => offsetGroup(c, dx, dy)),
  }
}

/** Recursively collect all subgraph IDs (including nested) */
function collectAllSubgraphIds(sg: MermaidSubgraph, out: Set<string>): void {
  out.add(sg.id)
  for (const child of sg.children) {
    collectAllSubgraphIds(child, out)
  }
}
