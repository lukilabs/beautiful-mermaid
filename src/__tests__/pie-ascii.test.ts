import { describe, it, expect } from 'bun:test'
import { renderMermaidAscii } from '../ascii/index.ts'

const PIE = `pie
  "A" : 50
  "B" : 30
  "C" : 20`

describe('pie – ASCII rendering', () => {
  it('renders one bar row per slice', () => {
    const out = renderMermaidAscii(PIE, { colorMode: 'none' })
    expect(out).toContain('A')
    expect(out).toContain('B')
    expect(out).toContain('C')
  })

  it('shows percentages', () => {
    const out = renderMermaidAscii(PIE, { colorMode: 'none' })
    expect(out).toContain('50%')
    expect(out).toContain('30%')
    expect(out).toContain('20%')
  })

  it('uses # bars in pure ASCII mode', () => {
    const out = renderMermaidAscii(PIE, { colorMode: 'none', useAscii: true })
    expect(out).toContain('#')
  })

  it('uses block bars in Unicode mode', () => {
    const out = renderMermaidAscii(PIE, { colorMode: 'none' })
    expect(out).toContain('█')
  })
})
