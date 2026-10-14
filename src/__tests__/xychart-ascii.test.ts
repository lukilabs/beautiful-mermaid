/**
 * Tests for xychart-beta ASCII rendering.
 *
 * Tests bar charts, line charts, mixed charts, horizontal orientation,
 * multi-series support, staircase line routing, and edge cases.
 */
import { describe, it, expect } from 'bun:test'
import { renderMermaidASCII } from '../ascii/index.ts'

// ============================================================================
// Helper — render with no colors for easy string matching
// ============================================================================

function render(text: string, useAscii = false): string {
  return renderMermaidASCII(text, { colorMode: 'none', useAscii })
}

// ============================================================================
// Bar charts
// ============================================================================

describe('xychart ASCII – bar charts', () => {
  it('renders a basic bar chart with block characters', () => {
    const result = render(`xychart-beta
      x-axis [A, B, C]
      bar [10, 20, 30]`)
    expect(result).toContain('█')
    expect(result).toContain('A')
    expect(result).toContain('B')
    expect(result).toContain('C')
  })

  it('renders bars with # in ASCII mode', () => {
    const result = render(`xychart-beta
      x-axis [A, B, C]
      bar [10, 20, 30]`, true)
    expect(result).toContain('#')
    expect(result).not.toContain('█')
  })

  it('renders a bar chart with title', () => {
    const result = render(`xychart-beta
      title "Sales Report"
      x-axis [Q1, Q2, Q3, Q4]
      bar [100, 200, 150, 250]`)
    expect(result).toContain('Sales Report')
    expect(result).toContain('Q1')
    expect(result).toContain('Q4')
  })

  it('renders y-axis tick labels', () => {
    const result = render(`xychart-beta
      x-axis [A, B]
      y-axis 0 --> 100
      bar [25, 75]`)
    // Should have at least some tick values visible
    expect(result).toContain('┤')
    expect(result).toContain('┼')
  })

  it('renders multi-series bars', () => {
    const result = render(`xychart-beta
      x-axis [A, B, C]
      bar [10, 20, 30]
      bar [15, 25, 35]`)
    // Should contain legend for multi-series
    expect(result).toContain('Bar 1')
    expect(result).toContain('Bar 2')
  })
})

// ============================================================================
// Line charts
// ============================================================================

describe('xychart ASCII – line charts', () => {
  it('renders a line chart with staircase routing', () => {
    const result = render(`xychart-beta
      x-axis [A, B, C, D]
      line [10, 30, 20, 40]`)
    // Should use box-drawing corners for staircase
    expect(result).toContain('╭')
    expect(result).toContain('─')
  })

  it('does NOT use dot markers on line charts', () => {
    const result = render(`xychart-beta
      x-axis [A, B, C, D]
      line [10, 30, 20, 40]`)
    expect(result).not.toContain('●')
    expect(result).not.toContain('*')
  })

  it('uses vertical segments for row transitions', () => {
    const result = render(`xychart-beta
      x-axis [A, B, C]
      line [10, 50, 20]`)
    // Vertical segments connect rows
    expect(result).toContain('│')
  })

  it('renders ascending line with ╯ and ╭ corners', () => {
    const result = render(`xychart-beta
      x-axis [A, B]
      line [10, 50]`)
    // Ascending: ╯ at bottom (left+up), ╭ at top (bottom+right)
    expect(result).toContain('╯')
    expect(result).toContain('╭')
  })

  it('renders descending line with ╮ and ╰ corners', () => {
    const result = render(`xychart-beta
      x-axis [A, B]
      line [50, 10]`)
    // Descending: ╮ at top (left+down), ╰ at bottom (top+right)
    expect(result).toContain('╮')
    expect(result).toContain('╰')
  })

  it('renders flat line with only ─', () => {
    const result = render(`xychart-beta
      x-axis [A, B, C]
      line [50, 50, 50]`)
    expect(result).toContain('─')
    // No corners needed for flat lines
    expect(result).not.toContain('╭')
    expect(result).not.toContain('╮')
  })

  it('uses + for corners in ASCII mode', () => {
    const result = render(`xychart-beta
      x-axis [A, B]
      line [10, 50]`, true)
    expect(result).toContain('+')
    expect(result).not.toContain('╭')
    expect(result).not.toContain('╰')
  })
})

// ============================================================================
// Mixed bar + line
// ============================================================================

describe('xychart ASCII – mixed charts', () => {
  it('renders bars and lines together', () => {
    const result = render(`xychart-beta
      x-axis [A, B, C, D]
      bar [20, 40, 30, 50]
      line [25, 35, 40, 45]`)
    // Should have both bar blocks and line corners
    expect(result).toContain('█')
    expect(result).toContain('─')
    // Legend for multi-series
    expect(result).toContain('Bar 1')
    expect(result).toContain('Line 1')
  })
})

// ============================================================================
// Horizontal orientation
// ============================================================================

describe('xychart ASCII – horizontal', () => {
  it('renders horizontal bar chart', () => {
    const result = render(`xychart-beta horizontal
      x-axis [Python, JavaScript, Go]
      bar [30, 25, 12]`)
    // Category labels on left side
    expect(result).toContain('Python')
    expect(result).toContain('JavaScript')
    expect(result).toContain('Go')
    expect(result).toContain('█')
  })

  it('renders horizontal line chart with staircase', () => {
    const result = render(`xychart-beta horizontal
      x-axis [A, B, C]
      line [10, 30, 20]`)
    // Should have horizontal staircase routing
    expect(result).toContain('─')
    expect(result).toContain('│')
  })
})

// ============================================================================
// Titles and axis labels
// ============================================================================

describe('xychart ASCII – titles and axes', () => {
  it('renders chart title centered', () => {
    const result = render(`xychart-beta
      title "My Chart"
      x-axis [A, B]
      bar [10, 20]`)
    const titleLine = result.split('\n').find(l => l.includes('My Chart'))
    expect(titleLine).toBeDefined()
  })

  it('renders x-axis title', () => {
    const result = render(`xychart-beta
      x-axis "Category" [A, B, C]
      bar [10, 20, 30]`)
    expect(result).toContain('Category')
  })

  it('renders y-axis with explicit range', () => {
    const result = render(`xychart-beta
      x-axis [A, B]
      y-axis "Score" 0 --> 100
      bar [25, 75]`)
    // Y-axis ticks should appear
    expect(result).toContain('0')
    expect(result).toContain('100')
  })

  it('renders without title when not specified', () => {
    const result = render(`xychart-beta
      x-axis [A, B]
      bar [10, 20]`)
    // First non-empty line should be chart content, not a title
    const lines = result.split('\n').filter(l => l.trim().length > 0)
    expect(lines.length).toBeGreaterThan(0)
  })
})

// ============================================================================
// Edge cases
// ============================================================================

describe('xychart ASCII – edge cases', () => {
  it('handles single data point', () => {
    const result = render(`xychart-beta
      x-axis [Only]
      bar [42]`)
    expect(result).toContain('Only')
    expect(result).toContain('█')
  })

  it('handles two data points', () => {
    const result = render(`xychart-beta
      x-axis [A, B]
      bar [10, 20]`)
    expect(result).toContain('A')
    expect(result).toContain('B')
  })

  it('handles all zeros', () => {
    const result = render(`xychart-beta
      x-axis [A, B, C]
      bar [0, 0, 0]`)
    expect(result).toContain('A')
    // Should still render axes
    expect(result).toContain('┼')
  })

  it('handles large values', () => {
    const result = render(`xychart-beta
      x-axis [A, B]
      bar [1000000, 2000000]`)
    expect(result).toContain('A')
    expect(result).toContain('B')
  })

  it('renders line chart with single data point', () => {
    const result = render(`xychart-beta
      x-axis [A]
      line [50]`)
    expect(result).toContain('A')
    expect(result).toContain('─')
  })
})

// ============================================================================
// Axis structure
// ============================================================================

describe('xychart ASCII – axis structure', () => {
  it('has y-axis ticks (┤) at value positions', () => {
    const result = render(`xychart-beta
      x-axis [A, B, C]
      y-axis 0 --> 100
      bar [25, 50, 75]`)
    expect(result).toContain('┤')
  })

  it('has x-axis ticks (┬) at category positions', () => {
    // A bar standing on the axis covers its tick with ▀, so use a line chart
    const result = render(`xychart-beta
      x-axis [A, B, C]
      line [25, 50, 75]`)
    expect(result).toContain('┬')
  })

  it('has origin marker (┼)', () => {
    const result = render(`xychart-beta
      x-axis [A, B]
      bar [10, 20]`)
    expect(result).toContain('┼')
  })

  it('uses + for axis characters in ASCII mode', () => {
    const result = render(`xychart-beta
      x-axis [A, B, C]
      y-axis 0 --> 100
      bar [25, 50, 75]`, true)
    expect(result).toContain('+')
    expect(result).not.toContain('┤')
    expect(result).not.toContain('┬')
    expect(result).not.toContain('┼')
  })
})

// ============================================================================
// Bar heights against the y-axis
// ============================================================================

/** Render a vertical chart and locate its tick rows, x-axis line and bar columns. */
function plot(text: string, useAscii = false) {
  const lines = render(text, useAscii).split('\n')
  const ticks = lines.flatMap((line, row) => {
    const label = line.match(/^\s*(-?[\d.]+)[┤┼+]/)?.[1]
    return label === undefined ? [] : [{ row, value: Number(label) }]
  })
  const axis = ticks[ticks.length - 1]!.row
  // A bar's column is its x-axis tick, or the middle of the ▀ run it stands on
  const bars = [...lines[axis]!.matchAll(/┬|▀+/g)].map(m => m.index! + Math.floor(m[0].length / 2))
  return { lines, ticks, axis, bars }
}

const isBar = (c = '') => /[█▀▄#]/.test(c)

describe('xychart ASCII – bar heights', () => {
  const charts: [string, number[]][] = [
    ['y-axis 0 --> 2500', [400, 1200, 1900, 2500, 800]],
    ['y-axis 0 --> 14', [12, 10, 8]],
    ['', [400, 1200, 1900, 2500, 800]],
  ]

  for (const [axisLine, values] of charts) {
    it(`reaches every tick at or below its value and stops on a tick it equals: ${values.join(', ')}`, () => {
      const { lines, ticks, axis, bars } = plot(`xychart-beta
        x-axis [${values.map((_, i) => `c${i}`).join(', ')}]
        ${axisLine}
        bar [${values.join(', ')}]`)
      expect(bars.length).toBe(values.length)
      for (const { row, value: tick } of ticks.filter(t => t.row !== axis)) {
        bars.forEach((col, i) => {
          expect(isBar(lines[row]![col])).toBe(tick <= values[i]!)
          if (tick === values[i]) expect(lines[row]![col]).toBe('▄')
        })
      }
    })
  }

  it('stands each bar on the x-axis line with a half block', () => {
    const { lines, axis, bars } = plot(`xychart-beta
      x-axis [A, B, C]
      y-axis 0 --> 100
      bar [25, 50, 75]`)
    expect(bars.length).toBe(3)
    bars.forEach(col => expect(lines[axis]![col]).toBe('▀'))
  })

  it('gives every tick interval the same number of rows', () => {
    const { ticks } = plot(`xychart-beta
      x-axis [A, B, C, D, E]
      y-axis 0 --> 2500
      bar [400, 1200, 1900, 2500, 800]`)
    const gaps = ticks.slice(1).map((t, i) => t.row - ticks[i]!.row)
    expect(new Set(gaps).size).toBe(1)
  })

  it('fills whole cells in ASCII mode, up to every tick at or below the value', () => {
    const values = [400, 1200, 1900, 2500, 800]
    const result = render(`xychart-beta
      x-axis [A, B, C, D, E]
      y-axis 0 --> 2500
      bar [${values.join(', ')}]`, true)
    expect(result).not.toMatch(/[▀▄█]/)
    const lines = result.split('\n')
    const axis = lines.findIndex(l => /^\s*0\+/.test(l))
    const cols = [...lines[axis]!.matchAll(/\+/g)].map(m => m.index!).slice(1)
    expect(cols.length).toBe(values.length)
    for (const line of lines.slice(0, axis)) {
      const tick = line.match(/^\s*(\d+)\+/)?.[1]
      if (tick !== undefined) cols.forEach((col, i) => expect(line[col] === '#').toBe(Number(tick) <= values[i]!))
    }
  })
})

describe('xychart ASCII – negative bars', () => {
  for (const values of [[-6, 6, -2, 2], [-5, 3, 8, -2, 0], [-5, -3, -8]]) {
    it(`grows bars both ways from a solid base line and stops them on their tick: ${values.join(', ')}`, () => {
      const { lines, ticks, axis, bars } = plot(`xychart-beta
        x-axis [${values.map((_, i) => `c${i}`).join(', ')}]
        bar [${values.join(', ')}]`)
      expect(bars.length).toBe(values.length)
      // Bars grow from 0, or from the top tick when every value is negative
      const base = Math.min(Math.max(0, ticks[ticks.length - 1]!.value), ticks[0]!.value)
      const baseRow = ticks.find(t => t.value === base)!.row
      expect(lines[baseRow]).toMatch(/^\s*-?[\d.]+┼[─▀▄]+$/)
      bars.forEach((col, i) => expect(lines[baseRow]![col]).toBe(values[i] === base ? '─' : values[i]! > base ? '▀' : '▄'))
      for (const { row, value: tick } of ticks.filter(t => t.row !== axis && t.row !== baseRow)) {
        bars.forEach((col, i) => {
          expect(isBar(lines[row]![col])).toBe((base < tick && tick <= values[i]!) || (values[i]! <= tick && tick < base))
          if (tick === values[i]) expect(lines[row]![col]).toBe(tick > base ? '▄' : '▀')
        })
      }
    })
  }
})

describe('xychart ASCII – lines with bars', () => {
  it('draws a line at 0 along the x-axis line', () => {
    const lines = render(`xychart-beta
      x-axis [A, B, C]
      y-axis 0 --> 100
      line [0, 60, 100]`).split('\n')
    const axis = lines.findIndex(l => /^\s*0┼/.test(l))
    expect(lines[axis]).toMatch(/^\s*0┼─+╯/)
  })

  for (const useAscii of [false, true]) {
    it(`draws a line behind the bars, leaving every bar cell as it was${useAscii ? ' (ASCII)' : ''}`, () => {
      const bars = `xychart-beta
        x-axis [A, B, C, D]
        y-axis 0 --> 100
        bar [20, 50, 80, 40]`
      const cells = (text: string) => {
        const lines = render(text, useAscii).split('\n')
        const top = lines.findIndex(l => /^\s*\d+[┤+]/.test(l))
        const axis = lines.findIndex(l => /^\s*0[┼+]/.test(l))
        return lines.slice(top, axis + 1).flatMap((l, r) => [...l].flatMap((c, col) => (isBar(c) ? [`${axis - top - r}:${col}`] : [])))
      }
      for (const line of ['line [20, 50, 80, 40]', 'line [0, 50, 100, 25]']) {
        expect(cells(`${bars}\n        ${line}`)).toEqual(cells(bars))
      }
    })
  }
})
