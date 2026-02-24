/**
 * Integration tests for xychart-beta rendering.
 *
 * Tests data-* attributes (always emitted) and interactive tooltip
 * groups (only when interactive: true).
 */
import { describe, it, expect } from 'bun:test'
import { renderMermaid } from '../index.ts'

const BAR_CHART = `xychart-beta
  x-axis [Jan, Feb, Mar, Apr]
  y-axis "Revenue" 0 --> 100
  bar [30, 60, 45, 80]`

const LINE_CHART = `xychart-beta
  x-axis [Jan, Feb, Mar]
  y-axis "Users" 0 --> 500
  line [100, 250, 400]`

const MIXED_CHART = `xychart-beta
  x-axis [Q1, Q2, Q3, Q4]
  y-axis "Sales" 0 --> 200
  bar [50, 80, 120, 90]
  line [40, 100, 110, 85]`

// ============================================================================
// Data attributes (always present)
// ============================================================================

describe('xychart – data attributes', () => {
  it('emits data-value and data-label on bars', async () => {
    const svg = await renderMermaid(BAR_CHART)
    expect(svg).toContain('data-value="30"')
    expect(svg).toContain('data-value="80"')
    expect(svg).toContain('data-label="Jan"')
    expect(svg).toContain('data-label="Apr"')
  })

  it('emits data-value and data-label on line dots (interactive)', async () => {
    // Line dots are only rendered when interactive: true
    const svg = await renderMermaid(LINE_CHART, { interactive: true })
    expect(svg).toContain('data-value="100"')
    expect(svg).toContain('data-value="400"')
    expect(svg).toContain('data-label="Jan"')
    expect(svg).toContain('data-label="Mar"')
  })

  it('shows dots on sparse line charts even without interactive', async () => {
    // Sparse charts (≤12 points) render dots as visual markers
    const svg = await renderMermaid(LINE_CHART)
    expect(svg).toContain('<circle')
    expect(svg).toContain('data-value="100"')
    // But no tooltips without interactive
    expect(svg).not.toContain('xychart-tip-bg')
    expect(svg).not.toContain('xychart-dot-group')
  })

  it('emits data attributes on mixed chart elements', async () => {
    const svg = await renderMermaid(MIXED_CHART, { interactive: true })
    // Bars
    expect(svg).toContain('data-value="50"')
    expect(svg).toContain('data-value="120"')
    // Line dots (only when interactive)
    expect(svg).toContain('data-value="40"')
    expect(svg).toContain('data-value="110"')
    // Labels on both
    expect(svg).toContain('data-label="Q1"')
    expect(svg).toContain('data-label="Q4"')
  })
})

// ============================================================================
// Interactive tooltips (opt-in)
// ============================================================================

describe('xychart – interactive tooltips', () => {
  it('does not emit tooltip elements by default', async () => {
    const svg = await renderMermaid(BAR_CHART)
    expect(svg).not.toContain('xychart-tip')
    expect(svg).not.toContain('xychart-bar-group')
    expect(svg).not.toContain('<title>')
  })

  it('emits tooltip groups for bars when interactive', async () => {
    const svg = await renderMermaid(BAR_CHART, { interactive: true })
    expect(svg).toContain('class="xychart-bar-group"')
    expect(svg).toContain('class="xychart-tip xychart-tip-bg"')
    expect(svg).toContain('class="xychart-tip xychart-tip-text"')
    expect(svg).toContain('<title>Jan: 30</title>')
    expect(svg).toContain('<title>Apr: 80</title>')
  })

  it('emits tooltip groups for line dots when interactive', async () => {
    const svg = await renderMermaid(LINE_CHART, { interactive: true })
    expect(svg).toContain('class="xychart-dot-group"')
    expect(svg).toContain('<title>Jan: 100</title>')
    expect(svg).toContain('<title>Mar: 400</title>')
  })

  it('includes hover CSS rules when interactive', async () => {
    const svg = await renderMermaid(BAR_CHART, { interactive: true })
    expect(svg).toContain('.xychart-tip {')
    expect(svg).toContain('opacity: 0')
    expect(svg).toContain('.xychart-bar-group:hover .xychart-tip')
    expect(svg).toContain('.xychart-dot-group:hover .xychart-tip')
    // Tooltips appear instantly (no transition)
  })

  it('does not include hover CSS when not interactive', async () => {
    const svg = await renderMermaid(BAR_CHART)
    expect(svg).not.toContain('.xychart-tip {')
    expect(svg).not.toContain('.xychart-bar-group:hover')
  })

  it('still emits data attributes when interactive', async () => {
    const svg = await renderMermaid(BAR_CHART, { interactive: true })
    expect(svg).toContain('data-value="30"')
    expect(svg).toContain('data-label="Jan"')
  })
})
