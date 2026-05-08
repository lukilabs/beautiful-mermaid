/**
 * Layout engine for beautiful-mermaid (ELK.js based).
 *
 * ELK does both layout and routing. Per-subgraph `direction` directives
 * are honoured by setting `SEPARATE_CHILDREN` on every subgraph whose
 * direction differs from its effective parent (or that contains a leaf
 * endpoint of a cross-hierarchy edge — without `SEPARATE_CHILDREN` the
 * leaf would migrate out of its declared subgraph). Cross-hierarchy
 * edges are decomposed into a chain of sub-edges, one per subgraph
 * boundary they cross, with explicit ports on each subgraph's boundary
 * on the side dictated by that subgraph's direction. ELK lays out each
 * subgraph independently with its own direction and routes every edge
 * — including the cross-hierarchy ones — in a single pass.
 *
 * Pipeline:
 *   mermaidToElk:    build ELK input with port chains and sub-edges
 *   elkLayoutSync:   ELK lays out the subgraph tree end-to-end
 *   elkToPositioned: extract nodes + groups; assemble each cross-hier edge
 *                    polyline by concatenating its sub-edge sections
 *   clipEdgeToShape: shape-aware endpoint clipping for non-rectangles
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
// Defaults & direction helpers
// ============================================================================

const DEFAULTS = {
  font: 'Inter',
  padding: 40,
  nodeSpacing: 28,
  layerSpacing: 48,
  thoroughness: 30,
} as const

type ElkDirection = 'RIGHT' | 'LEFT' | 'UP' | 'DOWN'

function directionToElk(dir: Direction): ElkDirection {
  switch (dir) {
    case 'LR': return 'RIGHT'
    case 'RL': return 'LEFT'
    case 'BT': return 'UP'
    case 'TD':
    case 'TB':
    default:   return 'DOWN'
  }
}

type Side = 'NORTH' | 'SOUTH' | 'EAST' | 'WEST'

/** The side an outgoing edge exits on, given the producing subgraph's flow direction. */
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

/** The side an incoming edge enters on, given the receiving subgraph's flow direction. */
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

function buildSubgraphParentMap(subgraphs: MermaidSubgraph[]): Map<string, string | undefined> {
  const map = new Map<string, string | undefined>()
  function traverse(sg: MermaidSubgraph, parentId: string | undefined): void {
    map.set(sg.id, parentId)
    for (const child of sg.children) traverse(child, sg.id)
  }
  for (const sg of subgraphs) traverse(sg, undefined)
  return map
}

function buildSubgraphMap(subgraphs: MermaidSubgraph[]): Map<string, MermaidSubgraph> {
  const map = new Map<string, MermaidSubgraph>()
  function index(sg: MermaidSubgraph): void {
    map.set(sg.id, sg)
    for (const child of sg.children) index(child)
  }
  for (const sg of subgraphs) index(sg)
  return map
}

function buildNodeToSubgraphMap(subgraphs: MermaidSubgraph[]): Map<string, string> {
  const map = new Map<string, string>()
  function traverse(sg: MermaidSubgraph): void {
    for (const nodeId of sg.nodeIds) map.set(nodeId, sg.id)
    for (const child of sg.children) traverse(child)
  }
  for (const sg of subgraphs) traverse(sg)
  return map
}

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

/**
 * Effective direction at a subgraph: own direction directive if any, otherwise
 * the nearest ancestor's, otherwise the root direction. Determines which side
 * a port for an outgoing/incoming cross-hier edge sits on.
 */
function effectiveDirection(
  subgraphId: string,
  subgraphMap: Map<string, MermaidSubgraph>,
  subgraphParent: Map<string, string | undefined>,
  rootDirection: Direction
): Direction {
  let cur: string | undefined = subgraphId
  while (cur !== undefined) {
    const sg = subgraphMap.get(cur)
    if (sg?.direction) return sg.direction
    cur = subgraphParent.get(cur)
  }
  return rootDirection
}

/**
 * Subgraphs that need SEPARATE_CHILDREN. Two reasons:
 *
 * 1. Direction mismatch: own directive differs from effective parent direction.
 * 2. Contains a direct leaf child that's an endpoint of a cross-hier edge —
 *    without SEPARATE_CHILDREN, INCLUDE_CHILDREN inheritance lets ELK migrate
 *    that leaf out of its declared subgraph when the layered layout prefers
 *    a layer near a cross-hier neighbour. SEPARATE_CHILDREN locks it inside.
 */
function computeSubgraphsNeedingSeparate(
  subgraphMap: Map<string, MermaidSubgraph>,
  subgraphParent: Map<string, string | undefined>,
  rootDirection: Direction,
  nodeToSubgraph: Map<string, string>,
  crossHierEdges: ReadonlyArray<{ edge: MermaidEdge }>
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
  for (const ce of crossHierEdges) {
    const srcSg = nodeToSubgraph.get(ce.edge.source)
    if (srcSg) result.add(srcSg)
    const tgtSg = nodeToSubgraph.get(ce.edge.target)
    if (tgtSg) result.add(tgtSg)
  }
  return result
}

// ============================================================================
// Cross-hierarchy edge decomposition
//
// Each cross-hier edge becomes a chain of sub-edges, one per subgraph
// boundary it crosses, plus one final sub-edge at the LCA level where the
// source-side and target-side become siblings (or where one endpoint is at
// LCA level itself).
//
// Source side: walking up from `source.parent` to (but not including) LCA,
// each subgraph on the way gets an OUTGOING port for this edge on its
// outgoing-side (TB → SOUTH, LR → EAST, etc.). Each port becomes the target
// of one sub-edge (whose source is the previous-level port or the source
// leaf itself for the innermost) and the source of the next sub-edge.
//
// Mirror for the target side.
//
// Each sub-edge lives in the ELK `edges` array of the subgraph where its
// source and target are direct children — so ELK at that level routes it
// natively, with channels reserved.
// ============================================================================

interface CrossHierPort {
  /** Stable, unique ELK port id. */
  portId: string
  /** Subgraph that owns this port. */
  subgraphId: string
  /** Side of the subgraph the port sits on. */
  side: Side
  /** 'out' = outgoing (source side), 'in' = incoming (target side). */
  direction: 'in' | 'out'
  /** Index of the underlying cross-hier edge in graph.edges. Numeric tiebreaker that orders ports sharing a side and outsideDepth in declaration order. */
  edgeIndex: number
  /**
   * Number of subgraph levels between this port's subgraph and the source
   * (for `direction: 'in'`) or the target (for `direction: 'out'`) of the
   * underlying cross-hier edge. Used as a tiebreaker when several ports
   * share a side: the closer endpoint goes first along the side, which
   * matches the natural geographic order in most diagrams (closer leaves
   * are typically laid out closer to their target subgraph).
   */
  outsideDepth: number
}

interface CrossHierDecomposition {
  /** Index of this edge in graph.edges. */
  index: number
  edge: MermaidEdge
  /** Source-side subgraph chain, innermost first (excluding LCA). Empty if source is direct child of LCA. */
  srcChain: CrossHierPort[]
  /** Target-side subgraph chain, innermost first (excluding LCA). Empty if target is direct child of LCA. */
  tgtChain: CrossHierPort[]
  /** LCA subgraph id, or undefined for root LCA. */
  lca: string | undefined
  /**
   * True when the LCA-level segment was reversed in the ELK input to break
   * a cycle in that LCA's flow DAG (e.g. two siblings with bidirectional
   * cross-hier edges). The polyline for this segment is reversed back during
   * assembly so the user-visible direction is preserved.
   */
  lcaReversed: boolean
}

function decomposeCrossHierEdge(
  index: number,
  edge: MermaidEdge,
  sourceSg: string | undefined,
  targetSg: string | undefined,
  subgraphParent: Map<string, string | undefined>,
  subgraphMap: Map<string, MermaidSubgraph>,
  rootDirection: Direction
): CrossHierDecomposition {
  const lca = lowestCommonAncestor(sourceSg, targetSg, subgraphParent)

  function buildChain(startSg: string | undefined, dir: 'in' | 'out'): CrossHierPort[] {
    const chain: CrossHierPort[] = []
    let cur = startSg
    while (cur !== undefined && cur !== lca) {
      const subgraphDir = effectiveDirection(cur, subgraphMap, subgraphParent, rootDirection)
      const side = dir === 'out' ? outgoingSide(subgraphDir) : incomingSide(subgraphDir)
      chain.push({
        portId: `port_${cur}_e${index}_${dir}`,
        subgraphId: cur,
        side,
        direction: dir,
        edgeIndex: index,
        outsideDepth: 0, // filled in after loop
      })
      cur = subgraphParent.get(cur)
    }
    // outsideDepth = how many levels out from this port's subgraph until we
    // reach the source/target leaf. For the innermost port it's `chain.length`
    // (every subgraph in the chain plus the leaf at the LCA's parent side);
    // for the outermost port it's 1 (the leaf is the next step out at the
    // LCA level). Lower depth = source/target endpoint is closer.
    for (let i = 0; i < chain.length; i++) {
      chain[i]!.outsideDepth = chain.length - i
    }
    return chain
  }

  return {
    index,
    edge,
    srcChain: buildChain(sourceSg, 'out'),
    tgtChain: buildChain(targetSg, 'in'),
    lca,
    lcaReversed: false,
  }
}

// ============================================================================
// ELK input construction
//
// Each subgraph that needs SEPARATE_CHILDREN becomes a subgraph with:
//   - direction (its own or effective)
//   - hierarchyHandling: SEPARATE_CHILDREN
//   - portConstraints: FIXED_ORDER (the explicit port.index on each port
//     decides the per-side order; the explicit port.side decides the side)
//   - ports[] populated from cross-hier decomposition
//
// Sub-edges are placed in the edges array of the subgraph where their
// source and target are direct children (or where they are direct ports
// on direct children).
// ============================================================================

interface ElkPort {
  id: string
  layoutOptions?: Record<string, string>
}

interface ElkGraphNode extends ElkNode {
  children?: ElkGraphNode[]
  edges?: ElkExtendedEdge[]
  ports?: ElkPort[]
}

interface MermaidToElkResult {
  elkGraph: ElkGraphNode
  /** The decomposed cross-hier edges, in graph.edges order. Used during extraction to assemble polylines. */
  decompositions: CrossHierDecomposition[]
  /** Raw cross-hier ports per subgraph (used by the second-pass index refinement). */
  rawPortsBySubgraph: Map<string, CrossHierPort[]>
}

function buildElkLabel(text: string): NonNullable<ElkExtendedEdge['labels']>[0] {
  const metrics = measureMultilineText(text, FONT_SIZES.edgeLabel, FONT_WEIGHTS.edgeLabel)
  return {
    text,
    width: metrics.width + 8,
    height: metrics.height + 6,
    layoutOptions: {
      'elk.edgeLabels.inline': 'true',
      'elk.edgeLabels.placement': 'CENTER',
    },
  }
}

function buildInternalElkEdge(index: number, edge: MermaidEdge): ElkExtendedEdge {
  const elkEdge: ElkExtendedEdge = {
    id: `e${index}`,
    sources: [edge.source],
    targets: [edge.target],
  }
  if (edge.label) elkEdge.labels = [buildElkLabel(edge.label)]
  return elkEdge
}

function mermaidToElk(
  graph: MermaidGraph,
  opts: Required<Pick<RenderOptions, 'font' | 'padding' | 'nodeSpacing' | 'layerSpacing'>>,
  /**
   * Optional per-port index override. When supplied, each port's
   * `org.eclipse.elk.port.index` is set from this map instead of the
   * default outsideDepth heuristic. `layoutGraphSync`'s iterative pass
   * supplies this map after each ELK pass, sorting ports along each
   * side by the outward neighbour's perpendicular coordinate to
   * minimise crossings.
   */
  portIndexOverride?: Map<string, number>
): MermaidToElkResult {
  // Index data
  const subgraphNodeIds = new Set<string>()
  const subgraphIds = new Set<string>()
  for (const sg of graph.subgraphs) {
    subgraphIds.add(sg.id)
    collectSubgraphNodeIds(sg, subgraphNodeIds, subgraphIds)
  }
  const nodeToSubgraph = buildNodeToSubgraphMap(graph.subgraphs)
  const subgraphParent = buildSubgraphParentMap(graph.subgraphs)
  const subgraphMap = buildSubgraphMap(graph.subgraphs)

  // Classify edges. internalEdgesBySubgraph[null] = root-level real edges.
  const internalEdgesBySubgraph = new Map<string | null, Array<{ index: number; edge: MermaidEdge }>>()
  internalEdgesBySubgraph.set(null, [])
  const crossHierRaw: Array<{ index: number; edge: MermaidEdge; sourceSg: string | undefined; targetSg: string | undefined }> = []
  for (let i = 0; i < graph.edges.length; i++) {
    const edge = graph.edges[i]!
    const sourceSg = nodeToSubgraph.get(edge.source)
    const targetSg = nodeToSubgraph.get(edge.target)
    if (sourceSg === targetSg) {
      const key = sourceSg ?? null
      let arr = internalEdgesBySubgraph.get(key)
      if (!arr) { arr = []; internalEdgesBySubgraph.set(key, arr) }
      arr.push({ index: i, edge })
    } else {
      crossHierRaw.push({ index: i, edge, sourceSg, targetSg })
    }
  }

  // Decompose cross-hier edges into port chains.
  const decompositions: CrossHierDecomposition[] = crossHierRaw.map(ce =>
    decomposeCrossHierEdge(ce.index, ce.edge, ce.sourceSg, ce.targetSg, subgraphParent, subgraphMap, graph.direction)
  )

  // Detect LCA-level cycles. When two cross-hier edges between the same pair
  // of LCA-children flow in opposite directions (the cousin-cross-hier case),
  // their LCA sub-edges form a 2-cycle that ELK has to break. With model
  // ordering on, ELK arbitrarily picks which to reverse — sometimes the one
  // that reverses sibling declaration order. To control this, we walk the
  // LCA-level flow graph (real internal edges + LCA sub-edges so far) in
  // source order, and any sub-edge that would close a cycle gets reversed
  // in the ELK input. The polyline assembly reverses its points back so the
  // user-visible direction is preserved.
  {
    const lcaAdj = new Map<string | null, Map<string, Set<string>>>()
    function getAdj(lca: string | null): Map<string, Set<string>> {
      let a = lcaAdj.get(lca)
      if (!a) { a = new Map(); lcaAdj.set(lca, a) }
      return a
    }
    function addAdj(a: Map<string, Set<string>>, src: string, tgt: string): void {
      let s = a.get(src)
      if (!s) { s = new Set(); a.set(src, s) }
      s.add(tgt)
    }
    function hasPath(a: Map<string, Set<string>>, from: string, to: string): boolean {
      if (from === to) return true
      const visited = new Set<string>()
      const stack: string[] = [from]
      while (stack.length > 0) {
        const cur = stack.pop()!
        if (visited.has(cur)) continue
        visited.add(cur)
        const succs = a.get(cur)
        if (!succs) continue
        for (const n of succs) {
          if (n === to) return true
          if (!visited.has(n)) stack.push(n)
        }
      }
      return false
    }
    // Seed with real internal edges at each LCA level. Both endpoints are
    // direct children of the LCA, so the adjacency entry is `source.id → target.id`.
    for (const [lcaKey, edges] of internalEdgesBySubgraph) {
      const a = getAdj(lcaKey)
      for (const { edge } of edges) addAdj(a, edge.source, edge.target)
    }
    // Walk decompositions in source order. For each LCA sub-edge, check if it
    // would close a cycle; if yes, mark reversed. Record either the forward
    // or reversed direction in the DAG so subsequent edges see the result.
    for (const decomp of decompositions) {
      const srcAnc = decomp.srcChain.length > 0
        ? decomp.srcChain[decomp.srcChain.length - 1]!.subgraphId
        : decomp.edge.source
      const tgtAnc = decomp.tgtChain.length > 0
        ? decomp.tgtChain[decomp.tgtChain.length - 1]!.subgraphId
        : decomp.edge.target
      if (srcAnc === tgtAnc) continue
      const adj = getAdj(decomp.lca ?? null)
      if (hasPath(adj, tgtAnc, srcAnc)) {
        decomp.lcaReversed = true
        addAdj(adj, tgtAnc, srcAnc)
      } else {
        addAdj(adj, srcAnc, tgtAnc)
      }
    }
  }

  // Subgraphs that need SEPARATE_CHILDREN. Cross-hier ports require it so
  // the subgraph's boundary is a real layout boundary that ELK respects
  // the FIXED_ORDER port constraints on; without SEPARATE the boundary
  // would be soft and the port positions would not stick.
  const subgraphsNeedingSeparate = computeSubgraphsNeedingSeparate(
    subgraphMap, subgraphParent, graph.direction, nodeToSubgraph, crossHierRaw
  )
  // Any subgraph that owns at least one cross-hier port also needs SEPARATE.
  for (const decomp of decompositions) {
    for (const p of decomp.srcChain) subgraphsNeedingSeparate.add(p.subgraphId)
    for (const p of decomp.tgtChain) subgraphsNeedingSeparate.add(p.subgraphId)
  }

  // Per-subgraph: ports owned + sub-edges to lay out at this level.
  const rawPortsBySubgraph = new Map<string, CrossHierPort[]>()
  // sub-edges owned by a subgraph (or root if subgraphId === null)
  const subEdgesBySubgraph = new Map<string | null, ElkExtendedEdge[]>()
  function addSubEdge(subgraphId: string | null, edge: ElkExtendedEdge): void {
    let arr = subEdgesBySubgraph.get(subgraphId)
    if (!arr) { arr = []; subEdgesBySubgraph.set(subgraphId, arr) }
    arr.push(edge)
  }
  function addRawPort(p: CrossHierPort): void {
    let arr = rawPortsBySubgraph.get(p.subgraphId)
    if (!arr) { arr = []; rawPortsBySubgraph.set(p.subgraphId, arr) }
    arr.push(p)
  }

  // Emit ports + sub-edges per decomposition.
  for (const decomp of decompositions) {
    // Collect ports for sorting/indexing later.
    for (const p of decomp.srcChain) addRawPort(p)
    for (const p of decomp.tgtChain) addRawPort(p)

    // Sub-edges. Each is `e${index}_seg${k}` so the extractor can group them
    // back together by parsing the id prefix.
    let segCounter = 0
    function nextSegId(): string { return `e${decomp.index}_seg${segCounter++}` }

    // Source side, innermost first.
    if (decomp.srcChain.length > 0) {
      // Innermost: from source leaf to first subgraph's port
      const firstPort = decomp.srcChain[0]!
      addSubEdge(firstPort.subgraphId, {
        id: nextSegId(),
        sources: [decomp.edge.source],
        targets: [firstPort.portId],
      })
      // Each subsequent subgraph: from inner port to outer port (lives at outer's level)
      for (let i = 1; i < decomp.srcChain.length; i++) {
        const inner = decomp.srcChain[i - 1]!
        const outer = decomp.srcChain[i]!
        addSubEdge(outer.subgraphId, {
          id: nextSegId(),
          sources: [inner.portId],
          targets: [outer.portId],
        })
      }
    }

    // Target side, innermost first.
    if (decomp.tgtChain.length > 0) {
      // Innermost: from first subgraph's port to target leaf
      const firstPort = decomp.tgtChain[0]!
      addSubEdge(firstPort.subgraphId, {
        id: nextSegId(),
        sources: [firstPort.portId],
        targets: [decomp.edge.target],
      })
      for (let i = 1; i < decomp.tgtChain.length; i++) {
        const inner = decomp.tgtChain[i - 1]!
        const outer = decomp.tgtChain[i]!
        addSubEdge(outer.subgraphId, {
          id: nextSegId(),
          sources: [outer.portId],
          targets: [inner.portId],
        })
      }
    }

    // LCA-level segment: from outermost source-port (or source leaf if srcChain empty)
    // to outermost target-port (or target leaf if tgtChain empty).
    const lcaSrc = decomp.srcChain.length > 0
      ? decomp.srcChain[decomp.srcChain.length - 1]!.portId
      : decomp.edge.source
    const lcaTgt = decomp.tgtChain.length > 0
      ? decomp.tgtChain[decomp.tgtChain.length - 1]!.portId
      : decomp.edge.target
    const lcaEdge: ElkExtendedEdge = decomp.lcaReversed
      ? { id: nextSegId(), sources: [lcaTgt], targets: [lcaSrc] }
      : { id: nextSegId(), sources: [lcaSrc], targets: [lcaTgt] }
    if (decomp.edge.label) lcaEdge.labels = [buildElkLabel(decomp.edge.label)]
    addSubEdge(decomp.lca ?? null, lcaEdge)
  }

  // Convert raw ports (CrossHierPort) to ELK ports with explicit indices.
  // `port.index` is per side, restarting at 0 on each side. ELK numbers
  // ports along each perimeter in the natural sense — NORTH/SOUTH
  // left-to-right, EAST/WEST top-to-bottom. With `portIndexOverride`
  // present (iterative-pass override), the supplied indices are used
  // directly. Without it, ports sort by outsideDepth ascending within
  // each side — the closer source/target endpoint comes first, which is
  // the best blind heuristic when both sub-edges in a SEPARATE subgraph
  // end at the same internal node.
  const portsBySubgraph = new Map<string, ElkPort[]>()
  for (const [subgraphId, raws] of rawPortsBySubgraph) {
    // Group by side and sort each side independently.
    const bySide = new Map<Side, CrossHierPort[]>()
    for (const p of raws) {
      let arr = bySide.get(p.side)
      if (!arr) { arr = []; bySide.set(p.side, arr) }
      arr.push(p)
    }
    const elkPorts: ElkPort[] = []
    for (const [side, sidePorts] of bySide) {
      sidePorts.sort((a, b) => {
        if (portIndexOverride) {
          const ai = portIndexOverride.get(a.portId) ?? 0
          const bi = portIndexOverride.get(b.portId) ?? 0
          if (ai !== bi) return ai - bi
        } else if (a.outsideDepth !== b.outsideDepth) {
          return a.outsideDepth - b.outsideDepth
        }
        return a.edgeIndex - b.edgeIndex
      })
      sidePorts.forEach((p, idx) => {
        elkPorts.push({
          id: p.portId,
          layoutOptions: {
            'org.eclipse.elk.port.side': side,
            'org.eclipse.elk.port.index': String(idx),
          },
        })
      })
    }
    portsBySubgraph.set(subgraphId, elkPorts)
  }

  // Sub-edge order matters for SEPARATE subgraph port placement: ELK fans
  // out a leaf's outgoing edges in the order they appear in the parent's
  // edges array, and the resulting fan-out positions become the port
  // positions on the boundary. (Internal model order overrides port.index
  // for subgraph port placement.) For each subgraph, sort its sub-edges so
  // that the sub-edge ending at the subgraph's earliest-indexed port comes
  // first, the next-indexed port comes second, etc. Sub-edges with no port
  // on this subgraph (LCA-level segments) are placed last.
  const portIndexOf = new Map<string, number>()
  for (const elkPorts of portsBySubgraph.values()) {
    for (const p of elkPorts) {
      const idxStr = p.layoutOptions?.['org.eclipse.elk.port.index']
      if (idxStr !== undefined) portIndexOf.set(p.id, parseInt(idxStr, 10))
    }
  }
  for (const [subgraphId, edges] of subEdgesBySubgraph) {
    if (subgraphId === null) continue // root has no boundary ports
    const subgraphPortIds = new Set<string>()
    for (const p of portsBySubgraph.get(subgraphId) ?? []) subgraphPortIds.add(p.id)
    function sortKey(edge: ElkExtendedEdge): number {
      // Find a port on this subgraph that this edge connects to.
      for (const s of edge.sources) if (subgraphPortIds.has(s)) return portIndexOf.get(s) ?? 1e9
      for (const t of edge.targets) if (subgraphPortIds.has(t)) return portIndexOf.get(t) ?? 1e9
      return 1e9 // not a port-attached sub-edge
    }
    edges.sort((a, b) => sortKey(a) - sortKey(b))
  }

  // Build ELK input tree.
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
      'elk.layered.compaction.postCompaction.strategy': 'LEFT_RIGHT_CONSTRAINT_LOCKING',
      'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
      // When breaking cycles, reverse the edge that goes against
      // declaration order rather than ELK's default heuristic. Keeps a
      // back-edge like `D-.->A` reading as the back-edge in the rendered
      // flow rather than ELK reversing the forward edge `A→B`.
      'elk.layered.cycleBreaking.strategy': 'GREEDY_MODEL_ORDER',
      'elk.layered.wrapping.strategy': 'OFF',
      'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
    },
    children: [],
    edges: [],
  }

  // Top-level leaves.
  for (const [id, node] of graph.nodes) {
    if (!subgraphNodeIds.has(id) && !subgraphIds.has(id)) {
      const size = estimateNodeSize(id, node.label, node.shape)
      elkGraph.children!.push({
        id, width: size.width, height: size.height,
        labels: [{ text: node.label }],
      })
    }
  }

  // Subgraphs (recursive).
  for (const sg of graph.subgraphs) {
    elkGraph.children!.push(buildSubgraphNode(sg, graph, opts, internalEdgesBySubgraph, subEdgesBySubgraph, portsBySubgraph, subgraphsNeedingSeparate, subgraphMap, subgraphParent, graph.direction))
  }

  // Root-level real internal edges.
  for (const { index, edge } of internalEdgesBySubgraph.get(null) ?? []) {
    elkGraph.edges!.push(buildInternalElkEdge(index, edge))
  }
  // Root-level cross-hier sub-edges (LCA = root).
  for (const e of subEdgesBySubgraph.get(null) ?? []) {
    elkGraph.edges!.push(e)
  }

  return { elkGraph, decompositions, rawPortsBySubgraph }
}

function buildSubgraphNode(
  sg: MermaidSubgraph,
  graph: MermaidGraph,
  opts: Required<Pick<RenderOptions, 'font' | 'padding' | 'nodeSpacing' | 'layerSpacing'>>,
  internalEdgesBySubgraph: Map<string | null, Array<{ index: number; edge: MermaidEdge }>>,
  subEdgesBySubgraph: Map<string | null, ElkExtendedEdge[]>,
  portsBySubgraph: Map<string, ElkPort[]>,
  subgraphsNeedingSeparate: Set<string>,
  subgraphMap: Map<string, MermaidSubgraph>,
  subgraphParent: Map<string, string | undefined>,
  rootDirection: Direction
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
    'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
    'elk.layered.cycleBreaking.strategy': 'GREEDY_MODEL_ORDER',
  }

  const ownPorts = portsBySubgraph.get(sg.id) ?? []
  const needsSeparate = subgraphsNeedingSeparate.has(sg.id) || ownPorts.length > 0

  if (needsSeparate) {
    // SEPARATE_CHILDREN starts an independent layered layout for this
    // subgraph. ELK's default for that layout is RIGHT (LR), so the
    // subgraph's effective direction (own directive, nearest ancestor's,
    // or root) must be set explicitly — an inherited TB silently renders
    // as LR inside a SEPARATE subgraph otherwise.
    layoutOptions['elk.hierarchyHandling'] = 'SEPARATE_CHILDREN'
    layoutOptions['elk.direction'] = directionToElk(
      effectiveDirection(sg.id, subgraphMap, subgraphParent, rootDirection)
    )
    if (ownPorts.length > 0) {
      // FIXED_ORDER honours the explicit `port.index` set by mermaidToElk
      // so the port nearest its endpoint sits earlier along its side. In
      // a SEPARATE subgraph ELK can't otherwise pick a good order — both
      // ends of the sub-edges meet at the same internal node — so without
      // an explicit index it falls back to declaration order, which can
      // place a far-source port between the subgraph and a closer
      // source's port and force the closer source's edge to cross through
      // it.
      layoutOptions['elk.portConstraints'] = 'FIXED_ORDER'
    }
  } else if (sg.direction) {
    // INCLUDE_CHILDREN inheritance carries the parent's direction; if this
    // subgraph has its own directive but doesn't otherwise need SEPARATE,
    // we still record the directive so a future parent's effective-direction
    // walk sees it (no-op for the layout itself).
    layoutOptions['elk.direction'] = directionToElk(sg.direction)
  }

  const elkNode: ElkGraphNode = {
    id: sg.id,
    layoutOptions,
    labels: sg.label ? [{ text: sg.label }] : undefined,
    children: [],
    edges: [],
  }
  if (ownPorts.length > 0) elkNode.ports = ownPorts

  // Direct leaf children.
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

  // Direct sub-subgraphs.
  for (const child of sg.children) {
    elkNode.children!.push(buildSubgraphNode(child, graph, opts, internalEdgesBySubgraph, subEdgesBySubgraph, portsBySubgraph, subgraphsNeedingSeparate, subgraphMap, subgraphParent, rootDirection))
  }

  // Real internal edges at this subgraph's level.
  const internalEdges = internalEdgesBySubgraph.get(sg.id) ?? []
  for (const { index, edge } of internalEdges) {
    elkNode.edges!.push(buildInternalElkEdge(index, edge))
  }
  // Cross-hier sub-edges at this subgraph's level.
  for (const e of subEdgesBySubgraph.get(sg.id) ?? []) {
    elkNode.edges!.push(e)
  }

  // Synthetic chain edges between consecutive isolated leaves of a
  // direction-bearing subgraph. ELK Layered has no edges to layer
  // disconnected leaves by — `considerModelOrder` only breaks ties
  // within a layer, not layer assignment — so a subgraph like
  // `subgraph foo; direction TB; A; B; C; end` would otherwise place
  // A/B/C in one row. The chain edges (`__bm_chain_*` ids, which the
  // renderer drops by id-prefix filter) put each isolated leaf in its
  // own layer in declaration order. Only nodes with zero internal
  // edges in this subgraph's scope are chained — parallel patterns
  // like `A→B; C→D` are left alone.
  if (sg.direction) {
    const connected = new Set<string>()
    for (const { edge } of internalEdges) {
      connected.add(edge.source)
      connected.add(edge.target)
    }
    const isolatedLeaves = sg.nodeIds.filter(id => graph.nodes.has(id) && !connected.has(id))
    for (let i = 0; i + 1 < isolatedLeaves.length; i++) {
      elkNode.edges!.push({
        id: `__bm_chain_${sg.id}_${i}`,
        sources: [isolatedLeaves[i]!],
        targets: [isolatedLeaves[i + 1]!],
      })
    }
  }

  return elkNode
}

// ============================================================================
// ELK output extraction
//
// Walk the ELK output once. For each ELK edge encountered:
//   - If id matches `e${index}` exactly, it's a real internal edge: take
//     its single section as the polyline.
//   - If id matches `e${index}_seg${k}`, it's a cross-hier sub-edge:
//     accumulate its section into an aggregate keyed by index.
//
// After walking, each cross-hier edge has N sub-sections. They concatenate
// into one continuous polyline because port positions match by construction
// (the same port id is the target of one sub-edge and the source of the
// next, so ELK places them at the same global coordinate).
// ============================================================================

interface ExtractionResult {
  nodes: PositionedNode[]
  groups: PositionedGroup[]
  edges: PositionedEdge[]
  nodeMap: Map<string, PositionedNode>
}

function elkToPositioned(
  elkResult: ElkNode,
  graph: MermaidGraph,
  decompositions: CrossHierDecomposition[]
): ExtractionResult {
  const nodes: PositionedNode[] = []
  const groups: PositionedGroup[] = []
  const nodeMap = new Map<string, PositionedNode>()
  const groupMap = new Map<string, PositionedGroup>()

  const subgraphIds = new Set<string>()
  for (const sg of graph.subgraphs) collectAllSubgraphIds(sg, subgraphIds)

  function walk(elkNode: ElkNode, offsetX: number, offsetY: number, outGroups: PositionedGroup[]): void {
    if (!elkNode.children) return
    for (const child of elkNode.children) {
      const x = (child.x ?? 0) + offsetX
      const y = (child.y ?? 0) + offsetY
      const w = child.width ?? 0
      const h = child.height ?? 0

      if (subgraphIds.has(child.id)) {
        const childGroups: PositionedGroup[] = []
        walk(child, x, y, childGroups)
        const mermaidSg = findSubgraph(graph.subgraphs, child.id)
        const g: PositionedGroup = {
          id: child.id,
          label: mermaidSg?.label ?? '',
          x, y, width: w, height: h,
          children: childGroups,
        }
        outGroups.push(g)
        groupMap.set(child.id, g)
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
        }
      }
    }
  }
  walk(elkResult, 0, 0, groups)

  // Edge polyline accumulation. Internal edges have a direct entry; cross-hier
  // edges accumulate per-segment sections then concatenate.
  interface AccumulatedSeg {
    segIdx: number
    points: Point[]
    labelPosition?: Point
  }
  const internalPolylines = new Map<number, { points: Point[]; labelPosition?: Point }>()
  const crossHierSegs = new Map<number, AccumulatedSeg[]>()

  function collectEdges(elkNode: ElkNode, offsetX: number, offsetY: number): void {
    if (elkNode.edges) {
      for (const elkEdge of elkNode.edges) {
        const id = elkEdge.id
        // Match `e${index}` or `e${index}_seg${k}`.
        const m = id.match(/^e(\d+)(?:_seg(\d+))?$/)
        if (!m) continue
        const index = parseInt(m[1]!, 10)
        if (graph.edges[index] === undefined) continue

        const points: Point[] = []
        if (elkEdge.sections && elkEdge.sections.length > 0) {
          const section = elkEdge.sections[0]!
          points.push({ x: section.startPoint.x + offsetX, y: section.startPoint.y + offsetY })
          if (section.bendPoints) {
            for (const bp of section.bendPoints) points.push({ x: bp.x + offsetX, y: bp.y + offsetY })
          }
          points.push({ x: section.endPoint.x + offsetX, y: section.endPoint.y + offsetY })
        }
        if (points.length === 0) continue

        let labelPos: Point | undefined
        if (elkEdge.labels && elkEdge.labels.length > 0) {
          const label = elkEdge.labels[0]!
          if (label.x != null && label.y != null) {
            labelPos = {
              x: label.x + (label.width ?? 0) / 2 + offsetX,
              y: label.y + (label.height ?? 0) / 2 + offsetY,
            }
          }
        }

        if (m[2] === undefined) {
          // Real internal edge.
          internalPolylines.set(index, { points, labelPosition: labelPos })
        } else {
          // Cross-hier sub-edge segment.
          const segIdx = parseInt(m[2]!, 10)
          let arr = crossHierSegs.get(index)
          if (!arr) { arr = []; crossHierSegs.set(index, arr) }
          arr.push({ segIdx, points, labelPosition: labelPos })
        }
      }
    }
    if (elkNode.children) {
      for (const child of elkNode.children) {
        collectEdges(child, offsetX + (child.x ?? 0), offsetY + (child.y ?? 0))
      }
    }
  }
  collectEdges(elkResult, 0, 0)

  // Build the edges array in graph.edges order.
  const decompByIndex = new Map<number, CrossHierDecomposition>()
  for (const d of decompositions) decompByIndex.set(d.index, d)
  const edges: PositionedEdge[] = []

  for (let i = 0; i < graph.edges.length; i++) {
    const original = graph.edges[i]!
    const decomp = decompByIndex.get(i)

    let points: Point[] = []
    let labelPos: Point | undefined

    if (decomp === undefined) {
      // Real internal edge.
      const e = internalPolylines.get(i)
      if (!e) continue
      points = e.points
      labelPos = e.labelPosition ?? (original.label ? calculatePathMidpoint(points) : undefined)
    } else {
      // Cross-hier edge: assemble in chain order.
      const segs = crossHierSegs.get(i) ?? []
      points = assembleCrossHierPolyline(decomp, segs)
      // Label was attached to the LCA-level segment.
      for (const s of segs) {
        if (s.labelPosition) { labelPos = s.labelPosition; break }
      }
      if (!labelPos && original.label && points.length > 0) {
        labelPos = calculatePathMidpoint(points)
      }
    }

    if (points.length === 0) continue

    edges.push({
      source: original.source,
      target: original.target,
      label: original.label,
      style: original.style,
      hasArrowStart: original.hasArrowStart,
      hasArrowEnd: original.hasArrowEnd,
      points,
      labelPosition: labelPos,
      inlineStyle: resolveEdgeStyle(i, graph),
    })
  }

  return { nodes, groups, edges, nodeMap }
}

/**
 * Assemble a cross-hier edge's polyline from its sub-segments, in the order
 *   source-leaf → ...source-chain ports outermost-last... → LCA-segment →
 *   ...target-chain ports outermost-first... → target-leaf.
 *
 * Sub-segments are tagged in mermaidToElk by `segIdx` in this order:
 *   srcChain[0..n-1] (source-leaf → port → port → ...)
 *   tgtChain[0..m-1] (port → ... → port → target-leaf)
 *   LCA-segment
 *
 * To assemble we sort by:
 *   1. all srcChain segments in ascending segIdx (innermost to outermost)
 *   2. then the LCA segment
 *   3. then all tgtChain segments REVERSED (outermost to innermost)
 *
 * Because endpoints of consecutive segments share a port (which ELK places
 * at the same global coordinate), the concatenation is continuous. We drop
 * the duplicated endpoint at each join.
 */
function assembleCrossHierPolyline(decomp: CrossHierDecomposition, segs: ReadonlyArray<{ segIdx: number; points: Point[] }>): Point[] {
  if (segs.length === 0) return []

  const srcLen = decomp.srcChain.length
  const tgtLen = decomp.tgtChain.length
  // Sort segments into the per-chain buckets by their segIdx slot.
  const srcSegs: Array<Point[] | undefined> = new Array(srcLen)
  const tgtSegs: Array<Point[] | undefined> = new Array(tgtLen)
  let lcaSeg: Point[] | undefined

  for (const s of segs) {
    if (s.segIdx < srcLen) {
      srcSegs[s.segIdx] = s.points
    } else if (s.segIdx < srcLen + tgtLen) {
      tgtSegs[s.segIdx - srcLen] = s.points
    } else {
      // LCA segment. If we reversed it in the ELK input to break a cycle,
      // ELK gave us points in reverse order (from what is logically the
      // target back to the source); flip them so concatenation joins on
      // the correct port at each end.
      lcaSeg = decomp.lcaReversed ? [...s.points].reverse() : s.points
    }
  }

  const ordered: Point[][] = []
  for (let i = 0; i < srcLen; i++) {
    const seg = srcSegs[i]
    if (seg) ordered.push(seg)
  }
  if (lcaSeg) ordered.push(lcaSeg)
  for (let i = tgtLen - 1; i >= 0; i--) {
    const seg = tgtSegs[i]
    if (seg) ordered.push(seg)
  }

  if (ordered.length === 0) return []

  // Concatenate, dropping the duplicated joining point at each boundary.
  const out: Point[] = [...ordered[0]!]
  for (let i = 1; i < ordered.length; i++) {
    const seg = ordered[i]!
    if (seg.length === 0) continue
    const last = out[out.length - 1]!
    const first = seg[0]!
    if (Math.abs(last.x - first.x) < 0.5 && Math.abs(last.y - first.y) < 0.5) {
      // Skip the duplicated point.
      for (let j = 1; j < seg.length; j++) out.push(seg[j]!)
    } else {
      // Endpoints don't match exactly — concatenate as-is, with both points.
      // This shouldn't happen with a correctly-configured ELK pass but is
      // robust against rounding.
      for (const p of seg) out.push(p)
    }
  }

  return simplifyColinear(out)
}

// ============================================================================
// Polyline simplification
// ============================================================================

const COORD_EPSILON = 0.5

function simplifyColinear(points: Point[]): Point[] {
  if (points.length <= 2) return points
  // Drop zero-length segments first.
  const compact: Point[] = [points[0]!]
  for (let i = 1; i < points.length; i++) {
    const prev = compact[compact.length - 1]!
    const cur = points[i]!
    if (Math.abs(prev.x - cur.x) < COORD_EPSILON && Math.abs(prev.y - cur.y) < COORD_EPSILON) continue
    compact.push(cur)
  }
  if (compact.length <= 2) return compact
  const out: Point[] = [compact[0]!]
  for (let i = 1; i < compact.length - 1; i++) {
    const prev = out[out.length - 1]!
    const cur = compact[i]!
    const next = compact[i + 1]!
    const sameX = Math.abs(prev.x - cur.x) < COORD_EPSILON && Math.abs(cur.x - next.x) < COORD_EPSILON
    const sameY = Math.abs(prev.y - cur.y) < COORD_EPSILON && Math.abs(cur.y - next.y) < COORD_EPSILON
    if (sameX || sameY) continue
    out.push(cur)
  }
  out.push(compact[compact.length - 1]!)
  return out
}

// ============================================================================
// Style resolution helpers
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
// Iterative port-index recomputation
//
// Each ELK pass leaves every cross-hier port, leaf, and sub-edge endpoint
// with a known position. Reading those back lets us recompute port indices
// on each subgraph boundary by the position of each port's outside
// neighbour — the next step outward along the cross-hier chain. Sorting
// by perpendicular coordinate (x for NORTH/SOUTH, y for EAST/WEST) places
// each port directly across from its outward neighbour, the order that
// minimises crossings between cross-hier sub-edges entering the same
// subgraph side. Used by `layoutGraphSync`'s iterative barycenter pass.
// ============================================================================

function computePortIndicesFromLayout(
  elkResult: ElkNode,
  rawPortsBySubgraph: Map<string, CrossHierPort[]>,
  decompositions: CrossHierDecomposition[]
): Map<string, number> {
  // 1. Walk ELK output and collect global positions for every port and
  //    every node center. Ports live as `node.ports[]` per ELK schema.
  const portPositions = new Map<string, Point>()
  const nodeCenters = new Map<string, Point>()
  function walk(elkNode: ElkNode, offsetX: number, offsetY: number): void {
    if (!elkNode.children) return
    for (const child of elkNode.children) {
      const x = (child.x ?? 0) + offsetX
      const y = (child.y ?? 0) + offsetY
      const w = child.width ?? 0
      const h = child.height ?? 0
      nodeCenters.set(child.id, { x: x + w / 2, y: y + h / 2 })
      const ports = (child as ElkGraphNode).ports
      if (ports) {
        for (const p of ports) {
          // ELK fills in port.x/.y after layout; these are relative to the node.
          const pAny = p as ElkPort & { x?: number; y?: number }
          const px = pAny.x ?? 0
          const py = pAny.y ?? 0
          portPositions.set(p.id, { x: x + px, y: y + py })
        }
      }
      walk(child, x, y)
    }
  }
  walk(elkResult, 0, 0)

  // 2. For each cross-hier port, compute the BARYCENTER of the edge's two
  //    endpoints (source leaf and target leaf). This is the standard port-
  //    ordering heuristic for crossing minimisation in port-constrained
  //    layered layouts (KLay Layered uses the same approach internally).
  //    Sorting ports by their edge's barycentre puts each port near where
  //    the edge "wants to be" geographically, which propagates consistently
  //    across subgraphs at every nesting level — when two cross-hier edges
  //    share a source (e.g. both `spec→stepA` and `spec→merged`), the
  //    target position breaks the tie and orders ports identically on
  //    every subgraph the edges traverse.
  const barycenter = new Map<string, Point>()
  for (const decomp of decompositions) {
    const sourcePos = nodeCenters.get(decomp.edge.source)
    const targetPos = nodeCenters.get(decomp.edge.target)
    if (!sourcePos || !targetPos) continue
    const bary = { x: (sourcePos.x + targetPos.x) / 2, y: (sourcePos.y + targetPos.y) / 2 }
    for (const port of decomp.srcChain) barycenter.set(port.portId, bary)
    for (const port of decomp.tgtChain) barycenter.set(port.portId, bary)
  }

  // 3. Per subgraph, group ports by side and sort each side independently
  //    by the outward neighbour's perpendicular coordinate (x for NORTH/SOUTH,
  //    y for EAST/WEST). Indices restart at 0 per side and increase in the
  //    natural perpendicular direction.
  const newIndices = new Map<string, number>()
  for (const raws of rawPortsBySubgraph.values()) {
    const bySide = new Map<Side, CrossHierPort[]>()
    for (const p of raws) {
      let arr = bySide.get(p.side)
      if (!arr) { arr = []; bySide.set(p.side, arr) }
      arr.push(p)
    }
    for (const sidePorts of bySide.values()) {
      sidePorts.sort((a, b) => {
        const aPos = barycenter.get(a.portId)
        const bPos = barycenter.get(b.portId)
        if (aPos && bPos) {
          const k1 = (a.side === 'NORTH' || a.side === 'SOUTH') ? aPos.x : aPos.y
          const k2 = (a.side === 'NORTH' || a.side === 'SOUTH') ? bPos.x : bPos.y
          if (Math.abs(k1 - k2) > 0.5) return k1 - k2
        }
        if (a.outsideDepth !== b.outsideDepth) return a.outsideDepth - b.outsideDepth
        return a.edgeIndex - b.edgeIndex
      })
      sidePorts.forEach((p, idx) => newIndices.set(p.portId, idx))
    }
  }
  return newIndices
}

function sameIndices(a: Map<string, number>, b: Map<string, number>): boolean {
  if (a.size !== b.size) return false
  for (const [k, v] of a) if (b.get(k) !== v) return false
  return true
}

/** True iff at least one subgraph has 2+ ports on the same side — the only case where indices can affect crossings. */
function hasReorderableSide(rawPortsBySubgraph: Map<string, CrossHierPort[]>): boolean {
  for (const raws of rawPortsBySubgraph.values()) {
    const counts = new Map<Side, number>()
    for (const p of raws) counts.set(p.side, (counts.get(p.side) ?? 0) + 1)
    for (const c of counts.values()) if (c > 1) return true
  }
  return false
}

/**
 * Count right-angle crossings between distinct edges. A crossing is a
 * horizontal segment of one edge passing over a vertical segment of
 * another with the intersection strictly inside both segments
 * (`HOP_RADIUS + 1` padding from each endpoint, matching the renderer so
 * this count predicts the hop count drawn on screen). Same-edge
 * intersections do not count.
 *
 * Exported for the stress test suite. Internal API; do not depend on
 * this from outside `src/`.
 */
export function countRightAngleCrossings(edges: ReadonlyArray<PositionedEdge>): number {
  interface Seg { edgeIdx: number; axis: 'H' | 'V'; pos: number; rangeMin: number; rangeMax: number }
  const segs: Seg[] = []
  const EPS = 0.5
  for (let ei = 0; ei < edges.length; ei++) {
    const pts = edges[ei]!.points
    for (let si = 0; si + 1 < pts.length; si++) {
      const p1 = pts[si]!
      const p2 = pts[si + 1]!
      const dx = p2.x - p1.x
      const dy = p2.y - p1.y
      if (Math.abs(dy) < EPS && Math.abs(dx) > EPS) {
        segs.push({ edgeIdx: ei, axis: 'H', pos: (p1.y + p2.y) / 2, rangeMin: Math.min(p1.x, p2.x), rangeMax: Math.max(p1.x, p2.x) })
      } else if (Math.abs(dx) < EPS && Math.abs(dy) > EPS) {
        segs.push({ edgeIdx: ei, axis: 'V', pos: (p1.x + p2.x) / 2, rangeMin: Math.min(p1.y, p2.y), rangeMax: Math.max(p1.y, p2.y) })
      }
    }
  }
  const PAD = 6 // matches renderer's HOP_RADIUS+1
  let count = 0
  for (const h of segs) {
    if (h.axis !== 'H') continue
    for (const v of segs) {
      if (v.axis !== 'V') continue
      if (h.edgeIdx === v.edgeIdx) continue
      if (v.pos < h.rangeMin + PAD || v.pos > h.rangeMax - PAD) continue
      if (h.pos < v.rangeMin + PAD || h.pos > v.rangeMax - PAD) continue
      count++
    }
  }
  return count
}

// ============================================================================
// Public API
// ============================================================================

export function layoutGraphSync(
  graph: MermaidGraph,
  options: RenderOptions = {}
): PositionedGraph {
  const opts = { ...DEFAULTS, ...options }

  // Pass 1: default port indices.
  const pass1 = mermaidToElk(graph, opts)
  const r1 = elkLayoutSync(pass1.elkGraph)
  const ext1 = elkToPositioned(r1, graph, pass1.decompositions)
  let extracted = ext1
  let elkResult = r1

  // Iterative barycenter port-ordering pass. Skipped unless (a) some
  // subgraph has multiple ports on the same side (otherwise port indices
  // can't affect anything) AND (b) pass 1 has right-angle crossings to
  // reduce. Each iteration reads the previous layout's leaf positions,
  // recomputes each port's barycentre, re-sorts ports per subgraph side,
  // and re-runs ELK with the new indices. The new layout is accepted only
  // if it strictly reduces crossings; iteration stops on convergence or
  // after MAX_PASSES iterations. Standard crossing-minimisation layer
  // sweep adapted for subgraph-port layered layouts.
  if (hasReorderableSide(pass1.rawPortsBySubgraph)) {
    let bestExt = ext1
    let bestResult = r1
    let bestCrossings = countRightAngleCrossings(ext1.edges)
    let prevIndices: Map<string, number> | undefined
    const MAX_PASSES = 4
    for (let i = 0; bestCrossings > 0 && i < MAX_PASSES; i++) {
      const newIndices = computePortIndicesFromLayout(bestResult, pass1.rawPortsBySubgraph, pass1.decompositions)
      // Stop when the heuristic produces the same indices as last iteration.
      if (prevIndices && sameIndices(newIndices, prevIndices)) break
      prevIndices = newIndices
      const candidate = mermaidToElk(graph, opts, newIndices)
      const candidateResult = elkLayoutSync(candidate.elkGraph)
      const candidateExt = elkToPositioned(candidateResult, graph, candidate.decompositions)
      const candidateCrossings = countRightAngleCrossings(candidateExt.edges)
      if (candidateCrossings < bestCrossings) {
        bestExt = candidateExt
        bestResult = candidateResult
        bestCrossings = candidateCrossings
      } else {
        break
      }
    }
    extracted = bestExt
    elkResult = bestResult
  }

  // Shape-aware endpoint clipping (diamonds, etc.) on every edge.
  for (const edge of extracted.edges) {
    const s = extracted.nodeMap.get(edge.source)
    const t = extracted.nodeMap.get(edge.target)
    if (s) edge.points = clipEdgeToShape(edge.points, s, true)
    if (t) edge.points = clipEdgeToShape(edge.points, t, false)
  }

  // Final canvas bounds = ELK's layout extent expanded for any edge points or
  // labels that ended up beyond the node bounding box.
  let width = elkResult.width ?? 800
  let height = elkResult.height ?? 600
  const arrowMargin = ARROW_HEAD.width
  const padding = DEFAULTS.padding

  for (const edge of extracted.edges) {
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
    edges: extracted.edges,
    groups: extracted.groups,
  }
}

/**
 * Convert MermaidGraph to ELK format — exported for benchmarking. Returns the
 * exact input the ELK call uses inside `layoutGraphSync`.
 */
export function convertToElkFormat(
  graph: MermaidGraph,
  options: RenderOptions = {}
): ElkNode {
  const opts = { ...DEFAULTS, ...options }
  return mermaidToElk(graph, opts).elkGraph
}
