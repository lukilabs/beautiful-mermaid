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
 * real user text. Limitation: if user text contains U+E000 itself, it
 * will be stripped (PUA chars are rare in diagram labels).
 * If stripping is accidentally skipped, U+E000 renders as a visible
 * box (□) — making the bug immediately obvious.
 */
export const CJK_PAD = '\uE000'

/**
 * Check if a character is ALWAYS two columns in a monospace terminal
 * (East Asian Width = W or F). Does NOT include characters that only
 * become wide with VS16 (FE0F) — those are handled by isEmojiModifiable.
 */
export function isFullwidthChar(code: number): boolean {
  return (
    // --- CJK ---
    (code >= 0x1100 && code <= 0x115f) || // Hangul Jamo
    (code >= 0x2329 && code <= 0x232a) || // Angle Brackets (EAW=W)
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
    // --- Emoji SMP (EAW=W, always 2 columns) ---
    code === 0x1f004 || code === 0x1f0cf || code === 0x1f18e ||
    (code >= 0x1f191 && code <= 0x1f19a) ||
    (code >= 0x1f1e0 && code <= 0x1f1ff) || // Regional indicators
    (code >= 0x1f200 && code <= 0x1f202) || // Enclosed Ideographic Supplement
    (code >= 0x1f210 && code <= 0x1f23b) || // Squared CJK Unified Ideograph
    (code >= 0x1f240 && code <= 0x1f248) || // Tortoise Shell Bracketed CJK
    (code >= 0x1f250 && code <= 0x1f251) || // Circled Ideograph
    (code >= 0x1f300 && code <= 0x1f64f) || // Misc Symbols & Emoticons
    (code >= 0x1f680 && code <= 0x1f6ff) || // Transport & Map
    (code >= 0x1f7e0 && code <= 0x1f7eb) || // Colored circles/squares
    (code >= 0x1f900 && code <= 0x1f9ff) || // Supplemental Symbols
    (code >= 0x1fa00 && code <= 0x1fa6f) || // Chess Symbols
    (code >= 0x1fa70 && code <= 0x1faff) || // Symbols Extended-A
    // --- BMP emoji (EAW=W only, always 2 columns) ---
    code === 0x231a || code === 0x231b ||
    (code >= 0x23e9 && code <= 0x23ec) ||
    code === 0x23f0 || code === 0x23f3 ||
    code === 0x25fd || code === 0x25fe ||
    code === 0x2614 || code === 0x2615 ||
    (code >= 0x2648 && code <= 0x2653) || // zodiac
    code === 0x267f || code === 0x2693 ||
    code === 0x26a1 || // ⚡ EAW=W (NOT ⚠ which is EAW=N)
    code === 0x26aa || code === 0x26ab ||
    code === 0x26bd || code === 0x26be ||
    code === 0x26c4 || code === 0x26c5 ||
    code === 0x26ce || code === 0x26d4 ||
    code === 0x26ea || code === 0x26f2 || code === 0x26f3 ||
    code === 0x26f5 || code === 0x26fa || code === 0x26fd ||
    code === 0x2705 || // ✅ EAW=W
    code === 0x270a || code === 0x270b || // ✊✋ EAW=W
    code === 0x2728 || // ✨ EAW=W
    code === 0x274c || code === 0x274e ||
    (code >= 0x2753 && code <= 0x2755) ||
    code === 0x2757 ||
    (code >= 0x2795 && code <= 0x2797) ||
    code === 0x27b0 || code === 0x27bf ||
    code === 0x2b1b || code === 0x2b1c ||
    code === 0x2b50 || code === 0x2b55 ||
    code === 0x3030 || code === 0x303d ||
    code === 0x3297 || code === 0x3299 ||
    // --- CJK Extension B through I + Compatibility Supplement ---
    // FIX: replaced overly broad `>= 0x20000` with precise ranges
    (code >= 0x20000 && code <= 0x2a6df) || // CJK Extension B
    (code >= 0x2a700 && code <= 0x2b73f) || // CJK Extension C
    (code >= 0x2b740 && code <= 0x2b81f) || // CJK Extension D
    (code >= 0x2b820 && code <= 0x2ceaf) || // CJK Extension E
    (code >= 0x2ceb0 && code <= 0x2ebef) || // CJK Extension F
    (code >= 0x2f800 && code <= 0x2fa1f) || // CJK Compatibility Ideographs Supplement
    (code >= 0x30000 && code <= 0x3134f) || // CJK Extension G
    (code >= 0x31350 && code <= 0x323af) || // CJK Extension H
    (code >= 0x2ebf0 && code <= 0x2f7ff)    // CJK Extension I
  )
}

/**
 * Characters that are 1 column by default (EAW=N) but become 2 columns
 * when followed by VS16 (U+FE0F) for emoji presentation.
 *
 * Includes common EAW=N emoji that appear in diagram labels.
 * Note: grapheme clusters like skin tone modifiers and flag sequences
 * are NOT handled — they are rare in diagram labels and would require
 * a full grapheme segmenter (Intl.Segmenter or UAX#29 library).
 */
function isEmojiModifiable(code: number): boolean {
  return (
    code === 0x26a0 || // ⚠
    code === 0x2702 || // ✂
    code === 0x2708 || code === 0x2709 || // ✈✉
    code === 0x270c || code === 0x270d || // ✌✍
    code === 0x270f || code === 0x2712 || // ✏✒
    code === 0x2714 || code === 0x2716 || // ✔✖
    code === 0x271d || code === 0x2721 || // ✝✡
    code === 0x2733 || code === 0x2734 || // ✳✴
    code === 0x2744 || code === 0x2747 || // ❄❇
    code === 0x2763 || code === 0x2764 || // ❣❤
    code === 0x27a1 || // ➡
    code === 0x2934 || code === 0x2935 || // ⤴⤵
    (code >= 0x2b05 && code <= 0x2b07) || // ⬅⬆⬇
    // FIX: added missing EAW=N emoji (©️ ®️ ™️ ℹ️ ↔️ etc.)
    code === 0x00a9 || // © copyright
    code === 0x00ae || // ® registered
    code === 0x2122 || // ™ trade mark
    code === 0x2139 || // ℹ information
    (code >= 0x2194 && code <= 0x2199) || // ↔↕↖↗↘↙
    (code >= 0x21a9 && code <= 0x21aa) || // ↩↪
    code === 0x231a || code === 0x231b || // ⌚⌛ (also EAW=W, but FE0F doesn't hurt)
    (code >= 0x23e9 && code <= 0x23f3) || // ⏩-⏳
    (code >= 0x23f8 && code <= 0x23fa) || // ⏸⏹⏺
    code === 0x25aa || code === 0x25ab || // ▪▫
    code === 0x25b6 || code === 0x25c0 || // ▶◀
    code === 0x25fb || code === 0x25fc || // ◻◼
    code === 0x2600 || code === 0x2601 || // ☀☁
    (code >= 0x2602 && code <= 0x2604) || // ☂☃☄
    code === 0x260e || // ☎
    code === 0x2611 || // ☑
    (code >= 0x2618 && code <= 0x261d) || // ☘-☝
    code === 0x2620 || // ☠
    code === 0x2622 || code === 0x2623 || // ☢☣
    code === 0x2626 || code === 0x262a || // ☦☪
    code === 0x262e || code === 0x262f || // ☮☯
    (code >= 0x2638 && code <= 0x263a) || // ☸☹☺
    code === 0x2640 || code === 0x2642 || // ♀♂
    (code >= 0x2660 && code <= 0x2668) || // ♠-♨
    code === 0x267b || code === 0x267e    // ♻♾
  )
}

/**
 * Check if a character is zero-width (variation selectors, joiners, combining marks).
 * Note: FE0F is handled specially in displayWidth/drawCJKText before this check.
 */
export function isZeroWidth(code: number): boolean {
  return (
    (code >= 0xfe00 && code <= 0xfe0f) || // Variation Selectors (VS1-VS16)
    code === 0x200b || // Zero Width Space
    code === 0x200c || // Zero Width Non-Joiner
    code === 0x200d || // Zero Width Joiner
    code === 0xfeff || // BOM / Zero Width No-Break Space
    (code >= 0xe0100 && code <= 0xe01ef) || // Variation Selectors Supplement
    // FIX: added combining marks (zero display width)
    (code >= 0x0300 && code <= 0x036f) || // Combining Diacritical Marks
    (code >= 0x0483 && code <= 0x0489) || // Combining Cyrillic
    (code >= 0x0591 && code <= 0x05bd) || // Hebrew combining
    (code >= 0x0610 && code <= 0x061a) || // Arabic combining
    (code >= 0x064b && code <= 0x065f) || // Arabic combining
    (code >= 0x20d0 && code <= 0x20ff)    // Combining Diacritical Marks for Symbols
  )
}

/**
 * Calculate the display width of a string in monospace terminal columns.
 * - Fullwidth (CJK, EAW=W emoji): 2 columns
 * - EAW=N emoji + FE0F: 2 columns (FE0F upgrades previous char)
 * - EAW=N emoji alone: 1 column
 * - Zero-width (VS, ZWJ, combining marks): 0 columns
 * - Everything else: 1 column
 */
export function displayWidth(str: string): number {
  let w = 0
  let prevWasNarrowEmoji = false
  for (const ch of str) {
    const code = ch.codePointAt(0)
    if (code === undefined) continue
    // FE0F 追加到前一个 narrow emoji 上，宽度 1 → 2
    if (code === 0xfe0f) {
      if (prevWasNarrowEmoji) { w += 1; prevWasNarrowEmoji = false }
      continue
    }
    if (isZeroWidth(code)) continue
    if (isFullwidthChar(code)) {
      w += 2; prevWasNarrowEmoji = false
    } else {
      w += 1; prevWasNarrowEmoji = isEmojiModifiable(code)
    }
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
 * @param maxCols - Maximum display columns to render (clips text at boundary)
 */
export function drawCJKText(
  canvas: Canvas,
  x: number,
  y: number,
  text: string,
  forceOverwrite = false,
  roleCanvas?: RoleCanvas,
  role?: CharRole,
  maxCols?: number,
): void {
  let offset = 0
  let lastWrittenCx = -1
  let lastWasNarrowEmoji = false
  let lastCharWritten = false
  const h = canvas[0]?.length ?? 0
  for (const ch of text) {
    const code = ch.codePointAt(0)
    if (code === undefined) continue
    // FE0F: 若前一个是 narrow emoji 且有空间，升级为全宽（追加 FE0F + 放 CJK_PAD）
    if (code === 0xfe0f) {
      if (lastWasNarrowEmoji && lastCharWritten) {
        // 需要 1 列放 CJK_PAD；空间不够则跳过升级（保持 1 列窄 emoji）
        if (maxCols === undefined || offset < maxCols) {
          if (lastWrittenCx >= 0 && lastWrittenCx < canvas.length && y >= 0 && y < h) {
            canvas[lastWrittenCx]![y] = (canvas[lastWrittenCx]![y] ?? '') + ch
          }
          const px = x + offset
          if (px >= 0 && px < canvas.length && y >= 0 && y < h) {
            canvas[px]![y] = CJK_PAD
          }
          offset++
        }
        lastWasNarrowEmoji = false
      } else if (lastCharWritten && lastWrittenCx >= 0 && lastWrittenCx < canvas.length && y >= 0 && y < h) {
        // 非 emoji 后的 FE0F: 追加为零宽（无视觉效果）
        canvas[lastWrittenCx]![y] = (canvas[lastWrittenCx]![y] ?? '') + ch
      }
      continue
    }
    // 其他零宽字符: 跳过
    if (isZeroWidth(code)) continue
    // maxCols 检查: 全宽字符需要 2 列空间
    const charWidth = isFullwidthChar(code) ? 2 : 1
    if (maxCols !== undefined && offset + charWidth > maxCols) break
    // 正常字符绘制
    const cx = x + offset
    let written = false
    if (cx >= 0 && cx < canvas.length && y >= 0 && y < h) {
      if (forceOverwrite || canvas[cx]![y] === ' ') {
        canvas[cx]![y] = ch
        if (roleCanvas && role !== undefined && cx < roleCanvas.length && y < (roleCanvas[0]?.length ?? 0)) {
          roleCanvas[cx]![y] = role
        }
        written = true
      }
    }
    if (written) {
      lastWrittenCx = cx
    }
    lastCharWritten = written
    offset++
    if (isFullwidthChar(code)) {
      lastWasNarrowEmoji = false
      if (written) {
        const px = x + offset
        if (px >= 0 && px < canvas.length && y >= 0 && y < h) {
          canvas[px]![y] = CJK_PAD
        }
      }
      offset++
    } else {
      lastWasNarrowEmoji = isEmojiModifiable(code)
    }
  }
}
