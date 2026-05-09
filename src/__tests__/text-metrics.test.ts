/**
 * Tests for text-metrics module — variable-width character measurement.
 */
import { describe, expect, it } from 'bun:test'
import { getCharWidth, measureTextWidth } from '../text-metrics'

// ============================================================================
// Character width classification
// ============================================================================

describe('getCharWidth', () => {
  describe('narrow characters', () => {
    it('returns 0.4 for thin letters (i, l, t, f, j, I)', () => {
      expect(getCharWidth('i')).toBe(0.4)
      expect(getCharWidth('l')).toBe(0.4)
      expect(getCharWidth('t')).toBe(0.4)
      expect(getCharWidth('f')).toBe(0.4)
      expect(getCharWidth('j')).toBe(0.4)
      expect(getCharWidth('I')).toBe(0.4)
    })

    it('returns 0.4 for thin punctuation', () => {
      expect(getCharWidth('!')).toBe(0.4)
      expect(getCharWidth('|')).toBe(0.4)
      expect(getCharWidth('.')).toBe(0.4)
      expect(getCharWidth(',')).toBe(0.4)
      expect(getCharWidth(':')).toBe(0.4)
      expect(getCharWidth(';')).toBe(0.4)
      expect(getCharWidth("'")).toBe(0.4)
      expect(getCharWidth('1')).toBe(0.4)
    })

    it('returns 0.8 for semi-narrow r', () => {
      expect(getCharWidth('r')).toBe(0.8)
    })
  })

  describe('normal characters', () => {
    it('returns 1.0 for average lowercase letters', () => {
      expect(getCharWidth('a')).toBe(1.0)
      expect(getCharWidth('e')).toBe(1.0)
      expect(getCharWidth('o')).toBe(1.0)
      expect(getCharWidth('n')).toBe(1.0)
      expect(getCharWidth('s')).toBe(1.0)
    })

    it('returns 1.0 for digits', () => {
      expect(getCharWidth('0')).toBe(1.0)
      expect(getCharWidth('2')).toBe(1.0)
      expect(getCharWidth('9')).toBe(1.0)
    })
  })

  describe('wide characters', () => {
    it('returns 1.2 for uppercase letters (except I)', () => {
      expect(getCharWidth('A')).toBe(1.2)
      expect(getCharWidth('B')).toBe(1.2)
      expect(getCharWidth('N')).toBe(1.2)
      expect(getCharWidth('Z')).toBe(1.2)
    })

    it('returns 1.2 for wide lowercase (w, m)', () => {
      expect(getCharWidth('w')).toBe(1.2)
      expect(getCharWidth('m')).toBe(1.2)
    })

    it('returns 1.5 for very wide characters (W, M)', () => {
      expect(getCharWidth('W')).toBe(1.5)
      expect(getCharWidth('M')).toBe(1.5)
    })
  })

  describe('space', () => {
    it('returns 0.3 for space character', () => {
      expect(getCharWidth(' ')).toBe(0.3)
    })
  })

  describe('combining marks (zero-width)', () => {
    it('returns 0 for combining diacritical marks', () => {
      // U+0301 = combining acute accent
      expect(getCharWidth('\u0301')).toBe(0)
      // U+0308 = combining diaeresis
      expect(getCharWidth('\u0308')).toBe(0)
      // U+0327 = combining cedilla
      expect(getCharWidth('\u0327')).toBe(0)
    })
  })

  describe('accented characters (precomposed)', () => {
    it('returns normal width for precomposed accented letters', () => {
      // These are single code points, treated as normal letters
      expect(getCharWidth('é')).toBe(1.0) // U+00E9
      expect(getCharWidth('ñ')).toBe(1.0) // U+00F1
      expect(getCharWidth('ü')).toBe(1.0) // U+00FC
      expect(getCharWidth('ç')).toBe(1.0) // U+00E7
      expect(getCharWidth('ö')).toBe(1.0) // U+00F6
    })
  })

  describe('CJK characters (fullwidth)', () => {
    it('returns 2.0 for CJK ideographs', () => {
      expect(getCharWidth('中')).toBe(2.0) // U+4E2D
      expect(getCharWidth('国')).toBe(2.0) // U+56FD
      expect(getCharWidth('字')).toBe(2.0) // U+5B57
    })

    it('returns 2.0 for Japanese hiragana/katakana', () => {
      expect(getCharWidth('あ')).toBe(2.0) // Hiragana
      expect(getCharWidth('ア')).toBe(2.0) // Katakana
    })

    it('returns 2.0 for Korean hangul', () => {
      expect(getCharWidth('한')).toBe(2.0) // U+D55C
      expect(getCharWidth('글')).toBe(2.0) // U+AE00
    })
  })

  describe('emoji (fullwidth)', () => {
    it('returns 2.0 for common emoji', () => {
      expect(getCharWidth('😀')).toBe(2.0)
      expect(getCharWidth('🚀')).toBe(2.0)
      expect(getCharWidth('❤')).toBe(2.0)
    })
  })

  describe('edge cases', () => {
    it('returns 0 for empty string', () => {
      expect(getCharWidth('')).toBe(0)
    })
  })
})

// ============================================================================
// Text width measurement
// ============================================================================

describe('measureTextWidth', () => {
  const fontSize = 13
  const fontWeight = 500
  const baseRatio = 0.57 // weight 500 (was 0.55, increased for edge truncation safety)
  const minPadding = fontSize * 0.15 // minimum padding added to prevent truncation (increased for label separation)

  it('returns minPadding for empty text', () => {
    // Empty text still gets minimum padding to prevent edge truncation
    expect(measureTextWidth('', fontSize, fontWeight)).toBeCloseTo(minPadding, 1)
  })

  it('handles lowercase text with narrow letters', () => {
    // "hello" = h(1.0) + e(1.0) + l(0.4) + l(0.4) + o(1.0) = 3.8
    const width = measureTextWidth('hello', fontSize, fontWeight)
    expect(width).toBeCloseTo(3.8 * fontSize * baseRatio + minPadding, 1)
  })

  it('narrow text is narrower than uniform estimate', () => {
    // "illiterate" has many narrow chars (i, l, t)
    const narrow = measureTextWidth('illicit', fontSize, fontWeight)
    const uniform = 'illicit'.length * fontSize * baseRatio
    expect(narrow).toBeLessThan(uniform)
  })

  it('wide text is wider than uniform estimate', () => {
    // "MAMMOTH" has wide chars (M, A, O)
    const wide = measureTextWidth('MAMMOTH', fontSize, fontWeight)
    const uniform = 'MAMMOTH'.length * fontSize * baseRatio
    expect(wide).toBeGreaterThan(uniform)
  })

  it('handles mixed Latin text', () => {
    // "Will" = W(1.5) + i(0.4) + l(0.4) + l(0.4) = 2.7
    const width = measureTextWidth('Will', fontSize, fontWeight)
    expect(width).toBeCloseTo(2.7 * fontSize * baseRatio + minPadding, 1)
  })

  it('handles spaces correctly', () => {
    // "a b" = a(1.0) + space(0.3) + b(1.0) = 2.3
    const width = measureTextWidth('a b', fontSize, fontWeight)
    expect(width).toBeCloseTo(2.3 * fontSize * baseRatio + minPadding, 1)
  })

  it('handles decomposed accents (base + combining mark)', () => {
    // "café" with decomposed é = c + a + f + e + combining accent
    // Should be same width as "cafe" since combining mark is zero-width
    const decomposed = 'cafe\u0301' // e + combining acute
    const precomposed = 'café'
    const widthDecomposed = measureTextWidth(decomposed, fontSize, fontWeight)
    const widthPrecomposed = measureTextWidth(precomposed, fontSize, fontWeight)
    expect(widthDecomposed).toBeCloseTo(widthPrecomposed, 1)
  })

  it('handles CJK text', () => {
    // "中国" = 2 chars × 2.0 width = 4.0
    const width = measureTextWidth('中国', fontSize, fontWeight)
    expect(width).toBeCloseTo(4.0 * fontSize * baseRatio + minPadding, 1)
  })

  it('handles mixed Latin and CJK', () => {
    // "Hello中国" = H(1.2) + e(1.0) + l(0.4) + l(0.4) + o(1.0) + 中(2.0) + 国(2.0) = 8.0
    const width = measureTextWidth('Hello中国', fontSize, fontWeight)
    expect(width).toBeCloseTo(8.0 * fontSize * baseRatio + minPadding, 1)
  })

  it('heavier weights produce wider estimates', () => {
    const regular = measureTextWidth('Test', fontSize, 400)
    const medium = measureTextWidth('Test', fontSize, 500)
    const bold = measureTextWidth('Test', fontSize, 600)

    expect(medium).toBeGreaterThan(regular)
    expect(bold).toBeGreaterThan(medium)
  })

  it('scales with font size', () => {
    const small = measureTextWidth('Test', 11, fontWeight)
    const large = measureTextWidth('Test', 16, fontWeight)

    expect(large).toBeGreaterThan(small)
    expect(large / small).toBeCloseTo(16 / 11, 1)
  })
})

// ============================================================================
// Real-world examples
// ============================================================================

describe('real-world text examples', () => {
  const fontSize = 13
  const fontWeight = 500

  it('handles typical node labels', () => {
    const labels = ['User', 'Database', 'API Gateway', 'Load Balancer']
    for (const label of labels) {
      const width = measureTextWidth(label, fontSize, fontWeight)
      expect(width).toBeGreaterThan(0)
      // Width should be reasonable (not too small or too large)
      expect(width).toBeGreaterThan(label.length * 3)
      expect(width).toBeLessThan(label.length * 15)
    }
  })

  it('handles Japanese labels', () => {
    const width = measureTextWidth('データベース', fontSize, fontWeight)
    // 6 CJK chars × 2.0 × 13 × 0.57 + minPadding
    const baseRatio = 0.57
    const minPadding = fontSize * 0.15
    expect(width).toBeCloseTo(6 * 2.0 * fontSize * baseRatio + minPadding, 1)
  })

  it('handles Hungarian text with accents', () => {
    const width = measureTextWidth('Üdvözöljük', fontSize, fontWeight)
    expect(width).toBeGreaterThan(0)
    // Should be similar to unaccented version (within 5% difference)
    const unaccented = measureTextWidth('Udvozoljuk', fontSize, fontWeight)
    const percentDiff = Math.abs(width - unaccented) / unaccented
    expect(percentDiff).toBeLessThan(0.05)
  })
})
