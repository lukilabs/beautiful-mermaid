// ============================================================================
// ASCII renderer — text width utilities (monospace columns)
//
// Measures display width for mixed ASCII + CJK + emoji in fixed-width output.
// Inspired by wcwidth / string-width (MIT), trimmed for our use-case.
// ============================================================================

/** Return the display width of a string in monospace columns. */
export function stringWidth(text: string): number {
  let width = 0
  for (const ch of text) {
    width += charWidth(ch)
  }
  return width
}

/** Return the display width of a single Unicode character. */
export function charWidth(ch: string): number {
  const codePoint = ch.codePointAt(0)
  if (codePoint === undefined) return 0

  // Control characters
  if (codePoint <= 0x1F || (codePoint >= 0x7F && codePoint <= 0x9F)) return 0

  // Combining marks (zero width)
  if (isCombining(ch)) return 0

  return isFullwidthCodePoint(codePoint) ? 2 : 1
}

function isCombining(ch: string): boolean {
  return /\p{Mark}/u.test(ch)
}

// Based on https://github.com/sindresorhus/is-fullwidth-code-point (MIT)
function isFullwidthCodePoint(codePoint: number): boolean {
  if (codePoint >= 0x1100 && (
    codePoint <= 0x115F ||
    codePoint === 0x2329 ||
    codePoint === 0x232A ||
    (codePoint >= 0x2E80 && codePoint <= 0xA4CF && codePoint !== 0x303F) ||
    (codePoint >= 0xAC00 && codePoint <= 0xD7A3) ||
    (codePoint >= 0xF900 && codePoint <= 0xFAFF) ||
    (codePoint >= 0xFE10 && codePoint <= 0xFE19) ||
    (codePoint >= 0xFE30 && codePoint <= 0xFE6F) ||
    (codePoint >= 0xFF00 && codePoint <= 0xFF60) ||
    (codePoint >= 0xFFE0 && codePoint <= 0xFFE6) ||
    (codePoint >= 0x1F300 && codePoint <= 0x1F64F) ||
    (codePoint >= 0x1F900 && codePoint <= 0x1F9FF) ||
    (codePoint >= 0x20000 && codePoint <= 0x3FFFD)
  )) {
    return true
  }

  return false
}
