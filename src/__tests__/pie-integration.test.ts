import { describe, it, expect } from 'bun:test'
import { renderMermaid, renderMermaidSVG } from '../index.ts'

const BASIC_PIE = `pie title Pets adopted by volunteers
  "Dogs" : 386
  "Cats" : 85
  "Rats" : 15`

const SHOW_DATA_PIE = `pie showData title Key elements in Product X
  "Calcium" : 42.96
  "Potassium" : 50.05
  "Magnesium" : 10.01
  "Iron" :  5`

describe('pie – integration rendering', () => {
  it('renders valid SVG for basic pie chart', () => {
    const svg = renderMermaidSVG(BASIC_PIE)
    expect(svg).toContain('<svg')
    expect(svg).toContain('</svg>')
    expect(svg).toContain('data-pie-colors=')
    expect(svg).toContain('class="pie-slice pie-color-0"')
    expect(svg).toContain('class="pie-slice pie-color-1"')
    expect(svg).toContain('class="pie-slice pie-color-2"')
    expect(svg).toContain('data-label="Dogs"')
    expect(svg).toContain('data-value="386"')
    expect(svg).toContain('Pets adopted by volunteers')
    expect(svg).toContain('Dogs')
    expect(svg).toContain('Cats')
    expect(svg).toContain('Rats')
  })

  it('renders showData formatted legend in SVG', async () => {
    const svg = await renderMermaid(SHOW_DATA_PIE)
    expect(svg).toContain('Calcium [42.96]')
    expect(svg).toContain('Potassium [50.05]')
    expect(svg).toContain('Magnesium [10.01]')
    expect(svg).toContain('Iron [5]')
  })

  it('handles theme customization and CSS variables without producing NaN', async () => {
    const svg = await renderMermaid(BASIC_PIE, {
      bg: 'var(--background)',
      fg: 'var(--foreground)',
      accent: 'var(--accent)',
    })
    expect(svg).not.toContain('NaN')
    expect(svg).toContain('--pie-color-0: var(--accent, #3b82f6);')
  })

  it('supports transparent background', () => {
    const svg = renderMermaidSVG(BASIC_PIE, { transparent: true })
    expect(svg).not.toContain('background:var(--bg)')
  })

  it('supports interactive hover tooltips', () => {
    const svg = renderMermaidSVG(BASIC_PIE, { interactive: true })
    expect(svg).toContain('class="pie-slice-group"')
    expect(svg).toContain('<title>Dogs: 386 (')
    expect(svg).toContain('<title>Cats: 85 (')
  })

  it('handles XML escaping in slice labels and titles', () => {
    const xmlPie = `pie title "Fish & Chips <Salt>"
      "A & B" : 50
      "<Alpha>" : 50`
    const svg = renderMermaidSVG(xmlPie)
    expect(svg).toContain('Fish &amp; Chips &lt;Salt&gt;')
    expect(svg).toContain('A &amp; B')
    expect(svg).toContain('&lt;Alpha&gt;')
  })

  it('handles single 100% slice rendering full circle', () => {
    const singlePie = `pie
      "All" : 100`
    const svg = renderMermaidSVG(singlePie)
    expect(svg).toContain('class="pie-slice pie-color-0"')
    expect(svg).toContain('data-percentage="100%"')
  })

  it('handles empty pie chart without crashing', () => {
    const emptyPie = `pie title "Empty"`
    const svg = renderMermaidSVG(emptyPie)
    expect(svg).toContain('<svg')
    expect(svg).toContain('Empty')
  })

  it('correctly detects pie diagram with leading comment lines', () => {
    const commentedPie = `%% This is a header comment
%% Another comment
pie title "Commented Diagram"
  "Dogs" : 50
  "Cats" : 50`
    const svg = renderMermaidSVG(commentedPie)
    expect(svg).toContain('data-pie-colors=')
    expect(svg).toContain('Commented Diagram')
    expect(svg).toContain('Dogs')
  })
})
