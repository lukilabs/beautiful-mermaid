// ============================================================================
// Font metrics — character width estimates for Inter at different sizes.
// Used to approximate text bounding boxes without DOM measurement.
// These are calibrated for Inter's typical glyph widths.
//
// NOTE: Theme/color system has moved to src/theme.ts. This file only
// contains font metrics, spacing constants, and stroke widths.
// ============================================================================

// ============================================================================
// CJK / Fullwidth character utilities
// Used to correctly calculate display width for Korean, Chinese, Japanese,
// and other fullwidth characters that occupy 2 columns in terminal/monospace.
// ============================================================================

/**
 * Check if a character is a fullwidth character (CJK, Hangul, etc.)
 * Fullwidth characters occupy 2 columns in terminal/monospace display.
 */
export function isFullWidth(char: string): boolean {
  const code = char.charCodeAt(0)
  return (
    (code >= 0x1100 && code <= 0x11ff) || // Hangul Jamo
    (code >= 0x3000 && code <= 0x303f) || // CJK Punctuation
    (code >= 0x3040 && code <= 0x309f) || // Hiragana
    (code >= 0x30a0 && code <= 0x30ff) || // Katakana
    (code >= 0x3130 && code <= 0x318f) || // Hangul Compatibility Jamo
    (code >= 0x4e00 && code <= 0x9fff) || // CJK Unified Ideographs
    (code >= 0xac00 && code <= 0xd7af) || // Hangul Syllables
    (code >= 0xff00 && code <= 0xffef) // Fullwidth Forms
  )
}

/**
 * Calculate the display width of a string, accounting for fullwidth characters.
 * Fullwidth characters (CJK, Hangul) count as 2, others count as 1.
 */
export function getDisplayWidth(text: string): number {
  let width = 0
  for (const char of text) {
    width += isFullWidth(char) ? 2 : 1
  }
  return width
}

/** Average character width in px at the given font size and weight (proportional font) */
export function estimateTextWidth(text: string, fontSize: number, fontWeight: number): number {
  // Inter average character widths as fraction of fontSize, per weight.
  // Heavier weights are slightly wider.
  // Use getDisplayWidth() to account for fullwidth CJK characters.
  const widthRatio = fontWeight >= 600 ? 0.58 : fontWeight >= 500 ? 0.55 : 0.52
  return getDisplayWidth(text) * fontSize * widthRatio
}

/** Average character width in px for monospace fonts (uniform glyph width) */
export function estimateMonoTextWidth(text: string, fontSize: number): number {
  // Monospace fonts have uniform character width — 0.6 of fontSize matches actual
  // glyph widths for JetBrains Mono / SF Mono / Fira Code at small sizes (11px).
  // Previous value of 0.55 underestimated widths, causing class member labels to
  // extend beyond their box boundaries.
  // Use getDisplayWidth() to account for fullwidth CJK characters.
  return getDisplayWidth(text) * fontSize * 0.6
}

/** Monospace font family used for code-like text (class members, types) */
export const MONO_FONT = "'JetBrains Mono'" as const

/** Full CSS fallback chain for monospace text */
export const MONO_FONT_STACK = `${MONO_FONT}, 'SF Mono', 'Fira Code', ui-monospace, monospace` as const

/** Fixed font sizes used in the renderer (in px) */
export const FONT_SIZES = {
  /** Node label text */
  nodeLabel: 13,
  /** Edge label text */
  edgeLabel: 11,
  /** Subgraph header text */
  groupHeader: 12,
} as const

/** Font weights used per element type */
export const FONT_WEIGHTS = {
  nodeLabel: 500,
  edgeLabel: 400,
  groupHeader: 600,
} as const

// ============================================================================
// Spacing & sizing constants
// ============================================================================

/** Vertical gap between a subgraph header band and the content area below it (px).
 * Without this, nested subgraph headers sit flush against their parent's header band. */
export const GROUP_HEADER_CONTENT_PAD = 8

/** Padding inside node shapes */
export const NODE_PADDING = {
  /** Horizontal padding inside rectangles/rounded/stadium */
  horizontal: 16,
  /** Vertical padding inside rectangles/rounded/stadium */
  vertical: 10,
  /** Extra padding for diamond shapes (they need more space due to rotation) */
  diamondExtra: 24,
} as const

/** Stroke widths per element type (in px) */
export const STROKE_WIDTHS = {
  outerBox: 1,
  innerBox: 0.75,
  connector: 0.75,
} as const

/**
 * Vertical shift applied to all text elements for font-agnostic centering.
 *
 * Instead of relying on `dominant-baseline="central"` (which each font interprets
 * differently based on its own ascent/descent metrics), we use the default alphabetic
 * baseline and shift down by 0.35em. This places the optical center of text at the
 * y coordinate, regardless of font family (Inter, JetBrains Mono, system fallbacks).
 *
 * The 0.35em value approximates the distance from alphabetic baseline to visual
 * center of Latin text. Using `em` units ensures it scales with font size.
 */
export const TEXT_BASELINE_SHIFT = '0.35em' as const

/** Arrow head dimensions */
export const ARROW_HEAD = {
  width: 8,
  height: 4.8,
} as const

