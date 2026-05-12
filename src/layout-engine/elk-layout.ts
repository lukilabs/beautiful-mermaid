/**
 * ELK round-trip with iterative crossing minimisation: build ELK input tree,
 * run ELK, extract positions, iterate barycentre-sorting if multi-port
 * crossings remain.
 */

import type { ElkNode, ElkExtendedEdge, LayoutOptions } from 'elkjs'
import type {
  MermaidGraph,
  MermaidSubgraph,
  MermaidEdge,
  Direction,
  PositionedNode,
  PositionedEdge,
  PositionedGroup,
  Point,
} from '../types.ts'
import { FONT_SIZES, FONT_WEIGHTS } from '../styles.ts'
import { measureMultilineText } from '../text-metrics.ts'
import { elkLayoutSync } from '../elk-instance.ts'
import { COORDINATE_EQUALITY_TOLERANCE, HOP_ENDPOINT_PAD } from '../render-geometry.ts'
import {
  type Side,
  directionToElk,
  effectiveDirection,
  collectAllSubgraphIds,
  findSubgraph,
  estimateNodeSize,
  resolveNodeStyle,
  resolveEdgeStyle,
  pushTo,
} from './utilities.ts'
import type {
  PreprocessedEdge,
  PreprocessedGraph,
  CrossSubgraphPort,
} from './preprocess-graph.ts'

export interface EngineOptions {
  font: string
  padding: number
  nodeSpacing: number
  layerSpacing: number
  thoroughness: number
}

interface ElkPort {
  id: string
  layoutOptions?: Record<string, string>
}

interface ElkGraphNode extends ElkNode {
  children?: ElkGraphNode[]
  edges?: ElkExtendedEdge[]
  ports?: ElkPort[]
}

export interface ExtractionResult {
  nodes: PositionedNode[]
  groups: PositionedGroup[]
  edges: PositionedEdge[]
  nodeMap: Map<string, PositionedNode>
}

export interface ElkLayoutResult {
  extraction: ExtractionResult
  width: number
  height: number
}

// ============================================================================
// Phase: ELK input construction (stage 5)
//
// Input:  PreprocessedGraph (port chains, internal edges by LCA, SEPARATE set)
// Output: ElkGraphNode tree with subgraphs as nested children, sub-edges
//         attached at their LCA's level, and FIXED_ORDER ports on every
//         SEPARATE_CHILDREN subgraph.
// ============================================================================

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

export interface BuiltElkInput {
  elkGraph: ElkGraphNode
  portsBySubgraph: Map<string, CrossSubgraphPort[]>
}

/**
 * Convert the preprocessed mermaid graph into the ELK input tree. Emits
 * one boundary port per port chain entry, one ELK sub-edge per
 * port-to-port hop plus an LCA-level segment, and one ELK node per
 * leaf and subgraph. SEPARATE subgraphs get FIXED_ORDER port constraints;
 * the per-side port indices come from the outsideDepth heuristic by
 * default, or `portIndexOverride` (from the iterative barycentre pass)
 * when supplied. Returns both the ELK tree and the cross-subgraph port
 * map; the iterative pass reads the port map back when computing new
 * indices.
 */
export function buildElkInput(
  preprocessed: PreprocessedGraph,
  opts: EngineOptions,
  portIndexOverride?: Map<string, number>
): BuiltElkInput {
  const {
    graph,
    preprocessedEdges,
    internalEdgesBySubgraph,
    subgraphsNeedingSeparate,
    subgraphMap,
    subgraphParent,
    subgraphNodeIds,
    subgraphIds,
  } = preprocessed

  const portsBySubgraph = new Map<string, CrossSubgraphPort[]>()
  const subEdgesBySubgraph = new Map<string | null, ElkExtendedEdge[]>()

  for (const edge of preprocessedEdges) {
    for (const p of edge.sourceChain) pushTo(portsBySubgraph, p.subgraphId, p)
    for (const p of edge.targetChain) pushTo(portsBySubgraph, p.subgraphId, p)

    let segCounter = 0
    function nextSegId(): string { return `e${edge.index}_seg${segCounter++}` }

    if (edge.sourceChain.length > 0) {
      const firstPort = edge.sourceChain[0]!
      pushTo(subEdgesBySubgraph, firstPort.subgraphId, {
        id: nextSegId(),
        sources: [edge.edge.source],
        targets: [firstPort.portId],
      })
      for (let i = 1; i < edge.sourceChain.length; i++) {
        const inner = edge.sourceChain[i - 1]!
        const outer = edge.sourceChain[i]!
        pushTo(subEdgesBySubgraph, outer.subgraphId, {
          id: nextSegId(),
          sources: [inner.portId],
          targets: [outer.portId],
        })
      }
    }

    if (edge.targetChain.length > 0) {
      const firstPort = edge.targetChain[0]!
      pushTo(subEdgesBySubgraph, firstPort.subgraphId, {
        id: nextSegId(),
        sources: [firstPort.portId],
        targets: [edge.edge.target],
      })
      for (let i = 1; i < edge.targetChain.length; i++) {
        const inner = edge.targetChain[i - 1]!
        const outer = edge.targetChain[i]!
        pushTo(subEdgesBySubgraph, outer.subgraphId, {
          id: nextSegId(),
          sources: [outer.portId],
          targets: [inner.portId],
        })
      }
    }

    const lcaSrc = edge.sourceChain.length > 0
      ? edge.sourceChain[edge.sourceChain.length - 1]!.portId
      : edge.edge.source
    const lcaTgt = edge.targetChain.length > 0
      ? edge.targetChain[edge.targetChain.length - 1]!.portId
      : edge.edge.target
    const lcaEdge: ElkExtendedEdge = edge.lcaReversed
      ? { id: nextSegId(), sources: [lcaTgt], targets: [lcaSrc] }
      : { id: nextSegId(), sources: [lcaSrc], targets: [lcaTgt] }
    if (edge.edge.label) lcaEdge.labels = [buildElkLabel(edge.edge.label)]
    pushTo(subEdgesBySubgraph, edge.lca ?? null, lcaEdge)
  }

  const elkPortsBySubgraph = new Map<string, ElkPort[]>()
  for (const [subgraphId, portsForSubgraph] of portsBySubgraph) {
    const bySide = new Map<Side, CrossSubgraphPort[]>()
    for (const p of portsForSubgraph) pushTo(bySide, p.side, p)
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
    elkPortsBySubgraph.set(subgraphId, elkPorts)
  }

  const portIndexOf = new Map<string, number>()
  for (const elkPorts of elkPortsBySubgraph.values()) {
    for (const p of elkPorts) {
      const idxStr = p.layoutOptions?.['org.eclipse.elk.port.index']
      if (idxStr !== undefined) portIndexOf.set(p.id, parseInt(idxStr, 10))
    }
  }
  for (const [subgraphId, edges] of subEdgesBySubgraph) {
    if (subgraphId === null) continue
    const subgraphPortIds = new Set<string>()
    for (const p of elkPortsBySubgraph.get(subgraphId) ?? []) subgraphPortIds.add(p.id)
    function sortKey(edge: ElkExtendedEdge): number {
      for (const s of edge.sources) if (subgraphPortIds.has(s)) return portIndexOf.get(s) ?? 1e9
      for (const t of edge.targets) if (subgraphPortIds.has(t)) return portIndexOf.get(t) ?? 1e9
      return 1e9
    }
    edges.sort((a, b) => sortKey(a) - sortKey(b))
  }

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
      'elk.layered.thoroughness': String(opts.thoroughness),
      'elk.layered.compaction.postCompaction.strategy': 'LEFT_RIGHT_CONSTRAINT_LOCKING',
      'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
      'elk.layered.cycleBreaking.strategy': 'DEPTH_FIRST',
      'elk.layered.wrapping.strategy': 'OFF',
      'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
    },
    children: [],
    edges: [],
  }

  for (const [id, node] of graph.nodes) {
    if (!subgraphNodeIds.has(id) && !subgraphIds.has(id)) {
      const size = estimateNodeSize(id, node.label, node.shape)
      elkGraph.children!.push({
        id, width: size.width, height: size.height,
        labels: [{ text: node.label }],
      })
    }
  }

  for (const sg of graph.subgraphs) {
    elkGraph.children!.push(buildSubgraphNode(sg, graph, opts, internalEdgesBySubgraph, subEdgesBySubgraph, elkPortsBySubgraph, subgraphsNeedingSeparate, subgraphMap, subgraphParent, graph.direction))
  }

  for (const { index, edge } of internalEdgesBySubgraph.get(null) ?? []) {
    elkGraph.edges!.push(buildInternalElkEdge(index, edge))
  }
  for (const e of subEdgesBySubgraph.get(null) ?? []) {
    elkGraph.edges!.push(e)
  }

  return { elkGraph, portsBySubgraph }
}

function buildSubgraphNode(
  sg: MermaidSubgraph,
  graph: MermaidGraph,
  opts: EngineOptions,
  internalEdgesBySubgraph: Map<string | null, Array<{ index: number; edge: MermaidEdge }>>,
  subEdgesBySubgraph: Map<string | null, ElkExtendedEdge[]>,
  elkPortsBySubgraph: Map<string, ElkPort[]>,
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

  const ownPorts = elkPortsBySubgraph.get(sg.id) ?? []
  const needsSeparate = subgraphsNeedingSeparate.has(sg.id) || ownPorts.length > 0

  if (needsSeparate) {
    layoutOptions['elk.hierarchyHandling'] = 'SEPARATE_CHILDREN'
    layoutOptions['elk.direction'] = directionToElk(
      effectiveDirection(sg.id, subgraphMap, subgraphParent, rootDirection)
    )
    if (ownPorts.length > 0) {
      layoutOptions['elk.portConstraints'] = 'FIXED_ORDER'
    }
  } else if (sg.direction) {
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
    elkNode.children!.push(buildSubgraphNode(child, graph, opts, internalEdgesBySubgraph, subEdgesBySubgraph, elkPortsBySubgraph, subgraphsNeedingSeparate, subgraphMap, subgraphParent, rootDirection))
  }

  const internalEdges = internalEdgesBySubgraph.get(sg.id) ?? []
  for (const { index, edge } of internalEdges) {
    elkNode.edges!.push(buildInternalElkEdge(index, edge))
  }
  for (const e of subEdgesBySubgraph.get(sg.id) ?? []) {
    elkNode.edges!.push(e)
  }

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
// Phase: position extraction (stage 7)
//
// Input:  ELK output tree (parent-relative x/y on every node, sections[]
//         on every edge) + the PreprocessedEdge list from stage 2.
// Output: ExtractionResult — flat node/group/edge arrays with absolute
//         coordinates, and one polyline per user-visible edge (cross-
//         subgraph chains reassembled, LCA segments reversed back if
//         stage 3 flipped them).
// ============================================================================

function extractPositions(
  elkResult: ElkNode,
  graph: MermaidGraph,
  preprocessedEdges: PreprocessedEdge[]
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

  interface AccumulatedSeg {
    segIdx: number
    points: Point[]
    labelPosition?: Point
  }
  const internalPolylines = new Map<number, { points: Point[]; labelPosition?: Point }>()
  const crossSubgraphSegs = new Map<number, AccumulatedSeg[]>()

  function collectEdges(elkNode: ElkNode, offsetX: number, offsetY: number): void {
    if (elkNode.edges) {
      for (const elkEdge of elkNode.edges) {
        const id = elkEdge.id
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
          internalPolylines.set(index, { points, labelPosition: labelPos })
        } else {
          const segIdx = parseInt(m[2]!, 10)
          pushTo(crossSubgraphSegs, index, { segIdx, points, labelPosition: labelPos })
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

  const preprocessedByEdgeIndex = new Map<number, PreprocessedEdge>()
  for (const d of preprocessedEdges) preprocessedByEdgeIndex.set(d.index, d)
  const edges: PositionedEdge[] = []

  for (let i = 0; i < graph.edges.length; i++) {
    const original = graph.edges[i]!
    const preprocessed = preprocessedByEdgeIndex.get(i)

    let points: Point[] = []
    let labelPos: Point | undefined

    if (preprocessed === undefined) {
      const e = internalPolylines.get(i)
      if (!e) continue
      points = e.points
      labelPos = e.labelPosition ?? (original.label ? calculatePathMidpoint(points) : undefined)
    } else {
      const segs = crossSubgraphSegs.get(i) ?? []
      points = assembleCrossSubgraphPolyline(preprocessed, segs)
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
 * Re-concatenate a cross-subgraph edge's sub-edge polylines into the
 * single polyline the renderer expects. The chain order is:
 *
 *   source-leaf → sourceChain[0..n-1] → LCA segment →
 *                 targetChain[m-1..0] → target-leaf
 *
 * Segments were tagged in buildElkInput by `segIdx`: 0..n-1 for the
 * source chain (innermost to outermost), n..n+m-1 for the target chain,
 * and the LCA segment last. Endpoints between adjacent segments are
 * identical port positions, so the joining vertex is dropped on each
 * boundary. The LCA segment was reversed in the ELK input when stage 3
 * marked `lcaReversed` to break a 2-cycle; reverse its points back here.
 */
function assembleCrossSubgraphPolyline(preprocessed: PreprocessedEdge, segs: ReadonlyArray<{ segIdx: number; points: Point[] }>): Point[] {
  if (segs.length === 0) return []

  const srcLen = preprocessed.sourceChain.length
  const tgtLen = preprocessed.targetChain.length
  const srcSegs: Array<Point[] | undefined> = new Array(srcLen)
  const tgtSegs: Array<Point[] | undefined> = new Array(tgtLen)
  let lcaSeg: Point[] | undefined

  for (const s of segs) {
    if (s.segIdx < srcLen) {
      srcSegs[s.segIdx] = s.points
    } else if (s.segIdx < srcLen + tgtLen) {
      tgtSegs[s.segIdx - srcLen] = s.points
    } else {
      lcaSeg = preprocessed.lcaReversed ? [...s.points].reverse() : s.points
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

  const out: Point[] = [...ordered[0]!]
  for (let i = 1; i < ordered.length; i++) {
    const seg = ordered[i]!
    if (seg.length === 0) continue
    const last = out[out.length - 1]!
    const first = seg[0]!
    if (Math.abs(last.x - first.x) < COORDINATE_EQUALITY_TOLERANCE && Math.abs(last.y - first.y) < COORDINATE_EQUALITY_TOLERANCE) {
      for (let j = 1; j < seg.length; j++) out.push(seg[j]!)
    } else {
      for (const p of seg) out.push(p)
    }
  }

  return simplifyColinear(out)
}

/**
 * ELK can emit polylines with zero-length steps (two consecutive points
 * at the same coordinate) and colinear interior vertices (three
 * consecutive points on the same axis), particularly where sub-edges
 * join through a boundary port. The downstream hop detector treats every
 * vertex as a segment boundary, so these degenerate vertices produce
 * spurious "segments" of length zero that confuse crossing classification
 * — pass 1 drops zero-length steps, pass 2 drops colinear interior
 * vertices.
 */
function simplifyColinear(points: Point[]): Point[] {
  if (points.length <= 2) return points
  const compact: Point[] = [points[0]!]
  for (let i = 1; i < points.length; i++) {
    const prev = compact[compact.length - 1]!
    const cur = points[i]!
    if (Math.abs(prev.x - cur.x) < COORDINATE_EQUALITY_TOLERANCE && Math.abs(prev.y - cur.y) < COORDINATE_EQUALITY_TOLERANCE) continue
    compact.push(cur)
  }
  if (compact.length <= 2) return compact
  const out: Point[] = [compact[0]!]
  for (let i = 1; i < compact.length - 1; i++) {
    const prev = out[out.length - 1]!
    const cur = compact[i]!
    const next = compact[i + 1]!
    const sameX = Math.abs(prev.x - cur.x) < COORDINATE_EQUALITY_TOLERANCE && Math.abs(cur.x - next.x) < COORDINATE_EQUALITY_TOLERANCE
    const sameY = Math.abs(prev.y - cur.y) < COORDINATE_EQUALITY_TOLERANCE && Math.abs(cur.y - next.y) < COORDINATE_EQUALITY_TOLERANCE
    if (sameX || sameY) continue
    out.push(cur)
  }
  out.push(compact[compact.length - 1]!)
  return out
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
// Phase: iterative crossing minimisation (stage 8)
//
// Input:  the previous pass's ELK result + the cross-subgraph port map.
// Output: a per-portId index map. Sorting ports on each subgraph side by
//         these indices and re-running stages 5–7 reduces perpendicular
//         crossings on dense fan-in/fan-out samples. Loop until
//         convergence or 4 passes.
// ============================================================================

/**
 * Recompute per-side port indices from the previous ELK output. A port's
 * **barycentre** is the midpoint of the source-leaf and target-leaf
 * positions of the cross-subgraph edge that owns the port — a single
 * point representing where the edge "wants to be" geographically.
 * Sorting each subgraph's per-side ports by barycentre puts each port
 * directly across from its outward neighbour, which is the standard
 * crossing-minimisation move adapted for port-constrained layered
 * layouts.
 */
function computePortIndicesFromLayout(
  elkResult: ElkNode,
  portsBySubgraph: Map<string, CrossSubgraphPort[]>,
  preprocessedEdges: PreprocessedEdge[]
): Map<string, number> {
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

  const barycenter = new Map<string, Point>()
  for (const preprocessed of preprocessedEdges) {
    const sourcePos = nodeCenters.get(preprocessed.edge.source)
    const targetPos = nodeCenters.get(preprocessed.edge.target)
    if (!sourcePos || !targetPos) continue
    const bary = { x: (sourcePos.x + targetPos.x) / 2, y: (sourcePos.y + targetPos.y) / 2 }
    for (const port of preprocessed.sourceChain) barycenter.set(port.portId, bary)
    for (const port of preprocessed.targetChain) barycenter.set(port.portId, bary)
  }

  const newIndices = new Map<string, number>()
  for (const portsForSubgraph of portsBySubgraph.values()) {
    const bySide = new Map<Side, CrossSubgraphPort[]>()
    for (const p of portsForSubgraph) pushTo(bySide, p.side, p)
    for (const sidePorts of bySide.values()) {
      sidePorts.sort((a, b) => {
        const aPos = barycenter.get(a.portId)
        const bPos = barycenter.get(b.portId)
        if (aPos && bPos) {
          const k1 = (a.side === 'NORTH' || a.side === 'SOUTH') ? aPos.x : aPos.y
          const k2 = (a.side === 'NORTH' || a.side === 'SOUTH') ? bPos.x : bPos.y
          if (Math.abs(k1 - k2) > COORDINATE_EQUALITY_TOLERANCE) return k1 - k2
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

function hasReorderableSide(portsBySubgraph: Map<string, CrossSubgraphPort[]>): boolean {
  for (const portsForSubgraph of portsBySubgraph.values()) {
    const counts = new Map<Side, number>()
    for (const p of portsForSubgraph) counts.set(p.side, (counts.get(p.side) ?? 0) + 1)
    for (const c of counts.values()) if (c > 1) return true
  }
  return false
}

/**
 * Count perpendicular crossings between distinct edges. A crossing is a
 * horizontal segment of one edge passing over a vertical segment of
 * another with the intersection strictly inside both segments
 * (`HOP_RADIUS + 1` padding from each endpoint, matching the renderer so
 * this count predicts the hop count drawn on screen). Same-edge
 * intersections do not count.
 *
 * Exported for the stress test suite. Internal API; do not depend on
 * this from outside `src/`.
 */
export function countPerpendicularCrossings(edges: ReadonlyArray<PositionedEdge>): number {
  interface Seg { edgeIdx: number; axis: 'H' | 'V'; pos: number; rangeMin: number; rangeMax: number }
  const segs: Seg[] = []
  for (let ei = 0; ei < edges.length; ei++) {
    const pts = edges[ei]!.points
    for (let si = 0; si + 1 < pts.length; si++) {
      const p1 = pts[si]!
      const p2 = pts[si + 1]!
      const dx = p2.x - p1.x
      const dy = p2.y - p1.y
      if (Math.abs(dy) < COORDINATE_EQUALITY_TOLERANCE && Math.abs(dx) > COORDINATE_EQUALITY_TOLERANCE) {
        segs.push({ edgeIdx: ei, axis: 'H', pos: (p1.y + p2.y) / 2, rangeMin: Math.min(p1.x, p2.x), rangeMax: Math.max(p1.x, p2.x) })
      } else if (Math.abs(dx) < COORDINATE_EQUALITY_TOLERANCE && Math.abs(dy) > COORDINATE_EQUALITY_TOLERANCE) {
        segs.push({ edgeIdx: ei, axis: 'V', pos: (p1.x + p2.x) / 2, rangeMin: Math.min(p1.y, p2.y), rangeMax: Math.max(p1.y, p2.y) })
      }
    }
  }
  let count = 0
  for (const h of segs) {
    if (h.axis !== 'H') continue
    for (const v of segs) {
      if (v.axis !== 'V') continue
      if (h.edgeIdx === v.edgeIdx) continue
      if (v.pos < h.rangeMin + HOP_ENDPOINT_PAD || v.pos > h.rangeMax - HOP_ENDPOINT_PAD) continue
      if (h.pos < v.rangeMin + HOP_ENDPOINT_PAD || h.pos > v.rangeMax - HOP_ENDPOINT_PAD) continue
      count++
    }
  }
  return count
}

// ============================================================================
// Main routine: build → run → extract → iterate
//
// Composes stages 5–8. The iterative pass is gated on `hasReorderableSide`
// (cheap: returns false unless some subgraph has 2+ ports sharing a side)
// AND the pass-1 layout having any perpendicular crossings to reduce.
// Each iteration is only accepted if crossings strictly drop; we stop on
// convergence (same indices as previous iteration) or MAX_PASSES = 4.
// ============================================================================

/**
 * Build ELK input, run ELK, extract positions; iterate barycentre-sorting
 * port indices if multi-port crossings remain. The returned width/height
 * come from ELK's root layout extent — postprocess expands them to wrap
 * arrow heads and label boxes that may sit outside.
 */
export function elkLayout(
  preprocessed: PreprocessedGraph,
  opts: EngineOptions
): ElkLayoutResult {
  const pass1 = buildElkInput(preprocessed, opts)
  const r1 = elkLayoutSync(pass1.elkGraph)
  const ext1 = extractPositions(r1, preprocessed.graph, preprocessed.preprocessedEdges)
  let extracted = ext1
  let elkResult = r1

  if (hasReorderableSide(pass1.portsBySubgraph)) {
    let bestExt = ext1
    let bestResult = r1
    let bestCrossings = countPerpendicularCrossings(ext1.edges)
    let prevIndices: Map<string, number> | undefined
    const MAX_PASSES = 4
    for (let i = 0; bestCrossings > 0 && i < MAX_PASSES; i++) {
      const newIndices = computePortIndicesFromLayout(bestResult, pass1.portsBySubgraph, preprocessed.preprocessedEdges)
      if (prevIndices && sameIndices(newIndices, prevIndices)) break
      prevIndices = newIndices
      const candidate = buildElkInput(preprocessed, opts, newIndices)
      const candidateResult = elkLayoutSync(candidate.elkGraph)
      const candidateExt = extractPositions(candidateResult, preprocessed.graph, preprocessed.preprocessedEdges)
      const candidateCrossings = countPerpendicularCrossings(candidateExt.edges)
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

  return {
    extraction: extracted,
    width: elkResult.width ?? 800,
    height: elkResult.height ?? 600,
  }
}
