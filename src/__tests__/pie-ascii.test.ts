import { describe, it, expect } from 'bun:test'
import { renderMermaidASCII } from '../ascii/index.ts'

const PIE_DIAGRAM = `pie title Pets
  "Dogs" : 386
  "Cats" : 85
  "Rats" : 15`

const PIE_SHOWDATA = `pie showData title "Pets"
  "Dogs" : 386
  "Cats" : 85
  "Rats" : 15`

describe('pie – ASCII / Unicode rendering', () => {
  it('renders Unicode pie chart with distribution bar and breakdown', () => {
    const ascii = renderMermaidASCII(PIE_DIAGRAM, { colorMode: 'none' })

    expect(ascii).toContain('Pets')
    expect(ascii).toContain('[')
    expect(ascii).toContain(']')
    expect(ascii).toContain('█')
    expect(ascii).toContain('Dogs')
    expect(ascii).toContain('79.4%')
    expect(ascii).toContain('Cats')
    expect(ascii).toContain('17.5%')
    expect(ascii).toContain('Rats')
    expect(ascii).toContain('3.1%')
  })

  it('renders ASCII pie chart with useAscii: true', () => {
    const ascii = renderMermaidASCII(PIE_DIAGRAM, { useAscii: true, colorMode: 'none' })

    expect(ascii).toContain('Pets')
    expect(ascii).toContain('[')
    expect(ascii).toContain(']')
    expect(ascii).toContain('#')
    expect(ascii).toContain('Dogs')
    expect(ascii).toContain('79.4%')
  })

  it('includes numeric values when showData is enabled', () => {
    const ascii = renderMermaidASCII(PIE_SHOWDATA, { colorMode: 'none' })

    expect(ascii).toContain('386')
    expect(ascii).toContain('85')
    expect(ascii).toContain('15')
    expect(ascii).toContain('( 79.4%)')
  })
})
