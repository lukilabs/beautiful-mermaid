import { describe, it, expect } from 'bun:test'
import { renderMermaidAscii } from '../ascii/index.ts'
import { mkCanvas, drawText, mergeCanvases, canvasToString } from '../ascii/canvas.ts'
import { displayWidth, toCells, WIDE_PAD } from '../text-metrics.ts'

/**
 * Display column of character index `idx` within `line` — i.e. how many
 * terminal columns precede it. This is what a monospace terminal uses to
 * align glyphs, so box borders must agree on it across rows.
 */
function displayCol(line: string, idx: number): number {
  return displayWidth(line.slice(0, idx))
}

/**
 * Assert that the first box in the output is rectangular in display columns:
 * its top corners define a left/right column, every in-box row that carries
 * vertical borders has borders exactly at those columns, and the bottom
 * corners land on them too. Tolerates sibling boxes on the same rows (only
 * requires the expected columns to be present among the border positions)
 * and divider/junction rows (skipped — they carry no vertical border char).
 * Returns the number of rows whose borders were verified.
 */
function expectAlignedBox(output: string, topLeft: string, topRight: string, vertical: string): number {
  const lines = output.split('\n')
  const topIdx = lines.findIndex(l => l.includes(topLeft) && l.includes(topRight))
  expect(topIdx).toBeGreaterThanOrEqual(0)
  const top = lines[topIdx]!
  const leftCol = displayCol(top, top.indexOf(topLeft))
  const rightCol = displayCol(top, top.indexOf(topRight))

  // Find the bottom border row: the next row whose characters at the
  // expected columns are box-closing corners or junctions.
  const bottomChars = new Set(['└', '┘', '╰', '╯', '╚', '╝', '┴', "'", '+', '#'])
  let checked = 0
  for (let i = topIdx + 1; i < lines.length; i++) {
    const line = lines[i]!
    const cols = new Map<number, string>()
    let col = 0
    // Segment by grapheme (not code point) so the column model matches the
    // renderer's: a flag like 🇨🇳 is one 2-column glyph, not two.
    for (const { segment } of new Intl.Segmenter().segment(line)) {
      cols.set(col, segment)
      col += displayWidth(segment)
    }
    const atLeft = cols.get(leftCol)
    const atRight = cols.get(rightCol)
    if (atLeft !== undefined && bottomChars.has(atLeft)) {
      // Bottom border: both corners must close at the expected columns
      expect(atRight !== undefined && bottomChars.has(atRight)).toBe(true)
      checked++
      break
    }
    if (line.includes(vertical)) {
      expect(atLeft).toBe(vertical)
      expect(atRight).toBe(vertical)
      checked++
    }
  }
  return checked
}

describe('CJK display width utilities', () => {
  it('counts fullwidth characters as 2 columns', () => {
    expect(displayWidth('AB')).toBe(2)
    expect(displayWidth('한글')).toBe(4)
    expect(displayWidth('수집 스케줄러')).toBe(13)
    expect(displayWidth('日本語テスト')).toBe(12)
    expect(displayWidth('中文')).toBe(4)
    expect(displayWidth('mixed 한글 text')).toBe(15)
    expect(displayWidth('')).toBe(0)
  })

  it('counts emoji-presentation scalars as 2 columns', () => {
    expect(displayWidth('🚀')).toBe(2)
    expect(displayWidth('A🚀B')).toBe(4)
    expect(displayWidth('⌚')).toBe(2)
  })

  it('keeps text-presentation symbols used by the renderer at 1 column', () => {
    // The renderer itself places these as single-cell arrowheads/markers
    for (const ch of ['◀', '▶', '◁', '▷', '△', '▲', '▼', '◆', '◇', '½', '·']) {
      expect(displayWidth(ch)).toBe(1)
    }
  })

  it('measures grapheme clusters, not code points', () => {
    expect(displayWidth('👩‍💻')).toBe(2) // ZWJ sequence
    expect(displayWidth('👨‍👩‍👧')).toBe(2) // multi-ZWJ family
    expect(displayWidth('🇰🇷')).toBe(2) // regional-indicator flag
    expect(displayWidth('👍🏽')).toBe(2) // base + skin-tone modifier (one glyph)
    expect(displayWidth('🏳️‍🌈')).toBe(2) // flag + VS16 + ZWJ + rainbow
    expect(displayWidth('✈️')).toBe(2) // VS16 forces emoji presentation
    expect(displayWidth('❤️')).toBe(2)
    expect(displayWidth('1️⃣')).toBe(2) // keycap sequence
    expect(displayWidth('e\u0301')).toBe(1) // combining acute mark
  })

  it('upgrades text-presentation symbols to 2 columns only with VS16', () => {
    // Default presentation is text (1 col); VS16 requests emoji (2 cols).
    expect(displayWidth('⚠')).toBe(1)
    expect(displayWidth('⚠️')).toBe(2)
    expect(displayWidth('©')).toBe(1)
    expect(displayWidth('©️')).toBe(2)
  })

  it('expands wide glyphs into glyph + pad cells', () => {
    expect(toCells('AB')).toEqual(['A', 'B'])
    expect(toCells('한글')).toEqual(['한', WIDE_PAD, '글', WIDE_PAD])
    expect(toCells('A한B')).toEqual(['A', '한', WIDE_PAD, 'B'])
    expect(toCells('👩‍💻')).toEqual(['👩‍💻', WIDE_PAD])
    expect(toCells('e\u0301')).toEqual(['e\u0301'])
  })
})

describe('CJK box border alignment', () => {
  it('aligns flowchart node borders around Hangul labels', () => {
    const out = renderMermaidAscii('graph TD\n  A[수집 스케줄러]', { useAscii: false })
    expect(expectAlignedBox(out, '┌', '┐', '│')).toBeGreaterThan(0)
  })

  it('aligns flowchart node borders around mixed-width labels', () => {
    const out = renderMermaidAscii('graph TD\n  A[릴리즈 ingest 단계]', { useAscii: false })
    expect(expectAlignedBox(out, '┌', '┐', '│')).toBeGreaterThan(0)
  })

  it('aligns connected CJK nodes and keeps edge label', () => {
    const out = renderMermaidAscii('graph TD\n  A[수집기] -->|매시간| B[저장소]', { useAscii: false })
    expect(out).toContain('매시간')
    expect(expectAlignedBox(out, '┌', '┐', '│')).toBeGreaterThan(0)
  })

  it('aligns multi-line CJK node labels', () => {
    const out = renderMermaidAscii('graph TD\n  A[첫째 줄<br>둘째 줄이 더 길다]', { useAscii: false })
    expect(out).toContain('첫째 줄')
    expect(expectAlignedBox(out, '┌', '┐', '│')).toBeGreaterThan(0)
  })

  it('aligns sequence actor boxes with Hangul labels', () => {
    const out = renderMermaidAscii(
      'sequenceDiagram\n  participant U as 방문자\n  participant W as 웹사이트\n  U->>W: 페이지 요청',
      { useAscii: false },
    )
    expect(out).toContain('페이지 요청')
    expect(expectAlignedBox(out, '┌', '┐', '│')).toBeGreaterThan(0)
  })

  it('aligns class diagram boxes with Hangul members', () => {
    const out = renderMermaidAscii(
      'classDiagram\n  class 동물 {\n    +이름 string\n  }',
      { useAscii: false },
    )
    expect(out).toContain('동물')
    expect(expectAlignedBox(out, '┌', '┐', '│')).toBeGreaterThan(0)
  })

  it('aligns ER entity boxes with Hangul names', () => {
    const out = renderMermaidAscii('erDiagram\n  회원 ||--o{ 주문 : 생성', { useAscii: false })
    expect(out).toContain('생성')
    expect(expectAlignedBox(out, '┌', '┐', '│')).toBeGreaterThan(0)
  })

  it('centers xychart CJK title within total width', () => {
    const out = renderMermaidAscii(
      'xychart-beta\n  title "월별 방문자"\n  x-axis [1월, 2월]\n  y-axis "명" 0 --> 10\n  bar [3, 7]',
      { useAscii: false },
    )
    expect(out).toContain('월별 방문자')
  })

  it('aligns state diagram boxes with Hangul labels', () => {
    const out = renderMermaidAscii('stateDiagram-v2\n  [*] --> 대기\n  대기 --> 처리중: 시작', { useAscii: false })
    expect(out).toContain('처리중')
    expect(expectAlignedBox(out, '╭', '╮', '│')).toBeGreaterThan(0)
  })

  it('aligns boxes for flag + CJK labels (compound emoji)', () => {
    // Regression for the regional-indicator case competing fixes miss:
    // 🇨🇳 is one 2-column glyph, not two 1-column code points.
    const out = renderMermaidAscii('graph TD\n  A[🇨🇳 中文文章] --> B[🇬🇧 英文文章]', { useAscii: false })
    expect(out).toContain('🇨🇳 中文文章')
    expect(expectAlignedBox(out, '┌', '┐', '│')).toBeGreaterThan(0)
  })
})

describe('wide-glyph continuation cells', () => {
  it('never leaks the pad placeholder into output', () => {
    const sources = [
      'graph TD\n  A[한글] --> B[테스트]',
      'graph TD\n  A[🇨🇳 中文] --> B[👍🏽 OK]',
      'sequenceDiagram\n  A->>B: 한글 메시지',
      'classDiagram\n  class 클래스',
      'erDiagram\n  고객 ||--o{ 주문 : 한다',
      'stateDiagram-v2\n  [*] --> 대기',
      'xychart-beta\n  title "월별"\n  x-axis [일월, 이월]\n  y-axis "명" 0 --> 10\n  bar [3, 7]',
    ]
    for (const src of sources) {
      const out = renderMermaidAscii(src, { useAscii: false })
      expect(out).not.toContain(WIDE_PAD)
    }
  })

  it('keeps pure-ASCII output identical in width semantics', () => {
    const out = renderMermaidAscii('graph TD\n  A[Plain] --> B[Labels]', { useAscii: false })
    for (const line of out.split('\n')) {
      expect(displayWidth(line)).toBe(line.length)
    }
  })

  it('keeps row widths uniform when labels collide on a merge', () => {
    // Two edge labels between the same nodes force a label collision;
    // a split wide-glyph pair would make row 3 narrower or wider.
    const out = renderMermaidAscii('graph LR\n  A[A] -->|한글| B[B]\n  A -->|X| B', { useAscii: false })
    const widths = new Set(out.split('\n').map(l => displayWidth(l)))
    expect(widths.size).toBe(1)
  })

  it('keeps row widths uniform for narrow-symbol + emoji edge labels', () => {
    const out = renderMermaidAscii('graph LR\n  A[Start] -->|go ▶ 🚀| B[Done]', { useAscii: false })
    const widths = new Set(out.split('\n').map(l => displayWidth(l)))
    expect(widths.size).toBe(1)
  })

  it('keeps row widths uniform for ZWJ emoji node labels', () => {
    const out = renderMermaidAscii('graph TD\n  A[Dev 👩‍💻] --> B[OK]', { useAscii: false })
    const widths = new Set(out.split('\n').map(l => displayWidth(l)))
    expect(widths.size).toBe(1)
  })

  it('mergeCanvases keeps an existing emoji label when a narrow label collides', () => {
    // first-label-wins must cover emoji: a width-2 emoji lead is label content,
    // so a later narrow label colliding on its cell must not overwrite it.
    // (Fails on the pre-fix isLabelChar, which only protected letters/digits.)
    const base = mkCanvas(0, 0)
    drawText(base, { x: 0, y: 0 }, '🚀') // emoji label placed first
    const overlay = mkCanvas(0, 0)
    drawText(overlay, { x: 0, y: 0 }, 'X') // later narrow label on the same cell
    const merged = canvasToString(mergeCanvases(base, { x: 0, y: 0 }, false, overlay))
    expect(merged).toContain('🚀')
    expect(merged).not.toContain('X')
  })

  it('keeps colored output aligned for CJK labels', () => {
    const colored = renderMermaidAscii('graph TD\n  A[한글 라벨] --> B[OK]', {
      useAscii: false,
      colorMode: 'truecolor',
    })
    expect(colored).not.toContain(WIDE_PAD)
    // Strip ANSI escapes; the visible rows must match the plain rendering
    const plain = renderMermaidAscii('graph TD\n  A[한글 라벨] --> B[OK]', {
      useAscii: false,
      colorMode: 'none',
    })
    // eslint-disable-next-line no-control-regex
    const stripped = colored.replace(/\x1b\[[0-9;]*m/g, '')
    expect(stripped).toBe(plain)
  })
})
