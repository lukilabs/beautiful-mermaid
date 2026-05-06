// ============================================================================
// CJK width support — unit tests
// ============================================================================

import { describe, test, expect } from 'bun:test'
import { displayWidth, isFullwidthChar, isZeroWidth, drawCJKText, CJK_PAD } from '../ascii/cjk.ts'
import { mkCanvas } from '../ascii/canvas.ts'

// ============================================================================
// displayWidth
// ============================================================================

describe('displayWidth', () => {
  test('ASCII text = string length', () => {
    expect(displayWidth('hello')).toBe(5)
    expect(displayWidth('Hello World')).toBe(11)
    expect(displayWidth('')).toBe(0)
  })

  test('CJK characters = 2 columns each', () => {
    expect(displayWidth('中')).toBe(2)
    expect(displayWidth('中文')).toBe(4)
    expect(displayWidth('你好世界')).toBe(8)
  })

  test('mixed ASCII + CJK', () => {
    expect(displayWidth('Hello中文')).toBe(9) // 5 + 4
    expect(displayWidth('A中B文C')).toBe(7) // 3 + 4
  })

  test('Japanese hiragana/katakana', () => {
    expect(displayWidth('あ')).toBe(2)
    expect(displayWidth('アイウ')).toBe(6)
  })

  test('Korean hangul', () => {
    expect(displayWidth('한')).toBe(2)
    expect(displayWidth('한글')).toBe(4)
  })

  test('fullwidth ASCII', () => {
    expect(displayWidth('Ａ')).toBe(2) // U+FF21
  })

  test('EAW=W emoji (always 2 columns)', () => {
    expect(displayWidth('⚡')).toBe(2) // U+26A1
    expect(displayWidth('✅')).toBe(2) // U+2705
    expect(displayWidth('❌')).toBe(2) // U+274C
  })

  test('EAW=N emoji alone = 1 column', () => {
    expect(displayWidth('⚠')).toBe(1) // U+26A0 without FE0F
    expect(displayWidth('✈')).toBe(1) // U+2708 without FE0F
  })

  test('EAW=N emoji + FE0F = 2 columns', () => {
    expect(displayWidth('⚠️')).toBe(2) // U+26A0 + U+FE0F
    expect(displayWidth('✈️')).toBe(2) // U+2708 + U+FE0F
  })

  test('SMP emoji (always 2 columns)', () => {
    expect(displayWidth('😀')).toBe(2) // U+1F600
    expect(displayWidth('🚀')).toBe(2) // U+1F680
    expect(displayWidth('🎉')).toBe(2) // U+1F389
  })

  test('ZWJ sequences counted by components', () => {
    // ZWJ (U+200D) is zero-width, so only visible characters count
    // 👨‍💻 = 👨 + ZWJ + 💻 = 2 + 0 + 2 = 4
    expect(displayWidth('👨\u200D💻')).toBe(4)
  })

  test('combining marks = 0 columns', () => {
    // 'e' + combining acute accent (U+0301)
    expect(displayWidth('e\u0301')).toBe(1)
    // 'a' + combining diacritical mark for symbols (U+20D7)
    expect(displayWidth('a\u20D7')).toBe(1)
  })

  test('variation selectors (non-FE0F) = 0 columns', () => {
    // VS1 (U+FE00) should be zero width
    expect(displayWidth('A\uFE00')).toBe(1)
  })

  test('box-drawing characters = 1 column', () => {
    expect(displayWidth('─')).toBe(1)
    expect(displayWidth('│')).toBe(1)
    expect(displayWidth('┌┐└┘')).toBe(4)
  })
})

// ============================================================================
// isFullwidthChar
// ============================================================================

describe('isFullwidthChar', () => {
  test('CJK Unified Ideographs', () => {
    expect(isFullwidthChar(0x4e00)).toBe(true)  // 一
    expect(isFullwidthChar(0x9fff)).toBe(true)   // last in block
  })

  test('CJK Extension B', () => {
    expect(isFullwidthChar(0x20000)).toBe(true)
    expect(isFullwidthChar(0x2a6df)).toBe(true)
  })

  test('SMP private use = false (fixed from patch-cjk-v2)', () => {
    // U+F0000 is Supplementary Private Use Area — NOT CJK
    expect(isFullwidthChar(0xF0000)).toBe(false)
    expect(isFullwidthChar(0x100000)).toBe(false)
  })

  test('ASCII = false', () => {
    expect(isFullwidthChar(0x41)).toBe(false) // 'A'
    expect(isFullwidthChar(0x7a)).toBe(false) // 'z'
  })

  test('emoji EAW=W', () => {
    expect(isFullwidthChar(0x1F600)).toBe(true) // 😀
    expect(isFullwidthChar(0x26A1)).toBe(true)  // ⚡
  })

  test('emoji EAW=N', () => {
    expect(isFullwidthChar(0x26A0)).toBe(false) // ⚠ (EAW=N)
  })
})

// ============================================================================
// isZeroWidth
// ============================================================================

describe('isZeroWidth', () => {
  test('ZWJ = zero width', () => {
    expect(isZeroWidth(0x200D)).toBe(true)
  })

  test('ZWNJ = zero width', () => {
    expect(isZeroWidth(0x200C)).toBe(true)
  })

  test('variation selectors', () => {
    expect(isZeroWidth(0xFE00)).toBe(true) // VS1
    expect(isZeroWidth(0xFE0F)).toBe(true) // VS16
  })

  test('combining diacritical marks', () => {
    expect(isZeroWidth(0x0300)).toBe(true) // combining grave accent
    expect(isZeroWidth(0x0301)).toBe(true) // combining acute accent
    expect(isZeroWidth(0x036F)).toBe(true) // last in block
  })

  test('combining marks for symbols', () => {
    expect(isZeroWidth(0x20D0)).toBe(true)
    expect(isZeroWidth(0x20FF)).toBe(true)
  })

  test('regular characters = not zero width', () => {
    expect(isZeroWidth(0x41)).toBe(false)   // 'A'
    expect(isZeroWidth(0x4E00)).toBe(false) // '一'
    expect(isZeroWidth(0x20)).toBe(false)   // space
  })
})

// ============================================================================
// drawCJKText
// ============================================================================

describe('drawCJKText', () => {
  test('ASCII text draws normally', () => {
    const canvas = mkCanvas(10, 0)
    drawCJKText(canvas, 0, 0, 'Hello')
    expect(canvas[0]![0]).toBe('H')
    expect(canvas[4]![0]).toBe('o')
    expect(canvas[5]![0]).toBe(' ')
  })

  test('CJK text places CJK_PAD after each character', () => {
    const canvas = mkCanvas(10, 0)
    drawCJKText(canvas, 0, 0, '中文')
    expect(canvas[0]![0]).toBe('中')
    expect(canvas[1]![0]).toBe(CJK_PAD)
    expect(canvas[2]![0]).toBe('文')
    expect(canvas[3]![0]).toBe(CJK_PAD)
    expect(canvas[4]![0]).toBe(' ')
  })

  test('mixed text has correct layout', () => {
    const canvas = mkCanvas(10, 0)
    drawCJKText(canvas, 0, 0, 'A中B')
    expect(canvas[0]![0]).toBe('A')
    expect(canvas[1]![0]).toBe('中')
    expect(canvas[2]![0]).toBe(CJK_PAD)
    expect(canvas[3]![0]).toBe('B')
  })

  test('forceOverwrite=false preserves existing non-space characters', () => {
    const canvas = mkCanvas(10, 0)
    canvas[0]![0] = 'X'
    drawCJKText(canvas, 0, 0, 'AB', false)
    expect(canvas[0]![0]).toBe('X') // not overwritten
    expect(canvas[1]![0]).toBe('B') // written (was space)
  })

  test('forceOverwrite=true overwrites everything', () => {
    const canvas = mkCanvas(10, 0)
    canvas[0]![0] = 'X'
    drawCJKText(canvas, 0, 0, 'AB', true)
    expect(canvas[0]![0]).toBe('A')
    expect(canvas[1]![0]).toBe('B')
  })

  test('FE0F appends to previous character cell (not a new cell)', () => {
    const canvas = mkCanvas(10, 0)
    drawCJKText(canvas, 0, 0, '⚠️') // U+26A0 + U+FE0F
    // ⚠ written to cell 0, FE0F appended to it, pad in cell 1
    expect(canvas[0]![0]).toBe('⚠\uFE0F')
    expect(canvas[1]![0]).toBe(CJK_PAD)
  })

  test('FE0F does NOT pollute unrelated cells (bug fix)', () => {
    const canvas = mkCanvas(10, 0)
    // Draw a border character first
    canvas[0]![0] = '─'
    // Try to draw ⚠️ starting at position 1, but forceOverwrite=false
    // and position 1 has '─' which is non-space
    drawCJKText(canvas, 0, 0, '─⚠️', false)
    // The ─ at position 0 should NOT have FE0F appended
    // because the ─ was not written by this drawCJKText call
    expect(canvas[0]![0]).toBe('─')
    // ⚠ is at position 1 (it IS a non-space, so with forceOverwrite=false it stays)
    // Actually ─ was already there, so ⚠ won't be written
  })

  test('zero-width characters are skipped', () => {
    const canvas = mkCanvas(10, 0)
    drawCJKText(canvas, 0, 0, 'A\u200BB') // A + ZWS + B
    expect(canvas[0]![0]).toBe('A')
    expect(canvas[1]![0]).toBe('B')
  })
})
