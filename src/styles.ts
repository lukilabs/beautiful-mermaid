// ============================================================================
// Font metrics — character width estimates for Inter at different sizes.
// Used to approximate text bounding boxes without DOM measurement.
// These are calibrated for Inter's typical glyph widths.
//
// NOTE: Theme/color system has moved to src/theme.ts. This file only
// contains font metrics, spacing constants, and stroke widths.
// ============================================================================

/** Average character width in px at the given font size and weight (proportional font) */
export function estimateTextWidth(text: string, fontSize: number, fontWeight: number): number {
  // Inter average character widths as fraction of fontSize, per weight.
  // Heavier weights are slightly wider.
  const widthRatio = fontWeight >= 600 ? 0.58 : fontWeight >= 500 ? 0.55 : 0.52
  return text.length * fontSize * widthRatio
}

/** Average character width in px for monospace fonts (uniform glyph width) */
export function estimateMonoTextWidth(text: string, fontSize: number): number {
  // Monospace fonts have uniform character width — 0.6 of fontSize matches actual
  // glyph widths for JetBrains Mono / SF Mono / Fira Code at small sizes (11px).
  // Previous value of 0.55 underestimated widths, causing class member labels to
  // extend beyond their box boundaries.
  return text.length * fontSize * 0.6
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

/** Line height multiplier for multiline text (relative to font size) */
export const LINE_HEIGHT_RATIO = 1.4

/** Maximum label width in px before auto-wrapping at word boundaries */
export const MAX_LABEL_WIDTH = 200

/**
 * Wrap text into multiple lines:
 * 1. Split on existing `\n` characters (from `<br>` normalization)
 * 2. Word-wrap any line exceeding `maxWidth` at word boundaries
 *
 * Returns an array of lines.
 */
export function wrapText(text: string, fontSize: number, fontWeight: number, maxWidth: number = MAX_LABEL_WIDTH): string[] {
  const hardLines = text.split('\n')
  const result: string[] = []

  for (const line of hardLines) {
    const lineWidth = estimateTextWidth(line, fontSize, fontWeight)
    if (lineWidth <= maxWidth) {
      result.push(line)
      continue
    }

    // Word-wrap this line
    const words = line.split(/\s+/)
    let currentLine = ''

    for (const word of words) {
      if (currentLine.length === 0) {
        currentLine = word
        continue
      }
      const testLine = currentLine + ' ' + word
      const testWidth = estimateTextWidth(testLine, fontSize, fontWeight)
      if (testWidth <= maxWidth) {
        currentLine = testLine
      } else {
        result.push(currentLine)
        currentLine = word
      }
    }
    if (currentLine.length > 0) {
      result.push(currentLine)
    }
  }

  return result
}

/** Arrow head dimensions */
export const ARROW_HEAD = {
  width: 8,
  height: 4.8,
} as const

