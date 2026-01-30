// ============================================================================
// CJK (Chinese, Japanese, Korean) character width utilities
//
// CJK characters have a display width of 2 in monospace terminals,
// while other characters have width of 1.
// This module provides utilities to correctly calculate string widths
// for proper text alignment in ASCII/Unicode rendering.
// ============================================================================

// Unicode ranges for CJK characters
const CJK_RANGES = [
  [0x4E00, 0x9FFF],   // CJK Unified Ideographs
  [0x3400, 0x4DBF],   // CJK Extension A
  [0x20000, 0x2A6DF], // CJK Extension B
  [0x2A700, 0x2B73F], // CJK Extension C
  [0x2B740, 0x2B81F], // CJK Extension D
  [0x3000, 0x303F],   // CJK Symbols and Punctuation
  [0xFF00, 0xFFEF],   // Fullwidth forms
  [0x3040, 0x309F],   // Hiragana
  [0x30A0, 0x30FF],   // Katakana
  [0xAC00, 0xD7AF],   // Korean Hangul
  [0x3130, 0x318F],   // Hangul Compatibility Jamo
] as const

/**
 * Check if a character is a CJK (East Asian Wide) character
 */
export function isCJK(char: string): boolean {
  if (char.length === 0) return false
  const code = char.charCodeAt(0)

  for (const [start, end] of CJK_RANGES) {
    if (code >= start && code <= end) return true
  }

  return false
}

/**
 * Calculate the display width of a string in monospace terminals
 * CJK characters count as 2, others as 1
 */
export function getDisplayWidth(str: string): number {
  let width = 0
  for (const char of str) {
    width += isCJK(char) ? 2 : 1
  }
  return width
}

/**
 * Calculate the starting X position to center text in a box
 *
 * @param boxWidth - Total width of the box (in display units)
 * @param textWidth - Display width of the text (using getDisplayWidth)
 * @returns The X offset from the box left edge
 */
export function centerTextOffset(boxWidth: number, textWidth: number): number {
  return Math.floor((boxWidth - textWidth) / 2)
}
