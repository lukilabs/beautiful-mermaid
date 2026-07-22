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
 * Exact advance widths for printable ASCII, measured from the real Inter font
 * (canvas measureText, headless Chrome, weight 400) and normalized so that
 * ratio × fontSize × baseRatio reproduces the measured pixel advance.
 *
 * The coarse character-class buckets below remain as fallback for characters
 * not in this table. The buckets systematically underestimated Inter widths
 * (spaces, m/w, digits, punctuation), and the error grew with text length —
 * wide edge labels overflowed their 8px-padded background rects.
 */
const INTER_ADVANCES: Record<string, number> = {
  ' ': 0.521, '!': 0.533, '"': 0.863, '%': 1.818, "'": 0.555,
  '(': 0.675, ')': 0.675, '+': 1.225, ',': 0.534, '-': 0.852,
  '.': 0.534, '/': 0.667,
  '0': 1.168, '1': 0.753, '2': 1.129, '3': 1.144, '4': 1.196,
  '5': 1.099, '6': 1.148, '7': 1.048, '8': 1.146, '9': 1.148,
  ':': 0.534, ';': 0.559, '@': 1.789,
  'A': 1.278, 'B': 1.212, 'C': 1.353, 'D': 1.336, 'E': 1.113,
  'F': 1.093, 'G': 1.382, 'H': 1.376, 'I': 0.497, 'J': 1.057,
  'K': 1.244, 'L': 1.047, 'M': 1.673, 'N': 1.395, 'O': 1.416,
  'P': 1.183, 'Q': 1.416, 'R': 1.192, 'S': 1.188, 'T': 1.195,
  'U': 1.378, 'V': 1.278, 'W': 1.825, 'X': 1.263, 'Y': 1.257,
  'Z': 1.165,
  '[': 0.675, '\\': 0.667, ']': 0.675, '_': 0.845,
  'a': 1.04, 'b': 1.134, 'c': 1.058, 'd': 1.134, 'e': 1.08,
  'f': 0.685, 'g': 1.136, 'h': 1.095, 'i': 0.448, 'j': 0.448,
  'k': 1.016, 'l': 0.448, 'm': 1.622, 'n': 1.094, 'o': 1.11,
  'p': 1.134, 'q': 1.134, 'r': 0.697, 's': 0.977, 't': 0.606,
  'u': 1.095, 'v': 1.041, 'w': 1.515, 'x': 1.011, 'y': 1.041,
  'z': 1.023,
  '{': 0.789, '|': 0.616, '}': 0.789,
}

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

  // Exact measured advance for printable ASCII (Inter)
  const measured = INTER_ADVANCES[char]
  if (measured !== undefined) return measured

  // Zero-width: combining diacritical marks
  if (isCombiningMark(code)) return 0

  // Fullwidth: CJK, emoji
  if (isFullwidth(code) || isEmoji(char)) return 2.0

  // Accented Latin: use the base letter's measured advance (é → e, Ü → U)
  const base = char.normalize('NFD')[0]
  if (base !== undefined && base !== char) {
    const baseMeasured = INTER_ADVANCES[base]
    if (baseMeasured !== undefined) return baseMeasured
  }

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
