import { describe, expect, it, afterEach } from 'bun:test'
import { renderMermaidSVG } from '../index.ts'
import { estimateTextWidth, isMonospaceFont, setMonospaceMetrics } from '../styles.ts'

afterEach(() => setMonospaceMetrics(false))

describe('monospace metrics', () => {
  it('detects monospace font families', () => {
    for (const font of [
      'Commit Mono',
      'JetBrains Mono',
      'SF Mono',
      'Menlo',
      'Courier New',
      'ui-monospace',
      'Fira Code',
    ])
      expect(isMonospaceFont(font)).toBe(true)
    // "Mona Sans" is the trap: it looks monospace-ish and is not.
    for (const font of ['Inter', 'Mona Sans', 'Helvetica', 'Georgia'])
      expect(isMonospaceFont(font)).toBe(false)
  })

  it('measures every glyph at the same advance', () => {
    setMonospaceMetrics(true)
    const narrow = estimateTextWidth('iiiiiiiiiiii', 14, 400)
    const wide = estimateTextWidth('WWWWWWWWWWWW', 14, 400)
    expect(narrow).toBe(wide)
    expect(narrow).toBeCloseTo(12 * 14 * 0.6, 5)
  })

  it('still measures proportional fonts by glyph shape', () => {
    setMonospaceMetrics(false)
    expect(estimateTextWidth('iiiiiiiiiiii', 14, 400)).toBeLessThan(
      estimateTextWidth('WWWWWWWWWWWW', 14, 400),
    )
  })

  it('sizes boxes from the font passed to the renderer', () => {
    const code = 'flowchart LR\n  a[iiiiiiiiiiii] --> b[WWWWWWWWWWWW]'
    const mono = renderMermaidSVG(code, { font: 'Commit Mono' })
    const proportional = renderMermaidSVG(code, { font: 'Inter' })
    expect(mono).not.toBe(proportional)
    expect(mono).toContain('Commit Mono')
  })
})
