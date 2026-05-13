/**
 * Phase-agnostic helpers reused across the pipeline.
 */

import type { MermaidGraph, MermaidSubgraph, Direction } from '../types.ts'
import { FONT_SIZES, FONT_WEIGHTS, NODE_PADDING } from '../styles.ts'
import { measureMultilineText } from '../text-metrics.ts'

export type ElkDirection = 'RIGHT' | 'LEFT' | 'UP' | 'DOWN'
export type Side = 'NORTH' | 'SOUTH' | 'EAST' | 'WEST'

/** Convert Mermaid direction to ELK direction */
export function directionToElk(dir: Direction): ElkDirection {
  switch (dir) {
    case 'LR': return 'RIGHT'
    case 'RL': return 'LEFT'
    case 'BT': return 'UP'
    case 'TD':
    case 'TB':
    default:   return 'DOWN'
  }
}

/** The side an outgoing edge exits on, given the producing subgraph's flow direction. */
export function outgoingSide(dir: Direction): Side {
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
export function incomingSide(dir: Direction): Side {
  switch (dir) {
    case 'LR': return 'WEST'
    case 'RL': return 'EAST'
    case 'BT': return 'SOUTH'
    case 'TD':
    case 'TB':
    default:   return 'NORTH'
  }
}

/**
 * Effective direction at a subgraph: own direction directive if any, otherwise
 * the nearest ancestor's, otherwise the root direction. Determines which side
 * a port for an outgoing/incoming cross-subgraph edge sits on.
 */
export function effectiveDirection(
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

/** Walk every leaf id reachable from `sg` into `nodeIds`, and every nested subgraph id into `subgraphIds`. */
export function collectSubgraphNodeIds(sg: MermaidSubgraph, nodeIds: Set<string>, subgraphIds: Set<string>): void {
  for (const id of sg.nodeIds) nodeIds.add(id)
  for (const child of sg.children) {
    subgraphIds.add(child.id)
    collectSubgraphNodeIds(child, nodeIds, subgraphIds)
  }
}

/** Walk `sg` and every descendant subgraph, accumulating ids into `out`. Used to distinguish subgraph nodes from leaf nodes during ELK output extraction. */
export function collectAllSubgraphIds(sg: MermaidSubgraph, out: Set<string>): void {
  out.add(sg.id)
  for (const child of sg.children) collectAllSubgraphIds(child, out)
}

/** Locate the `MermaidSubgraph` at any depth whose id matches; `undefined` if not present. */
export function findSubgraph(subgraphs: MermaidSubgraph[], id: string): MermaidSubgraph | undefined {
  for (const sg of subgraphs) {
    if (sg.id === id) return sg
    const found = findSubgraph(sg.children, id)
    if (found) return found
  }
  return undefined
}

/** Map every subgraph id to its parent subgraph id (or `undefined` when the subgraph sits at root). */
export function buildSubgraphParentMap(subgraphs: MermaidSubgraph[]): Map<string, string | undefined> {
  const map = new Map<string, string | undefined>()
  function traverse(sg: MermaidSubgraph, parentId: string | undefined): void {
    map.set(sg.id, parentId)
    for (const child of sg.children) traverse(child, sg.id)
  }
  for (const sg of subgraphs) traverse(sg, undefined)
  return map
}

/** Map every subgraph id to its `MermaidSubgraph` for O(1) lookup by id. */
export function buildSubgraphMap(subgraphs: MermaidSubgraph[]): Map<string, MermaidSubgraph> {
  const map = new Map<string, MermaidSubgraph>()
  function index(sg: MermaidSubgraph): void {
    map.set(sg.id, sg)
    for (const child of sg.children) index(child)
  }
  for (const sg of subgraphs) index(sg)
  return map
}

/** Map every leaf node id to the id of the subgraph that directly contains it. Leaves at root are absent from the map. */
export function buildNodeToSubgraphMap(subgraphs: MermaidSubgraph[]): Map<string, string> {
  const map = new Map<string, string>()
  function traverse(sg: MermaidSubgraph): void {
    for (const nodeId of sg.nodeIds) map.set(nodeId, sg.id)
    for (const child of sg.children) traverse(child)
  }
  for (const sg of subgraphs) traverse(sg)
  return map
}

/** Lowest common ancestor of two subgraph ids in the `parentMap` tree; `undefined` when either id is `undefined` or when the LCA is the root. */
export function lowestCommonAncestor(
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

/** Estimate the rendered width/height of a leaf node from its label text and shape. Used to populate ELK's per-leaf `width`/`height` before layout. */
export function estimateNodeSize(id: string, label: string, shape: string): { width: number; height: number } {
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

/** Merge classDef + per-node style overrides into the final CSS-style record for a leaf, or `undefined` when no style applies. */
export function resolveNodeStyle(nodeId: string, graph: MermaidGraph): Record<string, string> | undefined {
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

/** Merge default linkStyle + per-edge linkStyle into the final CSS-style record for an edge, or `undefined` when no style applies. */
export function resolveEdgeStyle(edgeIndex: number, graph: MermaidGraph): Record<string, string> | undefined {
  let result: Record<string, string> | undefined
  const defaultStyle = graph.linkStyles.get('default')
  if (defaultStyle) result = { ...defaultStyle }
  const indexStyle = graph.linkStyles.get(edgeIndex)
  if (indexStyle) result = result ? { ...result, ...indexStyle } : { ...indexStyle }
  return result
}

/** Push a value into a Map of arrays, creating the array on first insertion. Preserves insertion order; allows duplicates. */
export function pushTo<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  let arr = map.get(key)
  if (!arr) { arr = []; map.set(key, arr) }
  arr.push(value)
}

/** Add a value to a Map of sets, creating the set on first insertion. Drops duplicates. */
export function addTo<K, V>(map: Map<K, Set<V>>, key: K, value: V): void {
  let set = map.get(key)
  if (!set) { set = new Set(); map.set(key, set) }
  set.add(value)
}
