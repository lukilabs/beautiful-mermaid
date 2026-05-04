/**
 * Layout engine for beautiful-mermaid (ELK.js based).
 *
 * Architecture: lay out each subgraph independently so ELK fully respects
 * per-subgraph `direction` directives. Cross-hierarchy edges are not in the
 * ELK input — they are routed by a custom orthogonal router that runs after
 * ELK on the fully positioned graph, treating leaves and non-ancestor groups
 * as obstacles.
 *
 * Pipeline:
 *   mermaidToElk → elkLayoutSync → elkToPositioned → routeCrossHierEdges
 *   → clipEdgeToShape → return PositionedGraph.
 *
 * Why no `INCLUDE_CHILDREN` on the cross-hier path: that's the upstream
 * (mermaid-layout-elk) approach, but it drops direction enforcement on any
 * subgraph crossed by an external edge. Preserving direction in that case is
 * the property BM exists to provide.
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

const DEFAULTS = {
  font: 'Inter',
  padding: 40,
  nodeSpacing: 28,
  layerSpacing: 48,
  thoroughness: 3,
} as const

/** Convert Mermaid direction to ELK direction */
function directionToElk(dir: Direction): string {
  switch (dir) {
    case 'LR': return 'RIGHT'
    case 'RL': return 'LEFT'
    case 'BT': return 'UP'
    case 'TD':
    case 'TB':
    default: return 'DOWN'
  }
}

type Side = 'NORTH' | 'SOUTH' | 'EAST' | 'WEST'

/** Side an edge enters on, given the receiving compound's flow direction. */
function incomingSide(dir: Direction): Side {
  switch (dir) {
    case 'LR': return 'WEST'
    case 'RL': return 'EAST'
    case 'BT': return 'SOUTH'
    case 'TD':
    case 'TB':
    default:   return 'NORTH'
  }
}

/** Side an edge exits on, given the producing compound's flow direction. */
function outgoingSide(dir: Direction): Side {
  switch (dir) {
    case 'LR': return 'EAST'
    case 'RL': return 'WEST'
    case 'BT': return 'NORTH'
    case 'TD':
    case 'TB':
    default:   return 'SOUTH'
  }
}

// ============================================================================
// Node sizing
// ============================================================================

function estimateNodeSize(_id: string, label: string, shape: string): { width: number; height: number } {
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

  if (shape === 'hexagon') width += NODE_PADDING.horizontal
  if (shape === 'trapezoid' || shape === 'trapezoid-alt') width += NODE_PADDING.horizontal
  if (shape === 'asymmetric') width += 12
  if (shape === 'cylinder') height += 14
  if (shape === 'state-start' || shape === 'state-end') return { width: 28, height: 28 }

  width = Math.max(width, 60)
  height = Math.max(height, 36)

  return { width, height }
}

// ============================================================================
// Subgraph helpers
// ============================================================================

function collectSubgraphNodeIds(sg: MermaidSubgraph, nodeIds: Set<string>, subgraphIds: Set<string>): void {
  for (const id of sg.nodeIds) nodeIds.add(id)
  for (const child of sg.children) {
    subgraphIds.add(child.id)
    collectSubgraphNodeIds(child, nodeIds, subgraphIds)
  }
}

function collectAllSubgraphIds(sg: MermaidSubgraph, out: Set<string>): void {
  out.add(sg.id)
  for (const child of sg.children) collectAllSubgraphIds(child, out)
}

function findSubgraph(subgraphs: MermaidSubgraph[], id: string): MermaidSubgraph | undefined {
  for (const sg of subgraphs) {
    if (sg.id === id) return sg
    const found = findSubgraph(sg.children, id)
    if (found) return found
  }
  return undefined
}

/** Subgraph id → its parent subgraph id (or undefined for top-level under root). */
function buildSubgraphParentMap(subgraphs: MermaidSubgraph[]): Map<string, string | undefined> {
  const map = new Map<string, string | undefined>()
  function traverse(sg: MermaidSubgraph, parentId: string | undefined): void {
    map.set(sg.id, parentId)
    for (const child of sg.children) traverse(child, sg.id)
  }
  for (const sg of subgraphs) traverse(sg, undefined)
  return map
}

/** Id-keyed map of every subgraph (top-level and nested). */
function buildSubgraphMap(subgraphs: MermaidSubgraph[]): Map<string, MermaidSubgraph> {
  const map = new Map<string, MermaidSubgraph>()
  function index(sg: MermaidSubgraph): void {
    map.set(sg.id, sg)
    for (const child of sg.children) index(child)
  }
  for (const sg of subgraphs) index(sg)
  return map
}

/** Leaf node id → innermost containing subgraph id. Leaves not in any subgraph are absent. */
function buildNodeToSubgraphMap(subgraphs: MermaidSubgraph[]): Map<string, string> {
  const map = new Map<string, string>()
  function traverse(sg: MermaidSubgraph): void {
    for (const nodeId of sg.nodeIds) map.set(nodeId, sg.id)
    for (const child of sg.children) traverse(child)
  }
  for (const sg of subgraphs) traverse(sg)
  return map
}

/**
 * Lowest common ancestor of two subgraph ids in the subgraph parent chain.
 * Returns undefined when the LCA is the root level. Either argument can be
 * undefined, representing a node placed at the root.
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

/** Walk subgraph parent chain from `startId` upward (inclusive), top-most last. */
function ancestorChain(startId: string | undefined, parentMap: Map<string, string | undefined>): string[] {
  const chain: string[] = []
  let cursor: string | undefined = startId
  while (cursor !== undefined) { chain.push(cursor); cursor = parentMap.get(cursor) }
  return chain
}

/**
 * Compute which subgraphs need SEPARATE_CHILDREN. A subgraph needs it only
 * when its `direction` directive actually changes the flow axis relative to
 * its effective parent direction. A redundant `direction TB` inside a
 * `flowchart TB` parent does NOT — INCLUDE_CHILDREN inheritance gives the
 * same visual layout without adding a layer of padding.
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
 * Direct child of `lcaId` whose ancestor chain contains `descendantId`.
 * `descendantId` may itself be the direct child (returns it) or a deeper
 * descendant (returns the ancestor in the chain just below the LCA).
 * Returns undefined when descendantId is undefined or not a descendant.
 */
function directChildOfLca(
  lcaId: string | undefined,
  descendantId: string | undefined,
  parentMap: Map<string, string | undefined>
): string | undefined {
  if (descendantId === undefined) return undefined
  let cursor: string | undefined = descendantId
  let parent = parentMap.get(cursor)
  while (parent !== lcaId) {
    if (parent === undefined) return undefined
    cursor = parent
    parent = parentMap.get(cursor)
  }
  return cursor
}

// ============================================================================
// Step 1: Mermaid → ELK input
//
// Each subgraph with a `direction` directive becomes a SEPARATE_CHILDREN
// compound so ELK lays out its interior independently with that direction.
// Internal edges are placed in their owning compound's `edges` array.
// Cross-hierarchy edges are NOT in the ELK input. Optional stand-in edges
// at the LCA's level give ELK a hint for placement; their polylines are
// discarded during extraction.
// ============================================================================

interface ElkGraphNode extends ElkNode {
  children?: ElkGraphNode[]
  edges?: ElkExtendedEdge[]
}

interface CrossHierEdge {
  index: number
  edge: MermaidEdge
  sourceSubgraph: string | undefined
  targetSubgraph: string | undefined
}

interface MermaidToElkResult {
  elkGraph: ElkGraphNode
  crossHierEdges: CrossHierEdge[]
  /** ID prefix used for stand-in edges so the extractor can skip their polylines. */
  standInPrefix: string
}

function buildElkEdge(index: number, edge: MermaidEdge): ElkExtendedEdge {
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
  return elkEdge
}

function mermaidToElk(
  graph: MermaidGraph,
  opts: Required<Pick<RenderOptions, 'font' | 'padding' | 'nodeSpacing' | 'layerSpacing'>>
): MermaidToElkResult {
  // Collect subgraph metadata
  const subgraphNodeIds = new Set<string>()
  const subgraphIds = new Set<string>()
  for (const sg of graph.subgraphs) {
    subgraphIds.add(sg.id)
    collectSubgraphNodeIds(sg, subgraphNodeIds, subgraphIds)
  }
  const nodeToSubgraph = buildNodeToSubgraphMap(graph.subgraphs)
  const subgraphParent = buildSubgraphParentMap(graph.subgraphs)
  const subgraphMap = buildSubgraphMap(graph.subgraphs)
  const subgraphsNeedingSeparate = computeSubgraphsNeedingSeparate(subgraphMap, subgraphParent, graph.direction)

  // Classify edges
  const internalEdgesBySubgraph = new Map<string | null, Array<{ index: number; edge: MermaidEdge }>>()
  internalEdgesBySubgraph.set(null, [])
  const crossHierEdges: CrossHierEdge[] = []

  for (let i = 0; i < graph.edges.length; i++) {
    const edge = graph.edges[i]!
    const sourceSubgraph = nodeToSubgraph.get(edge.source)
    const targetSubgraph = nodeToSubgraph.get(edge.target)

    if (sourceSubgraph === targetSubgraph) {
      // Same subgraph (or both at root): internal
      const key = sourceSubgraph ?? null
      let arr = internalEdgesBySubgraph.get(key)
      if (!arr) { arr = []; internalEdgesBySubgraph.set(key, arr) }
      arr.push({ index: i, edge })
    } else {
      crossHierEdges.push({ index: i, edge, sourceSubgraph, targetSubgraph })
    }
  }

  // Stand-in edges: place a synthetic edge at the LCA's level between the
  // direct LCA-children that contain S and T. ELK uses these for layered
  // ordering — sibling compounds connected by stand-ins flow from one to the
  // other. The polyline is discarded in step [4]; we route the actual
  // cross-hier edge ourselves. Tagged so the extractor skips them.
  const standInPrefix = 'stand_e'
  const standInsBySubgraph = new Map<string | null, ElkExtendedEdge[]>()
  let standInCounter = 0
  for (const ce of crossHierEdges) {
    const lca = lowestCommonAncestor(ce.sourceSubgraph, ce.targetSubgraph, subgraphParent)
    const srcAnc = directChildOfLca(lca, ce.sourceSubgraph, subgraphParent) ?? ce.edge.source
    const tgtAnc = directChildOfLca(lca, ce.targetSubgraph, subgraphParent) ?? ce.edge.target
    if (srcAnc === tgtAnc) continue
    const key = lca ?? null
    let arr = standInsBySubgraph.get(key)
    if (!arr) { arr = []; standInsBySubgraph.set(key, arr) }
    arr.push({
      id: `${standInPrefix}${standInCounter++}`,
      sources: [srcAnc],
      targets: [tgtAnc],
    })
  }

  // Build root
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
      // INCLUDE_CHILDREN makes non-direction subgraphs flatten into the
      // root's layered layout — they inherit the root's direction. Direction-
      // having subgraphs override this with SEPARATE_CHILDREN so ELK lays
      // them out independently with their declared direction.
      'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
    },
    children: [],
    edges: [],
  }

  // Top-level leaves
  for (const [id, node] of graph.nodes) {
    if (!subgraphNodeIds.has(id) && !subgraphIds.has(id)) {
      const size = estimateNodeSize(id, node.label, node.shape)
      elkGraph.children!.push({
        id, width: size.width, height: size.height,
        labels: [{ text: node.label }],
      })
    }
  }

  // Subgraphs (recursive)
  for (const sg of graph.subgraphs) {
    elkGraph.children!.push(subgraphToElk(sg, graph, opts, internalEdgesBySubgraph, standInsBySubgraph, subgraphsNeedingSeparate))
  }

  // Root-level internal edges
  for (const { index, edge } of internalEdgesBySubgraph.get(null) ?? []) {
    elkGraph.edges!.push(buildElkEdge(index, edge))
  }
  // Root-level stand-in edges (LCA = root)
  for (const e of standInsBySubgraph.get(null) ?? []) {
    elkGraph.edges!.push(e)
  }

  return { elkGraph, crossHierEdges, standInPrefix }
}

function subgraphToElk(
  sg: MermaidSubgraph,
  graph: MermaidGraph,
  opts: Required<Pick<RenderOptions, 'font' | 'padding' | 'nodeSpacing' | 'layerSpacing'>>,
  internalEdgesBySubgraph: Map<string | null, Array<{ index: number; edge: MermaidEdge }>>,
  standInsBySubgraph: Map<string | null, ElkExtendedEdge[]>,
  subgraphsNeedingSeparate: Set<string>
): ElkGraphNode {
  const layoutOptions: LayoutOptions = {
    'elk.algorithm': 'layered',
    'elk.padding': '[top=44,left=16,bottom=16,right=16]',
    'elk.edgeRouting': 'ORTHOGONAL',
    'elk.contentAlignment': 'H_CENTER V_CENTER',
    'elk.spacing.edgeEdge': '12',
    'elk.layered.spacing.edgeEdgeBetweenLayers': '12',
    'elk.layered.spacing.edgeNodeBetweenLayers': '12',
    'elk.layered.nodePlacement.bk.fixedAlignment': 'BALANCED',
    'elk.layered.spacing.nodeNodeBetweenLayers': String(opts.layerSpacing),
    'elk.spacing.nodeNode': String(opts.nodeSpacing),
  }

  if (sg.direction) {
    layoutOptions['elk.direction'] = directionToElk(sg.direction)
  }
  if (subgraphsNeedingSeparate.has(sg.id)) {
    // SEPARATE_CHILDREN gives ELK licence to lay out this compound's interior
    // independently. Only set when this subgraph's direction actually differs
    // from its effective parent — same-direction nests don't need their own
    // layout problem and just add padding overhead.
    layoutOptions['elk.hierarchyHandling'] = 'SEPARATE_CHILDREN'
  }
  // Else: leave hierarchyHandling unset (inherits INCLUDE_CHILDREN from root).

  const elkNode: ElkGraphNode = {
    id: sg.id,
    layoutOptions,
    labels: sg.label ? [{ text: sg.label }] : undefined,
    children: [],
    edges: [],
  }

  for (const nodeId of sg.nodeIds) {
    const node = graph.nodes.get(nodeId)
    if (node) {
      const size = estimateNodeSize(nodeId, node.label, node.shape)
      elkNode.children!.push({
        id: nodeId, width: size.width, height: size.height,
        labels: [{ text: node.label }],
      })
    }
  }

  for (const child of sg.children) {
    elkNode.children!.push(subgraphToElk(child, graph, opts, internalEdgesBySubgraph, standInsBySubgraph, subgraphsNeedingSeparate))
  }

  for (const { index, edge } of internalEdgesBySubgraph.get(sg.id) ?? []) {
    elkNode.edges!.push(buildElkEdge(index, edge))
  }
  for (const e of standInsBySubgraph.get(sg.id) ?? []) {
    elkNode.edges!.push(e)
  }

  return elkNode
}

// ============================================================================
// Step 3: ELK output → PositionedGraph (nodes, groups, internal-edge polylines)
// ============================================================================

interface ExtractionResult {
  nodes: PositionedNode[]
  groups: PositionedGroup[]
  internalEdges: PositionedEdge[]
  /** Leaf id → innermost containing subgraph id (or null for root). */
  leafParent: Map<string, string | null>
  /** Subgraph id → parent subgraph id (or null for root). */
  groupParent: Map<string, string | null>
  /** Id → PositionedNode (leaves only). */
  nodeMap: Map<string, PositionedNode>
  /** Id → PositionedGroup (subgraphs only, flattened). */
  groupMap: Map<string, PositionedGroup>
}

function elkToExtraction(
  elkResult: ElkNode,
  graph: MermaidGraph,
  standInPrefix: string
): ExtractionResult {
  const nodes: PositionedNode[] = []
  const groups: PositionedGroup[] = []
  const internalEdges: PositionedEdge[] = []
  const leafParent = new Map<string, string | null>()
  const groupParent = new Map<string, string | null>()
  const nodeMap = new Map<string, PositionedNode>()
  const groupMap = new Map<string, PositionedGroup>()

  const subgraphIds = new Set<string>()
  for (const sg of graph.subgraphs) collectAllSubgraphIds(sg, subgraphIds)

  function walk(elkNode: ElkNode, offsetX: number, offsetY: number, parentSgId: string | null, outGroups: PositionedGroup[]): void {
    if (!elkNode.children) return
    for (const child of elkNode.children) {
      const x = (child.x ?? 0) + offsetX
      const y = (child.y ?? 0) + offsetY
      const w = child.width ?? 0
      const h = child.height ?? 0

      if (subgraphIds.has(child.id)) {
        const childGroups: PositionedGroup[] = []
        walk(child, x, y, child.id, childGroups)
        const mermaidSg = findSubgraph(graph.subgraphs, child.id)
        const g: PositionedGroup = {
          id: child.id,
          label: mermaidSg?.label ?? '',
          x, y, width: w, height: h,
          children: childGroups,
        }
        outGroups.push(g)
        groupMap.set(child.id, g)
        groupParent.set(child.id, parentSgId)
      } else {
        const mNode = graph.nodes.get(child.id)
        if (mNode) {
          const inlineStyle = resolveNodeStyle(child.id, graph)
          const n: PositionedNode = {
            id: child.id,
            label: mNode.label,
            shape: mNode.shape,
            x, y, width: w, height: h,
            inlineStyle,
          }
          nodes.push(n)
          nodeMap.set(child.id, n)
          leafParent.set(child.id, parentSgId)
        }
      }
    }
  }

  walk(elkResult, 0, 0, null, groups)

  // Collect internal-edge polylines from every nesting level (skip stand-ins).
  function collectEdges(elkNode: ElkNode, offsetX: number, offsetY: number): void {
    if (elkNode.edges) {
      for (const elkEdge of elkNode.edges) {
        if (elkEdge.id.startsWith(standInPrefix)) continue
        if (!elkEdge.id.startsWith('e')) continue
        const edgeIndex = parseInt(elkEdge.id.substring(1), 10)
        if (isNaN(edgeIndex)) continue
        const original = graph.edges[edgeIndex]
        if (!original) continue

        const points: Point[] = []
        let labelPos: Point | undefined
        if (elkEdge.sections && elkEdge.sections.length > 0) {
          const section = elkEdge.sections[0]!
          points.push({ x: section.startPoint.x + offsetX, y: section.startPoint.y + offsetY })
          if (section.bendPoints) {
            for (const bp of section.bendPoints) points.push({ x: bp.x + offsetX, y: bp.y + offsetY })
          }
          points.push({ x: section.endPoint.x + offsetX, y: section.endPoint.y + offsetY })
        }
        if (elkEdge.labels && elkEdge.labels.length > 0) {
          const label = elkEdge.labels[0]!
          if (label.x != null && label.y != null) {
            labelPos = {
              x: label.x + (label.width ?? 0) / 2 + offsetX,
              y: label.y + (label.height ?? 0) / 2 + offsetY,
            }
          }
        }
        if (points.length === 0) continue

        internalEdges.push({
          source: original.source,
          target: original.target,
          label: original.label,
          style: original.style,
          hasArrowStart: original.hasArrowStart,
          hasArrowEnd: original.hasArrowEnd,
          points,
          labelPosition: labelPos ?? (original.label ? calculatePathMidpoint(points) : undefined),
          inlineStyle: resolveEdgeStyle(edgeIndex, graph),
        })
      }
    }
    if (elkNode.children) {
      for (const child of elkNode.children) {
        collectEdges(child, offsetX + (child.x ?? 0), offsetY + (child.y ?? 0))
      }
    }
  }
  collectEdges(elkResult, 0, 0)

  return { nodes, groups, internalEdges, leafParent, groupParent, nodeMap, groupMap }
}

// ============================================================================
// Step 4: cross-hierarchy edge router
//
// For each cross-hier edge we pick exit/entry sides (direction-aware first,
// position-aware as fallback), build an L or Z initial polyline, then detour
// around obstacles (every leaf except S and T, and every group not on either
// endpoint's ancestor chain). After routing all edges individually, we
// allocate lanes so distinct edges don't share colinear segments.
// ============================================================================

interface Rect { x: number; y: number; width: number; height: number }
interface Obstacle { rect: Rect; id: string }

const DETOUR_MARGIN = 10
const MAX_DETOUR_DEPTH = 8
const COORD_EPSILON = 0.5

function entryPointOnSide(node: PositionedNode | Rect, side: Side): Point {
  switch (side) {
    case 'WEST':  return { x: node.x,                  y: node.y + node.height / 2 }
    case 'EAST':  return { x: node.x + node.width,     y: node.y + node.height / 2 }
    case 'NORTH': return { x: node.x + node.width / 2, y: node.y }
    case 'SOUTH': return { x: node.x + node.width / 2, y: node.y + node.height }
  }
}

interface RouterContext {
  nodeMap: Map<string, PositionedNode>
  groupMap: Map<string, PositionedGroup>
  leafParent: Map<string, string | null>
  groupParent: Map<string, string | null>
  subgraphMap: Map<string, MermaidSubgraph>
  rootDirection: Direction
  diagramBounds: Rect
}

/**
 * Pick the exit side for the source. The innermost ancestor of S that has a
 * `direction` directive determines the side (LR → EAST, etc.). Falls back to
 * the source-target offset when S has no directed ancestor.
 */
function pickExitSide(s: PositionedNode, t: PositionedNode, sourceChain: string[], ctx: RouterContext): Side {
  for (const sgId of sourceChain) {
    const sg = ctx.subgraphMap.get(sgId)
    if (sg?.direction) return outgoingSide(sg.direction)
  }
  const dx = (t.x + t.width / 2) - (s.x + s.width / 2)
  const dy = (t.y + t.height / 2) - (s.y + s.height / 2)
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'EAST' : 'WEST'
  return dy >= 0 ? 'SOUTH' : 'NORTH'
}

/** Mirror of pickExitSide for the target. */
function pickEntrySide(t: PositionedNode, s: PositionedNode, targetChain: string[], ctx: RouterContext): Side {
  for (const sgId of targetChain) {
    const sg = ctx.subgraphMap.get(sgId)
    if (sg?.direction) return incomingSide(sg.direction)
  }
  const dx = (t.x + t.width / 2) - (s.x + s.width / 2)
  const dy = (t.y + t.height / 2) - (s.y + s.height / 2)
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'WEST' : 'EAST'
  return dy >= 0 ? 'NORTH' : 'SOUTH'
}

/**
 * Initial polyline from `exit` (on `exitSide` of source) to `entry` (on
 * `entrySide` of target). Two parallel sides → Z. One vertical + one
 * horizontal → single-corner L. Two perpendicular but opposite-orientation
 * sides also produce a Z so the corner doesn't sit on the source/target's
 * boundary.
 */
function constructInitial(exit: Point, exitSide: Side, entry: Point, entrySide: Side): Point[] {
  const exitVertical = exitSide === 'NORTH' || exitSide === 'SOUTH'
  const entryVertical = entrySide === 'NORTH' || entrySide === 'SOUTH'

  if (exitVertical && entryVertical) {
    // Both vertical sides: degenerates to a straight line when the two
    // ports share the same x — the detour pass adds avoidance bumps.
    if (Math.abs(exit.x - entry.x) < COORD_EPSILON) return [exit, entry]
    const midY = (exit.y + entry.y) / 2
    return [exit, { x: exit.x, y: midY }, { x: entry.x, y: midY }, entry]
  }
  if (!exitVertical && !entryVertical) {
    // Both horizontal sides: degenerates to a straight line when ports
    // share the same y.
    if (Math.abs(exit.y - entry.y) < COORD_EPSILON) return [exit, entry]
    const midX = (exit.x + entry.x) / 2
    return [exit, { x: midX, y: exit.y }, { x: midX, y: entry.y }, entry]
  }
  const turn = entryVertical
    ? { x: entry.x, y: exit.y }
    : { x: exit.x, y: entry.y }
  return [exit, turn, entry]
}

/** Strict crossing: segment passes through the rect's interior. Touching a boundary doesn't count. */
function segmentCrossesRect(p1: Point, p2: Point, rect: Rect): boolean {
  const isHoriz = Math.abs(p1.y - p2.y) < COORD_EPSILON
  const isVert  = Math.abs(p1.x - p2.x) < COORD_EPSILON

  if (isHoriz) {
    const y = (p1.y + p2.y) / 2
    if (y <= rect.y + COORD_EPSILON || y >= rect.y + rect.height - COORD_EPSILON) return false
    const xMin = Math.min(p1.x, p2.x)
    const xMax = Math.max(p1.x, p2.x)
    return xMax > rect.x + COORD_EPSILON && xMin < rect.x + rect.width - COORD_EPSILON
  }
  if (isVert) {
    const x = (p1.x + p2.x) / 2
    if (x <= rect.x + COORD_EPSILON || x >= rect.x + rect.width - COORD_EPSILON) return false
    const yMin = Math.min(p1.y, p2.y)
    const yMax = Math.max(p1.y, p2.y)
    return yMax > rect.y + COORD_EPSILON && yMin < rect.y + rect.height - COORD_EPSILON
  }
  // Diagonal segments don't appear in our pipeline; treat conservatively.
  return false
}

/**
 * Detour around every obstacle that the segment polyline[idx]→polyline[idx+1]
 * crosses. Picks one elevation for the whole bridge so multiple obstacles in
 * the same row get one clean bump rather than a zigzag of independent
 * detours. Inserts four points (enter→up→across→down) covering the union of
 * all crossing obstacles.
 */
function detourAroundObstacles(polyline: Point[], idx: number, obstacles: Rect[], bounds: Rect): Point[] {
  const p1 = polyline[idx]!
  const p2 = polyline[idx + 1]!
  const isHoriz = Math.abs(p1.y - p2.y) < COORD_EPSILON

  if (isHoriz) {
    const minY = Math.min(...obstacles.map(o => o.y))
    const maxY = Math.max(...obstacles.map(o => o.y + o.height))
    const aboveY = minY - DETOUR_MARGIN
    const belowY = maxY + DETOUR_MARGIN
    const validAbove = aboveY > bounds.y
    const validBelow = belowY < bounds.y + bounds.height

    let detourY: number
    if (validAbove && validBelow) {
      const distAbove = Math.abs(aboveY - p1.y)
      const distBelow = Math.abs(belowY - p1.y)
      detourY = distAbove <= distBelow ? aboveY : belowY
    } else if (validAbove) detourY = aboveY
    else if (validBelow) detourY = belowY
    else detourY = aboveY

    const goingRight = p2.x > p1.x
    // Sort obstacles by traversal order along the segment.
    const sorted = [...obstacles].sort((a, b) =>
      goingRight ? a.x - b.x : (b.x + b.width) - (a.x + a.width)
    )
    const first = sorted[0]!
    const last = sorted[sorted.length - 1]!

    const enterX = goingRight ? first.x - DETOUR_MARGIN : first.x + first.width + DETOUR_MARGIN
    const exitX  = goingRight ? last.x + last.width + DETOUR_MARGIN : last.x - DETOUR_MARGIN

    return [
      ...polyline.slice(0, idx + 1),
      { x: enterX, y: p1.y },
      { x: enterX, y: detourY },
      { x: exitX, y: detourY },
      { x: exitX, y: p2.y },
      ...polyline.slice(idx + 1),
    ]
  } else {
    const minX = Math.min(...obstacles.map(o => o.x))
    const maxX = Math.max(...obstacles.map(o => o.x + o.width))
    const leftX  = minX - DETOUR_MARGIN
    const rightX = maxX + DETOUR_MARGIN
    const validLeft  = leftX > bounds.x
    const validRight = rightX < bounds.x + bounds.width

    let detourX: number
    if (validLeft && validRight) {
      const distLeft  = Math.abs(leftX - p1.x)
      const distRight = Math.abs(rightX - p1.x)
      detourX = distLeft <= distRight ? leftX : rightX
    } else if (validLeft) detourX = leftX
    else if (validRight) detourX = rightX
    else detourX = leftX

    const goingDown = p2.y > p1.y
    const sorted = [...obstacles].sort((a, b) =>
      goingDown ? a.y - b.y : (b.y + b.height) - (a.y + a.height)
    )
    const first = sorted[0]!
    const last = sorted[sorted.length - 1]!

    const enterY = goingDown ? first.y - DETOUR_MARGIN : first.y + first.height + DETOUR_MARGIN
    const exitY  = goingDown ? last.y + last.height + DETOUR_MARGIN : last.y - DETOUR_MARGIN

    return [
      ...polyline.slice(0, idx + 1),
      { x: p1.x, y: enterY },
      { x: detourX, y: enterY },
      { x: detourX, y: exitY },
      { x: p2.x, y: exitY },
      ...polyline.slice(idx + 1),
    ]
  }
}

/**
 * Whether `p` is strictly inside `rect` (touching the boundary doesn't count).
 */
function pointInsideRect(p: Point, rect: Rect): boolean {
  return p.x > rect.x + COORD_EPSILON &&
         p.x < rect.x + rect.width - COORD_EPSILON &&
         p.y > rect.y + COORD_EPSILON &&
         p.y < rect.y + rect.height - COORD_EPSILON
}

/**
 * When a polyline's interior corner sits inside an obstacle, replace the
 * three points (prev, corner, next) with a 5-point detour that routes around
 * the obstacle on the side closest to `prev`. This handles the L-with-corner-
 * inside-obstacle case that would otherwise send the recursive detour into
 * an oscillation.
 */
function bypassObstacleAtCorner(
  polyline: Point[],
  cornerIdx: number,
  obs: Rect
): Point[] {
  const prev = polyline[cornerIdx - 1]!
  const corner = polyline[cornerIdx]!
  const next = polyline[cornerIdx + 1]!

  const firstHoriz = Math.abs(prev.y - corner.y) < COORD_EPSILON
  if (firstHoriz) {
    // [prev → corner] horizontal, [corner → next] vertical. Bypass: keep first
    // horizontal up to obstacle's near side, drop down past obstacle's far
    // side, run horizontally to next.x, drop to next.y.
    const goingRight = corner.x > prev.x
    const bypassX = goingRight ? obs.x - DETOUR_MARGIN : obs.x + obs.width + DETOUR_MARGIN
    const goingDown = next.y > corner.y
    const bypassY = goingDown ? obs.y + obs.height + DETOUR_MARGIN : obs.y - DETOUR_MARGIN
    return [
      ...polyline.slice(0, cornerIdx),
      { x: bypassX, y: prev.y },
      { x: bypassX, y: bypassY },
      { x: next.x, y: bypassY },
      ...polyline.slice(cornerIdx + 1),
    ]
  } else {
    // [prev → corner] vertical, [corner → next] horizontal.
    const goingDown = corner.y > prev.y
    const bypassY = goingDown ? obs.y - DETOUR_MARGIN : obs.y + obs.height + DETOUR_MARGIN
    const goingRight = next.x > corner.x
    const bypassX = goingRight ? obs.x + obs.width + DETOUR_MARGIN : obs.x - DETOUR_MARGIN
    return [
      ...polyline.slice(0, cornerIdx),
      { x: prev.x, y: bypassY },
      { x: bypassX, y: bypassY },
      { x: bypassX, y: next.y },
      ...polyline.slice(cornerIdx + 1),
    ]
  }
}

/**
 * Apply corner-bypass repeatedly until no interior corner lies inside any
 * obstacle. This stops the detour pass from oscillating around a corner it
 * can never fully clear. Capped at MAX_DETOUR_DEPTH so a malformed input
 * can't infinite-loop.
 */
function bypassCornersInObstacles(polyline: Point[], obstacles: Obstacle[]): Point[] {
  for (let pass = 0; pass < MAX_DETOUR_DEPTH; pass++) {
    let changed = false
    for (let i = 1; i < polyline.length - 1; i++) {
      for (const o of obstacles) {
        if (pointInsideRect(polyline[i]!, o.rect)) {
          polyline = bypassObstacleAtCorner(polyline, i, o.rect)
          changed = true
          break
        }
      }
      if (changed) break
    }
    if (!changed) return polyline
  }
  return polyline
}

function detourPolyline(polyline: Point[], obstacles: Obstacle[], bounds: Rect, depth: number): Point[] {
  if (depth <= 0) return polyline
  for (let i = 0; i + 1 < polyline.length; i++) {
    const p1 = polyline[i]!
    const p2 = polyline[i + 1]!
    if (Math.abs(p1.x - p2.x) < COORD_EPSILON && Math.abs(p1.y - p2.y) < COORD_EPSILON) continue

    const crossing = obstacles
      .filter(o => segmentCrossesRect(p1, p2, o.rect))
      .map(o => o.rect)
    if (crossing.length === 0) continue

    const next = detourAroundObstacles(polyline, i, crossing, bounds)
    return detourPolyline(next, obstacles, bounds, depth - 1)
  }
  return polyline
}

/** Drop colinear interior points from an axis-aligned polyline. */
function simplifyColinear(points: Point[]): Point[] {
  if (points.length <= 2) return points
  const out: Point[] = [points[0]!]
  for (let i = 1; i < points.length - 1; i++) {
    const prev = out[out.length - 1]!
    const cur = points[i]!
    const next = points[i + 1]!
    const sameX = Math.abs(prev.x - cur.x) < COORD_EPSILON && Math.abs(cur.x - next.x) < COORD_EPSILON
    const sameY = Math.abs(prev.y - cur.y) < COORD_EPSILON && Math.abs(cur.y - next.y) < COORD_EPSILON
    if (sameX || sameY) continue
    out.push(cur)
  }
  out.push(points[points.length - 1]!)
  return out
}

/** Root the path's allowed region: the LCA's bounds, or the whole diagram if no LCA. */
function computeBoundsForEdge(
  sourceSubgraph: string | undefined,
  targetSubgraph: string | undefined,
  ctx: RouterContext
): Rect {
  const subParent = new Map<string, string | undefined>()
  for (const [k, v] of ctx.groupParent) subParent.set(k, v ?? undefined)
  const lca = lowestCommonAncestor(sourceSubgraph, targetSubgraph, subParent)
  if (lca) {
    const g = ctx.groupMap.get(lca)
    if (g) return { x: g.x, y: g.y, width: g.width, height: g.height }
  }
  return ctx.diagramBounds
}

function buildObstacleSet(
  s: PositionedNode,
  t: PositionedNode,
  sourceChain: string[],
  targetChain: string[],
  ctx: RouterContext
): Obstacle[] {
  const allowed = new Set<string>([...sourceChain, ...targetChain])
  const obstacles: Obstacle[] = []

  for (const node of ctx.nodeMap.values()) {
    if (node.id === s.id || node.id === t.id) continue
    obstacles.push({ rect: { x: node.x, y: node.y, width: node.width, height: node.height }, id: node.id })
  }
  for (const g of ctx.groupMap.values()) {
    if (allowed.has(g.id)) continue
    obstacles.push({ rect: { x: g.x, y: g.y, width: g.width, height: g.height }, id: g.id })
  }
  return obstacles
}

function routeOneCrossHierEdge(
  ce: CrossHierEdge,
  graph: MermaidGraph,
  ctx: RouterContext
): PositionedEdge | undefined {
  const s = ctx.nodeMap.get(ce.edge.source)
  const t = ctx.nodeMap.get(ce.edge.target)
  if (!s || !t) return undefined

  const subParent = new Map<string, string | undefined>()
  for (const [k, v] of ctx.groupParent) subParent.set(k, v ?? undefined)
  const sourceChain = ancestorChain(ce.sourceSubgraph, subParent)
  const targetChain = ancestorChain(ce.targetSubgraph, subParent)

  const exitSide = pickExitSide(s, t, sourceChain, ctx)
  const entrySide = pickEntrySide(t, s, targetChain, ctx)
  const exit = entryPointOnSide(s, exitSide)
  const entry = entryPointOnSide(t, entrySide)
  let polyline = constructInitial(exit, exitSide, entry, entrySide)

  const bounds = computeBoundsForEdge(ce.sourceSubgraph, ce.targetSubgraph, ctx)
  const obstacles = buildObstacleSet(s, t, sourceChain, targetChain, ctx)

  // Bypass any L corner that landed inside an obstacle — otherwise the
  // recursive detour would oscillate around the trapped corner.
  polyline = bypassCornersInObstacles(polyline, obstacles)
  polyline = detourPolyline(polyline, obstacles, bounds, MAX_DETOUR_DEPTH)
  polyline = simplifyColinear(polyline)

  const original = ce.edge
  return {
    source: original.source,
    target: original.target,
    label: original.label,
    style: original.style,
    hasArrowStart: original.hasArrowStart,
    hasArrowEnd: original.hasArrowEnd,
    points: polyline,
    labelPosition: original.label ? calculatePathMidpoint(polyline) : undefined,
    inlineStyle: resolveEdgeStyle(ce.index, graph),
  }
}

// ============================================================================
// Lane allocation
//
// Distinct edges (no shared source or target) must not share a colinear
// segment. Bucket axis-aligned segments by (axis, position-bin); for each
// bucket where multiple distinct edges overlap, distribute their segments
// into parallel lanes.
// ============================================================================

const LANE_SPACING = 8
const SEGMENT_EPSILON = 0.5
const POS_BIN = 1.0
const PORT_SIDE_MARGIN = 4

interface SegmentRecord {
  edgeIndex: number
  segIndex: number
  axis: 'H' | 'V'
  pos: number
  rangeMin: number
  rangeMax: number
  kind: 'first' | 'last' | 'interior'
}

function edgesShareEndpoint(a: PositionedEdge, b: PositionedEdge): boolean {
  return a.source === b.source || a.source === b.target ||
         a.target === b.source || a.target === b.target
}

function constrainPortPosition(pos: number, node: PositionedNode, axis: 'H' | 'V'): number {
  if (axis === 'H') {
    return Math.max(node.y + PORT_SIDE_MARGIN, Math.min(node.y + node.height - PORT_SIDE_MARGIN, pos))
  }
  return Math.max(node.x + PORT_SIDE_MARGIN, Math.min(node.x + node.width - PORT_SIDE_MARGIN, pos))
}

function applySegmentShift(
  seg: SegmentRecord,
  edges: PositionedEdge[],
  nodeMap: Map<string, PositionedNode>,
  offset: number
): boolean {
  const pts = edges[seg.edgeIndex]!.points
  let newPos = seg.pos + offset
  if (seg.kind === 'first' || seg.kind === 'last') {
    const nodeId = seg.kind === 'first' ? edges[seg.edgeIndex]!.source : edges[seg.edgeIndex]!.target
    const node = nodeMap.get(nodeId)
    if (node) newPos = constrainPortPosition(newPos, node, seg.axis)
  }
  if (Math.abs(newPos - seg.pos) < SEGMENT_EPSILON) return false
  if (seg.axis === 'H') {
    pts[seg.segIndex]!.y = newPos
    pts[seg.segIndex + 1]!.y = newPos
  } else {
    pts[seg.segIndex]!.x = newPos
    pts[seg.segIndex + 1]!.x = newPos
  }
  return true
}

function deoverlapPass(edges: PositionedEdge[], nodeMap: Map<string, PositionedNode>): boolean {
  const allSegs: SegmentRecord[] = []
  for (let ei = 0; ei < edges.length; ei++) {
    const pts = edges[ei]!.points
    if (pts.length < 2) continue
    for (let si = 0; si + 1 < pts.length; si++) {
      const p1 = pts[si]!
      const p2 = pts[si + 1]!
      const dx = p2.x - p1.x
      const dy = p2.y - p1.y
      let axis: 'H' | 'V'
      let pos: number
      let rangeMin: number
      let rangeMax: number
      if (Math.abs(dy) < SEGMENT_EPSILON && Math.abs(dx) > SEGMENT_EPSILON) {
        axis = 'H'
        pos = (p1.y + p2.y) / 2
        rangeMin = Math.min(p1.x, p2.x)
        rangeMax = Math.max(p1.x, p2.x)
      } else if (Math.abs(dx) < SEGMENT_EPSILON && Math.abs(dy) > SEGMENT_EPSILON) {
        axis = 'V'
        pos = (p1.x + p2.x) / 2
        rangeMin = Math.min(p1.y, p2.y)
        rangeMax = Math.max(p1.y, p2.y)
      } else {
        continue
      }
      const kind: SegmentRecord['kind'] =
        si === 0 ? 'first' : (si === pts.length - 2 ? 'last' : 'interior')
      allSegs.push({ edgeIndex: ei, segIndex: si, axis, pos, rangeMin, rangeMax, kind })
    }
  }

  const buckets = new Map<string, SegmentRecord[]>()
  for (const s of allSegs) {
    const key = `${s.axis}:${Math.round(s.pos / POS_BIN)}`
    let arr = buckets.get(key)
    if (!arr) { arr = []; buckets.set(key, arr) }
    arr.push(s)
  }

  let shifted = false
  for (const bucket of buckets.values()) {
    if (bucket.length < 2) continue
    if (resolveBucketConflicts(bucket, edges, nodeMap)) shifted = true
  }
  return shifted
}

function resolveBucketConflicts(
  bucket: SegmentRecord[],
  edges: PositionedEdge[],
  nodeMap: Map<string, PositionedNode>
): boolean {
  const conflicts = new Map<number, Set<number>>()
  for (let i = 0; i < bucket.length; i++) {
    for (let j = i + 1; j < bucket.length; j++) {
      const s1 = bucket[i]!
      const s2 = bucket[j]!
      if (s1.edgeIndex === s2.edgeIndex) continue
      const overlap = Math.min(s1.rangeMax, s2.rangeMax) - Math.max(s1.rangeMin, s2.rangeMin)
      if (overlap <= SEGMENT_EPSILON) continue
      if (edgesShareEndpoint(edges[s1.edgeIndex]!, edges[s2.edgeIndex]!)) continue
      let cs1 = conflicts.get(i)
      if (!cs1) { cs1 = new Set(); conflicts.set(i, cs1) }
      let cs2 = conflicts.get(j)
      if (!cs2) { cs2 = new Set(); conflicts.set(j, cs2) }
      cs1.add(j)
      cs2.add(i)
    }
  }
  if (conflicts.size === 0) return false

  let shifted = false
  const visited = new Set<number>()
  for (let i = 0; i < bucket.length; i++) {
    if (visited.has(i) || !conflicts.has(i)) continue
    const comp: number[] = []
    const stack: number[] = [i]
    while (stack.length > 0) {
      const cur = stack.pop()!
      if (visited.has(cur)) continue
      visited.add(cur)
      comp.push(cur)
      const cn = conflicts.get(cur)
      if (cn) for (const k of cn) if (!visited.has(k)) stack.push(k)
    }
    if (comp.length < 2) continue
    comp.sort((a, b) => {
      const sa = bucket[a]!
      const sb = bucket[b]!
      return sa.edgeIndex - sb.edgeIndex || sa.segIndex - sb.segIndex
    })
    const N = comp.length
    for (let li = 0; li < N; li++) {
      const offset = (li - (N - 1) / 2) * LANE_SPACING
      if (Math.abs(offset) < SEGMENT_EPSILON) continue
      if (applySegmentShift(bucket[comp[li]!]!, edges, nodeMap, offset)) shifted = true
    }
  }
  return shifted
}

function allocateLanes(edges: PositionedEdge[], nodeMap: Map<string, PositionedNode>): void {
  const MAX_PASSES = 6
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    if (!deoverlapPass(edges, nodeMap)) return
  }
}

// ============================================================================
// Style resolution helpers (kept verbatim from previous implementation)
// ============================================================================

function resolveNodeStyle(nodeId: string, graph: MermaidGraph): Record<string, string> | undefined {
  let result: Record<string, string> | undefined

  const className = graph.classAssignments.get(nodeId)
  if (className) {
    const classDef = graph.classDefs.get(className)
    if (classDef) result = { ...classDef }
  }
  const nodeStyle = graph.nodeStyles.get(nodeId)
  if (nodeStyle) result = result ? { ...result, ...nodeStyle } : { ...nodeStyle }
  return result
}

function resolveEdgeStyle(edgeIndex: number, graph: MermaidGraph): Record<string, string> | undefined {
  let result: Record<string, string> | undefined
  const defaultStyle = graph.linkStyles.get('default')
  if (defaultStyle) result = { ...defaultStyle }
  const indexStyle = graph.linkStyles.get(edgeIndex)
  if (indexStyle) result = result ? { ...result, ...indexStyle } : { ...indexStyle }
  return result
}

/** Midpoint along a polyline by arc length. */
function calculatePathMidpoint(points: Point[]): Point {
  if (points.length === 0) return { x: 0, y: 0 }
  if (points.length === 1) return points[0]!
  let totalLength = 0
  for (let i = 1; i < points.length; i++) {
    const dx = points[i]!.x - points[i - 1]!.x
    const dy = points[i]!.y - points[i - 1]!.y
    totalLength += Math.sqrt(dx * dx + dy * dy)
  }
  let remaining = totalLength / 2
  for (let i = 1; i < points.length; i++) {
    const dx = points[i]!.x - points[i - 1]!.x
    const dy = points[i]!.y - points[i - 1]!.y
    const segLen = Math.sqrt(dx * dx + dy * dy)
    if (remaining <= segLen) {
      const t = remaining / segLen
      return { x: points[i - 1]!.x + t * dx, y: points[i - 1]!.y + t * dy }
    }
    remaining -= segLen
  }
  return points[points.length - 1]!
}

// ============================================================================
// Public API
// ============================================================================

export function layoutGraphSync(
  graph: MermaidGraph,
  options: RenderOptions = {}
): PositionedGraph {
  const opts = { ...DEFAULTS, ...options }

  // [1] Build ELK input (no cross-hier edges).
  const { elkGraph, crossHierEdges, standInPrefix } = mermaidToElk(graph, opts)

  // [2] Run ELK.
  const elkResult = elkLayoutSync(elkGraph)

  // [3] Extract positioned nodes, groups, and internal-edge polylines.
  const extracted = elkToExtraction(elkResult, graph, standInPrefix)

  // [4] Route cross-hierarchy edges around obstacles.
  const subgraphMap = buildSubgraphMap(graph.subgraphs)
  const diagramBounds: Rect = {
    x: 0, y: 0,
    width: elkResult.width ?? 0,
    height: elkResult.height ?? 0,
  }
  const ctx: RouterContext = {
    nodeMap: extracted.nodeMap,
    groupMap: extracted.groupMap,
    leafParent: extracted.leafParent,
    groupParent: extracted.groupParent,
    subgraphMap,
    rootDirection: graph.direction,
    diagramBounds,
  }
  const routedCrossHier: PositionedEdge[] = []
  for (const ce of crossHierEdges) {
    const routed = routeOneCrossHierEdge(ce, graph, ctx)
    if (routed) routedCrossHier.push(routed)
  }

  // Combine all edges in original declaration order (so labels and styles
  // line up with the user's mental model).
  const edgesByIndex = new Map<number, PositionedEdge>()
  // Walk each set; we don't track index for routed/internal directly, so
  // recompute from the source edge's position in graph.edges.
  function indexOf(e: PositionedEdge, fromList: PositionedEdge[], offset: number): number {
    return offset + fromList.indexOf(e)
  }
  // Simpler: we know cross-hier edges keep their MermaidEdge index via the
  // CrossHierEdge.index field, and internal edges came from extraction in
  // some order. Build by-index map from each list keyed off the source edge.
  for (const e of extracted.internalEdges) {
    // Find the matching graph.edges entry — use first match to retain index.
    const idx = graph.edges.findIndex(ge =>
      ge.source === e.source && ge.target === e.target && !edgesByIndex.has(graph.edges.indexOf(ge))
    )
    if (idx >= 0) edgesByIndex.set(idx, e)
  }
  for (let i = 0; i < crossHierEdges.length; i++) {
    const ce = crossHierEdges[i]!
    const routed = routedCrossHier[i]
    if (routed) edgesByIndex.set(ce.index, routed)
  }
  const edges: PositionedEdge[] = []
  for (let i = 0; i < graph.edges.length; i++) {
    const e = edgesByIndex.get(i)
    if (e) edges.push(e)
  }

  // [5] Shape-aware endpoint clipping (diamonds, etc.).
  for (const edge of edges) {
    const s = extracted.nodeMap.get(edge.source)
    const t = extracted.nodeMap.get(edge.target)
    if (s) edge.points = clipEdgeToShape(edge.points, s, true)
    if (t) edge.points = clipEdgeToShape(edge.points, t, false)
  }

  // Lane allocation across all edges so distinct edges don't share segments.
  allocateLanes(edges, extracted.nodeMap)

  // Calculate final bounds. ELK gives node bounds; we expand for any edge
  // points that ended up beyond the diagram (margin-routed cross-hier edges
  // can extend outside the ELK-computed extent).
  let width = elkResult.width ?? 800
  let height = elkResult.height ?? 600
  const arrowMargin = ARROW_HEAD.width
  const padding = DEFAULTS.padding

  for (const edge of edges) {
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

  return {
    width,
    height,
    nodes: extracted.nodes,
    edges,
    groups: extracted.groups,
  }
}

/**
 * Convert MermaidGraph to ELK format — exported for benchmarking.
 * Returns the same `elk.bundled.js` input shape `layoutGraphSync` feeds
 * to ELK.
 */
export function convertToElkFormat(
  graph: MermaidGraph,
  options: RenderOptions = {}
): ElkNode {
  const opts = { ...DEFAULTS, ...options }
  return mermaidToElk(graph, opts).elkGraph
}
