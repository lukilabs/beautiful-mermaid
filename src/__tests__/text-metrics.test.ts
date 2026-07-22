/**
 * Tests for text-metrics module — variable-width character measurement.
 */
import { describe, it, expect } from 'bun:test'
import { getCharWidth, measureTextWidth } from '../text-metrics'

// ============================================================================
// Character width classification
// ============================================================================

describe('getCharWidth', () => {
  describe('narrow characters', () => {
    it('measures thin letters as narrow (i, l, t, f, j, I)', () => {
      for (const ch of ['i', 'l', 't', 'f', 'j', 'I']) {
        expect(getCharWidth(ch), ch).toBeLessThan(0.7)
      }
    })

    it('measures thin punctuation as narrow', () => {
      for (const ch of ['!', '|', '.', ',', ':', ';', "'", '1']) {
        expect(getCharWidth(ch), ch).toBeLessThan(0.8)
      }
    })

    it('measures r as semi-narrow', () => {
      expect(getCharWidth('r')).toBeGreaterThan(getCharWidth('i'))
      expect(getCharWidth('r')).toBeLessThan(getCharWidth('a'))
    })
  })

  describe('normal characters', () => {
    it('measures average lowercase letters near 1.0', () => {
      for (const ch of ['a', 'e', 'o', 'n', 's']) {
        expect(getCharWidth(ch), ch).toBeGreaterThan(0.9)
        expect(getCharWidth(ch), ch).toBeLessThan(1.15)
      }
    })

    it('measures digits near 1.0-1.2 (tabular width)', () => {
      for (const ch of ['0', '2', '9']) {
        expect(getCharWidth(ch), ch).toBeGreaterThan(1.0)
        expect(getCharWidth(ch), ch).toBeLessThan(1.2)
      }
    })
  })

  describe('wide characters', () => {
    it('measures uppercase letters wider than lowercase (except I)', () => {
      for (const ch of ['A', 'B', 'N', 'Z']) {
        expect(getCharWidth(ch), ch).toBeGreaterThan(1.1)
        expect(getCharWidth(ch), ch).toBeLessThan(1.45)
      }
    })

    it('measures wide lowercase (w, m) above 1.4', () => {
      expect(getCharWidth('w')).toBeGreaterThan(1.4)
      expect(getCharWidth('m')).toBeGreaterThan(1.4)
    })

    it('measures very wide characters (W, M) above 1.6', () => {
      expect(getCharWidth('W')).toBeGreaterThan(1.6)
      expect(getCharWidth('M')).toBeGreaterThan(1.6)
    })
  })

  describe('space', () => {
    it('measures space at its real Inter advance (~0.52)', () => {
      // The old bucket value of 0.3 underestimated every word gap by ~1.3px
      expect(getCharWidth(' ')).toBeCloseTo(0.521, 3)
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
    it('returns the base letter width for precomposed accented letters', () => {
      // Accents don't change the advance — é measures the same as e
      expect(getCharWidth('é')).toBe(getCharWidth('e')) // U+00E9
      expect(getCharWidth('ñ')).toBe(getCharWidth('n')) // U+00F1
      expect(getCharWidth('ü')).toBe(getCharWidth('u')) // U+00FC
      expect(getCharWidth('ç')).toBe(getCharWidth('c')) // U+00E7
      expect(getCharWidth('ö')).toBe(getCharWidth('o')) // U+00F6
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

  // Sum of per-char ratios — verifies the formula without pinning calibration
  const ratioSum = (text: string) => [...text].reduce((s, ch) => s + getCharWidth(ch), 0)

  it('handles lowercase text with narrow letters', () => {
    const width = measureTextWidth('hello', fontSize, fontWeight)
    expect(width).toBeCloseTo(ratioSum('hello') * fontSize * baseRatio + minPadding, 1)
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
    const width = measureTextWidth('Will', fontSize, fontWeight)
    expect(width).toBeCloseTo(ratioSum('Will') * fontSize * baseRatio + minPadding, 1)
  })

  it('handles spaces correctly', () => {
    const width = measureTextWidth('a b', fontSize, fontWeight)
    expect(width).toBeCloseTo(ratioSum('a b') * fontSize * baseRatio + minPadding, 1)
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
    const width = measureTextWidth('Hello中国', fontSize, fontWeight)
    expect(width).toBeCloseTo(ratioSum('Hello中国') * fontSize * baseRatio + minPadding, 1)
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
// Calibration against real Inter metrics
// ============================================================================
//
// Fixtures measured with canvas measureText in headless Chrome 138 with the
// real Inter font loaded (400 weight, 11px — the edge-label spec). If the
// estimator underestimates these, edge-label text overflows its 8px-padded
// background rect; if it grossly overestimates, layout gets bloated.

describe('calibration against real Inter widths (11px, weight 400)', () => {
  const REAL_INTER_WIDTHS: Record<string, number> = {
    'yes': 18.19,
    'no': 13.09,
    'on failure': 48.47,
    'validates credentials': 106.56,
    'sends confirmation email': 130.6,
    'asynchronous message processing': 184.1,
    'returns HTTP 401 Unauthorized response': 215.65,
    'WRITES TO DATABASE': 119.44,
    'user_id + session_token validation': 177.51,
    'retry with exponential backoff (max 5)': 197.49,
  }

  it('never underestimates real width by more than 3%', () => {
    for (const [text, real] of Object.entries(REAL_INTER_WIDTHS)) {
      const est = measureTextWidth(text, 11, 400)
      expect(est, `"${text}" est ${est.toFixed(1)} vs real ${real}`).toBeGreaterThanOrEqual(real * 0.97)
    }
  })

  it('never overestimates real width by more than 12% + 3px', () => {
    for (const [text, real] of Object.entries(REAL_INTER_WIDTHS)) {
      const est = measureTextWidth(text, 11, 400)
      expect(est, `"${text}" est ${est.toFixed(1)} vs real ${real}`).toBeLessThanOrEqual(real * 1.12 + 3)
    }
  })

  it('preserves at least 6px of the nominal 8px edge-label padding per side', () => {
    // Edge-label background rect = estimated width + 8px padding each side.
    // The visible gap between glyphs and rect wall must stay close to 8px.
    const EDGE_LABEL_PADDING = 8
    for (const [text, real] of Object.entries(REAL_INTER_WIDTHS)) {
      const est = measureTextWidth(text, 11, 400)
      const gapPerSide = (est + EDGE_LABEL_PADDING * 2 - real) / 2
      expect(gapPerSide, `"${text}" gap ${gapPerSide.toFixed(1)}px`).toBeGreaterThanOrEqual(6)
    }
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
