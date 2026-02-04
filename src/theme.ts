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
  /** Edge/connector lines: fg mixed at 30% */
  line:         30,
  /** Arrow head fill: fg mixed at 50% */
  arrow:        50,
  /** Node fill tint: fg mixed at 3% */
  nodeFill:     3,
  /** Node/group stroke: fg mixed at 20% */
  nodeStroke:   20,
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
 * const svg = await renderMermaid(code, colors)
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
// Static color resolution - for PDF/print output where CSS vars don't work
//
// When output is 'static', all var(--_xxx) references are replaced with
// literal hex colors. This produces SVG that renders correctly in PDF engines,
// Inkscape, and other static renderers that don't evaluate CSS custom properties.
// ============================================================================

/** Parsed RGBA color (alpha is optional - absent means fully opaque) */
export interface RGBA { r: number; g: number; b: number; a?: number }

/**
 * Parse a hex color string (#RGB, #RRGGBB, or #RRGGBBAA) to RGBA.
 * Throws on invalid hex lengths (e.g. #RGBBA, #RRGGB, empty).
 */
export function parseHex(hex: string): RGBA {
  let h = hex.replace(/^#/, '')
  // Expand shorthand (#RGB → #RRGGBB)
  if (h.length === 3) h = h[0]! + h[0]! + h[1]! + h[1]! + h[2]! + h[2]!
  if (h.length !== 6 && h.length !== 8) {
    throw new Error(
      `Invalid hex color: '${hex}'. Expected #RGB (3), #RRGGBB (6), or #RRGGBBAA (8) hex digits.`
    )
  }
  const result: RGBA = {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  }
  // Preserve alpha channel from #RRGGBBAA, clamped to 0–255
  if (h.length === 8) {
    result.a = Math.max(0, Math.min(255, parseInt(h.slice(6, 8), 16)))
  }
  return result
}

/** Convert RGBA to hex string. Emits #RRGGBBAA when alpha is present and not 255, otherwise #RRGGBB. */
export function toHex(rgba: RGBA): string {
  const c = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0')
  const hex = `#${c(rgba.r)}${c(rgba.g)}${c(rgba.b)}`
  if (rgba.a !== undefined && rgba.a !== 255) {
    return `${hex}${c(rgba.a)}`
  }
  return hex
}

/**
 * Linear interpolation of two hex colors in sRGB space.
 * Equivalent to `color-mix(in srgb, fg pct%, bg)`.
 *
 * Performs component-wise linear interpolation in sRGB space (straight alpha,
 * not premultiplied). Each channel is interpolated independently:
 *   result.c = bg.c + t * (fg.c - bg.c)
 * Alpha, when present on either input, is interpolated the same way and
 * clamped to 0–255. Missing alpha defaults to 255 (fully opaque).
 *
 * Note on precision: rounds to the nearest integer per channel. The CSS
 * color-mix(in srgb) spec uses the same model, but browser implementations
 * may round differently at integer boundaries (±1). Visually imperceptible.
 *
 * @param fg - Foreground color (hex)
 * @param bg - Background color (hex)
 * @param pct - Percentage of fg (0–100)
 * @returns Blended hex color
 */
export function colorMix(fg: string, bg: string, pct: number): string {
  const f = parseHex(fg)
  const b = parseHex(bg)
  const t = pct / 100
  const result: RGBA = {
    r: b.r + t * (f.r - b.r),
    g: b.g + t * (f.g - b.g),
    b: b.b + t * (f.b - b.b),
  }
  // Interpolate alpha when either input has an explicit alpha channel
  if (f.a !== undefined || b.a !== undefined) {
    const fa = f.a ?? 255
    const ba = b.a ?? 255
    result.a = Math.max(0, Math.min(255, ba + t * (fa - ba)))
  }
  return toHex(result)
}

/**
 * Hex color pattern: matches #RGB, #RRGGBB, or #RRGGBBAA.
 * Single source of truth - used by both validateHexColor() and
 * normalizeInlineStyles() to keep validation and normalization aligned.
 */
export const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/

/**
 * Validate that a color string is a hex value.
 * Throws if the value is rgb(), hsl(), a named color, var(), or any other non-hex format.
 */
export function validateHexColor(value: string, label: string): void {
  if (!HEX_RE.test(value)) {
    throw new Error(
      `Invalid color for '${label}': '${value}'. ` +
      `Only hex colors (#RGB, #RRGGBB, #RRGGBBAA) are supported. ` +
      `Got a non-hex value - convert to hex before passing.`
    )
  }
}

// ============================================================================
// Color derivation graph - single source of truth
//
// Each entry maps a CSS variable name to its derivation rule. Both the CSS
// style block (buildStyleBlock) and the JS resolver (resolveColors) are
// driven from this graph, eliminating drift between the two code paths.
//
// Rule types:
//   'fg'       → uses --fg directly
//   'bg'       → uses --bg directly
//   'override' → uses an optional enrichment var with mix fallback
//   'mix'      → always mixes fg into bg at the given percentage
// ============================================================================

interface DeriveRule {
  /** CSS variable name without leading -- (e.g. '_text') */
  cssVar: string
  /** Which MIX constant to use for the color-mix fallback */
  mixKey: keyof typeof MIX | null
  /** Which optional DiagramColors key overrides the mix (null = no override) */
  override: keyof DiagramColors | null
  /** Special source: 'fg' = use fg directly, 'bg' = use bg directly, null = standard mix */
  source: 'fg' | 'bg' | null
}

/**
 * Derivation graph for all internal CSS color variables.
 * Drives both CSS generation and JS-side static resolution.
 */
export const COLOR_GRAPH: readonly DeriveRule[] = [
  { cssVar: '_text',         mixKey: 'text',        override: null,      source: 'fg' },
  { cssVar: '_text-sec',     mixKey: 'textSec',     override: 'muted',   source: null },
  { cssVar: '_text-muted',   mixKey: 'textMuted',   override: 'muted',   source: null },
  { cssVar: '_text-faint',   mixKey: 'textFaint',   override: null,      source: null },
  { cssVar: '_line',         mixKey: 'line',         override: 'line',    source: null },
  { cssVar: '_arrow',        mixKey: 'arrow',        override: 'accent',  source: null },
  { cssVar: '_node-fill',    mixKey: 'nodeFill',     override: 'surface', source: null },
  { cssVar: '_node-stroke',  mixKey: 'nodeStroke',   override: 'border',  source: null },
  { cssVar: '_group-fill',   mixKey: null,           override: null,      source: 'bg' },
  { cssVar: '_group-hdr',    mixKey: 'groupHeader',  override: null,      source: null },
  { cssVar: '_inner-stroke', mixKey: 'innerStroke',  override: null,      source: null },
  { cssVar: '_key-badge',    mixKey: 'keyBadge',     override: null,      source: null },
] as const

/** All 14 derived color values resolved to literal hex strings */
export interface ResolvedColors {
  bg: string
  _text: string
  '_text-sec': string
  '_text-muted': string
  '_text-faint': string
  _line: string
  _arrow: string
  '_node-fill': string
  '_node-stroke': string
  '_group-fill': string
  '_group-hdr': string
  '_inner-stroke': string
  '_key-badge': string
}

/**
 * Resolve the full color cascade from DiagramColors to literal hex values.
 *
 * Driven by COLOR_GRAPH - the same derivation rules that generate CSS
 * variable declarations in buildStyleBlock(). This guarantees that static
 * (hex) output matches what the CSS path would produce in a browser.
 *
 * Input colors must be hex (#RGB, #RRGGBB, or #RRGGBBAA). Non-hex values
 * (rgb(), hsl(), named colors, var()) will throw.
 *
 * Note on precision: colorMix() uses linear sRGB interpolation, which may
 * differ from the CSS color-mix(in srgb) result by ±1 in any channel due
 * to rounding at integer boundaries. This is visually imperceptible.
 */
export function resolveColors(colors: DiagramColors): ResolvedColors {
  const { bg, fg } = colors
  validateHexColor(bg, 'bg')
  validateHexColor(fg, 'fg')

  const result: Record<string, string> = { bg }

  for (const rule of COLOR_GRAPH) {
    let value: string
    if (rule.source === 'fg') {
      value = fg
    } else if (rule.source === 'bg') {
      value = bg
    } else {
      const overrideValue = rule.override ? colors[rule.override] : undefined
      if (overrideValue) {
        validateHexColor(overrideValue, rule.override!)
        value = overrideValue
      } else {
        value = colorMix(fg, bg, MIX[rule.mixKey!])
      }
    }
    result[rule.cssVar] = value
  }

  return result as unknown as ResolvedColors
}

/**
 * Build a minimal <style> block with only font-family rules.
 * No CSS variables, no @import, no color-mix() - safe for static SVG.
 *
 * Returns empty string when `noStyleBlock` is true - for environments
 * (email clients, some PDF renderers) that strip `<style>` entirely.
 * In that case, font-family attributes should be inlined on text elements.
 */
export function buildStaticStyleBlock(font: string, hasMonoFont: boolean, noStyleBlock?: boolean): string {
  if (noStyleBlock) return ''
  return [
    '<style>',
    `  text { font-family: '${font}', system-ui, sans-serif; }`,
    ...(hasMonoFont ? [`  .mono { font-family: 'JetBrains Mono', 'SF Mono', 'Fira Code', ui-monospace, monospace; }`] : []),
    '</style>',
  ].join('\n')
}

/**
 * Build the SVG opening tag with literal background color.
 * No CSS custom properties - safe for static SVG.
 *
 * When transparent is true, uses explicit `background:none` rather than
 * omitting the property, ensuring renderers that assume a default opaque
 * background still get transparent output. (Dynamic mode omits the
 * background style entirely for transparency.)
 *
 * When noStyleBlock is true and font is provided, inlines `font-family`
 * on the SVG root `style` attribute, since there is no `<style>` block
 * to set it.
 */
export function svgOpenTagStatic(
  width: number,
  height: number,
  bg: string,
  transparent?: boolean,
  font?: string,
  noStyleBlock?: boolean,
): string {
  const bgStyle = transparent ? 'background:none' : `background:${bg}`
  let fontStyle = ''
  if (noStyleBlock && font) {
    // Escape single quotes in font name to prevent malformed SVG attribute values
    const safeFont = font.replace(/'/g, '&#39;')
    fontStyle = `;font-family:'${safeFont}',system-ui,sans-serif`
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" ` +
    `width="${width}" height="${height}" style="${bgStyle}${fontStyle}">`
  )
}

/** Keys accepted by the color accessor function */
export type ColorKey = keyof Omit<ResolvedColors, 'bg'>

// Compile-time assertion: every COLOR_GRAPH entry must map to a valid ColorKey or 'bg'.
// If a new entry is added to COLOR_GRAPH without a matching ResolvedColors field,
// this will produce a type error.
type _AssertColorGraphKeys = {
  [K in (typeof COLOR_GRAPH)[number]['cssVar']]: K extends ColorKey ? true : K extends never ? never : true
}

// Reverse assertion: every ResolvedColors key (except bg) must have a COLOR_GRAPH entry.
// Catches adding a field to ResolvedColors without a matching COLOR_GRAPH rule.
type _AssertResolvedColorsHasGraph = {
  [K in Exclude<keyof ResolvedColors, 'bg'>]: K extends (typeof COLOR_GRAPH)[number]['cssVar'] ? true : never
}

/**
 * Create a color accessor function.
 *
 * When `resolved` is null (CSS mode), returns `var(--_key)` strings.
 * When `resolved` is provided (static mode), returns literal hex values.
 *
 * Also provides a `bg()` method for the background color, which uses
 * `var(--bg)` in CSS mode and the literal color in static mode.
 */
export function createColorFn(resolved: ResolvedColors | null): {
  (key: ColorKey): string
  bg: () => string
} {
  const fn = ((key: ColorKey) => {
    if (resolved) return resolved[key]
    return `var(--${key})`
  }) as { (key: ColorKey): string; bg: () => string }
  fn.bg = () => resolved ? resolved.bg : 'var(--bg)'
  return fn
}

/**
 * Generate a unique marker ID prefix for multi-SVG isolation.
 * When multiple SVGs share a DOM, marker IDs can collide. This generates
 * a short random suffix to namespace all marker definitions.
 *
 * @param length - Number of hex characters (must be >= 1). Default: 4.
 * @throws If length is less than 1.
 */
export function generateMarkerId(length: number = 4): string {
  if (length < 1) {
    throw new Error(`generateMarkerId: length must be >= 1, got ${length}`)
  }
  // Build hex string from one or more Math.random() calls to guarantee
  // full requested entropy even when a single call yields fewer digits.
  let hex = ''
  while (hex.length < length) {
    hex += Math.random().toString(16).slice(2)
  }
  return `m${hex.slice(0, length)}`
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
 * Driven by COLOR_GRAPH - the same derivation rules that resolveColors()
 * uses, ensuring parity between CSS and static output.
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

  // Generate CSS variable declarations from COLOR_GRAPH
  const varLines: string[] = ['    /* Derived from --bg and --fg (overridable via --line, --accent, etc.) */']
  for (const rule of COLOR_GRAPH) {
    const name = `--${rule.cssVar}`
    let expr: string
    if (rule.source === 'fg') {
      expr = 'var(--fg)'
    } else if (rule.source === 'bg') {
      expr = 'var(--bg)'
    } else {
      const mixExpr = `color-mix(in srgb, var(--fg) ${MIX[rule.mixKey!]}%, var(--bg))`
      expr = rule.override ? `var(--${rule.override}, ${mixExpr})` : mixExpr
    }
    varLines.push(`    ${name}:${' '.repeat(Math.max(1, 18 - name.length))}${expr};`)
  }

  return [
    '<style>',
    `  ${fontImports.join('\n  ')}`,
    `  text { font-family: '${font}', system-ui, sans-serif; }`,
    ...(hasMonoFont ? [`  .mono { font-family: 'JetBrains Mono', 'SF Mono', 'Fira Code', ui-monospace, monospace; }`] : []),
    `  svg {`,
    ...varLines,
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
