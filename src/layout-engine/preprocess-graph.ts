/**
 * Mermaid-side preparation: classify edges, decompose cross-subgraph edges
 * into port chains, break LCA-level cycles, decide which subgraphs need
 * `SEPARATE_CHILDREN`.
 *
 * Terminology used throughout this file:
 *
 * - **User-declared edge**: an entry in `graph.edges` — one of the edges
 *   the user wrote in mermaid source.
 * - **Internal edge**: a user-declared edge whose endpoints sit in the
 *   same subgraph (or both at root). Passes straight to ELK.
 * - **Cross-subgraph edge**: a user-declared edge whose endpoints sit in
 *   different subgraphs. Decomposed into a chain of sub-edges.
 * - **Sub-edge**: an ELK-level edge synthesised during decomposition —
 *   either a port-to-port hop along the chain or the LCA-level segment
 *   joining the chains. Source and target are direct siblings, so ELK
 *   can route it.
 * - **Boundary port**: a synthetic port placed on a subgraph's perimeter
 *   where a cross-subgraph edge enters or leaves the subgraph.
 * - **LCA** (lowest common ancestor): the deepest subgraph that contains
 *   both endpoints of a cross-subgraph edge; the "meeting level" where
 *   the source-side and target-side chains join.
 */

import type {
  MermaidGraph,
  MermaidSubgraph,
  MermaidEdge,
  Direction,
} from '../types.ts'
import {
  type Side,
  directionToElk,
  outgoingSide,
  incomingSide,
  effectiveDirection,
  buildSubgraphParentMap,
  buildSubgraphMap,
  buildNodeToSubgraphMap,
  collectSubgraphNodeIds,
  lowestCommonAncestor,
  pushTo,
  addTo,
} from './utilities.ts'

export interface CrossSubgraphPort {
  /** Stable, unique ELK port id. */
  portId: string
  /** Subgraph that owns this port. */
  subgraphId: string
  /** Side of the subgraph the port sits on. */
  side: Side
  /** 'out' = outgoing (source side), 'in' = incoming (target side). */
  direction: 'in' | 'out'
  /** Index of the underlying cross-subgraph edge in graph.edges. Numeric tiebreaker that orders ports sharing a side and outsideDepth in declaration order. */
  edgeIndex: number
  /**
   * Number of subgraph levels between this port's subgraph and the source
   * (for `direction: 'in'`) or the target (for `direction: 'out'`) of the
   * underlying cross-subgraph edge. Used as a tiebreaker when several ports
   * share a side: the closer endpoint goes first along the side, which
   * matches the natural geographic order in most diagrams (closer leaves
   * are typically laid out closer to their target subgraph).
   */
  outsideDepth: number
}

export interface PreprocessedEdge {
  /** Index of this edge in graph.edges. */
  index: number
  edge: MermaidEdge
  /** Source-side subgraph chain, innermost first (excluding LCA). Empty if source is direct child of LCA. */
  sourceChain: CrossSubgraphPort[]
  /** Target-side subgraph chain, innermost first (excluding LCA). Empty if target is direct child of LCA. */
  targetChain: CrossSubgraphPort[]
  /** LCA subgraph id, or undefined for root LCA. */
  lca: string | undefined
  /**
   * True when the LCA-level segment was reversed in the ELK input to break
   * a cycle in that LCA's flow DAG (e.g. two siblings with bidirectional
   * cross-subgraph edges). The polyline for this segment is reversed back during
   * assembly so the user-visible direction is preserved.
   */
  lcaReversed: boolean
}

export interface PreprocessedGraph {
  graph: MermaidGraph
  preprocessedEdges: PreprocessedEdge[]
  internalEdgesBySubgraph: Map<string | null, Array<{ index: number; edge: MermaidEdge }>>
  subgraphsNeedingSeparate: Set<string>
  subgraphMap: Map<string, MermaidSubgraph>
  subgraphParent: Map<string, string | undefined>
  nodeToSubgraph: Map<string, string>
  subgraphNodeIds: Set<string>
  subgraphIds: Set<string>
}

/**
 * Walk from source-side and target-side subgraphs up to their LCA,
 * emitting one boundary port per subgraph crossed. Source-side ports sit
 * on the outgoing side of each subgraph's effective direction;
 * target-side ports sit on the incoming side. Each port's
 * `outsideDepth` records how many subgraph levels separate it from its
 * leaf endpoint — used as a tiebreaker when several ports share a side,
 * so the closer endpoint goes first along the side (the best blind
 * heuristic before the iterative barycentre pass).
 */
function preprocessEdge(
  index: number,
  edge: MermaidEdge,
  sourceSg: string | undefined,
  targetSg: string | undefined,
  subgraphParent: Map<string, string | undefined>,
  subgraphMap: Map<string, MermaidSubgraph>,
  rootDirection: Direction
): PreprocessedEdge {
  const lca = lowestCommonAncestor(sourceSg, targetSg, subgraphParent)

  function buildChain(startSg: string | undefined, dir: 'in' | 'out'): CrossSubgraphPort[] {
    const chain: CrossSubgraphPort[] = []
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
        outsideDepth: 0,
      })
      cur = subgraphParent.get(cur)
    }
    for (let i = 0; i < chain.length; i++) {
      chain[i]!.outsideDepth = chain.length - i
    }
    return chain
  }

  return {
    index,
    edge,
    sourceChain: buildChain(sourceSg, 'out'),
    targetChain: buildChain(targetSg, 'in'),
    lca,
    lcaReversed: false,
  }
}

/**
 * Split user-declared edges into internal vs. cross-subgraph. A
 * "user-declared edge" is an entry in `graph.edges`. An "internal" edge
 * has both endpoints in the same subgraph (or both at root); a
 * "cross-subgraph" edge has endpoints in different subgraphs and needs
 * port-chain decomposition before ELK can route it.
 *
 * Output: `internalEdgesBySubgraph` keyed by the owning subgraph (`null`
 * for root) and `crossSubgraphRaw` with the source/target subgraph ids
 * stashed for stage 2's chain walk.
 */
function classifyEdges(
  graph: MermaidGraph,
  nodeToSubgraph: Map<string, string>
): {
  internalEdgesBySubgraph: Map<string | null, Array<{ index: number; edge: MermaidEdge }>>
  crossSubgraphRaw: Array<{ index: number; edge: MermaidEdge; sourceSg: string | undefined; targetSg: string | undefined }>
} {
  const internalEdgesBySubgraph = new Map<string | null, Array<{ index: number; edge: MermaidEdge }>>()
  const crossSubgraphRaw: Array<{ index: number; edge: MermaidEdge; sourceSg: string | undefined; targetSg: string | undefined }> = []
  for (let i = 0; i < graph.edges.length; i++) {
    const edge = graph.edges[i]!
    const sourceSg = nodeToSubgraph.get(edge.source)
    const targetSg = nodeToSubgraph.get(edge.target)
    if (sourceSg === targetSg) {
      pushTo(internalEdgesBySubgraph, sourceSg ?? null, { index: i, edge })
    } else {
      crossSubgraphRaw.push({ index: i, edge, sourceSg, targetSg })
    }
  }
  return { internalEdgesBySubgraph, crossSubgraphRaw }
}

function decomposeCrossSubgraphEdges(
  crossSubgraphRaw: ReadonlyArray<{ index: number; edge: MermaidEdge; sourceSg: string | undefined; targetSg: string | undefined }>,
  subgraphParent: Map<string, string | undefined>,
  subgraphMap: Map<string, MermaidSubgraph>,
  rootDirection: Direction
): PreprocessedEdge[] {
  return crossSubgraphRaw.map(ce =>
    preprocessEdge(ce.index, ce.edge, ce.sourceSg, ce.targetSg, subgraphParent, subgraphMap, rootDirection)
  )
}

/**
 * Sibling subgraphs with opposing cross-subgraph edges form a 2-cycle in
 * the layered DAG at their LCA. ELK arbitrarily breaks it, silently
 * inverting declaration order. To control which edge is reversed, walk
 * preprocessedEdges in source-declaration order: seed the per-LCA
 * flow-DAG with internal edges, then for each LCA-level sub-edge check
 * whether adding it forward would close a cycle; if it would, mark
 * `lcaReversed = true` and record the reverse direction instead. The
 * polyline assembly reverses the segment back so the user-visible
 * direction is preserved. Without this step, rendered direction at
 * cycle pairs would flip non-deterministically across ELK versions.
 */
function markLcaCyclesReversed(
  preprocessedEdges: PreprocessedEdge[],
  internalEdgesBySubgraph: Map<string | null, Array<{ index: number; edge: MermaidEdge }>>
): void {
  const lcaAdj = new Map<string | null, Map<string, Set<string>>>()
  function getAdj(lca: string | null): Map<string, Set<string>> {
    let a = lcaAdj.get(lca)
    if (!a) { a = new Map(); lcaAdj.set(lca, a) }
    return a
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
  for (const [lcaKey, edges] of internalEdgesBySubgraph) {
    const a = getAdj(lcaKey)
    for (const { edge } of edges) addTo(a, edge.source, edge.target)
  }
  for (const preprocessed of preprocessedEdges) {
    const sourceAncestor = preprocessed.sourceChain.length > 0
      ? preprocessed.sourceChain[preprocessed.sourceChain.length - 1]!.subgraphId
      : preprocessed.edge.source
    const targetAncestor = preprocessed.targetChain.length > 0
      ? preprocessed.targetChain[preprocessed.targetChain.length - 1]!.subgraphId
      : preprocessed.edge.target
    if (sourceAncestor === targetAncestor) continue
    const adj = getAdj(preprocessed.lca ?? null)
    if (hasPath(adj, targetAncestor, sourceAncestor)) {
      preprocessed.lcaReversed = true
      addTo(adj, targetAncestor, sourceAncestor)
    } else {
      addTo(adj, sourceAncestor, targetAncestor)
    }
  }
}

function subgraphsWithDirectionMismatch(
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

function subgraphsContainingCrossSubgraphLeafEndpoint(
  nodeToSubgraph: Map<string, string>,
  preprocessedEdges: ReadonlyArray<PreprocessedEdge>
): Set<string> {
  const result = new Set<string>()
  for (const preprocessed of preprocessedEdges) {
    const sourceSubgraphId = nodeToSubgraph.get(preprocessed.edge.source)
    if (sourceSubgraphId) result.add(sourceSubgraphId)
    const targetSubgraphId = nodeToSubgraph.get(preprocessed.edge.target)
    if (targetSubgraphId) result.add(targetSubgraphId)
  }
  return result
}

function subgraphsOwningCrossSubgraphPort(
  preprocessedEdges: ReadonlyArray<PreprocessedEdge>
): Set<string> {
  const result = new Set<string>()
  for (const preprocessed of preprocessedEdges) {
    for (const p of preprocessed.sourceChain) result.add(p.subgraphId)
    for (const p of preprocessed.targetChain) result.add(p.subgraphId)
  }
  return result
}

function computeSubgraphsNeedingSeparate(
  subgraphMap: Map<string, MermaidSubgraph>,
  subgraphParent: Map<string, string | undefined>,
  rootDirection: Direction,
  nodeToSubgraph: Map<string, string>,
  preprocessedEdges: ReadonlyArray<PreprocessedEdge>
): Set<string> {
  const result = new Set<string>()
  for (const id of subgraphsWithDirectionMismatch(subgraphMap, subgraphParent, rootDirection)) result.add(id)
  for (const id of subgraphsContainingCrossSubgraphLeafEndpoint(nodeToSubgraph, preprocessedEdges)) result.add(id)
  for (const id of subgraphsOwningCrossSubgraphPort(preprocessedEdges)) result.add(id)
  return result
}

/**
 * Run stages 1–4 of the pipeline on a `MermaidGraph`. The returned
 * `PreprocessedGraph` carries everything stage 5 (build ELK input)
 * needs: index maps, the internal-edges-by-LCA map, the list of
 * decomposed cross-subgraph edges, and the SEPARATE_CHILDREN set. No
 * ELK input is built here.
 */
export function preprocess(graph: MermaidGraph): PreprocessedGraph {
  const subgraphNodeIds = new Set<string>()
  const subgraphIds = new Set<string>()
  for (const sg of graph.subgraphs) {
    subgraphIds.add(sg.id)
    collectSubgraphNodeIds(sg, subgraphNodeIds, subgraphIds)
  }
  const nodeToSubgraph = buildNodeToSubgraphMap(graph.subgraphs)
  const subgraphParent = buildSubgraphParentMap(graph.subgraphs)
  const subgraphMap = buildSubgraphMap(graph.subgraphs)

  const { internalEdgesBySubgraph, crossSubgraphRaw } = classifyEdges(graph, nodeToSubgraph)
  const preprocessedEdges = decomposeCrossSubgraphEdges(crossSubgraphRaw, subgraphParent, subgraphMap, graph.direction)
  markLcaCyclesReversed(preprocessedEdges, internalEdgesBySubgraph)
  const subgraphsNeedingSeparate = computeSubgraphsNeedingSeparate(
    subgraphMap, subgraphParent, graph.direction, nodeToSubgraph, preprocessedEdges
  )

  return {
    graph,
    preprocessedEdges,
    internalEdgesBySubgraph,
    subgraphsNeedingSeparate,
    subgraphMap,
    subgraphParent,
    nodeToSubgraph,
    subgraphNodeIds,
    subgraphIds,
  }
}
