// ============================================================================
// ASCII edge style tests — dotted and thick line rendering
// ============================================================================

import { describe, it, expect } from 'bun:test'
import { renderMermaidAscii } from '../ascii/index.ts'

describe('ASCII edge styles', () => {
  describe('solid edges (default)', () => {
    it('renders solid edges with ─ in unicode mode', () => {
      const result = renderMermaidAscii(`
        graph LR
          A --> B
      `)
      expect(result).toContain('─')
      expect(result).not.toContain('┄')
      expect(result).not.toContain('━')
    })

    it('renders solid edges with - in ascii mode', () => {
      const result = renderMermaidAscii(`
        graph LR
          A --> B
      `, { useAscii: true })
      expect(result).toContain('-')
    })
  })

  describe('dotted edges (-.->)', () => {
    it('renders dotted edges with ┄ in unicode mode', () => {
      const result = renderMermaidAscii(`
        graph LR
          A -.-> B
      `)
      // Should contain dotted horizontal line character
      expect(result).toContain('┄')
    })

    it('renders dotted edges with . in ascii mode', () => {
      const result = renderMermaidAscii(`
        graph LR
          A -.-> B
      `, { useAscii: true })
      // Should contain dots for dotted lines
      expect(result).toContain('.')
    })

    it('renders dotted vertical edges with ┆ in unicode mode', () => {
      const result = renderMermaidAscii(`
        graph TD
          A -.-> B
      `)
      // Should contain dotted vertical line character
      expect(result).toContain('┆')
    })

    it('renders dotted vertical edges with : in ascii mode', () => {
      const result = renderMermaidAscii(`
        graph TD
          A -.-> B
      `, { useAscii: true })
      // Should contain colons for dotted vertical lines
      expect(result).toContain(':')
    })

    it('renders dotted edges with labels', () => {
      const result = renderMermaidAscii(`
        graph LR
          A -.->|optional| B
      `)
      expect(result).toContain('┄')
      expect(result).toContain('optional')
    })
  })

  describe('thick edges (==>)', () => {
    it('renders thick edges with ━ in unicode mode', () => {
      const result = renderMermaidAscii(`
        graph LR
          A ==> B
      `)
      // Should contain thick horizontal line character
      expect(result).toContain('━')
    })

    it('renders thick edges with = in ascii mode', () => {
      const result = renderMermaidAscii(`
        graph LR
          A ==> B
      `, { useAscii: true })
      // Should contain equals for thick lines
      expect(result).toContain('=')
    })

    it('renders thick vertical edges with ┃ in unicode mode', () => {
      const result = renderMermaidAscii(`
        graph TD
          A ==> B
      `)
      // Should contain thick vertical line character
      expect(result).toContain('┃')
    })
  })

  describe('mixed edge styles', () => {
    it('renders different styles in the same diagram', () => {
      const result = renderMermaidAscii(`
        graph LR
          A --> B
          B -.-> C
          C ==> D
      `)
      // Should have all three line types
      expect(result).toContain('─')  // solid
      expect(result).toContain('┄')  // dotted
      expect(result).toContain('━')  // thick
    })

    it('renders mixed styles in ascii mode', () => {
      const result = renderMermaidAscii(`
        graph LR
          A --> B
          B -.-> C
          C ==> D
      `, { useAscii: true })
      // Note: ASCII mode uses - for solid, . for dotted, = for thick
      // We just check that the diagram renders without error
      expect(result).toContain('A')
      expect(result).toContain('B')
      expect(result).toContain('C')
      expect(result).toContain('D')
    })
  })

  // ==========================================================================
  // Circle and cross endpoint markers (`--o`, `--x`, `o--o`, `x--x`, ...)
  // Regression test for https://github.com/lukilabs/beautiful-mermaid/issues/109
  // ==========================================================================

  describe('open circle endpoints (--o)', () => {
    it('renders --o with ◯ marker and keeps the target node', () => {
      const result = renderMermaidAscii(`
        graph LR
          A --o B
      `)
      expect(result).toContain('◯')
      expect(result).toContain('A')
      expect(result).toContain('B')
    })

    it('renders --o with o marker in ascii mode', () => {
      const result = renderMermaidAscii(`
        graph LR
          A --o B
      `, { useAscii: true })
      expect(result).toContain('o')
      expect(result).toContain('B')
    })

    it('renders o--o with circles on both endpoints', () => {
      const result = renderMermaidAscii(`
        graph LR
          A o--o B
      `)
      expect((result.match(/◯/g) ?? []).length).toBe(2)
    })

    it('renders vertical --o (TD direction) with the target below', () => {
      const result = renderMermaidAscii(`
        graph TD
          A --o B
      `)
      expect(result).toContain('◯')
      expect(result).toContain('B')
    })
  })

  describe('cross endpoints (--x)', () => {
    it('renders --x with ✕ marker and keeps the target node', () => {
      const result = renderMermaidAscii(`
        graph LR
          A --x B
      `)
      expect(result).toContain('✕')
      expect(result).toContain('B')
    })

    it('renders --x with x marker in ascii mode', () => {
      const result = renderMermaidAscii(`
        graph LR
          A --x B
      `, { useAscii: true })
      expect(result).toContain('x')
      expect(result).toContain('B')
    })

    it('renders x--x with crosses on both endpoints', () => {
      const result = renderMermaidAscii(`
        graph LR
          A x--x B
      `)
      expect((result.match(/✕/g) ?? []).length).toBe(2)
    })
  })

  describe('mixed circle/cross endpoints', () => {
    it('renders o--x with circle at source and cross at target', () => {
      const result = renderMermaidAscii(`
        graph LR
          A o--x B
      `)
      expect(result).toContain('◯')
      expect(result).toContain('✕')
    })

    it('renders x--o with cross at source and circle at target', () => {
      const result = renderMermaidAscii(`
        graph LR
          A x--o B
      `)
      expect(result).toContain('✕')
      expect(result).toContain('◯')
    })
  })
})
