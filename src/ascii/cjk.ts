// ============================================================================
// ASCII renderer — fullwidth character support
//
// CJK (Chinese/Japanese/Korean) and other fullwidth characters occupy 2
// terminal columns, but JavaScript's `.length` counts them as 1. This module
// provides display-width calculation and CJK-aware canvas text rendering.
//
// Unicode ranges from src/text-metrics.ts isFullwidth() — kept in sync.
// ============================================================================

import type { Canvas, RoleCanvas, CharRole } from './types.ts'

/**
 * Sentinel character placed in the "right half" of a fullwidth character's
 * canvas cell. Stripped by `canvasToString()` before output.
 *
 * Uses a Private Use Area character (U+E000) to avoid collisions with
 * real user text. If stripping is accidentally skipped, the character
 * renders as a visible box — making the bug immediately obvious.
 */
export const CJK_PAD = '\uE000'

/**
 * Check if a character occupies two columns in a monospace terminal.
 *
 * Covers CJK Unified Ideographs, Hangul, fullwidth forms, and extended
 * CJK blocks. Ranges mirror `isFullwidth()` in `src/text-metrics.ts`.
 */
export function isFullwidthChar(code: number): boolean {
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
    (code >= 0xfe30 && code <= 0xfe4f) || // CJK Compatibility Forms
    (code >= 0xff00 && code <= 0xff60) || // Fullwidth ASCII
    (code >= 0xffe0 && code <= 0xffe6) || // Fullwidth symbols
    code >= 0x20000                       // CJK Extension B and beyond
  )
}

/**
 * Calculate the display width of a string in monospace terminal columns.
 * Fullwidth characters (CJK, etc.) count as 2; all others count as 1.
 */
export function displayWidth(str: string): number {
  let w = 0
  for (const ch of str) {
    const code = ch.codePointAt(0)
    w += (code !== undefined && isFullwidthChar(code)) ? 2 : 1
  }
  return w
}

/**
 * Draw a text string onto a column-major canvas with fullwidth character
 * support. Each fullwidth character is followed by a `CJK_PAD` sentinel
 * in the next column to maintain alignment.
 *
 * @param canvas - Column-major 2D character array (canvas[x][y])
 * @param x - Starting column index
 * @param y - Row index
 * @param text - Text to draw
 * @param forceOverwrite - If true, overwrite existing non-space characters
 * @param roleCanvas - Optional role canvas for colored output
 * @param role - Character role to assign (requires roleCanvas)
 */
export function drawCJKText(
  canvas: Canvas,
  x: number,
  y: number,
  text: string,
  forceOverwrite = false,
  roleCanvas?: RoleCanvas,
  role?: CharRole,
): void {
  let offset = 0
  for (const ch of text) {
    const cx = x + offset
    let written = false
    if (cx >= 0 && cx < canvas.length && y >= 0 && y < (canvas[0]?.length ?? 0)) {
      if (forceOverwrite || canvas[cx]![y] === ' ') {
        canvas[cx]![y] = ch
        if (roleCanvas && role !== undefined && cx < roleCanvas.length && y < (roleCanvas[0]?.length ?? 0)) {
          roleCanvas[cx]![y] = role
        }
        written = true
      }
    }
    offset++
    const code = ch.codePointAt(0)
    if (code !== undefined && isFullwidthChar(code)) {
      if (written) {
        const px = x + offset
        if (px >= 0 && px < canvas.length && y >= 0 && y < (canvas[0]?.length ?? 0)) {
          canvas[px]![y] = CJK_PAD
        }
      }
      offset++
    }
  }
}
