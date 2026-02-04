// ============================================================================
// beautiful-mermaid — public API
//
// Renders Mermaid diagrams to styled SVG strings.
// Framework-agnostic, no DOM required. Pure TypeScript.
//
// Supported diagram types:
//   - Flowcharts (graph TD / flowchart LR)
//   - State diagrams (stateDiagram-v2)
//   - Sequence diagrams (sequenceDiagram)
//   - Class diagrams (classDiagram)
//   - ER diagrams (erDiagram)
//
// Theming uses CSS custom properties (--bg, --fg, + optional enrichment).
// See src/theme.ts for the full variable system.
//
// Usage:
//   import { renderMermaid } from 'beautiful-mermaid'
//   const svg = await renderMermaid('graph TD\n  A --> B')
//   const svg = await renderMermaid('graph TD\n  A --> B', { bg: '#1a1b26', fg: '#a9b1d6' })
// ============================================================================

export type { RenderOptions, MermaidGraph, PositionedGraph } from './types.ts'
export type { DiagramColors, ThemeName, ResolvedColors, ColorKey, RGBA } from './theme.ts'
export { fromShikiTheme, THEMES, DEFAULTS, resolveColors, colorMix, createColorFn, validateHexColor, HEX_RE, COLOR_GRAPH, generateMarkerId, parseHex, toHex } from './theme.ts'
export { parseMermaid } from './parser.ts'
export { renderMermaidAscii } from './ascii/index.ts'
export type { AsciiRenderOptions } from './ascii/index.ts'

import { parseMermaid } from './parser.ts'
import { layoutGraph } from './layout.ts'
import { renderSvg } from './renderer.ts'
import type { RenderOptions } from './types.ts'
import type { DiagramColors, ResolvedColors } from './theme.ts'
import { DEFAULTS, resolveColors, generateMarkerId } from './theme.ts'

// New diagram type imports
import { parseSequenceDiagram } from './sequence/parser.ts'
import { layoutSequenceDiagram } from './sequence/layout.ts'
import { renderSequenceSvg } from './sequence/renderer.ts'
import { parseClassDiagram } from './class/parser.ts'
import { layoutClassDiagram } from './class/layout.ts'
import { renderClassSvg } from './class/renderer.ts'
import { parseErDiagram } from './er/parser.ts'
import { layoutErDiagram } from './er/layout.ts'
import { renderErSvg } from './er/renderer.ts'

/**
 * Detect the diagram type from the mermaid source text.
 * Returns the type keyword used for routing to the correct pipeline.
 */
function detectDiagramType(text: string): 'flowchart' | 'sequence' | 'class' | 'er' {
  const firstLine = text.trim().split(/[\n;]/)[0]?.trim().toLowerCase() ?? ''

  if (/^sequencediagram\s*$/.test(firstLine)) return 'sequence'
  if (/^classdiagram\s*$/.test(firstLine)) return 'class'
  if (/^erdiagram\s*$/.test(firstLine)) return 'er'

  // Default: flowchart/state (handled by parseMermaid internally)
  return 'flowchart'
}

/**
 * Build a DiagramColors object from render options.
 * Uses DEFAULTS for bg/fg when not provided, and passes through
 * optional enrichment colors (line, accent, muted, surface, border).
 */
function buildColors(options: RenderOptions): DiagramColors {
  return {
    bg: options.bg ?? DEFAULTS.bg,
    fg: options.fg ?? DEFAULTS.fg,
    line: options.line,
    accent: options.accent,
    muted: options.muted,
    surface: options.surface,
    border: options.border,
  }
}

/**
 * Render Mermaid diagram text to an SVG string.
 *
 * Async because layout engines run asynchronously.
 * Auto-detects diagram type from the header line.
 *
 * Colors are set via CSS custom properties on the <svg> tag:
 *   - bg/fg: Required base colors (default: white/#27272A)
 *   - line/accent/muted/surface/border: Optional enrichment colors
 *     (fall back to color-mix() derivations from bg+fg)
 *
 * @param text - Mermaid source text
 * @param options - Rendering options (colors, font, spacing)
 * @returns A self-contained SVG string
 *
 * @example
 * ```ts
 * // Mono — just defaults, everything derived from bg+fg
 * const svg = await renderMermaid('graph TD\n  A --> B')
 *
 * // Custom colors
 * const svg = await renderMermaid('graph TD\n  A --> B', {
 *   bg: '#1a1b26', fg: '#a9b1d6'
 * })
 *
 * // Enriched — Tokyo Night with accent + line colors
 * const svg = await renderMermaid('graph TD\n  A --> B', {
 *   bg: '#1a1b26', fg: '#a9b1d6',
 *   line: '#3d59a1', accent: '#7aa2f7', muted: '#565f89',
 * })
 * ```
 */
export async function renderMermaid(
  text: string,
  options: RenderOptions = {}
): Promise<string> {
  const colors = buildColors(options)
  const font = options.font ?? 'Inter'
  const transparent = options.transparent ?? false
  const diagramType = detectDiagramType(text)

  // Static color mode: resolve all CSS variables to literal hex values.
  // Pre-resolved palettes take priority, then output mode flag.
  const resolved: ResolvedColors | null = options.resolvedColors
    ?? (options.output === 'static' ? resolveColors(colors) : null)
  const noStyleBlock = options.noStyleBlock ?? false

  // Marker ID prefix for multi-SVG isolation
  const markerId = options.markerId === false
    ? ''
    : (options.markerId ?? (resolved ? '' : generateMarkerId()))

  // Preprocess: strip leading/trailing whitespace, filter comments
  const lines = text.split(/[\n;]/).map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('%%'))

  switch (diagramType) {
    case 'sequence': {
      const diagram = parseSequenceDiagram(lines)
      const positioned = layoutSequenceDiagram(diagram, options)
      return renderSequenceSvg(positioned, colors, font, transparent, resolved, noStyleBlock, markerId)
    }
    case 'class': {
      const diagram = parseClassDiagram(lines)
      const positioned = await layoutClassDiagram(diagram, options)
      return renderClassSvg(positioned, colors, font, transparent, resolved, noStyleBlock, markerId)
    }
    case 'er': {
      const diagram = parseErDiagram(lines)
      const positioned = await layoutErDiagram(diagram, options)
      return renderErSvg(positioned, colors, font, transparent, resolved, noStyleBlock, markerId)
    }
    case 'flowchart':
    default: {
      // Flowchart + state diagram pipeline (original)
      const graph = parseMermaid(text)
      const positioned = await layoutGraph(graph, options)
      return renderSvg(positioned, colors, font, transparent, resolved, noStyleBlock, markerId)
    }
  }
}
