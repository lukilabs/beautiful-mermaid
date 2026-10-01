import { describe, it, expect } from 'bun:test'
import { renderMermaidAscii } from '../ascii/index.ts'

const DIAGRAM = `timeline
  title Releases
  section 2024
    Q1 : Alpha : Beta
  section 2025
    Q1 : Stable`

describe('timeline – ASCII rendering', () => {
  it('renders section names, periods and events', () => {
    const out = renderMermaidAscii(DIAGRAM, { colorMode: 'none' })
    expect(out).toContain('2024')
    expect(out).toContain('2025')
    expect(out).toContain('Alpha')
    expect(out).toContain('Beta')
    expect(out).toContain('Stable')
  })

  it('renders the title', () => {
    const out = renderMermaidAscii(DIAGRAM, { colorMode: 'none' })
    expect(out).toContain('Releases')
  })
})
