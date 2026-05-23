/**
 * Tests for timeline ASCII rendering.
 */
import { describe, it, expect } from 'bun:test'
import { renderMermaidASCII } from '../ascii/index.ts'

function render(text: string, options: Parameters<typeof renderMermaidASCII>[1] = {}): string {
  return renderMermaidASCII(text, { colorMode: 'none', ...options })
}

describe('timeline ASCII', () => {
  it('renders a basic timeline with title, period, and event', () => {
    const result = render(`timeline
      title Product history
      2024 : Timeline support`)

    expect(result).toContain('Product history')
    expect(result).toContain('○ 2024')
    expect(result).toContain('└─ Timeline support')
  })

  it('renders section labels and multiple events', () => {
    const result = render(`timeline
      section Growth
      2023 : Public launch
           : Theme system`)

    expect(result).toContain('[Growth]')
    expect(result).toContain('○ 2023')
    expect(result).toContain('├─ Public launch')
    expect(result).toContain('└─ Theme system')
  })

  it('uses ASCII-safe glyphs in ASCII mode', () => {
    const result = render(`timeline
      2024 : Timeline support`, { useAscii: true })

    expect(result).toContain('o 2024')
    expect(result).toContain('`- Timeline support')
    expect(result).not.toContain('○')
    expect(result).not.toContain('└')
  })

  it('renders multiline event text on subsequent indented lines', () => {
    const result = render(`timeline
      2024 : Soft<br>launch`)

    expect(result).toContain('Soft')
    expect(result).toContain('launch')
  })

  it('supports themed HTML output and escapes labels safely', () => {
    const result = render(`timeline
      title Roadmap < 2025
      section Phase <1>
      2024 : Ship <alpha>`, {
      colorMode: 'html',
      theme: {
        fg: '#101010',
        border: '#202020',
        line: '#303030',
        arrow: '#404040',
        junction: '#505050',
        corner: '#606060',
      },
    })

    expect(result).toContain('<span style="color:#101010">Roadmap</span>')
    expect(result).toContain('<span style="color:#101010">&lt;</span>')
    expect(result).toContain('<span style="color:#202020">[</span>')
    expect(result).toContain('<span style="color:#101010">Phase</span>')
    expect(result).toContain('<span style="color:#202020">]</span>')
    expect(result).toContain('<span style="color:#505050">○</span>')
    expect(result).toContain('<span style="color:#303030">│</span>')
    expect(result).toContain('<span style="color:#101010">Ship</span>')
    expect(result).toContain('<span style="color:#101010">&lt;alpha&gt;</span>')
    expect(result).not.toContain('Ship <alpha>')
  })

  it('does not render accessibility metadata as visible timeline content', () => {
    const result = render(`timeline
      accTitle: Accessible roadmap
      accDescr: Product launch plan
      2024 : Private alpha`)

    expect(result).toContain('○ 2024')
    expect(result).toContain('Private alpha')
    expect(result).not.toContain('Accessible roadmap')
    expect(result).not.toContain('Product launch plan')
  })
})
