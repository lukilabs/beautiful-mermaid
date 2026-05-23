import { describe, expect, it } from 'bun:test'

import { renderMermaidASCII } from '../ascii/index.ts'
import { renderMermaidSVG } from '../index.ts'
import {
  getFrontmatterMap,
  getFrontmatterScalar,
  normalizeMermaidSource,
  preprocessMermaidSource,
} from '../mermaid-source.ts'

describe('preprocessMermaidSource', () => {
  it('parses real YAML frontmatter, including anchors, lists, and block scalars', () => {
    const processed = preprocessMermaidSource(`---
theme: base
themeCSS: |
  .foo { fill: red; }
secure:
  - theme
palette: &palette
  plotColorPalette: "#ff6b6b, #0ea5e9"
themeVariables:
  xyChart: *palette
config:
  xyChart:
    width: 640
---
xychart
x-axis [A]
bar [1]`)

    expect(processed.body).toBe(`xychart
x-axis [A]
bar [1]`)
    expect(getFrontmatterScalar<string>(processed.frontmatter, ['theme'])).toBe('base')
    expect(getFrontmatterScalar<string>(processed.frontmatter, ['themeCSS'])).toContain('.foo { fill: red; }')
    expect(processed.frontmatter.secure).toEqual(['theme'])
    expect(getFrontmatterScalar<string>(processed.frontmatter, ['themeVariables', 'xyChart', 'plotColorPalette']))
      .toBe('#ff6b6b, #0ea5e9')
    expect(getFrontmatterScalar<number>(processed.frontmatter, ['xyChart', 'width'])).toBe(640)
  })

  it('merges init directives before and after the header and strips them from the body', () => {
    const processed = preprocessMermaidSource(`%%{init: { theme: base, config: { xyChart: { width: 640 } } }}%%
xychart
%% regular comment
x-axis [A]
%%{initialize: { fontFamily: 'Fira Code', themeVariables: { primaryTextColor: '#111111' } }}%%
bar [1]`)

    expect(processed.lines).toEqual([
      'xychart',
      'x-axis [A]',
      'bar [1]',
    ])
    expect(processed.body).not.toContain('%%{')
    expect(processed.lines).not.toContain('%% regular comment')
    expect(getFrontmatterScalar<string>(processed.frontmatter, ['theme'])).toBe('base')
    expect(getFrontmatterScalar<number>(processed.frontmatter, ['xyChart', 'width'])).toBe(640)
    expect(getFrontmatterScalar<string>(processed.frontmatter, ['fontFamily'])).toBe('Fira Code')
    expect(getFrontmatterScalar<string>(processed.frontmatter, ['themeVariables', 'primaryTextColor'])).toBe('#111111')
  })
})

describe('normalizeMermaidSource', () => {
  it('merges base config with parsed frontmatter and directive overrides', () => {
    const normalized = normalizeMermaidSource(`---
theme: neutral
xyChart:
  width: 480
---
%%{init: { xyChart: { width: 640 }, themeVariables: { primaryTextColor: '#111111' } }}%%
xychart
  x-axis [A]
  bar [1]`, {
      fontFamily: 'IBM Plex Sans',
      xyChart: { width: 320, height: 240 },
    })

    expect(normalized.text).toBe(`xychart
x-axis [A]
bar [1]`)
    expect(normalized.config.theme).toBe('neutral')
    expect(normalized.config.fontFamily).toBe('IBM Plex Sans')
    expect(normalized.config.xyChart).toEqual(expect.objectContaining({
      width: 640,
      height: 240,
    }))
    expect(normalized.config.themeVariables?.primaryTextColor).toBe('#111111')
    expect(getFrontmatterMap(normalized.frontmatter, ['xyChart'])).toEqual(expect.objectContaining({
      width: 640,
      height: 240,
    }))
  })
})

describe('rendering with Mermaid config source metadata', () => {
  it('strips frontmatter/init directives before SVG parsing and applies theme config', () => {
    const svg = renderMermaidSVG(`---
theme: forest
---
%%{init: { fontFamily: 'Fira Code', themeVariables: { primaryTextColor: '#123456' } }}%%
graph TD
  A --> B`)

    expect(svg).toContain('<svg')
    expect(svg).toContain('--bg:#f0fdf4')
    expect(svg).toContain('--fg:#123456')
    expect(svg).toContain('Fira%20Code')
    expect(svg).not.toContain('%%{init')
  })

  it('strips frontmatter/init directives before ASCII parsing', () => {
    const ascii = renderMermaidASCII(`---
theme: dark
---
%%{init: { themeVariables: { primaryTextColor: '#ffffff' } }}%%
graph LR
  A --> B`)

    expect(ascii).toContain('A')
    expect(ascii).toContain('B')
    expect(ascii).toContain('►')
  })
})
