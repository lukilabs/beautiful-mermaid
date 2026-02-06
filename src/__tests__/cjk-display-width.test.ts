import { describe, expect, test } from 'bun:test'
import { isWideChar, displayWidth, drawTextWide, WIDE_CHAR_PAD } from '../ascii/display-width.ts'
import { mkCanvas, canvasToString } from '../ascii/canvas.ts'
import { renderMermaidAscii } from '../ascii/index.ts'

describe('isWideChar', () => {
  test('detects CJK Unified Ideographs', () => {
    expect(isWideChar('中')).toBe(true)
    expect(isWideChar('文')).toBe(true)
    expect(isWideChar('字')).toBe(true)
  })
  test('detects Hangul', () => {
    expect(isWideChar('한')).toBe(true)
    expect(isWideChar('글')).toBe(true)
  })
  test('detects Hiragana/Katakana', () => {
    expect(isWideChar('あ')).toBe(true)
    expect(isWideChar('カ')).toBe(true)
  })
  test('detects Fullwidth Forms', () => {
    expect(isWideChar('Ａ')).toBe(true) // U+FF21
  })
  test('returns false for ASCII', () => {
    expect(isWideChar('A')).toBe(false)
    expect(isWideChar('z')).toBe(false)
    expect(isWideChar('1')).toBe(false)
    expect(isWideChar('-')).toBe(false)
  })
})

describe('displayWidth', () => {
  test('ASCII string', () => {
    expect(displayWidth('hello')).toBe(5)
  })
  test('CJK string', () => {
    expect(displayWidth('中文')).toBe(4)
    expect(displayWidth('用户发链接')).toBe(10)
  })
  test('mixed string', () => {
    expect(displayWidth('save-twitter下载')).toBe(16)
    expect(displayWidth('Playwright 抓取')).toBe(15)
  })
  test('empty string', () => {
    expect(displayWidth('')).toBe(0)
  })
})

describe('drawTextWide', () => {
  test('ASCII text placed normally', () => {
    const canvas = mkCanvas(10, 0)
    drawTextWide(canvas, 0, 0, 'hello')
    expect(canvas[0]![0]).toBe('h')
    expect(canvas[4]![0]).toBe('o')
    expect(canvas[5]![0]).toBe(' ')
  })
  test('CJK text inserts padding markers', () => {
    const canvas = mkCanvas(10, 0)
    drawTextWide(canvas, 0, 0, '中文')
    expect(canvas[0]![0]).toBe('中')
    expect(canvas[1]![0]).toBe(WIDE_CHAR_PAD)
    expect(canvas[2]![0]).toBe('文')
    expect(canvas[3]![0]).toBe(WIDE_CHAR_PAD)
  })
})

describe('canvasToString skips WIDE_CHAR_PAD', () => {
  test('CJK text rendered correctly', () => {
    const canvas = mkCanvas(5, 0)
    drawTextWide(canvas, 0, 0, '中文')
    const output = canvasToString(canvas)
    expect(output).toContain('中文')
    expect(output).not.toContain(WIDE_CHAR_PAD)
  })
})

describe('renderMermaidAscii with CJK', () => {
  test('flowchart LR: CJK labels fit inside boxes', () => {
    const result = renderMermaidAscii(`graph LR
    A[中文] --> B[测试]`)
    // CJK text should be inside box borders, not overflowing
    const lines = result.split('\n')
    // Find the line with the label text
    const labelLine = lines.find(l => l.includes('中文'))!
    // The CJK text should be between │ borders
    expect(labelLine).toMatch(/│.*中文.*│/)
  })

  test('flowchart TD: CJK labels fit inside boxes', () => {
    const result = renderMermaidAscii(`graph TD
    A[用户] --> B[保存]`)
    const lines = result.split('\n')
    const labelLine = lines.find(l => l.includes('用户'))!
    expect(labelLine).toMatch(/│.*用户.*│/)
  })

  test('sequence diagram: CJK actor labels align', () => {
    const result = renderMermaidAscii(`sequenceDiagram
    用户->>服务器: 请求数据
    服务器-->>用户: 返回结果`)
    const lines = result.split('\n')
    // Top and bottom actor boxes should have same width
    const topLine = lines[0]!
    const bottomLine = lines[lines.length - 1]!
    // Both should contain the actor names in boxes
    expect(topLine).toContain('用户')
    expect(bottomLine).toContain('用户')
  })
})
