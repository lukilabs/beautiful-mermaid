/**
 * Layout engine for beautiful-mermaid (ELK.js based).
 *
 * ELK does both layout and routing. Per-subgraph `direction` directives
 * are honoured by setting `SEPARATE_CHILDREN` on every subgraph whose
 * direction differs from its effective parent (or that contains a leaf
 * endpoint of a cross-subgraph edge — without `SEPARATE_CHILDREN` the
 * leaf would migrate out of its declared subgraph). Cross-subgraph
 * edges are decomposed into a chain of sub-edges, one per subgraph
 * boundary they cross, with explicit ports on each subgraph's boundary
 * on the side dictated by that subgraph's direction. ELK lays out each
 * subgraph independently with its own direction and routes every edge
 * — including the cross-subgraph ones — in a single pass.
 *
 * Pipeline:
 *   preprocess:   classify edges, decompose cross-subgraph edges into
 *                 port chains, break LCA cycles, compute SEPARATE set
 *   elkLayout:    build ELK input tree, run ELK, extract positions,
 *                 iterate barycentre-sorting if multi-port crossings
 *                 remain
 *   postprocess:  shape-aware endpoint clipping; expand canvas bounds
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
