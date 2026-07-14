import { afterEach, describe, expect, it } from 'bun:test'
import { renderMermaidSVG } from '../index.ts'
import {
  isMonospaceFont,
  measureTextWidth,
  setMonospaceMetrics,
} from '../text-metrics.ts'

afterEach(() => setMonospaceMetrics(false))

/** Width of the widest node box in a rendered SVG. */
const widestNode = (svg: string): number =>
  Math.max(...[...svg.matchAll(/<rect[^>]*\swidth="([\d.]+)"/g)].map(m => Number(m[1])), 0)

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
    const narrow = measureTextWidth('iiiiiiiiiiii', 14, 400)
    const wide = measureTextWidth('WWWWWWWWWWWW', 14, 400)
    expect(narrow).toBe(wide)
  })

  it('leaves proportional measurement unchanged', () => {
    setMonospaceMetrics(false)
    expect(measureTextWidth('iiiiiiiiiiii', 14, 400)).toBeLessThan(
      measureTextWidth('WWWWWWWWWWWW', 14, 400),
    )
  })

  // The regression that matters. Flowchart layout reaches text metrics only through
  // measureMultilineText, so a fix applied at estimateTextWidth would miss it entirely — and
  // asserting on the SVG string would still "pass", because the font-family attribute differs.
  // Assert on real geometry instead.
  it('sizes flowchart node boxes with the configured font', () => {
    const code = 'flowchart LR\n  a[iiiiiiiiiiii] --> b[WWWWWWWWWWWW]'

    const proportional = renderMermaidSVG(code, { font: 'Inter' })
    const mono = renderMermaidSVG(code, { font: 'Commit Mono' })

    // Under a proportional model the twelve W's are far wider than the twelve i's.
    // Under monospace they are the same width, so the widest box shrinks.
    expect(widestNode(mono)).toBeLessThan(widestNode(proportional))
  })

  it('sizes sequence diagrams with the configured font', () => {
    const code = 'sequenceDiagram\n  participant iiiiiiiiiiii\n  participant WWWWWWWWWWWW\n  iiiiiiiiiiii->>WWWWWWWWWWWW: go'
    expect(widestNode(renderMermaidSVG(code, { font: 'Commit Mono' }))).not.toBe(
      widestNode(renderMermaidSVG(code, { font: 'Inter' })),
    )
  })
})
