// ============================================================================
// Text Metrics — Variable-width character measurement for SVG layout
// ============================================================================
//
// Provides font-agnostic text width estimation using character class buckets.
// More accurate than uniform character width for proportional fonts.
//
// Width ratios are normalized where 1.0 = average lowercase letter.
// Final pixel width = sum(charWidths) * fontSize * baseRatio
// ============================================================================

/**
 * Narrow characters - visually thin glyphs.
 * Note: '1' is included because in proportional fonts (like Inter), it's
 * significantly narrower than other digits which use tabular/uniform width.
 */
const NARROW_CHARS = new Set(['i', 'l', 't', 'f', 'j', 'I', '1', '!', '|', '.', ',', ':', ';', "'"])

/**
 * Wide characters - visually wide glyphs
 */
const WIDE_CHARS = new Set(['W', 'M', 'w', 'm', '@', '%'])

/**
 * Very wide characters - widest Latin glyphs
 */
const VERY_WIDE_CHARS = new Set(['W', 'M'])

/**
 * Semi-narrow punctuation - brackets and slashes are narrower than letters
 * but wider than narrow chars like dots/commas
 */
const SEMI_NARROW_PUNCT = new Set(['(', ')', '[', ']', '{', '}', '/', '\\', '-', '"', '`'])

/**
 * Check if a code point is a combining diacritical mark (zero-width overlay)
 */
function isCombiningMark(code: number): boolean {
  // Combining Diacritical Marks: U+0300–U+036F
  // Combining Diacritical Marks Extended: U+1AB0–U+1AFF
  // Combining Diacritical Marks Supplement: U+1DC0–U+1DFF
  // Combining Diacritical Marks for Symbols: U+20D0–U+20FF
  // Combining Half Marks: U+FE20–U+FE2F
  return (
    (code >= 0x0300 && code <= 0x036f) ||
    (code >= 0x1ab0 && code <= 0x1aff) ||
    (code >= 0x1dc0 && code <= 0x1dff) ||
    (code >= 0x20d0 && code <= 0x20ff) ||
    (code >= 0xfe20 && code <= 0xfe2f)
  )
}

/**
 * Check if a code point is fullwidth (CJK, emoji, etc.)
 * These characters occupy approximately 2x the width of Latin letters.
 */
function isFullwidth(code: number): boolean {
  // CJK Radicals Supplement: U+2E80–U+2EFF
  // Kangxi Radicals: U+2F00–U+2FDF
  // CJK Symbols and Punctuation: U+3000–U+303F
  // Hiragana: U+3040–U+309F
  // Katakana: U+30A0–U+30FF
  // Bopomofo: U+3100–U+312F
  // Hangul Compatibility Jamo: U+3130–U+318F
  // Kanbun: U+3190–U+319F
  // Bopomofo Extended: U+31A0–U+31BF
  // CJK Strokes: U+31C0–U+31EF
  // Katakana Phonetic Extensions: U+31F0–U+31FF
  // Enclosed CJK Letters and Months: U+3200–U+32FF
  // CJK Compatibility: U+3300–U+33FF
  // CJK Unified Ideographs Extension A: U+3400–U+4DBF
  // CJK Unified Ideographs: U+4E00–U+9FFF
  // Hangul Syllables: U+AC00–U+D7AF
  // CJK Compatibility Ideographs: U+F900–U+FAFF
  // Halfwidth and Fullwidth Forms (fullwidth part): U+FF00–U+FF60, U+FFE0–U+FFE6
  // CJK Unified Ideographs Extension B+: U+20000–U+2A6DF (and beyond)

  return (
    (code >= 0x1100 && code <= 0x115f) || // Hangul Jamo
    (code >= 0x2e80 && code <= 0x2eff) || // CJK Radicals Supplement
    (code >= 0x2f00 && code <= 0x2fdf) || // Kangxi Radicals
    (code >= 0x3000 && code <= 0x303f) || // CJK Symbols and Punctuation
    (code >= 0x3040 && code <= 0x309f) || // Hiragana
    (code >= 0x30a0 && code <= 0x30ff) || // Katakana
    (code >= 0x3100 && code <= 0x312f) || // Bopomofo
    (code >= 0x3130 && code <= 0x318f) || // Hangul Compatibility Jamo
    (code >= 0x3190 && code <= 0x31ff) || // Kanbun + extensions
    (code >= 0x3200 && code <= 0x33ff) || // Enclosed CJK + Compatibility
    (code >= 0x3400 && code <= 0x4dbf) || // CJK Extension A
    (code >= 0x4e00 && code <= 0x9fff) || // CJK Unified Ideographs
    (code >= 0xac00 && code <= 0xd7af) || // Hangul Syllables
    (code >= 0xf900 && code <= 0xfaff) || // CJK Compatibility Ideographs
    (code >= 0xff00 && code <= 0xff60) || // Fullwidth ASCII
    (code >= 0xffe0 && code <= 0xffe6) || // Fullwidth symbols
    code >= 0x20000 // CJK Extension B and beyond
  )
}

/**
 * Regex for emoji detection using Unicode property escapes.
 * Uses Emoji_Presentation and Extended_Pictographic (not just Emoji)
 * because \p{Emoji} includes digits and # which we don't want as fullwidth.
 */
const EMOJI_REGEX = /\p{Emoji_Presentation}|\p{Extended_Pictographic}/u

/**
 * Check if a character is an emoji (fullwidth)
 */
function isEmoji(char: string): boolean {
  return EMOJI_REGEX.test(char)
}

// ============================================================================
// Terminal display width — used by the ASCII renderer
//
// Terminals render most characters in 1 column, but East Asian wide
// characters (CJK ideographs, Hangul, kana, fullwidth forms) and
// emoji-presentation glyphs occupy 2 columns. The ASCII canvas is a
// cell-per-column grid, so its width math counts display columns rather
// than code units.
//
// Text is measured in grapheme clusters (Intl.Segmenter): a cluster that
// renders 2 columns is stored as its full string in one canvas cell
// followed by WIDE_PAD in the continuation cell it covers. The ASCII
// serializers drop WIDE_PAD cells when joining a row, so the emitted line
// occupies exactly as many terminal columns as the canvas has cells.
//
// Width policy (terminal wcwidth-style, locale-insensitive):
//   - East Asian Wide/Fullwidth code points ............ 2
//   - Emoji_Presentation scalars (e.g. 🚀, ⌚) .......... 2
//   - VS16 / ZWJ emoji sequences, regional-indicator flags 2
//   - combining marks / variation selectors / ZWJ ....... 0 (within cluster)
//   - everything else (incl. text-presentation symbols
//     like ◀ ▶ △ that the renderer uses as 1-cell glyphs) 1
// East Asian Ambiguous characters (e.g. ½ ·) are treated as narrow.
// ============================================================================

/**
 * Placeholder occupying the second cell of a fullwidth glyph on the ASCII
 * canvas. U+0000 cannot appear in parsed Mermaid labels, is treated as
 * occupied label content by canvas merging, and is stripped at
 * serialization time. Invariant: a WIDE_PAD cell always sits immediately
 * right of its lead cell; canvas writes keep the pair atomic.
 */
export const WIDE_PAD = '\u0000'

/** Scalars that default to emoji presentation render 2 columns wide. */
const EMOJI_PRESENTATION = /\p{Emoji_Presentation}/u

const ZWJ = '\u200d'
const VS16 = '\ufe0f'

const graphemeSegmenter = new Intl.Segmenter()

/** Display width of a single grapheme cluster in terminal columns. */
function clusterWidth(cluster: string): number {
  const first = cluster.codePointAt(0) ?? 0
  // Regional-indicator pair renders as one 2-column flag glyph.
  if (first >= 0x1f1e6 && first <= 0x1f1ff) return 2
  // ZWJ emoji sequence renders as a single 2-column glyph.
  if (cluster.includes(ZWJ)) return 2
  // An extended grapheme cluster renders as one glyph at its base scalar's
  // width; trailing extenders (combining marks, emoji/skin-tone modifiers,
  // variation selectors) fold into the base and add no columns.
  const base = String.fromCodePoint(first)
  let width = isFullwidth(first) || EMOJI_PRESENTATION.test(base) ? 2 : 1
  // VS16 upgrades a text-presentation base to emoji presentation (2 cols).
  if (width === 1 && cluster.includes(VS16)) width = 2
  return width
}

/**
 * Display width of a string in terminal columns, measured over grapheme
 * clusters. ASCII-only strings take a fast path.
 */
export function displayWidth(text: string): number {
  let ascii = true
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) > 0x7e) {
      ascii = false
      break
    }
  }
  if (ascii) return text.length

  let width = 0
  for (const seg of graphemeSegmenter.segment(text)) {
    width += clusterWidth(seg.segment)
  }
  return width
}

/**
 * Expand a string into ASCII-canvas cells: each 2-column grapheme cluster
 * is stored whole in one cell and followed by WIDE_PAD, so that
 * cells.length === displayWidth(text). Per-character placement loops can
 * iterate the result with plain cell offsets.
 */
export function toCells(text: string): string[] {
  const cells: string[] = []
  for (const seg of graphemeSegmenter.segment(text)) {
    cells.push(seg.segment)
    if (clusterWidth(seg.segment) === 2) {
      cells.push(WIDE_PAD)
    }
  }
  return cells
}

/**
 * Get the relative width of a single character.
 *
 * Returns a normalized width ratio where:
 * - 0.0 = zero-width (combining marks)
 * - 0.3 = space
 * - 0.4 = narrow (i, l, t, f, j, I, 1)
 * - 0.8 = semi-narrow (r)
 * - 1.0 = average lowercase
 * - 1.2 = wide lowercase / uppercase
 * - 1.5 = very wide (W, M)
 * - 2.0 = fullwidth (CJK, emoji)
 */
export function getCharWidth(char: string): number {
  const code = char.codePointAt(0)
  if (code === undefined) return 0

  // Zero-width: combining diacritical marks
  if (isCombiningMark(code)) return 0

  // Fullwidth: CJK, emoji
  if (isFullwidth(code) || isEmoji(char)) return 2.0

  // Space
  if (char === ' ') return 0.3

  // Very wide Latin
  if (VERY_WIDE_CHARS.has(char)) return 1.5

  // Wide Latin
  if (WIDE_CHARS.has(char)) return 1.2

  // Narrow Latin
  if (NARROW_CHARS.has(char)) return 0.4

  // Semi-narrow punctuation (brackets, slashes, hyphens)
  if (SEMI_NARROW_PUNCT.has(char)) return 0.5

  // Semi-narrow letter
  if (char === 'r') return 0.8

  // Uppercase (slightly wider than lowercase on average)
  if (code >= 65 && code <= 90) return 1.2

  // Digits (uniform width in most fonts)
  if (code >= 48 && code <= 57) return 1.0

  // Default: average lowercase width
  return 1.0
}

/**
 * Measure the pixel width of a text string.
 *
 * Uses character class buckets for more accurate width estimation
 * than uniform character width assumptions.
 *
 * @param text - The text to measure
 * @param fontSize - Font size in pixels
 * @param fontWeight - Font weight (affects width slightly)
 * @returns Estimated width in pixels
 */
export function measureTextWidth(text: string, fontSize: number, fontWeight: number): number {
  // Base ratio calibrated for Inter font family
  // Heavier weights are slightly wider
  // Added +0.02 buffer to prevent edge truncation of characters like 's' at line ends
  const baseRatio = fontWeight >= 600 ? 0.60 : fontWeight >= 500 ? 0.57 : 0.54

  let totalWidth = 0

  // Iterate over code points (handles surrogate pairs for emoji/CJK)
  for (const char of text) {
    totalWidth += getCharWidth(char)
  }

  // Add minimum padding to prevent truncation at text boundaries
  // Increased from 0.1 to 0.15 for better label separation and collision prevention
  const minPadding = fontSize * 0.15
  return totalWidth * fontSize * baseRatio + minPadding
}

// ============================================================================
// Multi-line Text Measurement
// ============================================================================

/** Standard line height ratio for multi-line text (1.3 = 130% of font size) */
export const LINE_HEIGHT_RATIO = 1.3

/** Metrics for multi-line text measurement */
export interface MultilineMetrics {
  /** Maximum line width in pixels */
  width: number
  /** Total height in pixels (lines × lineHeight) */
  height: number
  /** Individual lines after splitting */
  lines: string[]
  /** Computed line height in pixels */
  lineHeight: number
}

/**
 * Measure multi-line text dimensions.
 *
 * Splits text on newlines and returns the maximum width across all lines,
 * total height based on line count, and the split lines for rendering.
 *
 * @param text - The text to measure (may contain \n)
 * @param fontSize - Font size in pixels
 * @param fontWeight - Font weight (affects width slightly)
 * @returns Metrics including width, height, lines array, and lineHeight
 */
export function measureMultilineText(
  text: string,
  fontSize: number,
  fontWeight: number
): MultilineMetrics {
  const lines = text.split('\n')
  const lineHeight = fontSize * LINE_HEIGHT_RATIO

  // Width = max of all line widths
  let maxWidth = 0
  for (const line of lines) {
    const plain = line.replace(/<\/?(?:b|strong|i|em|u|s|del)\s*>/gi, '')
    const w = measureTextWidth(plain, fontSize, fontWeight)
    if (w > maxWidth) maxWidth = w
  }

  return {
    width: maxWidth,
    height: lines.length * lineHeight,
    lines,
    lineHeight,
  }
}
