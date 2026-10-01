import { describe, it, expect } from 'bun:test'
import { renderMermaidAscii } from '../ascii/index.ts'

const MAP = `mindmap
  root
    Origins
      Long history
    Research`

describe('mindmap – ASCII rendering', () => {
  it('renders node labels', () => {
    const out = renderMermaidAscii(MAP, { colorMode: 'none' })
    expect(out).toContain('root')
    expect(out).toContain('Origins')
    expect(out).toContain('Long history')
    expect(out).toContain('Research')
  })

  it('uses tree connectors', () => {
    const out = renderMermaidAscii(MAP, { colorMode: 'none' })
    expect(out).toContain('├')
  })
})
