// ============================================================================
// render_mermaid_svg tool handler
//
// Wraps renderMermaidSVG() with theme resolution and best-effort
// partial rendering on parse/rendering errors.
// ============================================================================

import { renderMermaidSVG, THEMES, DEFAULTS } from '../../index.ts'
import { formatError } from '../errors.ts'
import type { DiagramColors, ThemeName } from '../../index.ts'

// ============================================================================
// Theme resolution
// ============================================================================

/**
 * Resolve colors from theme name + user overrides.
 *
 * Priority: user bg/fg > theme bg/fg > DEFAULTS
 * Optional enrichment colors (line, accent, etc.) from theme are passed through
 * unless overridden by user (not exposed in MCP params, so theme values pass through).
 */
function resolveColors(args: {
  theme_name?: string
  bg?: string
  fg?: string
}): { bg: string; fg: string; enrichment: Partial<DiagramColors> } {
  const theme = args.theme_name && args.theme_name in THEMES
    ? THEMES[args.theme_name as ThemeName]
    : null

  const bg = args.bg ?? theme?.bg ?? DEFAULTS.bg
  const fg = args.fg ?? theme?.fg ?? DEFAULTS.fg

  // Carry forward optional enrichment from theme
  const enrichment: Partial<DiagramColors> = {}
  if (theme) {
    if (theme.line) enrichment.line = theme.line
    if (theme.accent) enrichment.accent = theme.accent
    if (theme.muted) enrichment.muted = theme.muted
    if (theme.surface) enrichment.surface = theme.surface
    if (theme.border) enrichment.border = theme.border
  }

  return { bg, fg, enrichment }
}

// ============================================================================
// Best-effort partial rendering
// ============================================================================

/**
 * Attempt best-effort partial rendering by stripping lines from the end.
 * Returns a partial SVG string if successful, or undefined if no partial output.
 */
function attemptPartialRendering(mermaidCode: string, colors: { bg: string; fg: string; enrichment: Partial<DiagramColors> }, transparent: boolean): string | undefined {
  const lines = mermaidCode.split('\n')
  // Start from full length minus 1, stop at 1 (keep at least the header line)
  for (let i = lines.length - 1; i > 0; i--) {
    try {
      const partial = lines.slice(0, i).join('\n')
      return renderMermaidSVG(partial, {
        bg: colors.bg,
        fg: colors.fg,
        ...colors.enrichment,
        transparent,
      })
    } catch {
      // Continue stripping lines
    }
  }
  return undefined
}

// ============================================================================
// Tool handler
// ============================================================================

/**
 * MCP tool handler for `render_mermaid_svg`.
 * Renders Mermaid code to SVG with theme resolution.
 */
export function handleRenderSVG(args: {
  mermaid_code: string
  theme_name?: string
  bg?: string
  fg?: string
  transparent?: boolean
}): {
  content: Array<{ type: 'text'; text: string }>
  isError?: boolean
} {
  const colors = resolveColors(args)
  const transparent = args.transparent ?? false

  try {
    const svg = renderMermaidSVG(args.mermaid_code, {
      bg: colors.bg,
      fg: colors.fg,
      ...colors.enrichment,
      transparent,
    })
    return {
      content: [{ type: 'text', text: svg }],
    }
  } catch (error) {
    // Best-effort: try partial rendering
    const partial = attemptPartialRendering(args.mermaid_code, colors, transparent)
    return {
      content: [{ type: 'text', text: formatError(error, partial) }],
      isError: true,
    }
  }
}
