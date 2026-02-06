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
//   - C4 diagrams (C4Context / C4Container / C4Component / C4Dynamic / C4Deployment)
//   - ArchiMate diagrams (archimate-layered)
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
export type { DiagramColors, ThemeName } from './theme.ts'
export { fromShikiTheme, THEMES, DEFAULTS } from './theme.ts'
export { parseMermaid } from './parser.ts'
export { renderMermaidAscii } from './ascii/index.ts'
export type { AsciiRenderOptions } from './ascii/index.ts'

// C4 type exports
export { parseC4 } from './c4/parser.ts'
export type { C4Diagram, C4DiagramType, C4Element, C4Relationship, C4Boundary } from './c4/types.ts'

// ArchiMate type exports
export { parseArchimate } from './archimate/parser.ts'
export type { ArchiMateDiagram, ArchiMateElement, ArchiMateRelationship, ArchiMateLayer } from './archimate/types.ts'

import { parseMermaid } from './parser.ts'
import { layoutGraph } from './layout.ts'
import { renderSvg } from './renderer.ts'
import type { RenderOptions } from './types.ts'
import type { DiagramColors } from './theme.ts'
import { DEFAULTS } from './theme.ts'

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

// C4 diagram imports
import { parseC4 } from './c4/parser.ts'
import { layoutC4Diagram } from './c4/layout.ts'
import { renderC4Svg } from './c4/renderer.ts'

// ArchiMate diagram imports
import { parseArchimate } from './archimate/parser.ts'
import { layoutArchiMateDiagram } from './archimate/layout.ts'
import { renderArchiMateSvg } from './archimate/renderer.ts'

/**
 * Detect the diagram type from the mermaid source text.
 * Returns the type keyword used for routing to the correct pipeline.
 */
function detectDiagramType(text: string): 'flowchart' | 'sequence' | 'class' | 'er' | 'c4' | 'archimate' {
  const firstLine = text.trim().split('\n')[0]?.trim() ?? ''
  const firstLineLower = firstLine.toLowerCase()

  if (/^sequencediagram\s*$/i.test(firstLine)) return 'sequence'
  if (/^classdiagram\s*$/i.test(firstLine)) return 'class'
  if (/^erdiagram\s*$/i.test(firstLine)) return 'er'
  if (/^c4(context|container|component|dynamic|deployment)\s*$/i.test(firstLine)) return 'c4'
  if (/^archimate-layered\s*$/i.test(firstLineLower)) return 'archimate'

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

  // Preprocess: strip leading/trailing whitespace, filter comments
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('%%'))

  switch (diagramType) {
    case 'sequence': {
      const diagram = parseSequenceDiagram(lines)
      const positioned = layoutSequenceDiagram(diagram, options)
      return renderSequenceSvg(positioned, colors, font, transparent)
    }
    case 'class': {
      const diagram = parseClassDiagram(lines)
      const positioned = await layoutClassDiagram(diagram, options)
      return renderClassSvg(positioned, colors, font, transparent)
    }
    case 'er': {
      const diagram = parseErDiagram(lines)
      const positioned = await layoutErDiagram(diagram, options)
      return renderErSvg(positioned, colors, font, transparent)
    }
    case 'c4': {
      const diagram = parseC4(lines)
      const positioned = await layoutC4Diagram(diagram, options)
      return renderC4Svg(positioned, colors, font, transparent)
    }
    case 'archimate': {
      const diagram = parseArchimate(lines)
      const positioned = await layoutArchiMateDiagram(diagram, options)
      return renderArchiMateSvg(positioned, colors, font, transparent)
    }
    case 'flowchart':
    default: {
      // Flowchart + state diagram pipeline (original)
      const graph = parseMermaid(text)
      const positioned = await layoutGraph(graph, options)
      return renderSvg(positioned, colors, font, transparent)
    }
  }
}
