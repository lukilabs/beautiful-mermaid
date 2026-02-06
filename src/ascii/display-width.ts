import type { Canvas } from "./types.ts";

// Sentinel value placed after a wide character in the canvas grid.
// canvasToString() skips cells containing this marker.
export const WIDE_CHAR_PAD = "\u200B";

/**
 * Returns true if `ch` is a full-width character that occupies
 * two columns in a monospace / terminal display.
 *
 * Covers CJK Unified Ideographs, CJK Compatibility, Hangul,
 * Fullwidth Forms, common emoji blocks, and CJK Extension A/B.
 */
export function isWideChar(ch: string): boolean {
  const code = ch.codePointAt(0)!;
  return (
    (code >= 0x1100 && code <= 0x115f) || // Hangul Jamo
    (code >= 0x2e80 && code <= 0x303e) || // CJK Radicals, Kangxi, Ideographic
    (code >= 0x3040 && code <= 0x33bf) || // Hiragana, Katakana, Bopomofo, CJK Compat
    (code >= 0x3400 && code <= 0x4dbf) || // CJK Extension A
    (code >= 0x4e00 && code <= 0x9fff) || // CJK Unified Ideographs
    (code >= 0xa960 && code <= 0xa97c) || // Hangul Jamo Extended-A
    (code >= 0xac00 && code <= 0xd7a3) || // Hangul Syllables
    (code >= 0xf900 && code <= 0xfaff) || // CJK Compatibility Ideographs
    (code >= 0xfe10 && code <= 0xfe19) || // Vertical Forms
    (code >= 0xfe30 && code <= 0xfe6f) || // CJK Compatibility Forms + Small Forms
    (code >= 0xff00 && code <= 0xff60) || // Fullwidth Forms
    (code >= 0xffe0 && code <= 0xffe6) || // Fullwidth Signs
    (code >= 0x1f000 && code <= 0x1faff) || // Emoji / Mahjong / Domino
    (code >= 0x20000 && code <= 0x2fa1f) // CJK Extension B–F, Compat Supplement
  );
}

/**
 * Returns the *display width* of `text` in a monospace terminal,
 * where wide (CJK / emoji) characters count as 2 columns.
 */
export function displayWidth(text: string): number {
  let w = 0;
  for (const ch of text) {
    w += isWideChar(ch) ? 2 : 1;
  }
  return w;
}

/**
 * Draws `text` onto `canvas` starting at `(x, y)`, correctly
 * handling wide characters by inserting a {@link WIDE_CHAR_PAD}
 * sentinel in the next column.
 */
export function drawTextWide(
  canvas: Canvas,
  x: number,
  y: number,
  text: string,
): void {
  let offset = 0;
  for (const ch of text) {
    if (x + offset >= 0 && x + offset < canvas.length) {
      canvas[x + offset]![y] = ch;
    }
    offset++;
    if (isWideChar(ch)) {
      if (x + offset < canvas.length) {
        canvas[x + offset]![y] = WIDE_CHAR_PAD;
      }
      offset++;
    }
  }
}
