// CJK 宽度修复模块 (patch-cjk-v2.mjs 生成)
export const CJK_PAD = '\u200B'

export function isCJK(ch: string): boolean {
  const c = ch.codePointAt(0)!
  return (c >= 0x2E80 && c <= 0x9FFF) || (c >= 0xAC00 && c <= 0xD7AF) ||
         (c >= 0xF900 && c <= 0xFAFF) || (c >= 0xFE30 && c <= 0xFE4F) ||
         (c >= 0xFF00 && c <= 0xFF60) || (c >= 0xFFE0 && c <= 0xFFE6) ||
         (c >= 0x20000 && c <= 0x2FA1F)
}

export function displayWidth(str: string): number {
  let w = 0
  for (const ch of str) w += isCJK(ch) ? 2 : 1
  return w
}

export function drawCJKText(
  canvas: string[][], x: number, y: number, text: string, forceOverwrite = false
): void {
  let offset = 0
  for (const ch of text) {
    const cx = x + offset
    if (cx >= 0 && cx < canvas.length && y >= 0 && y < (canvas[0]?.length ?? 0)) {
      if (forceOverwrite || canvas[cx]![y] === ' ') canvas[cx]![y] = ch
    }
    offset++
    if (isCJK(ch)) {
      const px = x + offset
      if (px >= 0 && px < canvas.length && y >= 0 && y < (canvas[0]?.length ?? 0)) canvas[px]![y] = CJK_PAD
      offset++
    }
  }
}
