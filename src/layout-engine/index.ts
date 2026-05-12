/**
 * Layout engine for beautiful-mermaid (ELK.js based).
 *
 * # What ELK can and can't do for us
 *
 * ELK Layered takes a tree of nodes + edges + a direction (LR, TB, etc.)
 * and produces positions and routed polylines. Nested subgraphs
 * ("compounds") work in two modes:
 *
 * - `INCLUDE_CHILDREN` — flattens subgraphs into one big layered layout
 *   in the parent's direction. Doesn't honour per-subgraph `direction`
 *   directives.
 * - `SEPARATE_CHILDREN` — each subgraph is its own independent layered
 *   layout with its own direction. Honours per-subgraph directives. But
 *   edges crossing a `SEPARATE_CHILDREN` boundary can't be drawn as a
 *   single polyline — ELK only routes an edge where source and target
 *   are direct siblings.
 *
 * Mermaid source declares per-subgraph directions and lets any leaf
 * connect to any other leaf. Combining "honour directions" with "allow
 * cross-subgraph edges" needs work on top of ELK.
 *
 * # The trick
 *
 * For each cross-subgraph edge, decompose it into a chain of *sub-edges*:
 * one per subgraph boundary it crosses, joined at explicit boundary
 * ports. Each sub-edge has source and target as siblings, so ELK routes
 * it. After ELK runs, concatenate each chain's polylines back into the
 * single user-visible edge.
 *
 * # Pipeline (10 stages)
 *
 *  1. **Classify edges** — split user edges into *internal* (both
 *     endpoints in the same subgraph or both at root) vs.
 *     *cross-subgraph* (endpoints in different subgraphs). Output: two
 *     edge lists. Cross-subgraph edges need preprocessing; internal
 *     edges go straight through.
 *
 *  2. **Decompose cross-subgraph edges** — walk up from source to LCA
 *     and back down to target. Emit one port per subgraph boundary
 *     crossed; emit one sub-edge per pair of adjacent ports plus an
 *     LCA-level segment. At the ELK level every edge is now internal —
 *     its source and target are direct siblings. The user-visible edge
 *     still exists in our `MermaidGraph` and gets reassembled in
 *     stage 7. Output: a list of `PreprocessedEdge` records, each
 *     holding the port chain and LCA metadata. Without this, ELK can't
 *     route any cross-subgraph edge in one pass.
 *
 *  3. **Break LCA-level cycles** — when two cross-subgraph edges between
 *     the same pair of sibling subgraphs flow in opposite directions,
 *     their LCA-level sub-edges form a 2-cycle. ELK picks one cycle
 *     edge to reverse in its internal layer assignment; its pick is
 *     non-deterministic across versions and inputs. We detect the cycle
 *     in source-declaration order and mark which sub-edge to reverse.
 *     The polyline is reversed back during assembly so the user sees
 *     the original direction. Output: each `PreprocessedEdge` gains
 *     `lcaReversed: boolean`. Without it: rendered edge direction and
 *     sibling ordering can flip silently between ELK versions or even
 *     input permutations.
 *
 *  4. **Compute `SEPARATE_CHILDREN` set** — decide which subgraphs need
 *     `SEPARATE_CHILDREN` mode. Three independent reasons, any one
 *     sufficient: (a) own `direction` directive differs from effective
 *     parent — per-subgraph direction is honoured only under SEPARATE,
 *     (b) directly contains a leaf endpoint of a cross-subgraph edge —
 *     under INCLUDE_CHILDREN, ELK migrates leaves across subgraph
 *     boundaries when neighbouring layers pull them; SEPARATE locks the
 *     leaf inside, (c) owns at least one cross-subgraph port —
 *     FIXED_ORDER port indices only stick when the boundary is a real
 *     layout boundary. Output: `Set<subgraphId>`.
 *
 *  5. **Build ELK input tree** — convert `MermaidGraph` into ELK's
 *     hierarchical input shape: a root `ElkNode` with `children`
 *     recursively. Each subgraph becomes an `ElkNode` whose children are
 *     its leaves and child subgraphs; each leaf becomes an `ElkNode`
 *     with width/height; edges live on whichever node is the lowest
 *     common ancestor of their endpoints. Attach per-subgraph options
 *     (direction, hierarchy mode, padding), port lists (`FIXED_ORDER`
 *     on SEPARATE subgraphs), and the sub-edges from stage 2. Node
 *     sizing happens here. Output: an `ElkNode` tree ready for ELK.
 *
 *  6. **Run ELK** — one synchronous call lays out the whole tree.
 *     Output: same tree shape, now with `x`/`y` filled in on every node
 *     and `sections[]` (polyline points) on every edge — all
 *     coordinates parent-relative.
 *
 *  7. **Extract positions** — walk the ELK output tree. Sum parent
 *     offsets to get absolute coordinates. Build our `PositionedGraph`
 *     shape (flat `PositionedNode[]`, `PositionedGroup[]`,
 *     `PositionedEdge[]`). For each cross-subgraph edge, gather its
 *     sub-edge polylines by edge index, concatenate them in chain
 *     order, reverse the LCA segment back if stage 3 reversed it. Drop
 *     colinear and zero-length vertices left over by ELK. Output: a
 *     `PositionedGraph` with absolute coordinates and one polyline per
 *     user-visible edge.
 *
 *  8. **Iterate to reduce crossings** — skip condition: runs only if
 *     (a) some subgraph has 2+ ports on the same side AND (b) stage 7
 *     produced ≥ 1 perpendicular crossing. Otherwise the stage-7 result
 *     is final. When it runs: read back leaf positions; for each
 *     cross-subgraph port, compute the *barycentre* (midpoint of
 *     source-leaf and target-leaf positions); sort each subgraph's
 *     per-side ports by barycentre; re-run stages 5–7 with the new port
 *     indices. Accept only if crossings strictly dropped. Loop until
 *     convergence or 4 passes. Output: the lowest-crossing
 *     `PositionedGraph` from the iteration.
 *
 *  9. **Clip endpoints to non-rectangular shapes** — for diamonds,
 *     circles, etc., clip the start and end of each polyline back to
 *     where it meets the shape outline. Without it, edges visibly poke
 *     past the shape outline before meeting the arrowhead. Delegates to
 *     `shape-clipping.ts`.
 *
 * 10. **Compute final canvas bounds** — ELK reports a bounding rectangle
 *     for the root. Arrow heads, edge labels with bounding boxes that
 *     extend past the root's reported size, and the occasional negative
 *     coordinate can sit outside it. Walk every edge polyline and every
 *     label position; grow the canvas to wrap them all. Output: final
 *     `width` and `height` on the returned `PositionedGraph`.
 *
 * # In / Out
 *
 * In: `MermaidGraph` — `{ direction, nodes, edges, subgraphs, classDefs,
 * classAssignments, nodeStyles, linkStyles }`.
 *
 * Out: `PositionedGraph` — `{ width, height, nodes, groups, edges }`.
 * This is our own data structure, not ELK's. The renderer consumes it
 * to produce SVG. Each field has concrete x/y/w/h; each edge has a
 * single concatenated polyline; cross-subgraph routing is invisible to
 * the renderer.
 *
 * Entry points map to the three phases:
 *
 * - `preprocess(graph)` — stages 1–4 (mermaid-side prep)
 * - `elkLayout(preprocessed, opts)` — stages 5–8 (ELK round-trip + iteration)
 * - `postprocess(extraction, w, h, padding)` — stages 9–10 (final touch-ups)
 */

import type { ElkNode } from 'elkjs'
import type { MermaidGraph, PositionedGraph, RenderOptions } from '../types.ts'
import { preprocess } from './preprocess-graph.ts'
import { buildElkInput, elkLayout, type EngineOptions } from './elk-layout.ts'
import { postprocess } from './postprocess-graph.ts'

export { countPerpendicularCrossings } from './elk-layout.ts'

const DEFAULTS: EngineOptions = {
  font: 'Inter',
  padding: 40,
  nodeSpacing: 28,
  layerSpacing: 48,
  thoroughness: 30,
}

function resolveOptions(options: RenderOptions): EngineOptions {
  return {
    font: options.font ?? DEFAULTS.font,
    padding: options.padding ?? DEFAULTS.padding,
    nodeSpacing: options.nodeSpacing ?? DEFAULTS.nodeSpacing,
    layerSpacing: options.layerSpacing ?? DEFAULTS.layerSpacing,
    thoroughness: DEFAULTS.thoroughness,
  }
}

export function layoutGraphSync(
  graph: MermaidGraph,
  options: RenderOptions = {}
): PositionedGraph {
  const opts = resolveOptions(options)
  const preprocessed = preprocess(graph)
  const { extraction, width, height } = elkLayout(preprocessed, opts)
  return postprocess(extraction, width, height, opts.padding)
}

/**
 * Convert MermaidGraph to ELK format — exported for benchmarking. Returns the
 * exact input the ELK call uses inside `layoutGraphSync`.
 */
export function convertToElkFormat(
  graph: MermaidGraph,
  options: RenderOptions = {}
): ElkNode {
  const opts = resolveOptions(options)
  const preprocessed = preprocess(graph)
  return buildElkInput(preprocessed, opts).elkGraph
}
