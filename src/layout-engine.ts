/**
 * Layout engine for beautiful-mermaid (ELK.js based).
 *
 * Converts MermaidGraph to ELK's JSON format, runs layout, and converts
 * the result back to PositionedGraph. This is the core layout engine used
 * by all graph-based diagram types (flowcharts, state, ER, class).
 *
 * ELK (Eclipse Layout Kernel) features:
 *   - Native orthogonal edge routing (no post-processing needed)
 *   - Proper handling of compound nodes (subgraphs)
 *   - Support for disconnected graphs
 *   - Direction overrides per subgraph
 *   - Sophisticated algorithms for complex graphs
 *
 * Uses elk.bundled.js (pure synchronous JS, no WASM/Workers).
 * Safe for Electron, Node, and browser environments.
 */

import type { ElkNode, ElkExtendedEdge, LayoutOptions } from 'elkjs'
import type {
  MermaidGraph,
  MermaidSubgraph,
  MermaidEdge,
  Direction,
  PositionedGraph,
  PositionedNode,
  PositionedEdge,
  PositionedGroup,
  Point,
  RenderOptions,
} from './types.ts'
import { FONT_SIZES, FONT_WEIGHTS, NODE_PADDING, ARROW_HEAD } from './styles.ts'
import { measureMultilineText } from './text-metrics.ts'
import { elkLayoutSync } from './elk-instance.ts'
import { clipEdgeToShape } from './shape-clipping.ts'

// ============================================================================
// Layout options
// ============================================================================

/** Default render options (layout-only) */
const DEFAULTS = {
  font: 'Inter',
  padding: 40,
  nodeSpacing: 28,
  layerSpacing: 48,
  mergeEdges: true,
  thoroughness: 3,
} as const

/** Convert Mermaid direction to ELK direction */
function directionToElk(dir: MermaidGraph['direction']): string {
  switch (dir) {
    case 'LR': return 'RIGHT'
    case 'RL': return 'LEFT'
    case 'BT': return 'UP'
    case 'TD':
    case 'TB':
    default: return 'DOWN'
  }
}

// ============================================================================
// Node sizing (same logic as Dagre adapter)
// ============================================================================

function estimateNodeSize(id: string, label: string, shape: string): { width: number; height: number } {
  const metrics = measureMultilineText(label, FONT_SIZES.nodeLabel, FONT_WEIGHTS.nodeLabel)

  let width = metrics.width + NODE_PADDING.horizontal * 2
  let height = metrics.height + NODE_PADDING.vertical * 2

  if (shape === 'diamond') {
    const side = Math.max(width, height) + NODE_PADDING.diamondExtra
    width = side
    height = side
  }

  if (shape === 'circle' || shape === 'doublecircle') {
    const diameter = Math.ceil(Math.sqrt(width * width + height * height)) + 8
    width = shape === 'doublecircle' ? diameter + 12 : diameter
    height = width
  }

  if (shape === 'hexagon') {
    width += NODE_PADDING.horizontal
  }

  if (shape === 'trapezoid' || shape === 'trapezoid-alt') {
    width += NODE_PADDING.horizontal
  }

  if (shape === 'asymmetric') {
    width += 12
  }

  if (shape === 'cylinder') {
    height += 14
  }

  if (shape === 'state-start' || shape === 'state-end') {
    return { width: 28, height: 28 }
  }

  width = Math.max(width, 60)
  height = Math.max(height, 36)

  return { width, height }
}

// ============================================================================
// Graph conversion: MermaidGraph → ELK JSON
// ============================================================================

interface ElkGraphNode extends ElkNode {
  children?: ElkGraphNode[]
  edges?: ElkExtendedEdge[]
}

/**
 * Convert a MermaidGraph to ELK's nested JSON input format.
 *
 * The root node uses INCLUDE_CHILDREN so ELK lays out the whole graph as one
 * problem and routes cross-hierarchy edges natively. Subgraphs with their own
 * `direction` directive get SEPARATE_CHILDREN unless a cross-hierarchy edge
 * needs to cross their boundary (in which case ELK requires INCLUDE_CHILDREN
 * along the path — see computeSubgraphsNeedingSeparate / subgraphToElk).
 */
/**
 * Synthesis context: extra data the edge extractor needs to pick
 * direction-aware entry/exit sides when synthesizing the parts of a
 * cross-hierarchy edge polyline that ELK leaves empty.
 */
interface SynthesisContext {
  /** Edge index → port compounds and LCA. */
  edgePlanByIndex: Map<number, {
    sourcePortCompound: string | undefined
    targetPortCompound: string | undefined
    lca: string | undefined
  }>
  /** Subgraph id → subgraph (for direction lookups). */
  subgraphMap: Map<string, MermaidSubgraph>
  /** Root direction for fallback when no SEPARATE compound is on the path. */
  rootDirection: Direction
}

function mermaidToElk(
  graph: MermaidGraph,
  opts: Required<Pick<RenderOptions, 'font' | 'padding' | 'nodeSpacing' | 'layerSpacing'>>,
  outCtx?: SynthesisContext
): ElkGraphNode {
  // Collect all node IDs that belong to subgraphs
  const subgraphNodeIds = new Set<string>()
  const subgraphIds = new Set<string>()
  for (const sg of graph.subgraphs) {
    subgraphIds.add(sg.id)
    collectSubgraphNodeIds(sg, subgraphNodeIds, subgraphIds)
  }

  // Build node-to-subgraph mapping for edge distribution
  const nodeToSubgraph = buildNodeToSubgraphMap(graph.subgraphs)

  // Classify edges into three categories:
  // 1. Internal edges (both endpoints in same subgraph)
  // 2. Root-level edges (neither endpoint in a subgraph)
  // 3. Cross-hierarchy edges (endpoints in different levels)
  const edgesBySubgraph = new Map<string | null, Array<{ index: number; edge: typeof graph.edges[0] }>>()
  edgesBySubgraph.set(null, []) // Root-level edges

  // Cross-hierarchy edges have endpoints in different subgraph-levels.
  const crossHierarchyEdges: Array<{
    index: number
    edge: typeof graph.edges[0]
    sourceSubgraph: string | undefined
    targetSubgraph: string | undefined
  }> = []

  for (let i = 0; i < graph.edges.length; i++) {
    const edge = graph.edges[i]!
    const sourceSubgraph = nodeToSubgraph.get(edge.source)
    const targetSubgraph = nodeToSubgraph.get(edge.target)

    if (sourceSubgraph && sourceSubgraph === targetSubgraph) {
      // Internal edge: both endpoints in same subgraph
      if (!edgesBySubgraph.has(sourceSubgraph)) {
        edgesBySubgraph.set(sourceSubgraph, [])
      }
      edgesBySubgraph.get(sourceSubgraph)!.push({ index: i, edge })
    } else if (!sourceSubgraph && !targetSubgraph) {
      // Root-level edge: neither endpoint in a subgraph
      edgesBySubgraph.get(null)!.push({ index: i, edge })
    } else {
      // Cross-hierarchy edge: may need hierarchical ports (only when the
      // outermost SEPARATE_CHILDREN subgraph on the source/target path needs
      // them — see the port machinery below)
      crossHierarchyEdges.push({ index: i, edge, sourceSubgraph, targetSubgraph })
    }
  }

  // Hierarchy handling.
  //
  // The root always uses INCLUDE_CHILDREN so ELK lays out the whole graph as
  // one problem and routes cross-hierarchy edges natively. A subgraph with a
  // `direction` directive only needs SEPARATE_CHILDREN when its direction
  // actually differs from its effective parent — otherwise INCLUDE_CHILDREN
  // gives the same visual result and lets cross-hierarchy edges route freely.
  //
  // For subgraphs that DO need SEPARATE_CHILDREN, cross-hierarchy edges
  // crossing their boundary use ports with FIXED_SIDE constraints, with the
  // side picked from the direction (LR→west/east, TB→north/south, etc.).
  // The original code had ports without side constraints, which let ELK
  // scatter them across all four sides and inflate the subgraph's width.
  const subgraphParent = buildSubgraphParentMap(graph.subgraphs)
  const subgraphMap = buildSubgraphMap(graph.subgraphs)
  const subgraphsNeedingSeparate = computeSubgraphsNeedingSeparate(
    subgraphMap,
    subgraphParent,
    graph.direction
  )

  // ELK uses each cross-hierarchy edge's LCA (lowest common ancestor) as the
  // edge's coordinate-space origin, regardless of which level of the input
  // tree we declare the edge under. Declaring an edge at root level when its
  // LCA is some deep compound makes ELK return points in the LCA's local
  // space, which the recursive collector then can't offset correctly. Place
  // each edge at its LCA in the input so the recursive offset accumulator
  // picks it up at the right level.
  //
  // Port substitution is per-side: the boundary crossed on each side is the
  // OUTERMOST SEPARATE_CHILDREN subgraph between the leaf and the LCA
  // (exclusive of the LCA itself). When the LCA is itself SEPARATE, the
  // edge is internal to LCA's interior and no ports are needed.

  /**
   * Outermost SEPARATE_CHILDREN subgraph on the chain from `startId`
   * upward, stopping before reaching `stopAt` (exclusive). Returns
   * undefined when no SEPARATE compound sits in that range.
   */
  function outermostSeparateBetween(startId: string | undefined, stopAt: string | undefined): string | undefined {
    if (!startId) return undefined
    const chain: string[] = []
    let cursor: string | undefined = startId
    while (cursor !== undefined && cursor !== stopAt) {
      chain.push(cursor)
      cursor = subgraphParent.get(cursor)
    }
    for (let i = chain.length - 1; i >= 0; i--) {
      if (subgraphsNeedingSeparate.has(chain[i]!)) return chain[i]
    }
    return undefined
  }

  const subgraphPorts = new Map<string, Array<{
    portId: string
    edgeIndex: number
    direction: 'incoming' | 'outgoing'
    internalNodeId: string
    side: 'NORTH' | 'SOUTH' | 'EAST' | 'WEST'
  }>>()

  // Cross-hier edges placed at a subgraph's LCA — keyed by subgraph id.
  const lcaPlacedEdges = new Map<string, ElkExtendedEdge[]>()

  // Plan per cross-hier edge: where it lives, what its source/target IDs are,
  // plus the port compounds and LCA so the edge-extraction pass can pick
  // direction-aware entry/exit sides when synthesizing missing port→leaf
  // segments. (ELK doesn't route those when the leaf is buried inside an
  // INCLUDE_CHILDREN descendant of a SEPARATE_CHILDREN ancestor.)
  interface EdgePlan {
    index: number
    edge: typeof graph.edges[0]
    placeAt: string | undefined  // subgraph id or undefined for root
    sourceId: string  // either edge.source or a port id
    targetId: string  // either edge.target or a port id
    sourcePortCompound: string | undefined
    targetPortCompound: string | undefined
    lca: string | undefined
  }

  const edgePlans: EdgePlan[] = []
  for (const ce of crossHierarchyEdges) {
    const lca = lowestCommonAncestor(ce.sourceSubgraph, ce.targetSubgraph, subgraphParent)

    // If the LCA itself is SEPARATE, the edge is internal to LCA's interior;
    // the leaves are visible there directly so we don't need ports.
    if (lca !== undefined && subgraphsNeedingSeparate.has(lca)) {
      edgePlans.push({
        index: ce.index, edge: ce.edge, placeAt: lca,
        sourceId: ce.edge.source, targetId: ce.edge.target,
        sourcePortCompound: undefined, targetPortCompound: undefined, lca,
      })
      continue
    }

    const sourcePort = outermostSeparateBetween(ce.sourceSubgraph, lca)
    const targetPort = outermostSeparateBetween(ce.targetSubgraph, lca)

    if (sourcePort) {
      const sg = subgraphMap.get(sourcePort)!
      const side = portSideFor(sg.direction!, /*incoming=*/false)
      const portId = `${sourcePort}_out_${ce.index}`
      if (!subgraphPorts.has(sourcePort)) subgraphPorts.set(sourcePort, [])
      subgraphPorts.get(sourcePort)!.push({
        portId, edgeIndex: ce.index, direction: 'outgoing', internalNodeId: ce.edge.source, side,
      })
    }
    if (targetPort) {
      const sg = subgraphMap.get(targetPort)!
      const side = portSideFor(sg.direction!, /*incoming=*/true)
      const portId = `${targetPort}_in_${ce.index}`
      if (!subgraphPorts.has(targetPort)) subgraphPorts.set(targetPort, [])
      subgraphPorts.get(targetPort)!.push({
        portId, edgeIndex: ce.index, direction: 'incoming', internalNodeId: ce.edge.target, side,
      })
    }

    edgePlans.push({
      index: ce.index,
      edge: ce.edge,
      placeAt: lca,
      sourceId: sourcePort ? `${sourcePort}_out_${ce.index}` : ce.edge.source,
      targetId: targetPort ? `${targetPort}_in_${ce.index}` : ce.edge.target,
      sourcePortCompound: sourcePort,
      targetPortCompound: targetPort,
      lca,
    })
  }

  // Stash port-compound + LCA info on the synthesis context so the edge
  // extractor (in elkToPositioned) can pick direction-aware entry sides.
  if (outCtx) {
    outCtx.subgraphMap = subgraphMap
    outCtx.rootDirection = graph.direction
    for (const p of edgePlans) {
      outCtx.edgePlanByIndex.set(p.index, {
        sourcePortCompound: p.sourcePortCompound,
        targetPortCompound: p.targetPortCompound,
        lca: p.lca,
      })
    }
  }

  // Build the ELK edges from the plans now (before subgraphToElk runs) and
  // dispatch them to their containing compound. Edges with placeAt=undefined
  // get held aside for emission at root level after the root graph is built.
  const rootCrossHierEdges: ElkExtendedEdge[] = []
  for (const plan of edgePlans) {
    const elkEdge: ElkExtendedEdge = {
      id: `e${plan.index}`,
      sources: [plan.sourceId],
      targets: [plan.targetId],
    }
    if (plan.edge.label) {
      const metrics = measureMultilineText(plan.edge.label, FONT_SIZES.edgeLabel, FONT_WEIGHTS.edgeLabel)
      elkEdge.labels = [{
        text: plan.edge.label,
        width: metrics.width + 8,
        height: metrics.height + 6,
        layoutOptions: {
          'elk.edgeLabels.inline': 'true',
          'elk.edgeLabels.placement': 'CENTER',
        },
      }]
    }
    if (plan.placeAt === undefined) {
      rootCrossHierEdges.push(elkEdge)
    } else {
      if (!lcaPlacedEdges.has(plan.placeAt)) lcaPlacedEdges.set(plan.placeAt, [])
      lcaPlacedEdges.get(plan.placeAt)!.push(elkEdge)
    }
  }

  // Build the root ELK graph
  const elkGraph: ElkGraphNode = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': directionToElk(graph.direction),
      'elk.spacing.nodeNode': String(opts.nodeSpacing),
      'elk.layered.spacing.nodeNodeBetweenLayers': String(opts.layerSpacing),
      'elk.spacing.edgeEdge': '12',
      'elk.layered.spacing.edgeEdgeBetweenLayers': '12',
      'elk.layered.spacing.edgeNodeBetweenLayers': '12',
      'elk.padding': `[top=${opts.padding},left=${opts.padding},bottom=${opts.padding},right=${opts.padding}]`,
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.layered.nodePlacement.bk.fixedAlignment': 'BALANCED',
      'elk.contentAlignment': 'H_CENTER V_CENTER',
      'elk.layered.thoroughness': String(DEFAULTS.thoroughness),
      'elk.layered.highDegreeNodes.treatment': 'true',
      'elk.layered.highDegreeNodes.threshold': '8',
      'elk.layered.compaction.postCompaction.strategy': 'LEFT_RIGHT_CONSTRAINT_LOCKING',
      'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
      'elk.layered.wrapping.strategy': 'OFF',
      'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
    },
    children: [],
    edges: [],
  }

  // Add top-level nodes (those not in any subgraph)
  for (const [id, node] of graph.nodes) {
    if (!subgraphNodeIds.has(id) && !subgraphIds.has(id)) {
      const size = estimateNodeSize(id, node.label, node.shape)
      elkGraph.children!.push({
        id,
        width: size.width,
        height: size.height,
        labels: [{ text: node.label }],
      })
    }
  }

  // Add subgraphs as compound nodes with children and their internal edges
  for (const sg of graph.subgraphs) {
    elkGraph.children!.push(subgraphToElk(sg, graph, opts, edgesBySubgraph, subgraphPorts, subgraphsNeedingSeparate, subgraphParent, lcaPlacedEdges))
  }

  // Add root-level edges
  for (const { index, edge } of edgesBySubgraph.get(null)!) {
    const elkEdge: ElkExtendedEdge = {
      id: `e${index}`,
      sources: [edge.source],
      targets: [edge.target],
    }
    if (edge.label) {
      const metrics = measureMultilineText(edge.label, FONT_SIZES.edgeLabel, FONT_WEIGHTS.edgeLabel)
      elkEdge.labels = [{
        text: edge.label,
        width: metrics.width + 8,
        height: metrics.height + 6,
        layoutOptions: {
          'elk.edgeLabels.inline': 'true',
          'elk.edgeLabels.placement': 'CENTER',
        },
      }]
    }
    elkGraph.edges!.push(elkEdge)
  }

  // Cross-hierarchy edges whose LCA is root (already prepared in
  // rootCrossHierEdges) — emit them at the root level here.
  for (const e of rootCrossHierEdges) elkGraph.edges!.push(e)

  return elkGraph
}

/**
 * Convert a MermaidSubgraph to an ELK compound node.
 *
 * A subgraph in `subgraphsNeedingSeparate` (its direction differs from its
 * effective parent) gets SEPARATE_CHILDREN so ELK lays out its interior
 * independently and applies the direction. Cross-hierarchy edges crossing
 * such a subgraph are routed through ports with FIXED_SIDE constraints
 * (built up in `subgraphPorts`); edges inside the subgraph that connect a
 * port to a leaf node are emitted as internal segments here.
 *
 * Subgraphs whose direction matches the effective parent inherit
 * INCLUDE_CHILDREN from the root, which is fine — the visual result is the
 * same and cross-hierarchy edges flow through naturally.
 */
function subgraphToElk(
  sg: MermaidSubgraph,
  graph: MermaidGraph,
  opts: Required<Pick<RenderOptions, 'font' | 'padding' | 'nodeSpacing' | 'layerSpacing'>>,
  edgesBySubgraph: Map<string | null, Array<{ index: number; edge: MermaidEdge }>>,
  subgraphPorts: Map<string, Array<{
    portId: string
    edgeIndex: number
    direction: 'incoming' | 'outgoing'
    internalNodeId: string
    side: 'NORTH' | 'SOUTH' | 'EAST' | 'WEST'
  }>>,
  subgraphsNeedingSeparate: Set<string>,
  subgraphParent: Map<string, string | undefined>,
  lcaPlacedEdges: Map<string, ElkExtendedEdge[]>
): ElkGraphNode {
  const layoutOptions: LayoutOptions = {
    'elk.algorithm': 'layered',
    'elk.padding': '[top=44,left=16,bottom=16,right=16]', // Top = headerHeight(28) + gap(16) to match bottom padding
    'elk.edgeRouting': 'ORTHOGONAL',
    'elk.contentAlignment': 'H_CENTER V_CENTER',
    'elk.spacing.edgeEdge': '12',
    'elk.layered.spacing.edgeEdgeBetweenLayers': '12',
    'elk.layered.spacing.edgeNodeBetweenLayers': '12',
    'elk.layered.nodePlacement.bk.fixedAlignment': 'BALANCED',
    'elk.layered.spacing.nodeNodeBetweenLayers': String(opts.layerSpacing),
    'elk.spacing.nodeNode': String(opts.nodeSpacing),
  }

  // Apply direction override if specified
  if (sg.direction) {
    layoutOptions['elk.direction'] = directionToElk(sg.direction)
  }
  if (subgraphsNeedingSeparate.has(sg.id)) {
    layoutOptions['elk.hierarchyHandling'] = 'SEPARATE_CHILDREN'
    layoutOptions['elk.portConstraints'] = 'FIXED_SIDE'
  } else if (hasSeparateAncestor(sg.id, subgraphParent, subgraphsNeedingSeparate)) {
    // Override inherit-from-SEPARATE-parent so this subgraph's leaves flatten
    // up to its nearest SEPARATE ancestor's interior layout.
    layoutOptions['elk.hierarchyHandling'] = 'INCLUDE_CHILDREN'
  }
  // Else: leave hierarchyHandling unset and let it inherit from root
  // (INCLUDE_CHILDREN). Setting it explicitly when no SEPARATE compound is
  // anywhere in the ancestor chain confuses ELK's router on deeply-nested
  // diagrams (it produces edges with start/end points well outside the
  // source/target nodes).

  const elkNode: ElkGraphNode = {
    id: sg.id,
    layoutOptions,
    labels: sg.label ? [{ text: sg.label }] : undefined,
    children: [],
    edges: [],
  }

  // Emit ports declared in `subgraphPorts` with their fixed sides.
  const ports = subgraphPorts.get(sg.id) ?? []
  if (ports.length > 0) {
    (elkNode as unknown as Record<string, unknown>).ports = ports.map(p => ({
      id: p.portId,
      layoutOptions: { 'elk.port.side': p.side },
    }))
  }

  // Add direct child nodes
  for (const nodeId of sg.nodeIds) {
    const node = graph.nodes.get(nodeId)
    if (node) {
      const size = estimateNodeSize(nodeId, node.label, node.shape)
      elkNode.children!.push({
        id: nodeId,
        width: size.width,
        height: size.height,
        labels: [{ text: node.label }],
      })
    }
  }

  // Add nested subgraphs recursively
  for (const child of sg.children) {
    elkNode.children!.push(subgraphToElk(child, graph, opts, edgesBySubgraph, subgraphPorts, subgraphsNeedingSeparate, subgraphParent, lcaPlacedEdges))
  }

  // Add internal edges (edges where both endpoints are in this subgraph)
  const internalEdges = edgesBySubgraph.get(sg.id) ?? []
  for (const { index, edge } of internalEdges) {
    const elkEdge: ElkExtendedEdge = {
      id: `e${index}`,
      sources: [edge.source],
      targets: [edge.target],
    }
    if (edge.label) {
      const metrics = measureMultilineText(edge.label, FONT_SIZES.edgeLabel, FONT_WEIGHTS.edgeLabel)
      elkEdge.labels = [{
        text: edge.label,
        width: metrics.width + 8,
        height: metrics.height + 6,
        layoutOptions: {
          'elk.edgeLabels.inline': 'true',
          'elk.edgeLabels.placement': 'CENTER',
        },
      }]
    }
    elkNode.edges!.push(elkEdge)
  }

  // Internal edge segments connecting this subgraph's ports to its inner
  // nodes. For example, an incoming port `subgraph_in_3` carries the
  // external part of the edge up to the subgraph boundary; this internal
  // segment then continues from the port to the actual target node.
  for (const port of ports) {
    const internalEdgeId = `e${port.edgeIndex}_internal`
    const elkEdge: ElkExtendedEdge = port.direction === 'incoming'
      ? { id: internalEdgeId, sources: [port.portId], targets: [port.internalNodeId] }
      : { id: internalEdgeId, sources: [port.internalNodeId], targets: [port.portId] }
    elkNode.edges!.push(elkEdge)
  }

  // Cross-hierarchy edges whose LCA is this subgraph were placed here so
  // ELK uses this subgraph's coordinate system for them.
  const lcaEdges = lcaPlacedEdges.get(sg.id)
  if (lcaEdges) elkNode.edges!.push(...lcaEdges)

  return elkNode
}

/** Recursively collect all node IDs that belong to any subgraph */
function collectSubgraphNodeIds(sg: MermaidSubgraph, nodeIds: Set<string>, subgraphIds: Set<string>): void {
  for (const id of sg.nodeIds) {
    nodeIds.add(id)
  }
  for (const child of sg.children) {
    subgraphIds.add(child.id)
    collectSubgraphNodeIds(child, nodeIds, subgraphIds)
  }
}

/**
 * Build a mapping from subgraph ID to its parent subgraph ID
 * (or undefined when the subgraph is at the top level under root).
 */
function buildSubgraphParentMap(subgraphs: MermaidSubgraph[]): Map<string, string | undefined> {
  const map = new Map<string, string | undefined>()
  function traverse(sg: MermaidSubgraph, parentId: string | undefined): void {
    map.set(sg.id, parentId)
    for (const child of sg.children) traverse(child, sg.id)
  }
  for (const sg of subgraphs) traverse(sg, undefined)
  return map
}

/**
 * True when any ancestor of `sgId` is in `subgraphsNeedingSeparate`. Used to
 * decide whether a subgraph needs an explicit `INCLUDE_CHILDREN` to override
 * the SEPARATE_CHILDREN it would otherwise inherit from a SEPARATE ancestor.
 */
function hasSeparateAncestor(
  sgId: string,
  parentMap: Map<string, string | undefined>,
  subgraphsNeedingSeparate: Set<string>
): boolean {
  let cursor = parentMap.get(sgId)
  while (cursor !== undefined) {
    if (subgraphsNeedingSeparate.has(cursor)) return true
    cursor = parentMap.get(cursor)
  }
  return false
}

/**
 * Find the lowest common ancestor of two subgraphs in the parent chain.
 * Returns undefined when the LCA is the (implicit) root level — i.e. neither
 * chain shares a subgraph ancestor. Either argument can be undefined,
 * representing a node placed at the root level.
 */
function lowestCommonAncestor(
  a: string | undefined,
  b: string | undefined,
  parentMap: Map<string, string | undefined>
): string | undefined {
  if (a === undefined || b === undefined) return undefined
  const aChain = new Set<string>()
  let cursor: string | undefined = a
  while (cursor !== undefined) { aChain.add(cursor); cursor = parentMap.get(cursor) }
  cursor = b
  while (cursor !== undefined) {
    if (aChain.has(cursor)) return cursor
    cursor = parentMap.get(cursor)
  }
  return undefined
}

/** Build an id-keyed map of every subgraph (top-level and nested). */
function buildSubgraphMap(subgraphs: MermaidSubgraph[]): Map<string, MermaidSubgraph> {
  const map = new Map<string, MermaidSubgraph>()
  function index(sg: MermaidSubgraph): void {
    map.set(sg.id, sg)
    for (const child of sg.children) index(child)
  }
  for (const sg of subgraphs) index(sg)
  return map
}

/**
 * Compute which subgraphs need SEPARATE_CHILDREN. A subgraph needs it only
 * when its `direction` directive actually changes the flow axis relative to
 * its effective parent direction. A redundant `direction TB` inside a
 * `flowchart TB` parent does NOT need SEPARATE_CHILDREN — INCLUDE_CHILDREN
 * gives the same visual layout and lets cross-hierarchy edges route freely.
 *
 * Effective parent direction = the nearest ancestor subgraph's direction, or
 * the root direction if no ancestor sets one.
 */
function computeSubgraphsNeedingSeparate(
  subgraphMap: Map<string, MermaidSubgraph>,
  subgraphParent: Map<string, string | undefined>,
  rootDirection: Direction
): Set<string> {
  const result = new Set<string>()
  for (const [id, sg] of subgraphMap) {
    if (!sg.direction) continue
    let parentDir: Direction = rootDirection
    let cursor = subgraphParent.get(id)
    while (cursor !== undefined) {
      const parentSg = subgraphMap.get(cursor)
      if (parentSg?.direction) { parentDir = parentSg.direction; break }
      cursor = subgraphParent.get(cursor)
    }
    if (directionToElk(sg.direction) !== directionToElk(parentDir)) {
      result.add(id)
    }
  }
  return result
}

/**
 * Pick the side of a SEPARATE_CHILDREN subgraph for a port, based on the
 * subgraph's direction and whether the port is for an incoming or outgoing
 * cross-hierarchy edge. For LR flow, edges enter on the WEST side and leave
 * on the EAST side; for TB flow they enter NORTH and leave SOUTH; etc.
 */
function portSideFor(direction: Direction, incoming: boolean): 'NORTH' | 'SOUTH' | 'EAST' | 'WEST' {
  switch (direction) {
    case 'TD':
    case 'TB': return incoming ? 'NORTH' : 'SOUTH'
    case 'BT': return incoming ? 'SOUTH' : 'NORTH'
    case 'LR': return incoming ? 'WEST' : 'EAST'
    case 'RL': return incoming ? 'EAST' : 'WEST'
    default:   return incoming ? 'NORTH' : 'SOUTH'
  }
}

/**
 * Build a mapping from node ID to its containing subgraph ID.
 * For nested subgraphs, maps to the innermost containing subgraph.
 * Nodes not in any subgraph are not included in the map.
 */
function buildNodeToSubgraphMap(subgraphs: MermaidSubgraph[]): Map<string, string> {
  const map = new Map<string, string>()

  function traverse(sg: MermaidSubgraph): void {
    // Map all direct child nodes to this subgraph
    for (const nodeId of sg.nodeIds) {
      map.set(nodeId, sg.id)
    }
    // Recursively process nested subgraphs (they override parent mapping)
    for (const child of sg.children) {
      traverse(child)
    }
  }

  for (const sg of subgraphs) {
    traverse(sg)
  }

  return map
}

// ============================================================================
// Result conversion: ELK output → PositionedGraph
// ============================================================================

/** Margin routing info for cross-hierarchy edges */
interface MarginInfo {
  leftX: number
  rightX: number
}

/** Recursively flatten all group bounding boxes (including nested children) */
function flattenGroupBounds(groups: PositionedGroup[]): Array<{ x: number; y: number; right: number; bottom: number }> {
  const bounds: Array<{ x: number; y: number; right: number; bottom: number }> = []
  for (const g of groups) {
    bounds.push({ x: g.x, y: g.y, right: g.x + g.width, bottom: g.y + g.height })
    bounds.push(...flattenGroupBounds(g.children))
  }
  return bounds
}

function elkToPositioned(
  elkResult: ElkNode,
  graph: MermaidGraph,
  mergeEdges: boolean = false,
  synthesisCtx?: SynthesisContext
): PositionedGraph {
  const nodes: PositionedNode[] = []
  const edges: PositionedEdge[] = []
  const groups: PositionedGroup[] = []

  // Build set of subgraph IDs for distinguishing compound nodes from leaf nodes
  const subgraphIds = new Set<string>()
  for (const sg of graph.subgraphs) {
    collectAllSubgraphIds(sg, subgraphIds)
  }

  // Extract nodes and groups recursively. nodeParent maps each leaf node
  // to its immediate containing subgraph (or null for root) — used by
  // alignLayerNodes to keep cross-subgraph nodes from being clustered into
  // the same layer.
  const nodeParent = new Map<string, string | null>()
  extractNodesAndGroups(elkResult, graph, subgraphIds, nodes, groups, 0, 0, null, nodeParent)

  // Compute margin positions for cross-hierarchy edge routing.
  // Margins sit outside all group bounding boxes so edges don't cross through subgraphs.
  const allBounds = flattenGroupBounds(groups)
  const margins: MarginInfo | undefined = allBounds.length > 0
    ? {
        leftX: Math.min(...allBounds.map(b => b.x)) - 20,
        rightX: Math.max(...allBounds.map(b => b.right)) + 20,
      }
    : undefined

  // Build a node-id lookup so the edge extractor can synthesize segments
  // for any cross-hierarchy edge whose port→leaf internal section ELK left
  // empty (this happens when the leaf sits inside an INCLUDE_CHILDREN
  // descendant of a SEPARATE_CHILDREN ancestor — ELK only routes port→leaf
  // when the leaf is a direct child of the port-bearing subgraph).
  const nodeById = new Map(nodes.map(n => [n.id, n]))

  // Extract edges recursively from all levels (root and subgraphs)
  // Edges are distributed to subgraphs for direction override to work,
  // so we need to collect them from all children with proper offsets
  extractEdgesRecursively(elkResult, graph, edges, 0, 0, margins, nodeById, synthesisCtx)

  // Snap same-layer nodes to the same position along the flow axis.
  // ELK's orthogonal routing staggers nodes within a layer to create room for
  // edge bends, but this looks bad. We fix it by aligning layers, then let
  // edge bundling and clipping recalculate edge paths from corrected positions.
  alignLayerNodes(nodes, edges, graph.direction, nodeParent)

  // Bundle fan-out/fan-in edge paths into shared trunks when mergeEdges is enabled
  if (mergeEdges) {
    bundleEdgePaths(edges, nodes, groups, graph.direction)
  }

  // Apply shape-aware edge clipping for non-rectangular shapes.
  // ELK treats all nodes as rectangles, so we need to clip edge endpoints
  // to the actual shape boundaries (e.g., diamond vertices).
  const nodeMap = new Map(nodes.map(n => [n.id, n]))
  for (const edge of edges) {
    const sourceNode = nodeMap.get(edge.source)
    const targetNode = nodeMap.get(edge.target)

    if (sourceNode) {
      edge.points = clipEdgeToShape(edge.points, sourceNode, true)
    }
    if (targetNode) {
      edge.points = clipEdgeToShape(edge.points, targetNode, false)
    }
  }

  // Calculate final bounds including all edge points
  // ELK should include edges in its dimensions, but we verify and expand if needed
  let width = elkResult.width ?? 800
  let height = elkResult.height ?? 600
  const arrowMargin = ARROW_HEAD.width
  const padding = DEFAULTS.padding

  for (const edge of edges) {
    for (const p of edge.points) {
      width = Math.max(width, p.x + arrowMargin + padding)
      height = Math.max(height, p.y + arrowMargin + padding)
    }
    if (edge.labelPosition) {
      width = Math.max(width, edge.labelPosition.x + 60 + padding)
      height = Math.max(height, edge.labelPosition.y + 20 + padding)
    }
  }

  return {
    width,
    height,
    nodes,
    edges,
    groups,
  }
}

/**
 * Recursively extract positioned nodes and groups from ELK result.
 */
function extractNodesAndGroups(
  elkNode: ElkNode,
  graph: MermaidGraph,
  subgraphIds: Set<string>,
  nodes: PositionedNode[],
  groups: PositionedGroup[],
  offsetX: number,
  offsetY: number,
  parentSubgraphId: string | null,
  nodeParent: Map<string, string | null>
): void {
  if (!elkNode.children) return

  for (const child of elkNode.children) {
    const x = (child.x ?? 0) + offsetX
    const y = (child.y ?? 0) + offsetY
    const width = child.width ?? 0
    const height = child.height ?? 0

    if (subgraphIds.has(child.id)) {
      // This is a subgraph/group
      const childGroups: PositionedGroup[] = []

      // Recursively process children
      extractNodesAndGroups(child, graph, subgraphIds, nodes, childGroups, x, y, child.id, nodeParent)

      const mermaidSg = findSubgraph(graph.subgraphs, child.id)
      groups.push({
        id: child.id,
        label: mermaidSg?.label ?? '',
        x,
        y,
        width,
        height,
        children: childGroups,
      })
    } else {
      // This is a leaf node
      const mNode = graph.nodes.get(child.id)
      if (mNode) {
        // Resolve inline styles from nodeStyles map and classDefs
        const inlineStyle = resolveNodeStyle(child.id, graph)

        nodes.push({
          id: child.id,
          label: mNode.label,
          shape: mNode.shape,
          x,
          y,
          width,
          height,
          inlineStyle,
        })
        nodeParent.set(child.id, parentSubgraphId)
      }

      // Also check for nested children (shouldn't happen for leaf nodes, but be safe)
      if (child.children && child.children.length > 0) {
        extractNodesAndGroups(child, graph, subgraphIds, nodes, groups, x, y, parentSubgraphId, nodeParent)
      }
    }
  }
}

/** Edge geometry extracted from one ElkExtendedEdge. */
interface EdgeSegment {
  edgeIndex: number
  points: Point[]
  labelPosition?: Point
}

/**
 * Calculate the midpoint along a polyline path.
 * Walks the path to find the point at half the total length.
 */
function calculatePathMidpoint(points: Point[]): Point {
  if (points.length === 0) return { x: 0, y: 0 }
  if (points.length === 1) return points[0]!

  // Calculate total length
  let totalLength = 0
  for (let i = 1; i < points.length; i++) {
    const dx = points[i]!.x - points[i - 1]!.x
    const dy = points[i]!.y - points[i - 1]!.y
    totalLength += Math.sqrt(dx * dx + dy * dy)
  }

  // Walk to halfway point
  let remaining = totalLength / 2
  for (let i = 1; i < points.length; i++) {
    const dx = points[i]!.x - points[i - 1]!.x
    const dy = points[i]!.y - points[i - 1]!.y
    const segLen = Math.sqrt(dx * dx + dy * dy)
    if (remaining <= segLen) {
      const t = remaining / segLen
      return {
        x: points[i - 1]!.x + t * dx,
        y: points[i - 1]!.y + t * dy,
      }
    }
    remaining -= segLen
  }

  return points[points.length - 1]!
}

/**
 * Walk the ELK result and produce a PositionedEdge for every edge in the graph.
 *
 * Cross-hierarchy edges that traverse a SEPARATE_CHILDREN subgraph's port are
 * split by ELK into an external segment (`e{n}`) plus internal segments
 * (`e{n}_internal`) inside each subgraph on the path. Concatenate the
 * segments in source-to-target order to produce the final polyline.
 */
function extractEdgesRecursively(
  elkNode: ElkNode,
  graph: MermaidGraph,
  edges: PositionedEdge[],
  offsetX: number,
  offsetY: number,
  margins?: MarginInfo,
  nodeById?: Map<string, PositionedNode>,
  synthesisCtx?: SynthesisContext
): void {
  // First pass: collect all edge segments
  const segments = new Map<number, { external?: EdgeSegment; incoming?: EdgeSegment; outgoing?: EdgeSegment }>()
  collectEdgeSegments(elkNode, segments, 0, 0)

  // Track margin-routed edge count for spacing offsets
  let marginEdgeIndex = 0

  // Second pass: combine segments and create positioned edges
  for (const [edgeIndex, seg] of segments) {
    const originalEdge = graph.edges[edgeIndex]
    if (!originalEdge) continue

    // Combine points from all segments in correct order:
    // - For incoming cross-hierarchy (external → subgraph): external then incoming
    // - For outgoing cross-hierarchy (subgraph → external): outgoing then external
    // - For both (subgraph A → subgraph B): outgoing → external → incoming
    const allPoints: Point[] = []

    // First: outgoing internal segment (source node → exit port)
    if (seg.outgoing && seg.outgoing.points.length > 0) {
      allPoints.push(...seg.outgoing.points)
    }

    // Second: external segment (exit port → entry port, or source → entry port, or exit port → target)
    if (seg.external && seg.external.points.length > 0) {
      if (allPoints.length > 0) {
        // Skip first point to avoid duplicate at outgoing port
        allPoints.push(...seg.external.points.slice(1))
      } else {
        allPoints.push(...seg.external.points)
      }
    }

    // Third: incoming internal segment (entry port → target node)
    if (seg.incoming && seg.incoming.points.length > 0) {
      if (allPoints.length > 0) {
        // Skip first point to avoid duplicate at incoming port
        allPoints.push(...seg.incoming.points.slice(1))
      } else {
        allPoints.push(...seg.incoming.points)
      }
    }

    // Synthesis: ELK doesn't always route cross-hierarchy edges when one or
    // both endpoints sit inside an INCLUDE_CHILDREN descendant of a
    // SEPARATE_CHILDREN ancestor. Two cases to handle:
    //   1. Polyline ends short of the source/target node (port→leaf
    //      section was empty). Extend with a turn + entry/exit point.
    //   2. Polyline is empty entirely (ELK gave no sections at all).
    //      Synthesize the whole edge between the source and target nodes.
    //
    // Side picking is direction-aware: for a partial polyline whose missing
    // port→leaf segment is inside a SEPARATE_CHILDREN compound, the natural
    // entry/exit side matches the compound's flow direction (LR → WEST/EAST,
    // TB → NORTH/SOUTH). For an empty polyline whose LCA is a SEPARATE
    // compound (cousin pattern), the entry/exit sides are PERPENDICULAR to
    // the LCA's flow so the synthesized path doesn't run alongside the
    // sibling subgraphs' internal flow.
    if (nodeById) {
      const sourceNode = nodeById.get(originalEdge.source)
      const targetNode = nodeById.get(originalEdge.target)
      const plan = synthesisCtx?.edgePlanByIndex.get(edgeIndex)

      if (allPoints.length === 0 && sourceNode && targetNode) {
        const lcaDir = plan?.lca && synthesisCtx ? synthesisCtx.subgraphMap.get(plan.lca)?.direction : undefined
        const sides = pickSidesForEmptySynthesis(sourceNode, targetNode, lcaDir)
        const path = synthesizeFullPath(sourceNode, sides.exit, targetNode, sides.entry)
        allPoints.push(...path)
      } else if (allPoints.length > 0) {
        if (targetNode && !pointTouchesRectBoundary(allPoints[allPoints.length - 1]!, targetNode)) {
          const approach = allPoints[allPoints.length - 1]!
          const portCompoundDir = plan?.targetPortCompound && synthesisCtx ? synthesisCtx.subgraphMap.get(plan.targetPortCompound)?.direction : undefined
          const side = pickSideForPartialSynthesis(approach, targetNode, portCompoundDir, /*incoming=*/true)
          allPoints.push(...synthesizePartialEntry(approach, targetNode, side))
        }
        if (sourceNode && !pointTouchesRectBoundary(allPoints[0]!, sourceNode)) {
          const approach = allPoints[0]!
          const portCompoundDir = plan?.sourcePortCompound && synthesisCtx ? synthesisCtx.subgraphMap.get(plan.sourcePortCompound)?.direction : undefined
          const side = pickSideForPartialSynthesis(approach, sourceNode, portCompoundDir, /*incoming=*/false)
          allPoints.unshift(...synthesizePartialExit(sourceNode, side, approach))
        }
      }
    }

    // Label position: use ELK's inline label position (on-edge with collision avoidance)
    // Fall back to midpoint for hierarchical edges or when ELK position unavailable
    let labelPosition: Point | undefined
    if (originalEdge.label && allPoints.length >= 2) {
      const elkLabelPos = seg.external?.labelPosition
      labelPosition = elkLabelPos ?? calculatePathMidpoint(allPoints)
    }

    // Ensure all edge segments are orthogonal (horizontal or vertical only).
    // ELK occasionally produces diagonal segments for cross-hierarchy edges
    // (it returns only start/end points without intermediate bend points).
    // When margins are available, route through the diagram margins instead
    // of Z-paths through the middle (which cross through subgraphs).
    const orthogonalPoints = orthogonalizeEdgePoints(allPoints, margins, marginEdgeIndex)
    if (orthogonalPoints !== allPoints) {
      marginEdgeIndex++
    }

    // Recalculate label position for margin-routed edges
    if (originalEdge.label && orthogonalPoints !== allPoints && orthogonalPoints.length >= 2) {
      labelPosition = calculatePathMidpoint(orthogonalPoints)
    }

    edges.push({
      source: originalEdge.source,
      target: originalEdge.target,
      label: originalEdge.label,
      style: originalEdge.style,
      hasArrowStart: originalEdge.hasArrowStart,
      hasArrowEnd: originalEdge.hasArrowEnd,
      points: orthogonalPoints,
      labelPosition,
      inlineStyle: resolveEdgeStyle(edgeIndex, graph),
    })
  }
}

/**
 * Post-process edge points to ensure all segments are purely orthogonal.
 *
 * ELK occasionally produces cross-hierarchy edges with only start/end
 * coordinates (no intermediate bend points), which renders as a diagonal
 * line. (This was previously documented as specific to `SEPARATE` hierarchy
 * mode, but the same artifact can show up with the FIXED_SIDE port routing
 * the new layout uses.)
 *
 * When margins are provided, routes diagonal segments through the left or right
 * margin of the diagram (outside all subgraphs). Alternates sides and adds
 * spacing offsets to prevent overlapping parallel edges.
 *
 * Without margins, falls back to Z-path through the vertical midpoint.
 *
 * Returns the original array reference (identity) if no changes were needed,
 * so callers can detect whether routing was applied.
 */
function orthogonalizeEdgePoints(
  points: Point[],
  margins?: MarginInfo,
  edgeIndex: number = 0
): Point[] {
  if (points.length < 2) return points

  // Check if any segment needs orthogonalization
  let needsWork = false
  for (let i = 1; i < points.length; i++) {
    const dx = Math.abs(points[i]!.x - points[i - 1]!.x)
    const dy = Math.abs(points[i]!.y - points[i - 1]!.y)
    if (dx > 1 && dy > 1) { needsWork = true; break }
  }
  if (!needsWork) return points

  const EDGE_SPACING = 12
  const result: Point[] = [points[0]!]

  for (let i = 1; i < points.length; i++) {
    const prev = result[result.length - 1]!
    const curr = points[i]!
    const dx = Math.abs(curr.x - prev.x)
    const dy = Math.abs(curr.y - prev.y)

    if (dx > 1 && dy > 1) {
      if (margins) {
        // Margin routing: exit horizontally → travel vertically along margin → enter horizontally
        // Alternate left/right margins and offset for parallel edge spacing
        const useRight = edgeIndex % 2 === 0
        const offset = Math.floor(edgeIndex / 2) * EDGE_SPACING
        const marginX = useRight
          ? margins.rightX + offset
          : margins.leftX - offset

        result.push({ x: marginX, y: prev.y })
        result.push({ x: marginX, y: curr.y })
      } else {
        // Fallback: Z-path through vertical midpoint
        const midY = (prev.y + curr.y) / 2
        result.push({ x: prev.x, y: midY })
        result.push({ x: curr.x, y: midY })
      }
    }

    result.push(curr)
  }

  return result
}

/**
 * True when point `p` lies on (or within `tolerance` of) the rectangle's
 * boundary. The point's other coordinate must also be within the rectangle's
 * span on that axis (so a point above the rect doesn't count as "on top").
 */
function pointTouchesRectBoundary(
  p: Point,
  r: { x: number; y: number; width: number; height: number },
  tolerance = 5
): boolean {
  const onLeft   = Math.abs(p.x - r.x) < tolerance              && p.y >= r.y - tolerance && p.y <= r.y + r.height + tolerance
  const onRight  = Math.abs(p.x - (r.x + r.width)) < tolerance  && p.y >= r.y - tolerance && p.y <= r.y + r.height + tolerance
  const onTop    = Math.abs(p.y - r.y) < tolerance              && p.x >= r.x - tolerance && p.x <= r.x + r.width + tolerance
  const onBottom = Math.abs(p.y - (r.y + r.height)) < tolerance && p.x >= r.x - tolerance && p.x <= r.x + r.width + tolerance
  return onLeft || onRight || onTop || onBottom
}

/**
 * Pick the side of `node` whose midpoint is closest to `approach`. Used to
 * synthesize the entry/exit of a cross-hierarchy edge so its corner sits
 * inside the surrounding subgraph (giving a clean L-shape) rather than on
 * the subgraph's boundary (which would create a jagged path running along
 * the edge of the subgraph).
 */
function nearestSide(approach: Point, node: PositionedNode): 'NORTH' | 'SOUTH' | 'EAST' | 'WEST' {
  const distNorth = Math.abs(approach.y - node.y)
  const distSouth = Math.abs(approach.y - (node.y + node.height))
  const distWest  = Math.abs(approach.x - node.x)
  const distEast  = Math.abs(approach.x - (node.x + node.width))
  const min = Math.min(distNorth, distSouth, distWest, distEast)
  if (min === distNorth) return 'NORTH'
  if (min === distSouth) return 'SOUTH'
  if (min === distWest)  return 'WEST'
  return 'EAST'
}

/**
 * Compute a coordinate on the named side of the node's bounding box —
 * the midpoint of that side.
 */
function entryPointOnSide(node: PositionedNode, side: 'NORTH' | 'SOUTH' | 'EAST' | 'WEST'): Point {
  switch (side) {
    case 'WEST':  return { x: node.x,                   y: node.y + node.height / 2 }
    case 'EAST':  return { x: node.x + node.width,      y: node.y + node.height / 2 }
    case 'NORTH': return { x: node.x + node.width / 2,  y: node.y }
    case 'SOUTH': return { x: node.x + node.width / 2,  y: node.y + node.height }
  }
}

/**
 * Pick the entry/exit side for a partial-polyline synthesis (port→leaf or
 * leaf→port). When the port lives on a SEPARATE_CHILDREN compound with a
 * direction directive, prefer the side that matches that compound's flow
 * (LR → west/east, TB → north/south). Otherwise fall back to the side that
 * is geometrically closest to the approach point.
 */
function pickSideForPartialSynthesis(
  approach: Point,
  node: PositionedNode,
  portCompoundDirection: Direction | undefined,
  incoming: boolean
): 'NORTH' | 'SOUTH' | 'EAST' | 'WEST' {
  if (portCompoundDirection) return portSideFor(portCompoundDirection, incoming)
  return nearestSide(approach, node)
}

/**
 * Pick exit + entry sides for a fully-synthesized polyline (when ELK left
 * the edge with no sections at all). When the LCA is a SEPARATE_CHILDREN
 * compound with a direction, the path runs PERPENDICULAR to that direction
 * so it goes through the gap between the LCA's child compounds rather than
 * along their internal flow axis. Without an LCA direction, fall back to
 * dominant-axis offset between source and target.
 */
function pickSidesForEmptySynthesis(
  source: PositionedNode,
  target: PositionedNode,
  lcaDirection: Direction | undefined
): { exit: 'NORTH' | 'SOUTH' | 'EAST' | 'WEST'; entry: 'NORTH' | 'SOUTH' | 'EAST' | 'WEST' } {
  const sourceCenter = { x: source.x + source.width / 2, y: source.y + source.height / 2 }
  const targetCenter = { x: target.x + target.width / 2, y: target.y + target.height / 2 }
  const dx = targetCenter.x - sourceCenter.x
  const dy = targetCenter.y - sourceCenter.y

  if (lcaDirection === 'LR' || lcaDirection === 'RL') {
    // LR/RL flow → cross-sibling edges go perpendicular (vertical)
    const exit = dy >= 0 ? 'SOUTH' : 'NORTH'
    const entry = dy >= 0 ? 'NORTH' : 'SOUTH'
    return { exit, entry }
  }
  if (lcaDirection === 'TB' || lcaDirection === 'TD' || lcaDirection === 'BT') {
    // TB/BT flow → cross-sibling edges go perpendicular (horizontal)
    const exit = dx >= 0 ? 'EAST' : 'WEST'
    const entry = dx >= 0 ? 'WEST' : 'EAST'
    return { exit, entry }
  }
  // No LCA direction: pick dominant axis of source-target offset.
  if (Math.abs(dx) > Math.abs(dy)) {
    const exit = dx >= 0 ? 'EAST' : 'WEST'
    const entry = dx >= 0 ? 'WEST' : 'EAST'
    return { exit, entry }
  }
  const exit = dy >= 0 ? 'SOUTH' : 'NORTH'
  const entry = dy >= 0 ? 'NORTH' : 'SOUTH'
  return { exit, entry }
}

/**
 * Synthesize a Z-shaped path from `source` exiting on `exitSide` to
 * `target` entering on `entrySide`. The middle segment runs perpendicular
 * to both the exit and entry, in the gap between the two nodes.
 *
 * Layout depends on whether exit/entry are parallel (both vertical or both
 * horizontal) or perpendicular:
 *   - Both vertical (e.g. SOUTH→NORTH): exit↓ → midY → horizontal across →
 *     midY → entry↓. 4 points, 2 corners.
 *   - Both horizontal (e.g. EAST→WEST): exit→ → midX → vertical → midX →
 *     entry→. 4 points, 2 corners.
 *   - Perpendicular: a single L works, with the corner placed inside one
 *     of the source/target's rows so it doesn't run along an edge.
 */
function synthesizeFullPath(
  source: PositionedNode,
  exitSide: 'NORTH' | 'SOUTH' | 'EAST' | 'WEST',
  target: PositionedNode,
  entrySide: 'NORTH' | 'SOUTH' | 'EAST' | 'WEST'
): Point[] {
  const exit = entryPointOnSide(source, exitSide)
  const entry = entryPointOnSide(target, entrySide)
  const exitVertical = exitSide === 'NORTH' || exitSide === 'SOUTH'
  const entryVertical = entrySide === 'NORTH' || entrySide === 'SOUTH'

  if (exitVertical && entryVertical) {
    // Z: exit↓ → midY → horizontal → midY → entry↓
    const midY = (exit.y + entry.y) / 2
    return [exit, { x: exit.x, y: midY }, { x: entry.x, y: midY }, entry]
  }
  if (!exitVertical && !entryVertical) {
    // Z: exit→ → midX → vertical → midX → entry→
    const midX = (exit.x + entry.x) / 2
    return [exit, { x: midX, y: exit.y }, { x: midX, y: entry.y }, entry]
  }
  // Mixed (one vertical, one horizontal): single L. Corner is placed so the
  // final segment aligns with the entry side.
  const turn = entryVertical
    ? { x: entry.x, y: exit.y }   // last segment vertical → bend horizontally first
    : { x: exit.x, y: entry.y }   // last segment horizontal → bend vertically first
  return [exit, turn, entry]
}

/**
 * Number of pixels by which a partial-synthesis Z-shape steps inward from the
 * SEPARATE_CHILDREN compound's boundary before turning. Without this offset
 * the perpendicular segment of the Z would run along the compound's edge.
 */
const PARTIAL_SYNTHESIS_OFFSET = 12

/**
 * Synthesize a Z-shaped [step, turn, entry] sequence to extend an existing
 * polyline from `last` (which sits on a SEPARATE_CHILDREN compound's
 * boundary) to the chosen `side` of `target`. The step pulls the path away
 * from the compound's boundary so the perpendicular turn segment doesn't
 * run along that boundary.
 *
 * For WEST entry the path moves right by OFFSET first, then down/up to the
 * entry's y, then right to the entry. (Same idea, mirrored, for E/N/S.)
 */
function synthesizePartialEntry(last: Point, target: PositionedNode, side: 'NORTH' | 'SOUTH' | 'EAST' | 'WEST'): Point[] {
  const entry = entryPointOnSide(target, side)
  if (side === 'WEST' || side === 'EAST') {
    const stepX = last.x + (side === 'WEST' ? PARTIAL_SYNTHESIS_OFFSET : -PARTIAL_SYNTHESIS_OFFSET)
    return [{ x: stepX, y: last.y }, { x: stepX, y: entry.y }, entry]
  }
  const stepY = last.y + (side === 'NORTH' ? PARTIAL_SYNTHESIS_OFFSET : -PARTIAL_SYNTHESIS_OFFSET)
  return [{ x: last.x, y: stepY }, { x: entry.x, y: stepY }, entry]
}

/**
 * Mirror of synthesizePartialEntry for the source side.
 */
function synthesizePartialExit(source: PositionedNode, side: 'NORTH' | 'SOUTH' | 'EAST' | 'WEST', first: Point): Point[] {
  const exit = entryPointOnSide(source, side)
  if (side === 'WEST' || side === 'EAST') {
    const stepX = first.x + (side === 'WEST' ? PARTIAL_SYNTHESIS_OFFSET : -PARTIAL_SYNTHESIS_OFFSET)
    return [exit, { x: stepX, y: exit.y }, { x: stepX, y: first.y }]
  }
  const stepY = first.y + (side === 'NORTH' ? PARTIAL_SYNTHESIS_OFFSET : -PARTIAL_SYNTHESIS_OFFSET)
  return [exit, { x: exit.x, y: stepY }, { x: first.x, y: stepY }]
}

/**
 * Recursively collect edge segments from the ELK result.
 *
 * Edge IDs are either `e{index}` (external segment) or `e{index}_internal`
 * (internal segment inside a SEPARATE_CHILDREN subgraph). For internal
 * segments, the source/target ID encodes whether the segment goes from a
 * port to a node (incoming, source-side of a subgraph containing the target)
 * or from a node to a port (outgoing, source-side of a subgraph containing
 * the source). The segment combiner uses these to chain them together.
 */
function collectEdgeSegments(
  elkNode: ElkNode,
  segments: Map<number, { external?: EdgeSegment; outgoing?: EdgeSegment; incoming?: EdgeSegment }>,
  offsetX: number,
  offsetY: number
): void {
  if (elkNode.edges) {
    for (const elkEdge of elkNode.edges) {
      // Parse edge ID: "e{index}" or "e{index}_internal"
      const isInternal = elkEdge.id.endsWith('_internal')
      const edgeIndex = parseInt(elkEdge.id.substring(1), 10)
      if (isNaN(edgeIndex)) continue

      // Extract points
      const points: Point[] = []
      if (elkEdge.sections && elkEdge.sections.length > 0) {
        const section = elkEdge.sections[0]!
        points.push({
          x: section.startPoint.x + offsetX,
          y: section.startPoint.y + offsetY,
        })
        if (section.bendPoints) {
          for (const bp of section.bendPoints) {
            points.push({ x: bp.x + offsetX, y: bp.y + offsetY })
          }
        }
        points.push({
          x: section.endPoint.x + offsetX,
          y: section.endPoint.y + offsetY,
        })
      }

      // Extract label position
      let labelPosition: Point | undefined
      if (elkEdge.labels && elkEdge.labels.length > 0) {
        const label = elkEdge.labels[0]!
        if (label.x != null && label.y != null) {
          labelPosition = {
            x: label.x + (label.width ?? 0) / 2 + offsetX,
            y: label.y + (label.height ?? 0) / 2 + offsetY,
          }
        }
      }

      // Store segment
      if (!segments.has(edgeIndex)) {
        segments.set(edgeIndex, {})
      }
      const seg = segments.get(edgeIndex)!

      if (isInternal) {
        // Determine if this is an incoming or outgoing internal segment
        // by checking if source is a port (incoming) or target is a port (outgoing)
        const source = elkEdge.sources?.[0] ?? ''
        const target = elkEdge.targets?.[0] ?? ''
        const sourceIsPort = source.includes('_in_') || source.includes('_out_')
        const targetIsPort = target.includes('_in_') || target.includes('_out_')

        if (sourceIsPort) {
          // Port → node: incoming internal segment
          seg.incoming = { edgeIndex, points, labelPosition }
        } else if (targetIsPort) {
          // Node → port: outgoing internal segment
          seg.outgoing = { edgeIndex, points, labelPosition }
        }
      } else {
        seg.external = { edgeIndex, points, labelPosition }
      }
    }
  }

  // Recurse into children with accumulated offset
  if (elkNode.children) {
    for (const child of elkNode.children) {
      collectEdgeSegments(child, segments, offsetX + (child.x ?? 0), offsetY + (child.y ?? 0))
    }
  }
}

/** Find a subgraph by ID in a nested structure */
function findSubgraph(subgraphs: MermaidSubgraph[], id: string): MermaidSubgraph | undefined {
  for (const sg of subgraphs) {
    if (sg.id === id) return sg
    const found = findSubgraph(sg.children, id)
    if (found) return found
  }
  return undefined
}

/** Recursively collect all subgraph IDs */
function collectAllSubgraphIds(sg: MermaidSubgraph, out: Set<string>): void {
  out.add(sg.id)
  for (const child of sg.children) {
    collectAllSubgraphIds(child, out)
  }
}

/**
 * Resolve inline styles for a node from classDefs and nodeStyles.
 * Class styles are applied first, then explicit style directives override.
 */
function resolveNodeStyle(
  nodeId: string,
  graph: MermaidGraph
): Record<string, string> | undefined {
  let result: Record<string, string> | undefined

  // First, apply class styles (if node has a class assignment)
  const className = graph.classAssignments.get(nodeId)
  if (className) {
    const classDef = graph.classDefs.get(className)
    if (classDef) {
      result = { ...classDef }
    }
  }

  // Then, apply explicit style directives (override class styles)
  const nodeStyle = graph.nodeStyles.get(nodeId)
  if (nodeStyle) {
    result = result ? { ...result, ...nodeStyle } : { ...nodeStyle }
  }

  return result
}

/**
 * Resolve inline styles for an edge from linkStyles map.
 * Default link style is applied first, then index-specific overrides.
 */
function resolveEdgeStyle(
  edgeIndex: number,
  graph: MermaidGraph
): Record<string, string> | undefined {
  let result: Record<string, string> | undefined

  const defaultStyle = graph.linkStyles.get('default')
  if (defaultStyle) {
    result = { ...defaultStyle }
  }

  const indexStyle = graph.linkStyles.get(edgeIndex)
  if (indexStyle) {
    result = result ? { ...result, ...indexStyle } : { ...indexStyle }
  }

  return result
}

// ============================================================================
// Layer alignment — snap same-layer nodes to a uniform position
// ============================================================================

/**
 * ELK's orthogonal edge routing staggers nodes within the same layer to create
 * space for edge bends. This post-processing step groups nodes into layers and
 * snaps them to the same flow-axis coordinate (Y for TD/TB, X for LR/RL).
 *
 * Grouping uses proximity along the flow axis: within a layer, ELK's stagger
 * is always less than layerSpacing (bounded by edge routing channels), while
 * adjacent layers are separated by at least layerSpacing + nodeHeight.
 * A threshold of 0.75 * layerSpacing cleanly separates these cases.
 *
 * Directly connected nodes (sharing an edge) are never merged into the same
 * layer group as an additional safety check.
 *
 * Edge endpoints connected to shifted nodes are adjusted proportionally.
 * Intermediate bend points are left unchanged — edge bundling or clipping
 * will recalculate them afterwards.
 */
function alignLayerNodes(
  nodes: PositionedNode[],
  edges: PositionedEdge[],
  direction: Direction,
  nodeParent: Map<string, string | null>
): void {
  if (nodes.length === 0) return

  const isHorizontal = direction === 'LR' || direction === 'RL'

  // Build set of directly-connected node pairs.
  // Nodes connected by an edge must not be merged into the same layer.
  const connectedPairs = new Set<string>()
  for (const edge of edges) {
    connectedPairs.add(`${edge.source}:${edge.target}`)
    connectedPairs.add(`${edge.target}:${edge.source}`)
  }

  // ELK's stagger creates small gaps between adjacent nodes in the same layer
  // (typically edgeEdge spacing = 12px per routing channel). Adjacent layers
  // are separated by at least layerSpacing (48px). We use single-linkage
  // clustering: a node joins the current layer if the gap from the previous
  // node (in sorted order) is within threshold, AND it has no direct edge to
  // any node already in the layer, AND it shares the same containing
  // subgraph. The parent constraint stops clustering across subgraph
  // boundaries — ELK lays each subgraph out independently, so co-located
  // nodes in different subgraphs aren't really in the same layer, and
  // snapping them together can pull a node out of its parent's content area
  // (e.g. into the parent's heading bar).
  const THRESHOLD = DEFAULTS.layerSpacing * 0.6

  // Sort nodes by flow-axis position
  const sorted = [...nodes].sort((a, b) =>
    isHorizontal ? a.x - b.x : a.y - b.y
  )

  const layers: PositionedNode[][] = []
  let currentLayer: PositionedNode[] = [sorted[0]!]

  for (let i = 1; i < sorted.length; i++) {
    const pos = isHorizontal ? sorted[i]!.x : sorted[i]!.y
    const prevPos = isHorizontal ? sorted[i - 1]!.x : sorted[i - 1]!.y
    // Single-linkage: compare with previous node, not layer start
    const gap = pos - prevPos
    // Check if this node is connected to any node already in the current layer
    const hasEdgeToLayer = currentLayer.some(n =>
      connectedPairs.has(`${n.id}:${sorted[i]!.id}`)
    )
    // Check if this node shares its parent subgraph with the layer.
    const candidateParent = nodeParent.get(sorted[i]!.id) ?? null
    const sharesParent = currentLayer.every(n => (nodeParent.get(n.id) ?? null) === candidateParent)
    if (gap <= THRESHOLD && !hasEdgeToLayer && sharesParent) {
      currentLayer.push(sorted[i]!)
    } else {
      layers.push(currentLayer)
      currentLayer = [sorted[i]!]
    }
  }
  layers.push(currentLayer)

  // Snap each layer's nodes to the layer's center position
  const deltas = new Map<string, number>() // nodeId → shift amount

  for (const layer of layers) {
    if (layer.length <= 1) continue

    const positions = layer.map(n => isHorizontal ? n.x : n.y)
    const min = Math.min(...positions)
    const max = Math.max(...positions)
    if (max - min <= 1) continue // Already aligned

    // Use the center of the range as the snap target
    const target = (min + max) / 2

    for (const node of layer) {
      const oldPos = isHorizontal ? node.x : node.y
      const delta = target - oldPos
      if (Math.abs(delta) > 0.5) {
        if (isHorizontal) {
          node.x = target
        } else {
          node.y = target
        }
        deltas.set(node.id, delta)
      }
    }
  }

  if (deltas.size === 0) return

  // Build node lookup for edge adjustment
  const nodeMap = new Map(nodes.map(n => [n.id, n]))

  // Adjust edge endpoints to match shifted node positions
  for (const edge of edges) {
    if (edge.points.length < 2) continue

    const srcDelta = deltas.get(edge.source)
    const tgtDelta = deltas.get(edge.target)

    if (srcDelta != null) {
      // Shift first point and any subsequent points in the initial vertical/horizontal run
      const first = edge.points[0]!
      if (isHorizontal) {
        first.x += srcDelta
        // Shift second point if it's part of a straight vertical exit
        if (edge.points.length > 1 && edge.points[1]!.x === first.x - srcDelta) {
          edge.points[1]!.x += srcDelta
        }
      } else {
        first.y += srcDelta
        if (edge.points.length > 1 && edge.points[1]!.y === first.y - srcDelta) {
          edge.points[1]!.y += srcDelta
        }
      }
    }

    if (tgtDelta != null) {
      const last = edge.points[edge.points.length - 1]!
      if (isHorizontal) {
        last.x += tgtDelta
        if (edge.points.length > 1) {
          const prev = edge.points[edge.points.length - 2]!
          if (prev.x === last.x - tgtDelta) prev.x += tgtDelta
        }
      } else {
        last.y += tgtDelta
        if (edge.points.length > 1) {
          const prev = edge.points[edge.points.length - 2]!
          if (prev.y === last.y - tgtDelta) prev.y += tgtDelta
        }
      }
    }
  }
}

// ============================================================================
// Edge bundling — merge fan-out / fan-in edge paths into shared trunks
// ============================================================================

/**
 * Find all groups (outermost first) that geometrically contain the given point.
 */
function findGroupsContainingPoint(
  x: number, y: number,
  groups: PositionedGroup[]
): PositionedGroup[] {
  const result: PositionedGroup[] = []
  for (const g of groups) {
    if (x >= g.x && x <= g.x + g.width && y >= g.y && y <= g.y + g.height) {
      result.push(g)
      result.push(...findGroupsContainingPoint(x, y, g.children))
    }
  }
  return result
}

/**
 * If `junction` falls inside a group that doesn't contain the reference node,
 * move it just outside the outermost such group boundary.
 */
function adjustJunctionForGroups(
  junctionMain: number,  // the junction coordinate along the flow axis (Y for TD, X for LR)
  refX: number,          // reference node center X (for finding its groups)
  refY: number,          // reference node center Y
  groups: PositionedGroup[],
  direction: Direction
): number {
  const GAP = 12
  const isLR = direction === 'LR'
  const isRL = direction === 'RL'
  const isBT = direction === 'BT'
  const isHorizontal = isLR || isRL

  // Groups containing the reference node
  const refGroupIds = new Set(findGroupsContainingPoint(refX, refY, groups).map(g => g.id))

  // Check where the junction point would be along the trunk
  const probeX = isHorizontal ? junctionMain : refX
  const probeY = isHorizontal ? refY : junctionMain
  const junctionGroups = findGroupsContainingPoint(probeX, probeY, groups)

  // Find outermost group containing the junction but NOT the reference node
  const crossingGroup = junctionGroups.find(g => !refGroupIds.has(g.id))
  if (!crossingGroup) return junctionMain

  // Move junction just outside this group
  if (isLR) return crossingGroup.x - GAP
  if (isRL) return crossingGroup.x + crossingGroup.width + GAP
  if (isBT) return crossingGroup.y + crossingGroup.height + GAP
  return crossingGroup.y - GAP // TD
}

/**
 * Bundle fan-out and fan-in edge paths so they share a common trunk segment.
 *
 * For fan-out (one source → N targets), all edges exit the source at the same
 * point, travel along a shared trunk, then branch to their individual targets.
 * The overlapping trunk segments render as a single visible line.
 *
 * Junction points are placed outside subgraph boundaries so branches split
 * before entering a group, not inside it.
 *
 * Constraints: edges in a bundle must share the same style and have no labels.
 * Self-loops and backward edges (against the graph direction) are excluded.
 */
function bundleEdgePaths(
  edges: PositionedEdge[],
  nodes: PositionedNode[],
  groups: PositionedGroup[],
  direction: Direction
): void {
  const nodeMap = new Map(nodes.map(n => [n.id, n]))
  const processed = new Set<PositionedEdge>()

  const isLR = direction === 'LR'
  const isRL = direction === 'RL'
  const isBT = direction === 'BT'
  const isHorizontal = isLR || isRL

  // --- Fan-out: group edges by shared source ---
  const fanOutGroups = new Map<string, PositionedEdge[]>()
  for (const edge of edges) {
    if (edge.source === edge.target) continue
    if (!fanOutGroups.has(edge.source)) fanOutGroups.set(edge.source, [])
    fanOutGroups.get(edge.source)!.push(edge)
  }

  for (const [sourceId, group] of fanOutGroups) {
    if (group.length < 2) continue

    const style = group[0]!.style
    if (group.some(e => e.label || e.style !== style)) continue

    const source = nodeMap.get(sourceId)
    if (!source) continue

    // Only bundle edges going in the forward direction
    const forward = group.filter(e => {
      const t = nodeMap.get(e.target)
      if (!t) return false
      if (isLR) return t.x > source.x + source.width
      if (isRL) return t.x + t.width < source.x
      if (isBT) return t.y + t.height < source.y
      return t.y > source.y + source.height // TD/TB
    })
    if (forward.length < 2) continue

    const targets = forward.map(e => ({ edge: e, node: nodeMap.get(e.target)! }))
    const srcCX = source.x + source.width / 2
    const srcCY = source.y + source.height / 2

    if (isHorizontal) {
      const exitX = isLR ? source.x + source.width : source.x
      const exitY = srcCY

      const nearestX = isLR
        ? Math.min(...targets.map(t => t.node.x))
        : Math.max(...targets.map(t => t.node.x + t.node.width))
      let junctionX = exitX + (nearestX - exitX) / 2
      junctionX = adjustJunctionForGroups(junctionX, srcCX, srcCY, groups, direction)

      for (const { edge, node: target } of targets) {
        const entryX = isLR ? target.x : target.x + target.width
        const entryY = target.y + target.height / 2
        edge.points = [
          { x: exitX, y: exitY },
          { x: junctionX, y: exitY },
          { x: junctionX, y: entryY },
          { x: entryX, y: entryY },
        ]
        processed.add(edge)
      }
    } else {
      const exitX = srcCX
      const exitY = isBT ? source.y : source.y + source.height

      const nearestY = isBT
        ? Math.max(...targets.map(t => t.node.y + t.node.height))
        : Math.min(...targets.map(t => t.node.y))
      let junctionY = exitY + (nearestY - exitY) / 2
      junctionY = adjustJunctionForGroups(junctionY, srcCX, srcCY, groups, direction)

      for (const { edge, node: target } of targets) {
        const entryX = target.x + target.width / 2
        const entryY = isBT ? target.y + target.height : target.y
        edge.points = [
          { x: exitX, y: exitY },
          { x: exitX, y: junctionY },
          { x: entryX, y: junctionY },
          { x: entryX, y: entryY },
        ]
        processed.add(edge)
      }
    }
  }

  // --- Fan-in: group edges by shared target (skip already-bundled edges) ---
  const fanInGroups = new Map<string, PositionedEdge[]>()
  for (const edge of edges) {
    if (processed.has(edge) || edge.source === edge.target) continue
    if (!fanInGroups.has(edge.target)) fanInGroups.set(edge.target, [])
    fanInGroups.get(edge.target)!.push(edge)
  }

  for (const [targetId, group] of fanInGroups) {
    if (group.length < 2) continue

    const style = group[0]!.style
    if (group.some(e => e.label || e.style !== style)) continue

    const target = nodeMap.get(targetId)
    if (!target) continue

    const forward = group.filter(e => {
      const s = nodeMap.get(e.source)
      if (!s) return false
      if (isLR) return s.x + s.width < target.x
      if (isRL) return s.x > target.x + target.width
      if (isBT) return s.y > target.y + target.height
      return s.y + s.height < target.y // TD/TB
    })
    if (forward.length < 2) continue

    const sources = forward.map(e => ({ edge: e, node: nodeMap.get(e.source)! }))
    const tgtCX = target.x + target.width / 2
    const tgtCY = target.y + target.height / 2

    if (isHorizontal) {
      const entryX = isLR ? target.x : target.x + target.width
      const entryY = tgtCY

      const farthestX = isLR
        ? Math.max(...sources.map(s => s.node.x + s.node.width))
        : Math.min(...sources.map(s => s.node.x))
      let junctionX = farthestX + (entryX - farthestX) / 2
      junctionX = adjustJunctionForGroups(junctionX, tgtCX, tgtCY, groups, direction)

      for (const { edge, node: src } of sources) {
        const exitX = isLR ? src.x + src.width : src.x
        const exitY = src.y + src.height / 2
        edge.points = [
          { x: exitX, y: exitY },
          { x: junctionX, y: exitY },
          { x: junctionX, y: entryY },
          { x: entryX, y: entryY },
        ]
      }
    } else {
      const entryX = tgtCX
      const entryY = isBT ? target.y + target.height : target.y

      const farthestY = isBT
        ? Math.min(...sources.map(s => s.node.y))
        : Math.max(...sources.map(s => s.node.y + s.node.height))
      let junctionY = farthestY + (entryY - farthestY) / 2
      junctionY = adjustJunctionForGroups(junctionY, tgtCX, tgtCY, groups, direction)

      for (const { edge, node: src } of sources) {
        const exitX = src.x + src.width / 2
        const exitY = isBT ? src.y : src.y + src.height
        edge.points = [
          { x: exitX, y: exitY },
          { x: exitX, y: junctionY },
          { x: entryX, y: junctionY },
          { x: entryX, y: entryY },
        ]
      }
    }
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Lay out a parsed MermaidGraph using ELK.js (synchronous).
 * Returns a fully positioned graph ready for rendering.
 */
export function layoutGraphSync(
  graph: MermaidGraph,
  options: RenderOptions = {}
): PositionedGraph {
  const opts = { ...DEFAULTS, ...options }
  const synthesisCtx: SynthesisContext = {
    edgePlanByIndex: new Map(),
    subgraphMap: new Map(),
    rootDirection: graph.direction,
  }
  const elkGraph = mermaidToElk(graph, opts, synthesisCtx)
  const result = elkLayoutSync(elkGraph)
  return elkToPositioned(result, graph, DEFAULTS.mergeEdges, synthesisCtx)
}

/**
 * Convert MermaidGraph to ELK format (for benchmarking conversion overhead).
 */
export function convertToElkFormat(
  graph: MermaidGraph,
  options: RenderOptions = {}
): ElkNode {
  const opts = { ...DEFAULTS, ...options }
  return mermaidToElk(graph, opts)
}
