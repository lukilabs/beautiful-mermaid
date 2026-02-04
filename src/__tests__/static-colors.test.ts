/**
 * Tests for static color resolution (output: 'static').
 *
 * Verifies that when output is 'static', rendered SVG contains no
 * CSS custom properties (var(--)), color-mix(), or @import directives -
 * producing output compatible with PDF renderers.
 */
import { describe, it, expect } from 'bun:test'
import { renderMermaid } from '../index.ts'
import type { ResolvedColors } from '../theme.ts'
import { colorMix, resolveColors, parseHex, toHex, createColorFn, validateHexColor, HEX_RE, COLOR_GRAPH, generateMarkerId, svgOpenTagStatic } from '../theme.ts'

// ============================================================================
// Unit tests: color utilities
// ============================================================================

describe('parseHex / toHex', () => {
  it('parses 6-digit hex', () => {
    expect(parseHex('#FF8000')).toEqual({ r: 255, g: 128, b: 0 })
  })

  it('parses 3-digit shorthand hex', () => {
    expect(parseHex('#F80')).toEqual({ r: 255, g: 136, b: 0 })
  })

  it('parses 8-digit hex (preserves alpha)', () => {
    expect(parseHex('#FF800080')).toEqual({ r: 255, g: 128, b: 0, a: 128 })
  })

  it('round-trips through toHex', () => {
    expect(toHex(parseHex('#27272a'))).toBe('#27272a')
  })

  it('toHex clamps out-of-range values', () => {
    expect(toHex({ r: 300, g: -10, b: 128 })).toBe('#ff0080')
  })

  it('toHex emits alpha when present and not 255', () => {
    expect(toHex({ r: 255, g: 128, b: 0, a: 128 })).toBe('#ff800080')
  })

  it('toHex omits alpha when fully opaque (255)', () => {
    expect(toHex({ r: 255, g: 128, b: 0, a: 255 })).toBe('#ff8000')
  })

  it('toHex omits alpha when not present', () => {
    expect(toHex({ r: 255, g: 128, b: 0 })).toBe('#ff8000')
  })

  it('round-trips 8-digit hex through parseHex/toHex', () => {
    expect(toHex(parseHex('#ff800080'))).toBe('#ff800080')
  })

  it('throws on invalid hex length (4 digits)', () => {
    expect(() => parseHex('#ABCD')).toThrow(/Invalid hex color/)
  })

  it('throws on invalid hex length (5 digits)', () => {
    expect(() => parseHex('#ABCDE')).toThrow(/Invalid hex color/)
  })

  it('throws on invalid hex length (7 digits)', () => {
    expect(() => parseHex('#AABBCCD')).toThrow(/Invalid hex color/)
  })

  it('throws on empty input', () => {
    expect(() => parseHex('')).toThrow(/Invalid hex color/)
  })

  it('throws on hash-only input', () => {
    expect(() => parseHex('#')).toThrow(/Invalid hex color/)
  })
})

describe('colorMix', () => {
  it('returns bg at 0%', () => {
    expect(colorMix('#000000', '#ffffff', 0)).toBe('#ffffff')
  })

  it('returns fg at 100%', () => {
    expect(colorMix('#000000', '#ffffff', 100)).toBe('#000000')
  })

  it('returns midpoint at 50%', () => {
    const result = colorMix('#000000', '#ffffff', 50)
    // 50% mix of black into white = #808080 (or close)
    const parsed = parseHex(result)
    expect(parsed.r).toBeGreaterThanOrEqual(127)
    expect(parsed.r).toBeLessThanOrEqual(128)
  })

  it('mixes colored values correctly', () => {
    // 50% of #FF0000 into #0000FF = #800080
    const result = colorMix('#FF0000', '#0000FF', 50)
    const parsed = parseHex(result)
    expect(parsed.r).toBeGreaterThanOrEqual(127)
    expect(parsed.r).toBeLessThanOrEqual(128)
    expect(parsed.g).toBe(0)
    expect(parsed.b).toBeGreaterThanOrEqual(127)
    expect(parsed.b).toBeLessThanOrEqual(128)
  })

  it('interpolates alpha when inputs have alpha', () => {
    // 50% mix: fg alpha 0 into bg alpha 255 → alpha ~128
    const result = colorMix('#FF000000', '#00FF00FF', 50)
    const parsed = parseHex(result)
    expect(parsed.a).toBeGreaterThanOrEqual(127)
    expect(parsed.a).toBeLessThanOrEqual(128)
  })

  it('defaults missing alpha to 255 during mix', () => {
    // fg has alpha 0, bg has no alpha (defaults to 255)
    const result = colorMix('#FF000000', '#00FF00', 50)
    const parsed = parseHex(result)
    expect(parsed.a).toBeGreaterThanOrEqual(127)
    expect(parsed.a).toBeLessThanOrEqual(128)
  })

  it('omits alpha when neither input has alpha', () => {
    const result = colorMix('#FF0000', '#00FF00', 50)
    const parsed = parseHex(result)
    expect(parsed.a).toBeUndefined()
  })
})

// ============================================================================
// Hex color validation
// ============================================================================

describe('validateHexColor', () => {
  it('accepts 3-digit hex', () => {
    expect(() => validateHexColor('#F80', 'test')).not.toThrow()
  })

  it('accepts 6-digit hex', () => {
    expect(() => validateHexColor('#FF8000', 'test')).not.toThrow()
  })

  it('accepts 8-digit hex (alpha)', () => {
    expect(() => validateHexColor('#FF800080', 'test')).not.toThrow()
  })

  it('rejects rgb() values', () => {
    expect(() => validateHexColor('rgb(255, 128, 0)', 'test')).toThrow(/Invalid color/)
  })

  it('rejects hsl() values', () => {
    expect(() => validateHexColor('hsl(30, 100%, 50%)', 'test')).toThrow(/Invalid color/)
  })

  it('rejects named colors', () => {
    expect(() => validateHexColor('red', 'test')).toThrow(/Invalid color/)
  })

  it('rejects var() references', () => {
    expect(() => validateHexColor('var(--bg)', 'test')).toThrow(/Invalid color/)
  })

  it('rejects empty string', () => {
    expect(() => validateHexColor('', 'test')).toThrow(/Invalid color/)
  })
})

// ============================================================================
// HEX_RE - single source of truth
// ============================================================================

describe('HEX_RE alignment', () => {
  const validHex = ['#F80', '#FF8000', '#FF800080']
  const invalidHex = ['rgb(0,0,0)', 'hsl(0,0%,0%)', 'red', 'var(--bg)', '', '#ABCD', '#ABCDE']

  for (const v of validHex) {
    it(`HEX_RE accepts ${v}`, () => {
      expect(HEX_RE.test(v)).toBe(true)
    })
    it(`validateHexColor accepts ${v}`, () => {
      expect(() => validateHexColor(v, 'test')).not.toThrow()
    })
  }

  for (const v of invalidHex) {
    it(`HEX_RE rejects '${v}'`, () => {
      expect(HEX_RE.test(v)).toBe(false)
    })
    it(`validateHexColor rejects '${v}'`, () => {
      expect(() => validateHexColor(v, 'test')).toThrow()
    })
  }
})

// ============================================================================
// COLOR_GRAPH - shared derivation
// ============================================================================

describe('COLOR_GRAPH', () => {
  it('has entries for all ResolvedColors keys (except bg)', () => {
    const graphKeys = COLOR_GRAPH.map(r => r.cssVar)
    expect(graphKeys).toContain('_text')
    expect(graphKeys).toContain('_text-sec')
    expect(graphKeys).toContain('_text-muted')
    expect(graphKeys).toContain('_text-faint')
    expect(graphKeys).toContain('_line')
    expect(graphKeys).toContain('_arrow')
    expect(graphKeys).toContain('_node-fill')
    expect(graphKeys).toContain('_node-stroke')
    expect(graphKeys).toContain('_group-fill')
    expect(graphKeys).toContain('_group-hdr')
    expect(graphKeys).toContain('_inner-stroke')
    expect(graphKeys).toContain('_key-badge')
  })

  it('has 12 entries (one per derived variable)', () => {
    expect(COLOR_GRAPH.length).toBe(12)
  })

  it('reverse sync: every ResolvedColors key (except bg) is in COLOR_GRAPH', () => {
    const graphCssVars = new Set(COLOR_GRAPH.map(r => r.cssVar))
    // Get ResolvedColors keys from a resolved instance
    const resolved = resolveColors({ bg: '#FFFFFF', fg: '#000000' })
    const resolvedKeys = Object.keys(resolved).filter(k => k !== 'bg')
    for (const key of resolvedKeys) {
      expect(graphCssVars.has(key)).toBe(true)
    }
  })
})

// ============================================================================
// resolveColors
// ============================================================================

describe('resolveColors', () => {
  it('resolves all 13 color keys', () => {
    const resolved = resolveColors({ bg: '#FFFFFF', fg: '#27272A' })
    const keys = Object.keys(resolved)
    expect(keys).toContain('bg')
    expect(keys).toContain('_text')
    expect(keys).toContain('_text-sec')
    expect(keys).toContain('_text-muted')
    expect(keys).toContain('_text-faint')
    expect(keys).toContain('_line')
    expect(keys).toContain('_arrow')
    expect(keys).toContain('_node-fill')
    expect(keys).toContain('_node-stroke')
    expect(keys).toContain('_group-fill')
    expect(keys).toContain('_group-hdr')
    expect(keys).toContain('_inner-stroke')
    expect(keys).toContain('_key-badge')
  })

  it('uses literal fg for _text', () => {
    const resolved = resolveColors({ bg: '#FFFFFF', fg: '#27272A' })
    expect(resolved._text).toBe('#27272A')
  })

  it('uses bg for _group-fill', () => {
    const resolved = resolveColors({ bg: '#1a1b26', fg: '#a9b1d6' })
    expect(resolved['_group-fill']).toBe('#1a1b26')
  })

  it('uses provided enrichment colors when set', () => {
    const resolved = resolveColors({
      bg: '#FFFFFF', fg: '#000000',
      line: '#aabbcc', accent: '#112233', muted: '#445566',
      surface: '#eeff00', border: '#998877',
    })
    expect(resolved._line).toBe('#aabbcc')
    expect(resolved._arrow).toBe('#112233')
    expect(resolved['_text-sec']).toBe('#445566')
    expect(resolved['_text-muted']).toBe('#445566')
    expect(resolved['_node-fill']).toBe('#eeff00')
    expect(resolved['_node-stroke']).toBe('#998877')
  })

  it('falls back to color-mix when enrichment colors are not set', () => {
    const resolved = resolveColors({ bg: '#FFFFFF', fg: '#000000' })
    // _line should be mix(#000, #FFF, 30%) ≈ #b3b3b3
    const line = parseHex(resolved._line)
    expect(line.r).toBeGreaterThan(150)
    expect(line.r).toBeLessThan(200)
  })

  it('all values are valid hex strings', () => {
    const resolved = resolveColors({ bg: '#18181B', fg: '#FAFAFA' })
    for (const [key, value] of Object.entries(resolved)) {
      expect(value).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it('throws on non-hex bg color', () => {
    expect(() => resolveColors({ bg: 'white', fg: '#000000' })).toThrow(/Invalid color/)
  })

  it('throws on non-hex fg color', () => {
    expect(() => resolveColors({ bg: '#FFFFFF', fg: 'rgb(0,0,0)' })).toThrow(/Invalid color/)
  })

  it('throws on non-hex enrichment color', () => {
    expect(() => resolveColors({ bg: '#FFFFFF', fg: '#000000', line: 'red' })).toThrow(/Invalid color/)
  })
})

// ============================================================================
// Regression snapshots: exact color values for known inputs
// ============================================================================

describe('resolveColors – regression snapshots', () => {
  it('default white/zinc palette produces expected values', () => {
    const r = resolveColors({ bg: '#FFFFFF', fg: '#27272A' })
    expect(r.bg).toBe('#FFFFFF')
    expect(r._text).toBe('#27272A')
    expect(r['_group-fill']).toBe('#FFFFFF')
    // _text-faint at 25%: mix(#27272A, #FFFFFF, 25%)
    expect(r['_text-faint']).toBe('#c9c9ca')
    // _node-fill at 3%: mix(#27272A, #FFFFFF, 3%)
    expect(r['_node-fill']).toBe('#f9f9f9')
    // _line at 30%: mix(#27272A, #FFFFFF, 30%)
    expect(r._line).toBe('#bebebf')
    // _arrow at 50%: mix(#27272A, #FFFFFF, 50%)
    expect(r._arrow).toBe('#939395')
  })

  it('black/white palette produces expected values', () => {
    const r = resolveColors({ bg: '#FFFFFF', fg: '#000000' })
    expect(r._text).toBe('#000000')
    // 50% mix of black into white = #808080
    expect(r._arrow).toBe('#808080')
    // 30% mix of black into white = #b3b3b3
    expect(r._line).toBe('#b3b3b3')
    // 3% mix of black into white = #f7f7f7
    expect(r['_node-fill']).toBe('#f7f7f7')
  })

  it('tokyo night palette produces expected values', () => {
    const r = resolveColors({ bg: '#1a1b26', fg: '#a9b1d6' })
    expect(r.bg).toBe('#1a1b26')
    expect(r._text).toBe('#a9b1d6')
    expect(r['_group-fill']).toBe('#1a1b26')
    // Derived values for tokyo night mono
    expect(r['_text-faint']).toMatch(/^#[0-9a-f]{6}$/i)
    expect(r._line).toMatch(/^#[0-9a-f]{6}$/i)
  })
})

// ============================================================================
// createColorFn
// ============================================================================

describe('createColorFn', () => {
  it('returns var() strings when resolved is null', () => {
    const c = createColorFn(null)
    expect(c('_text')).toBe('var(--_text)')
    expect(c('_line')).toBe('var(--_line)')
    expect(c.bg()).toBe('var(--bg)')
  })

  it('returns hex strings when resolved is provided', () => {
    const resolved = resolveColors({ bg: '#FFFFFF', fg: '#000000' })
    const c = createColorFn(resolved)
    expect(c('_text')).toBe('#000000')
    expect(c.bg()).toBe('#FFFFFF')
    expect(c('_line')).toMatch(/^#[0-9a-f]{6}$/i)
  })
})

// ============================================================================
// generateMarkerId
// ============================================================================

describe('generateMarkerId', () => {
  it('returns a string starting with m', () => {
    const id = generateMarkerId()
    expect(id).toMatch(/^m[0-9a-f]{4}$/)
  })

  it('generates different IDs on successive calls', () => {
    const ids = new Set(Array.from({ length: 20 }, () => generateMarkerId()))
    // Should have high uniqueness (allow small chance of collision)
    expect(ids.size).toBeGreaterThan(15)
  })

  it('generates custom length IDs', () => {
    const id = generateMarkerId(6)
    // m + 6 hex chars = 7 chars total
    expect(id).toHaveLength(7)
    expect(id).toMatch(/^m[0-9a-f]{6}$/)
  })

  it('throws on length 0', () => {
    expect(() => generateMarkerId(0)).toThrow(/length must be >= 1/)
  })

  it('throws on negative length', () => {
    expect(() => generateMarkerId(-3)).toThrow(/length must be >= 1/)
  })

  it('generates full entropy for large lengths', () => {
    const id = generateMarkerId(20)
    expect(id).toHaveLength(21) // m + 20 hex chars
    expect(id).toMatch(/^m[0-9a-f]{20}$/)
  })
})

// ============================================================================
// svgOpenTagStatic - unit tests
// ============================================================================

describe('svgOpenTagStatic', () => {
  it('background comes before font-family in style attribute', () => {
    const tag = svgOpenTagStatic(100, 100, '#FFFFFF', false, 'Inter', true)
    const styleMatch = tag.match(/style="([^"]*)"/)
    expect(styleMatch).toBeTruthy()
    const style = styleMatch![1]!
    const bgIdx = style.indexOf('background:')
    const fontIdx = style.indexOf('font-family:')
    expect(bgIdx).toBeGreaterThanOrEqual(0)
    expect(fontIdx).toBeGreaterThan(bgIdx)
  })

  it('includes font-family when transparent and noStyleBlock', () => {
    const tag = svgOpenTagStatic(100, 100, '#FFFFFF', true, 'Inter', true)
    expect(tag).toContain('background:none')
    expect(tag).toContain("font-family:'Inter',system-ui,sans-serif")
  })

  it('escapes single quotes in font names', () => {
    const tag = svgOpenTagStatic(100, 100, '#FFF', false, "Foo'Bar", true)
    expect(tag).toContain("font-family:'Foo&#39;Bar'")
    // Must not break the style attribute quoting
    const quoteCount = (tag.match(/style="/g) ?? []).length
    expect(quoteCount).toBe(1) // exactly one opening style="
  })

  it('omits font-family when noStyleBlock is false', () => {
    const tag = svgOpenTagStatic(100, 100, '#FFFFFF', false, 'Inter', false)
    expect(tag).not.toContain('font-family')
  })

  it('omits font-family when font is not provided', () => {
    const tag = svgOpenTagStatic(100, 100, '#FFFFFF', false, undefined, true)
    expect(tag).not.toContain('font-family')
  })
})

// ============================================================================
// Integration: static SVG output (no var, no color-mix, no @import)
// ============================================================================

/** Assert that SVG contains no CSS-dependent constructs */
function assertStaticSvg(svg: string): void {
  // No CSS custom properties
  expect(svg).not.toMatch(/var\(--/)
  // No color-mix() functions
  expect(svg).not.toMatch(/color-mix\(/)
  // No @import directives
  expect(svg).not.toMatch(/@import/)
}

describe('renderMermaid – output: static', () => {
  describe('flowchart', () => {
    it('produces static SVG with no CSS variables', async () => {
      const svg = await renderMermaid('graph TD\n  A --> B', { output: 'static' })
      assertStaticSvg(svg)
      expect(svg).toContain('<svg')
      expect(svg).toContain('>A</text>')
      expect(svg).toContain('>B</text>')
    })

    it('uses hex colors in fill/stroke attributes', async () => {
      const svg = await renderMermaid('graph TD\n  A --> B', {
        bg: '#1a1b26', fg: '#a9b1d6', output: 'static',
      })
      assertStaticSvg(svg)
      // Should contain hex color values in the output
      expect(svg).toMatch(/#[0-9a-f]{6}/i)
    })

    it('renders subgraphs with static colors', async () => {
      const svg = await renderMermaid(`graph TD
        subgraph Backend
          A[API] --> B[DB]
        end
        C[Client] --> A`, { output: 'static' })
      assertStaticSvg(svg)
      expect(svg).toContain('>Backend</text>')
    })

    it('renders edge labels with static colors', async () => {
      const svg = await renderMermaid('graph TD\n  A -->|Yes| B', { output: 'static' })
      assertStaticSvg(svg)
      expect(svg).toContain('>Yes</text>')
    })

    it('renders state diagrams with static colors', async () => {
      const svg = await renderMermaid(`stateDiagram-v2
        [*] --> Idle
        Idle --> Active : start
        Active --> [*]`, { output: 'static' })
      assertStaticSvg(svg)
      expect(svg).toContain('>Idle</text>')
      expect(svg).toContain('>Active</text>')
    })

    it('uses background:none for transparent in static mode', async () => {
      const svg = await renderMermaid('graph TD\n  A --> B', {
        output: 'static', transparent: true,
      })
      assertStaticSvg(svg)
      expect(svg).toContain('background:none')
    })

    it('preserves inline style overrides in static mode', async () => {
      const svg = await renderMermaid(`graph TD
        A[Red Node] --> B
        style A fill:#ff0000,stroke:#cc0000`, { output: 'static' })
      assertStaticSvg(svg)
      expect(svg).toContain('fill="#ff0000"')
      expect(svg).toContain('stroke="#cc0000"')
    })
  })

  describe('sequence diagram', () => {
    it('produces static SVG', async () => {
      const svg = await renderMermaid(`sequenceDiagram
        Alice->>Bob: Hello
        Bob-->>Alice: Hi`, { output: 'static' })
      assertStaticSvg(svg)
      expect(svg).toContain('>Alice</text>')
      expect(svg).toContain('>Bob</text>')
      expect(svg).toContain('>Hello</text>')
    })
  })

  describe('class diagram', () => {
    it('produces static SVG', async () => {
      const svg = await renderMermaid(`classDiagram
        class Animal {
          +String name
          +eat()
        }
        class Dog {
          +bark()
        }
        Animal <|-- Dog`, { output: 'static' })
      assertStaticSvg(svg)
      expect(svg).toContain('>Animal</text>')
      expect(svg).toContain('>Dog</text>')
    })
  })

  describe('ER diagram', () => {
    it('produces static SVG', async () => {
      const svg = await renderMermaid(`erDiagram
        CUSTOMER ||--o{ ORDER : places
        ORDER ||--|{ LINE-ITEM : contains`, { output: 'static' })
      assertStaticSvg(svg)
      expect(svg).toContain('>CUSTOMER</text>')
      expect(svg).toContain('>ORDER</text>')
    })
  })
})

// ============================================================================
// Pre-resolved palettes (resolvedColors option)
// ============================================================================

describe('renderMermaid – resolvedColors option', () => {
  it('accepts pre-resolved palette (skips resolveColors)', async () => {
    const palette = resolveColors({ bg: '#1a1b26', fg: '#a9b1d6' })
    const svg = await renderMermaid('graph TD\n  A --> B', { resolvedColors: palette })
    assertStaticSvg(svg)
    expect(svg).toContain('>A</text>')
  })

  it('produces same output as output: static with same colors', async () => {
    const colors = { bg: '#1a1b26', fg: '#a9b1d6' }
    const palette = resolveColors(colors)
    const svg1 = await renderMermaid('graph TD\n  A --> B', { ...colors, output: 'static', markerId: false })
    const svg2 = await renderMermaid('graph TD\n  A --> B', { resolvedColors: palette, markerId: false })
    expect(svg1).toBe(svg2)
  })
})

// ============================================================================
// noStyleBlock option
// ============================================================================

describe('renderMermaid – noStyleBlock option', () => {
  it('omits style block when noStyleBlock is true', async () => {
    const svg = await renderMermaid('graph TD\n  A --> B', {
      output: 'static', noStyleBlock: true,
    })
    assertStaticSvg(svg)
    expect(svg).not.toContain('<style>')
    expect(svg).not.toContain('</style>')
  })

  it('includes style block by default in static mode', async () => {
    const svg = await renderMermaid('graph TD\n  A --> B', { output: 'static' })
    assertStaticSvg(svg)
    expect(svg).toContain('<style>')
  })

  it('SVG root has font-family when noStyleBlock is true', async () => {
    const svg = await renderMermaid('graph TD\n  A --> B', {
      output: 'static', noStyleBlock: true, font: 'Inter',
    })
    assertStaticSvg(svg)
    expect(svg).toMatch(/style="[^"]*font-family:'Inter',system-ui,sans-serif/)
  })

  it('SVG root omits font-family when noStyleBlock is false', async () => {
    const svg = await renderMermaid('graph TD\n  A --> B', {
      output: 'static', noStyleBlock: false, font: 'Inter',
    })
    expect(svg).not.toMatch(/style="[^"]*font-family:'Inter'/)
  })

  it('class diagram .mono text has inline font-family when noStyleBlock is true', async () => {
    const svg = await renderMermaid(`classDiagram
      class Foo {
        +String bar
      }`, { output: 'static', noStyleBlock: true })
    assertStaticSvg(svg)
    expect(svg).toContain('font-family="\'JetBrains Mono\'')
  })

  it('SVG root has font-family when both noStyleBlock and transparent are true', async () => {
    const svg = await renderMermaid('graph TD\n  A --> B', {
      output: 'static', noStyleBlock: true, transparent: true, font: 'Inter',
    })
    assertStaticSvg(svg)
    expect(svg).not.toContain('<style>')
    expect(svg).toContain('background:none')
    expect(svg).toMatch(/style="[^"]*font-family:'Inter',system-ui,sans-serif/)
  })
})

// ============================================================================
// Marker ID namespacing
// ============================================================================

describe('renderMermaid – marker ID namespacing', () => {
  it('uses namespaced marker IDs in dynamic mode by default', async () => {
    const svg = await renderMermaid('graph TD\n  A --> B')
    // Should have a namespaced marker ID (m + 4 hex chars + -)
    expect(svg).toMatch(/id="m[0-9a-f]{4}-arrowhead"/)
  })

  it('uses bare marker IDs when markerId is false', async () => {
    const svg = await renderMermaid('graph TD\n  A --> B', { markerId: false })
    expect(svg).toContain('id="arrowhead"')
  })

  it('uses custom marker ID prefix', async () => {
    const svg = await renderMermaid('graph TD\n  A --> B', { markerId: 'diag1' })
    expect(svg).toContain('id="diag1-arrowhead"')
    expect(svg).toContain('url(#diag1-arrowhead)')
  })

  it('uses bare IDs in static mode (no collision risk)', async () => {
    const svg = await renderMermaid('graph TD\n  A --> B', { output: 'static' })
    expect(svg).toContain('id="arrowhead"')
  })
})

// ============================================================================
// normalizeInlineStyles - integration tests via renderMermaid
// ============================================================================

describe('renderMermaid – inline style normalization', () => {
  it('passes hex values through unchanged in static mode', async () => {
    const svg = await renderMermaid(`graph TD
      A --> B
      style A fill:#aabbcc`, { output: 'static' })
    assertStaticSvg(svg)
    expect(svg).toContain('fill="#aabbcc"')
  })

  it('passes 8-digit hex values through in static mode', async () => {
    const svg = await renderMermaid(`graph TD
      A --> B
      style A fill:#aabbcc80`, { output: 'static' })
    assertStaticSvg(svg)
    expect(svg).toContain('fill="#aabbcc80"')
  })

  it('drops non-hex style values in static mode (falls back to default)', async () => {
    // Named colors get split by the parser as key:value, so 'fill:red' would be
    // parsed as fill=red. normalizeInlineStyles should drop it (not a hex value).
    const svg = await renderMermaid(`graph TD
      A --> B
      style A fill:red`, { output: 'static' })
    assertStaticSvg(svg)
    // 'red' is not hex, so normalizer drops it → falls back to theme default
    expect(svg).not.toContain('fill="red"')
  })
})

// ============================================================================
// Backward compatibility: output: 'dynamic' (default) still uses vars
// ============================================================================

describe('renderMermaid – output: dynamic (default)', () => {
  it('uses CSS variables by default', async () => {
    const svg = await renderMermaid('graph TD\n  A --> B')
    expect(svg).toContain('var(--')
    expect(svg).toContain('@import')
    expect(svg).toContain('color-mix(')
  })

  it('uses CSS variables when explicitly set to dynamic', async () => {
    const svg = await renderMermaid('graph TD\n  A --> B', { output: 'dynamic' })
    expect(svg).toContain('var(--')
  })
})
