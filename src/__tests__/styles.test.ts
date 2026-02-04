/**
 * Tests for styles module — text measurement and constants.
 * Theme resolution tests are in theme.test.ts (CSS custom property system).
 */
import { describe, it, expect } from 'bun:test'
import { estimateTextWidth, FONT_SIZES, FONT_WEIGHTS, NODE_PADDING, STROKE_WIDTHS, ARROW_HEAD, wrapText, LINE_HEIGHT_RATIO, MAX_LABEL_WIDTH } from '../styles.ts'
import { THEMES, DEFAULTS, fromShikiTheme, buildStyleBlock, svgOpenTag } from '../theme.ts'
import type { DiagramColors } from '../theme.ts'

// ============================================================================
// Theme system (CSS custom properties)
// ============================================================================

describe('THEMES', () => {
  it('contains well-known theme palettes', () => {
    expect(THEMES['zinc-light']).toBeDefined()
    expect(THEMES['zinc-dark']).toBeDefined()
    expect(THEMES['tokyo-night']).toBeDefined()
    expect(THEMES['catppuccin-mocha']).toBeDefined()
    expect(THEMES['nord']).toBeDefined()
  })

  it('each theme has valid bg and fg colors', () => {
    for (const [name, colors] of Object.entries(THEMES)) {
      expect(colors.bg).toMatch(/^#[0-9a-fA-F]{6}$/)
      expect(colors.fg).toMatch(/^#[0-9a-fA-F]{6}$/)
    }
  })
})

describe('DEFAULTS', () => {
  it('provides zinc-light bg/fg', () => {
    expect(DEFAULTS.bg).toBe('#FFFFFF')
    expect(DEFAULTS.fg).toBe('#27272A')
  })
})

describe('svgOpenTag', () => {
  it('sets --bg and --fg CSS variables in inline style', () => {
    const tag = svgOpenTag(400, 300, { bg: '#1a1b26', fg: '#a9b1d6' })
    expect(tag).toContain('--bg:#1a1b26')
    expect(tag).toContain('--fg:#a9b1d6')
    expect(tag).toContain('background:var(--bg)')
  })

  it('includes optional enrichment variables when provided', () => {
    const colors: DiagramColors = {
      bg: '#1a1b26', fg: '#a9b1d6',
      line: '#3d59a1', accent: '#7aa2f7',
    }
    const tag = svgOpenTag(400, 300, colors)
    expect(tag).toContain('--line:#3d59a1')
    expect(tag).toContain('--accent:#7aa2f7')
  })

  it('omits unset enrichment variables', () => {
    const tag = svgOpenTag(400, 300, { bg: '#fff', fg: '#000' })
    expect(tag).not.toContain('--line')
    expect(tag).not.toContain('--accent')
    expect(tag).not.toContain('--muted')
  })
})

describe('buildStyleBlock', () => {
  it('includes derived CSS variable declarations', () => {
    const style = buildStyleBlock('Inter', false)
    expect(style).toContain('--_text')
    expect(style).toContain('--_line')
    expect(style).toContain('--_arrow')
    expect(style).toContain('--_node-fill')
    expect(style).toContain('--_node-stroke')
  })

  it('includes mono font class when requested', () => {
    const withMono = buildStyleBlock('Inter', true)
    expect(withMono).toContain('.mono')
    expect(withMono).toContain('JetBrains Mono')

    const withoutMono = buildStyleBlock('Inter', false)
    expect(withoutMono).not.toContain('.mono')
  })
})

describe('fromShikiTheme', () => {
  it('extracts bg/fg from editor colors', () => {
    const colors = fromShikiTheme({
      type: 'dark',
      colors: {
        'editor.background': '#1a1b26',
        'editor.foreground': '#a9b1d6',
      },
    })
    expect(colors.bg).toBe('#1a1b26')
    expect(colors.fg).toBe('#a9b1d6')
  })

  it('falls back for missing editor colors', () => {
    const dark = fromShikiTheme({ type: 'dark' })
    expect(dark.bg).toBe('#1e1e1e')
    expect(dark.fg).toBe('#d4d4d4')

    const light = fromShikiTheme({ type: 'light' })
    expect(light.bg).toBe('#ffffff')
    expect(light.fg).toBe('#333333')
  })
})

// ============================================================================
// Text width estimation
// ============================================================================

describe('estimateTextWidth', () => {
  it('returns a positive number for non-empty text', () => {
    const width = estimateTextWidth('Hello', 13, 500)
    expect(width).toBeGreaterThan(0)
  })

  it('returns 0 for empty text', () => {
    expect(estimateTextWidth('', 13, 500)).toBe(0)
  })

  it('scales with text length', () => {
    const short = estimateTextWidth('Hi', 13, 500)
    const long = estimateTextWidth('Hello World', 13, 500)
    expect(long).toBeGreaterThan(short)
  })

  it('scales with font size', () => {
    const small = estimateTextWidth('Text', 11, 500)
    const large = estimateTextWidth('Text', 16, 500)
    expect(large).toBeGreaterThan(small)
  })

  it('heavier weights produce wider estimates', () => {
    const regular = estimateTextWidth('Text', 13, 400)
    const bold = estimateTextWidth('Text', 13, 600)
    expect(bold).toBeGreaterThan(regular)
  })

  it('produces reasonable widths for typical node labels', () => {
    // A 5-character label at 13px/500w should be roughly 35px (5 * 13 * 0.55)
    const width = estimateTextWidth('Hello', FONT_SIZES.nodeLabel, FONT_WEIGHTS.nodeLabel)
    expect(width).toBeGreaterThan(25)
    expect(width).toBeLessThan(60)
  })
})

// ============================================================================
// Exported constants
// ============================================================================

describe('constants', () => {
  it('FONT_SIZES has expected values', () => {
    expect(FONT_SIZES.nodeLabel).toBe(13)
    expect(FONT_SIZES.edgeLabel).toBe(11)
    expect(FONT_SIZES.groupHeader).toBe(12)
  })

  it('FONT_WEIGHTS has expected values', () => {
    expect(FONT_WEIGHTS.nodeLabel).toBe(500)
    expect(FONT_WEIGHTS.edgeLabel).toBe(400)
    expect(FONT_WEIGHTS.groupHeader).toBe(600)
  })

  it('NODE_PADDING has expected values', () => {
    expect(NODE_PADDING.horizontal).toBe(16)
    expect(NODE_PADDING.vertical).toBe(10)
    expect(NODE_PADDING.diamondExtra).toBe(24)
  })

  it('STROKE_WIDTHS has expected values', () => {
    expect(STROKE_WIDTHS.outerBox).toBe(1)
    expect(STROKE_WIDTHS.innerBox).toBe(0.75)
    expect(STROKE_WIDTHS.connector).toBe(0.75)
  })

  it('ARROW_HEAD has expected values', () => {
    expect(ARROW_HEAD.width).toBe(8)
    expect(ARROW_HEAD.height).toBe(4.8)
  })

  it('LINE_HEIGHT_RATIO is 1.4', () => {
    expect(LINE_HEIGHT_RATIO).toBe(1.4)
  })

  it('MAX_LABEL_WIDTH is 200', () => {
    expect(MAX_LABEL_WIDTH).toBe(200)
  })
})

// ============================================================================
// Text wrapping
// ============================================================================

describe('wrapText', () => {
  it('returns single-element array for short text', () => {
    const lines = wrapText('Hello', 13, 500)
    expect(lines).toEqual(['Hello'])
  })

  it('splits on existing newlines', () => {
    const lines = wrapText('Line 1\nLine 2', 13, 500)
    expect(lines).toEqual(['Line 1', 'Line 2'])
  })

  it('preserves multiple newlines as separate lines', () => {
    const lines = wrapText('A\nB\nC', 13, 500)
    expect(lines).toEqual(['A', 'B', 'C'])
  })

  it('auto-wraps long lines at word boundaries', () => {
    // Create a long text that exceeds maxWidth of 200px
    const longText = 'This is a very long label that should be wrapped at word boundaries'
    const lines = wrapText(longText, 13, 500, 100)
    expect(lines.length).toBeGreaterThan(1)
    // All words should still be present
    expect(lines.join(' ')).toBe(longText)
  })

  it('does not wrap text that fits within maxWidth', () => {
    const lines = wrapText('Short', 13, 500, 200)
    expect(lines).toEqual(['Short'])
  })

  it('handles combined newlines and word wrapping', () => {
    const text = 'Short line\nThis is a very long line that should definitely be word wrapped'
    const lines = wrapText(text, 13, 500, 100)
    expect(lines.length).toBeGreaterThan(2)
    expect(lines[0]).toBe('Short line')
  })
})
