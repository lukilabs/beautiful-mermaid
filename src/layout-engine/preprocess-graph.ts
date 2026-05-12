/**
 * Mermaid-side preparation: classify edges, decompose cross-subgraph edges
 * into port chains, break LCA-level cycles, decide which subgraphs need
 * `SEPARATE_CHILDREN`.
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

function classifyEdges(
  graph: MermaidGraph,
  nodeToSubgraph: Map<string, string>
): {
  internalEdgesBySubgraph: Map<string | null, Array<{ index: number; edge: MermaidEdge }>>
  crossSubgraphRaw: Array<{ index: number; edge: MermaidEdge; sourceSg: string | undefined; targetSg: string | undefined }>
} {
  const internalEdgesBySubgraph = new Map<string | null, Array<{ index: number; edge: MermaidEdge }>>()
  internalEdgesBySubgraph.set(null, [])
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

export function computeSubgraphsNeedingSeparate(
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
