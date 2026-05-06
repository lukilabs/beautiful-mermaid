// ============================================================================
// beautiful-mermaid — ASCII renderer public API
//
// Renders Mermaid diagrams to ASCII or Unicode box-drawing art.
// No external dependencies — pure TypeScript.
//
// Supported diagram types:
//   - Flowcharts (graph TD / flowchart LR) — grid-based layout with A* pathfinding
//   - State diagrams (stateDiagram-v2) — same pipeline as flowcharts
//   - Sequence diagrams (sequenceDiagram) — column-based timeline layout
//   - Class diagrams (classDiagram) — level-based UML layout
//   - ER diagrams (erDiagram) — grid layout with crow's foot notation
//
// Usage:
//   import { renderMermaidASCII } from 'beautiful-mermaid'
//   const ascii = renderMermaidASCII('graph LR\n  A --> B')
// ============================================================================

import { parseMermaid } from '../parser.ts'
import { convertToAsciiGraph } from './converter.ts'
import { createMapping } from './grid.ts'
import { drawGraph } from './draw.ts'
import { canvasToString, flipCanvasVertically, flipRoleCanvasVertically } from './canvas.ts'
import { renderSequenceAscii } from './sequence.ts'
import { renderClassAscii } from './class-diagram.ts'
import { renderErAscii } from './er-diagram.ts'
import { renderXYChartAscii } from './xychart.ts'
import { detectColorMode, DEFAULT_ASCII_THEME, diagramColorsToAsciiTheme } from './ansi.ts'
import type { AsciiConfig, AsciiTheme, ColorMode } from './types.ts'
import type { MermaidGraph, MermaidNode } from '../types.ts'
import { wrapText } from './layout-budget.ts'
import { maxLineWidth } from './multiline-utils.ts'
import { getShapeDimensions } from './shapes/index.ts'

// Re-export types for external use
export type { AsciiTheme, ColorMode }
export { DEFAULT_ASCII_THEME, detectColorMode, diagramColorsToAsciiTheme }

export interface AsciiRenderOptions {
  /** true = ASCII chars (+,-,|,>), false = Unicode box-drawing (┌,─,│,►). Default: false */
  useAscii?: boolean
  /** Horizontal spacing between nodes. Default: 5 */
  paddingX?: number
  /** Vertical spacing between nodes. Default: 5 */
  paddingY?: number
  /** Padding inside node boxes. Default: 1 */
  boxBorderPadding?: number
  /** Maximum output width in characters. Layout reduces spacing to fit. No default (unconstrained). */
  maxWidth?: number
  /**
   * Color mode for output.
   * - 'none': No colors (plain text)
   * - 'auto': Auto-detect (terminal ANSI capabilities, or HTML in browsers)
   * - 'ansi16': 16-color ANSI
   * - 'ansi256': 256-color xterm
   * - 'truecolor': 24-bit RGB
   * - 'html': HTML <span> tags with inline color styles (for browser rendering)
   * Default: 'auto'
   */
  colorMode?: ColorMode | 'auto'
  /** Theme colors for ASCII output. Uses default theme if not provided. */
  theme?: Partial<AsciiTheme>
}

/**
 * Detect the diagram type from the mermaid source text.
 * Mirrors the detection logic in src/index.ts for the SVG renderer.
 */
function detectDiagramType(text: string): 'flowchart' | 'sequence' | 'class' | 'er' | 'xychart' {
  const firstLine = text.trim().split('\n')[0]?.trim().toLowerCase() ?? ''

  if (/^xychart(-beta)?\b/.test(firstLine)) return 'xychart'
  if (/^sequencediagram\s*$/.test(firstLine)) return 'sequence'
  if (/^classdiagram\s*$/.test(firstLine)) return 'class'
  if (/^erdiagram\s*$/.test(firstLine)) return 'er'

  // Default: flowchart/state (handled by parseMermaid internally)
  return 'flowchart'
}

function buildFlowchartDepthMap(parsed: MermaidGraph): { depth: Map<string, number>; maxDepth: number } {
  const depth = new Map<string, number>()
  for (const nodeId of parsed.nodes.keys()) depth.set(nodeId, 0)

  const cap = parsed.nodes.size - 1
  for (let i = 0; i < cap; i++) {
    let changed = false
    for (const edge of parsed.edges) {
      const next = (depth.get(edge.source) ?? 0) + 1
      if (next > (depth.get(edge.target) ?? 0)) {
        depth.set(edge.target, next)
        changed = true
      }
    }
    if (!changed) break
  }

  return { depth, maxDepth: Math.max(...depth.values(), 0) }
}

function estimateNaturalFlowchartWidth(parsed: MermaidGraph, config: AsciiConfig): number {
  const orderedWidths = getFlowchartRankMetrics(parsed, config).map(rank => rank.width)
  if (orderedWidths.length === 0) return 0
  return orderedWidths.reduce((sum, width) => sum + width, 0) + Math.max(0, orderedWidths.length - 1) * config.paddingX
}

function estimateNaturalFlowchartTDWidth(parsed: MermaidGraph, config: AsciiConfig): number {
  const levelMetrics = getFlowchartLevelMetrics(parsed, config)
  let maxWidth = 0
  for (const level of levelMetrics) {
    const levelWidth = level.widths.reduce((sum, width) => sum + width, 0) + Math.max(0, level.widths.length - 1) * config.paddingX
    maxWidth = Math.max(maxWidth, levelWidth)
  }
  return maxWidth
}

function getFlowchartRankMetrics(
  parsed: MermaidGraph,
  config: AsciiConfig,
): Array<{ rank: number; width: number; nodes: Array<{ id: string; label: string; shape: string }> }> {
  const { depth } = buildFlowchartDepthMap(parsed)
  const rankMetrics = new Map<number, { width: number; nodes: Array<{ id: string; label: string; shape: string }> }>()

  for (const node of parsed.nodes.values()) {
    const rank = depth.get(node.id) ?? 0
    const dims = getShapeDimensions(node.shape, node.label, {
      useAscii: config.useAscii,
      padding: config.boxBorderPadding,
    })
    const metric = rankMetrics.get(rank) ?? { width: 0, nodes: [] }
    metric.width = Math.max(metric.width, dims.width)
    metric.nodes.push({ id: node.id, label: node.label, shape: node.shape })
    rankMetrics.set(rank, metric)
  }

  return [...rankMetrics.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([rank, metric]) => ({ rank, width: metric.width, nodes: metric.nodes }))
}

function getFlowchartLevelMetrics(
  parsed: MermaidGraph,
  config: AsciiConfig,
): Array<{ level: number; nodes: MermaidNode[]; widths: number[] }> {
  const { depth } = buildFlowchartDepthMap(parsed)
  const levelMetrics = new Map<number, { nodes: MermaidNode[]; widths: number[] }>()

  for (const node of parsed.nodes.values()) {
    const level = depth.get(node.id) ?? 0
    const dims = getShapeDimensions(node.shape, node.label, {
      useAscii: config.useAscii,
      padding: config.boxBorderPadding,
    })
    const metric = levelMetrics.get(level) ?? { nodes: [], widths: [] }
    metric.nodes.push(node)
    metric.widths.push(dims.width)
    levelMetrics.set(level, metric)
  }

  return [...levelMetrics.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([level, metric]) => ({ level, nodes: metric.nodes, widths: metric.widths }))
}

function capWidthsToBudget(widths: number[], totalBudget: number, minWidth: number): number[] {
  if (widths.length === 0) return []
  if (totalBudget <= minWidth * widths.length) return widths.map(() => minWidth)

  const capped = [...widths]
  let totalWidth = capped.reduce((sum, width) => sum + width, 0)
  if (totalWidth <= totalBudget) return capped

  const order = widths
    .map((width, index) => ({ width, index }))
    .sort((a, b) => b.width - a.width)

  for (let i = 0; i < order.length; i++) {
    const active = order.slice(0, i + 1).map(entry => entry.index)
    const currentLevel = capped[active[0]!]!
    const nextLevel = i === order.length - 1 ? minWidth : Math.max(minWidth, order[i + 1]!.width)
    const reducible = (currentLevel - nextLevel) * active.length

    if (totalWidth - reducible <= totalBudget) {
      let remainingReduction = totalWidth - totalBudget
      const baseReduction = Math.floor(remainingReduction / active.length)
      let remainder = remainingReduction % active.length

      for (const index of active) {
        const reduction = baseReduction + (remainder > 0 ? 1 : 0)
        capped[index] = Math.max(minWidth, capped[index]! - reduction)
        if (remainder > 0) remainder--
      }
      return capped
    }

    for (const index of active) {
      capped[index] = nextLevel
    }
    totalWidth -= reducible
  }

  return capped.map(width => Math.max(minWidth, width))
}

function applyFlowchartWidthBudget(parsed: MermaidGraph, config: AsciiConfig): void {
  if (!config.maxWidth || config.maxWidth <= 0) return
  if (config.graphDirection !== 'LR') {
    const hasStatePseudoNode = [...parsed.nodes.values()].some(node => node.shape === 'state-start' || node.shape === 'state-end')
    const availableWidth = hasStatePseudoNode ? Math.max(1, config.maxWidth - 7) : config.maxWidth
    if (availableWidth >= estimateNaturalFlowchartTDWidth(parsed, config)) return

    config.paddingX = Math.min(config.paddingX, 2)
    if (availableWidth < estimateNaturalFlowchartTDWidth(parsed, config)) {
      config.boxBorderPadding = Math.min(config.boxBorderPadding, 0)
    }

    for (const level of getFlowchartLevelMetrics(parsed, config)) {
      const totalGapWidth = Math.max(0, level.widths.length - 1) * config.paddingX
      const levelBudget = Math.max(0, availableWidth - totalGapWidth)
      const levelCaps = capWidthsToBudget(level.widths, levelBudget, 8)

      for (let i = 0; i < level.nodes.length; i++) {
        const node = level.nodes[i]!
        const levelCap = levelCaps[i] ?? level.widths[i]
        if (!levelCap) continue

        const dims = getShapeDimensions(node.shape, node.label, {
          useAscii: config.useAscii,
          padding: config.boxBorderPadding,
        })
        if (dims.width <= levelCap) continue

        const overhead = dims.width - maxLineWidth(node.label)
        const contentBudget = Math.max(1, levelCap - overhead)
        node.label = wrapText(node.label, contentBudget)
      }
    }
    return
  }

  if (config.maxWidth >= estimateNaturalFlowchartWidth(parsed, config)) return

  config.paddingX = Math.min(config.paddingX, 2)
  config.boxBorderPadding = Math.min(config.boxBorderPadding, 0)

  const rankMetrics = getFlowchartRankMetrics(parsed, config)
  const totalGapWidth = Math.max(0, rankMetrics.length - 1) * config.paddingX
  const rankBudget = Math.max(0, config.maxWidth - totalGapWidth)
  const rankCaps = capWidthsToBudget(
    rankMetrics.map(rank => rank.width),
    rankBudget,
    8,
  )
  const capByRank = new Map(rankMetrics.map((rank, index) => [rank.rank, rankCaps[index] ?? rank.width]))
  const { depth } = buildFlowchartDepthMap(parsed)

  for (const node of parsed.nodes.values()) {
    const rank = depth.get(node.id) ?? 0
    const rankCap = capByRank.get(rank)
    if (!rankCap) continue

    const dims = getShapeDimensions(node.shape, node.label, {
      useAscii: config.useAscii,
      padding: config.boxBorderPadding,
    })
    if (dims.width <= rankCap) continue

    const overhead = dims.width - maxLineWidth(node.label)
    const contentBudget = Math.max(1, rankCap - overhead)
    node.label = wrapText(node.label, contentBudget)
  }
}

/**
 * Render Mermaid diagram text to an ASCII/Unicode string.
 *
 * Synchronous — no async layout engine needed (unlike the SVG renderer).
 * Auto-detects diagram type from the header line and dispatches to
 * the appropriate renderer.
 *
 * @param text - Mermaid source text (any supported diagram type)
 * @param options - Rendering options
 * @returns Multi-line ASCII/Unicode string
 *
 * @example
 * ```ts
 * const result = renderMermaidAscii(`
 *   graph LR
 *     A --> B --> C
 * `, { useAscii: true })
 *
 * // Output:
 * // +---+     +---+     +---+
 * // |   |     |   |     |   |
 * // | A |---->| B |---->| C |
 * // |   |     |   |     |   |
 * // +---+     +---+     +---+
 * ```
 */
export function renderMermaidASCII(
  text: string,
  options: AsciiRenderOptions = {},
): string {
  const config: AsciiConfig = {
    useAscii: options.useAscii ?? false,
    paddingX: options.paddingX ?? 5,
    paddingY: options.paddingY ?? 5,
    boxBorderPadding: options.boxBorderPadding ?? 1,
    graphDirection: 'TD', // default, overridden for flowcharts below
    maxWidth: options.maxWidth,
  }

  // Resolve color mode ('auto' or unset → detect environment, otherwise use specified mode)
  const colorMode: ColorMode = options.colorMode === 'auto' || options.colorMode === undefined
    ? detectColorMode()
    : options.colorMode

  // Merge user theme with defaults
  const theme: AsciiTheme = { ...DEFAULT_ASCII_THEME, ...options.theme }

  const diagramType = detectDiagramType(text)

  switch (diagramType) {
    case 'xychart':
      return renderXYChartAscii(text, config, colorMode, theme)

    case 'sequence':
      return renderSequenceAscii(text, config, colorMode, theme)

    case 'class':
      return renderClassAscii(text, config, colorMode, theme)

    case 'er':
      return renderErAscii(text, config, colorMode, theme)

    case 'flowchart':
    default: {
      // Flowchart + state diagram pipeline (original)
      const parsed = parseMermaid(text)

      // Normalize direction for grid layout.
      // BT is laid out as TD then flipped vertically after drawing.
      // RL is treated as LR (full RL support not yet implemented).
      if (parsed.direction === 'LR' || parsed.direction === 'RL') {
        config.graphDirection = 'LR'
      } else {
        config.graphDirection = 'TD'
      }

      applyFlowchartWidthBudget(parsed, config)

      const graph = convertToAsciiGraph(parsed, config)
      createMapping(graph)
      drawGraph(graph)

      // BT: flip the finished canvas vertically so the flow runs bottom→top.
      // The grid layout ran as TD; flipping + character remapping produces BT.
      if (parsed.direction === 'BT') {
        flipCanvasVertically(graph.canvas)
        flipRoleCanvasVertically(graph.roleCanvas)
      }

      return canvasToString(graph.canvas, {
        roleCanvas: graph.roleCanvas,
        colorMode,
        theme,
      })
    }
  }
}

/** @deprecated Use `renderMermaidASCII` */
export const renderMermaidAscii = renderMermaidASCII
