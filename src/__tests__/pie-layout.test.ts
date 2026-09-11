import { describe, it, expect } from 'bun:test'
import { parsePieChart } from '../pie/parser.ts'
import { layoutPieChart } from '../pie/layout.ts'

describe('layoutPieChart', () => {
  it('computes percentage and slice angles correctly', () => {
    const text = `pie
      "A" : 50
      "B" : 50`
    const chart = parsePieChart(text.split('\n'))
    const positioned = layoutPieChart(chart)

    expect(positioned.totalValue).toBe(100)
    expect(positioned.slices).toHaveLength(2)
    expect(positioned.slices[0]!.percentage).toBeCloseTo(0.5, 4)
    expect(positioned.slices[1]!.percentage).toBeCloseTo(0.5, 4)
    expect(positioned.slices[0]!.percentageText).toBe('50%')
    expect(positioned.slices[1]!.percentageText).toBe('50%')

    // Slice 0 starts at -PI/2 (12 o'clock) and spans PI (180 deg)
    expect(positioned.slices[0]!.startAngle).toBeCloseTo(-Math.PI / 2, 4)
    expect(positioned.slices[0]!.endAngle).toBeCloseTo(Math.PI / 2, 4)

    // Slice 1 starts at PI/2 and ends at 3PI/2
    expect(positioned.slices[1]!.startAngle).toBeCloseTo(Math.PI / 2, 4)
    expect(positioned.slices[1]!.endAngle).toBeCloseTo((3 * Math.PI) / 2, 4)
  })

  it('handles single slice (100%) with full circle path', () => {
    const text = `pie
      "Solo" : 100`
    const chart = parsePieChart(text.split('\n'))
    const positioned = layoutPieChart(chart)

    expect(positioned.slices).toHaveLength(1)
    expect(positioned.slices[0]!.percentage).toBe(1)
    expect(positioned.slices[0]!.pathData).toContain('A 125 125 0 1 1')
  })

  it('generates inside labels for wide slices and callouts for narrow slices', () => {
    const text = `pie
      "Huge" : 95
      "Tiny" : 5`
    const chart = parsePieChart(text.split('\n'))
    const positioned = layoutPieChart(chart)

    expect(positioned.slices[0]!.hasCallout).toBe(false)
    expect(positioned.slices[0]!.labelText).toBe('95%')

    expect(positioned.slices[1]!.hasCallout).toBe(true)
    expect(positioned.slices[1]!.calloutLine).toBeDefined()
    expect(positioned.slices[1]!.labelText).toBe('5%')
  })

  it('positions title and legend correctly', () => {
    const text = `pie title "Pets Distribution"
      "Dogs" : 60
      "Cats" : 40`
    const chart = parsePieChart(text.split('\n'))
    const positioned = layoutPieChart(chart)

    expect(positioned.title).toBeDefined()
    expect(positioned.title!.text).toBe('Pets Distribution')
    expect(positioned.title!.x).toBeGreaterThan(0)
    expect(positioned.title!.y).toBeGreaterThan(0)

    expect(positioned.legend).toHaveLength(2)
    expect(positioned.legend[0]!.label).toBe('Dogs')
    expect(positioned.legend[1]!.label).toBe('Cats')
  })

  it('includes values in legend when showData is true', () => {
    const text = `pie showData
      "Dogs" : 386
      "Cats" : 85`
    const chart = parsePieChart(text.split('\n'))
    const positioned = layoutPieChart(chart)

    expect(positioned.showData).toBe(true)
    expect(positioned.legend[0]!.label).toBe('Dogs [386]')
    expect(positioned.legend[1]!.label).toBe('Cats [85]')
  })

  it('handles zero-value slices gracefully', () => {
    const text = `pie
      "Zero 1" : 0
      "Zero 2" : 0`
    const chart = parsePieChart(text.split('\n'))
    const positioned = layoutPieChart(chart)

    expect(positioned.totalValue).toBe(0)
    expect(positioned.slices[0]!.percentage).toBe(0)
    expect(positioned.slices[1]!.percentage).toBe(0)
    expect(positioned.slices[0]!.percentageText).toBe('0%')
    expect(positioned.slices[1]!.percentageText).toBe('0%')
  })
})
