// ============================================================================
// Theme system — CSS custom property-based theming for mermaid SVG diagrams.
//
// Architecture:
//   - Two required variables: --bg (background) and --fg (foreground)
//   - Five optional enrichment variables: --line, --accent, --muted, --surface, --border
//   - Unset optionals fall back to color-mix() derivations from bg + fg
//   - All derived values computed in a <style> block inside the SVG
//
// This means the SVG is a function of its CSS variables. The caller provides
// colors, and the SVG adapts. No light/dark mode detection needed.
// ============================================================================

// ============================================================================
// Types
// ============================================================================

/**
 * Diagram color configuration.
 *
 * Required: bg + fg give you a clean mono diagram.
 * Optional: line, accent, muted, surface, border bring in richer color
 * from Shiki themes or custom palettes. Each falls back to a color-mix()
 * derivation from bg + fg if not set.
 */
export interface DiagramColors {
  /** Background color → CSS variable --bg */
  bg: string
  /** Foreground / primary text color → CSS variable --fg */
  fg: string

  // -- Optional enrichment (each falls back to color-mix from bg+fg) --

  /** Edge/connector color → CSS variable --line */
  line?: string
  /** Arrow heads, highlights, special nodes → CSS variable --accent */
  accent?: string
  /** Secondary text, edge labels → CSS variable --muted */
  muted?: string
  /** Node/box fill tint → CSS variable --surface */
  surface?: string
  /** Node/group stroke color → CSS variable --border */
  border?: string
}

// ============================================================================
// Defaults
// ============================================================================

/** Default bg/fg when no colors are provided (zinc light) */
export const DEFAULTS: Readonly<{ bg: string; fg: string }> = {
  bg: '#FFFFFF',
  fg: '#27272A',
} as const

// ============================================================================
// color-mix() weights for derived CSS variables
//
// When an optional enrichment variable is NOT set, we compute the derived
// value by mixing --fg into --bg at these percentages. This produces a
// coherent mono hierarchy on any bg/fg combination.
// ============================================================================

export const MIX = {
  /** Primary text: near-full fg */
  text:         100, // just use --fg directly
  /** Secondary text (group headers): fg mixed at 60% */
  textSec:      60,
  /** Muted text (edge labels, notes): fg mixed at 40% */
  textMuted:    40,
  /** Faint text (de-emphasized): fg mixed at 25% */
  textFaint:    25,
  /** Edge/connector lines: fg mixed at 50% for clear visibility */
  line:         50,
  /** Arrow head fill: fg mixed at 85% for clear visibility */
  arrow:        85,
  /** Node fill tint: fg mixed at 3% */
  nodeFill:     3,
  /** Group header band tint: fg mixed at 5% */
  groupHeader:  5,
  /** Inner divider strokes: fg mixed at 12% */
  innerStroke:  12,
  /** Key badge background opacity (ER diagrams) */
  keyBadge:     10,
} as const

// ============================================================================
// Well-known theme palettes
//
// Curated bg/fg pairs (+ optional enrichment) for popular editor themes.
// Users can also extract from Shiki theme objects via fromShikiTheme().
// ============================================================================

export const THEMES: Record<string, DiagramColors> = {
  'zinc-light': {
    bg: '#FFFFFF', fg: '#27272A',
  },
  'zinc-dark': {
    bg: '#18181B', fg: '#FAFAFA',
  },
  'tokyo-night': {
    bg: '#1a1b26', fg: '#a9b1d6',
    line: '#3d59a1', accent: '#7aa2f7', muted: '#565f89',
  },
  'tokyo-night-storm': {
    bg: '#24283b', fg: '#a9b1d6',
    line: '#3d59a1', accent: '#7aa2f7', muted: '#565f89',
  },
  'tokyo-night-light': {
    bg: '#d5d6db', fg: '#343b58',
    line: '#34548a', accent: '#34548a', muted: '#9699a3',
  },
  'catppuccin-mocha': {
    bg: '#1e1e2e', fg: '#cdd6f4',
    line: '#585b70', accent: '#cba6f7', muted: '#6c7086',
  },
  'catppuccin-latte': {
    bg: '#eff1f5', fg: '#4c4f69',
    line: '#9ca0b0', accent: '#8839ef', muted: '#9ca0b0',
  },
  'nord': {
    bg: '#2e3440', fg: '#d8dee9',
    line: '#4c566a', accent: '#88c0d0', muted: '#616e88',
  },
  'nord-light': {
    bg: '#eceff4', fg: '#2e3440',
    line: '#aab1c0', accent: '#5e81ac', muted: '#7b88a1',
  },
  'dracula': {
    bg: '#282a36', fg: '#f8f8f2',
    line: '#6272a4', accent: '#bd93f9', muted: '#6272a4',
  },
  'github-light': {
    bg: '#ffffff', fg: '#1f2328',
    line: '#d1d9e0', accent: '#0969da', muted: '#59636e',
  },
  'github-dark': {
    bg: '#0d1117', fg: '#e6edf3',
    line: '#3d444d', accent: '#4493f8', muted: '#9198a1',
  },
  'solarized-light': {
    bg: '#fdf6e3', fg: '#657b83',
    line: '#93a1a1', accent: '#268bd2', muted: '#93a1a1',
  },
  'solarized-dark': {
    bg: '#002b36', fg: '#839496',
    line: '#586e75', accent: '#268bd2', muted: '#586e75',
  },
  'one-dark': {
    bg: '#282c34', fg: '#abb2bf',
    line: '#4b5263', accent: '#c678dd', muted: '#5c6370',
  },
} as const

export type ThemeName = keyof typeof THEMES

// ============================================================================
// Shiki theme extraction
//
// Extracts DiagramColors from a Shiki ThemeRegistrationResolved object.
// This provides native compatibility with any VS Code / TextMate theme.
// ============================================================================

/**
 * Minimal subset of Shiki's ThemeRegistrationResolved that we need.
 * We don't import from shiki to avoid a hard dependency.
 */
interface ShikiThemeLike {
  type?: string
  colors?: Record<string, string>
  tokenColors?: Array<{
    scope?: string | string[]
    settings?: { foreground?: string }
  }>
}

/**
 * Extract diagram colors from a Shiki theme object.
 * Works with any VS Code / TextMate theme loaded by Shiki.
 *
 * Maps editor UI colors to diagram roles:
 *   editor.background         → bg
 *   editor.foreground         → fg
 *   editorLineNumber.fg       → line (optional)
 *   focusBorder / keyword     → accent (optional)
 *   comment token             → muted (optional)
 *   editor.selectionBackground→ surface (optional)
 *   editorWidget.border       → border (optional)
 *
 * @example
 * ```ts
 * import { getSingletonHighlighter } from 'shiki'
 * import { fromShikiTheme } from 'beautiful-mermaid'
 *
 * const hl = await getSingletonHighlighter({ themes: ['tokyo-night'] })
 * const colors = fromShikiTheme(hl.getTheme('tokyo-night'))
 * const svg = renderMermaidSVG(code, colors)
 * ```
 */
export function fromShikiTheme(theme: ShikiThemeLike): DiagramColors {
  const c = theme.colors ?? {}
  const dark = theme.type === 'dark'

  // Helper: find a token color by scope name
  const tokenColor = (scope: string): string | undefined =>
    theme.tokenColors?.find(t =>
      Array.isArray(t.scope) ? t.scope.includes(scope) : t.scope === scope
    )?.settings?.foreground

  return {
    bg: c['editor.background'] ?? (dark ? '#1e1e1e' : '#ffffff'),
    fg: c['editor.foreground'] ?? (dark ? '#d4d4d4' : '#333333'),
    line:    c['editorLineNumber.foreground'] ?? undefined,
    accent:  c['focusBorder'] ?? tokenColor('keyword') ?? undefined,
    muted:   tokenColor('comment') ?? c['editorLineNumber.foreground'] ?? undefined,
    surface: c['editor.selectionBackground'] ?? undefined,
    border:  c['editorWidget.border'] ?? undefined,
  }
}

// ============================================================================
// SVG style block — the CSS variable derivation system
//
// Generates the <style> content that maps user-facing variables (--bg, --fg,
// --line, etc.) to internal derived variables (--_text, --_line, etc.) using
// color-mix() fallbacks.
// ============================================================================

/**
 * Build the CSS variable derivation rules for the SVG <style> block.
 *
 * When an optional variable (--line, --accent, etc.) is set on the SVG or
 * a parent element, it's used directly. When unset, the fallback computes
 * a blended value from --fg and --bg using color-mix().
 */
export function buildStyleBlock(font: string, hasMonoFont: boolean): string {
  const fontImports = [
    `@import url('https://fonts.googleapis.com/css2?family=${encodeURIComponent(font)}:wght@400;500;600;700&amp;display=swap');`,
    ...(hasMonoFont
      ? [`@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&amp;display=swap');`]
      : []),
  ]

  // Derived CSS variables: use override if set, else mix from bg+fg.
  // The --_ prefix signals "private/derived" — not meant for external override.
  const derivedVars = `
    /* Derived from --bg and --fg (overridable via --line, --accent, etc.) */
    --_text:          var(--fg);
    --_text-sec:      var(--muted, color-mix(in srgb, var(--fg) ${MIX.textSec}%, var(--bg)));
    --_text-muted:    var(--muted, color-mix(in srgb, var(--fg) ${MIX.textMuted}%, var(--bg)));
    --_text-faint:    color-mix(in srgb, var(--fg) ${MIX.textFaint}%, var(--bg));
    --_line:          var(--line, color-mix(in srgb, var(--fg) ${MIX.line}%, var(--bg)));
    --_arrow:         var(--accent, color-mix(in srgb, var(--fg) ${MIX.arrow}%, var(--bg)));
    --_node-fill:     var(--surface, color-mix(in srgb, var(--fg) ${MIX.nodeFill}%, var(--bg)));
    --_node-stroke:   var(--line, color-mix(in srgb, var(--fg) 30%, var(--bg)));
    --_group-fill:    var(--bg);
    --_group-hdr:     color-mix(in srgb, var(--fg) ${MIX.groupHeader}%, var(--bg));
    --_inner-stroke:  color-mix(in srgb, var(--fg) ${MIX.innerStroke}%, var(--bg));
    --_key-badge:     color-mix(in srgb, var(--fg) ${MIX.keyBadge}%, var(--bg));`

  return [
    '<style>',
    `  ${fontImports.join('\n  ')}`,
    `  text { font-family: '${font}', system-ui, sans-serif; }`,
    ...(hasMonoFont ? [`  .mono { font-family: 'JetBrains Mono', 'SF Mono', 'Fira Code', ui-monospace, monospace; }`] : []),
    `  svg {${derivedVars}`,
    `  }`,
    '</style>',
  ].join('\n')
}

/**
 * Build the SVG opening tag with CSS variables set as inline styles.
 * Only includes optional variables that are actually provided — unset ones
 * will fall back to the color-mix() derivations in the <style> block.
 *
 * @param transparent - If true, omits the background style for transparent SVGs
 */
export function svgOpenTag(
  width: number,
  height: number,
  colors: DiagramColors,
  transparent?: boolean,
): string {
  // Build the style string with only the provided color variables
  const vars = [
    `--bg:${colors.bg}`,
    `--fg:${colors.fg}`,
    colors.line    ? `--line:${colors.line}` : '',
    colors.accent  ? `--accent:${colors.accent}` : '',
    colors.muted   ? `--muted:${colors.muted}` : '',
    colors.surface ? `--surface:${colors.surface}` : '',
    colors.border  ? `--border:${colors.border}` : '',
  ].filter(Boolean).join(';')

  const bgStyle = transparent ? '' : ';background:var(--bg)'

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" ` +
    `width="${width}" height="${height}" style="${vars}${bgStyle}">`
  )
}
