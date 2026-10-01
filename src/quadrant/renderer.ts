import type { QuadrantAxis } from './types.ts'
import type { DiagramColors } from '../theme.ts'
import { svgOpenTag, buildStyleBlock } from '../theme.ts'
import { escapeXml } from '../multiline-utils.ts'
import { TEXT_BASELINE_SHIFT, FONT_SIZES, FONT_WEIGHTS } from '../styles.ts'

// ============================================================================
// Quadrant chart SVG renderer — 2×2 grid with floating axis labels,
// divider lines, quadrant labels, and points.
// ============================================================================

export interface PositionedQuadrantPoint {
  label: string
  x: number
  y: number
  labelX: number
  labelY: number
  anchor: 'start' | 'end'
}

export interface PositionedQuadrant {
  width: number
  height: number
  title?: { text: string; x: number; y: number }
  plot: { x: number; y: number; width: number; height: number }
  xAxis?: QuadrantAxis
  yAxis?: QuadrantAxis
  quadrantLabels: Array<{ text: string; x: number; y: number; anchor: 'start' | 'end' }>
  points: PositionedQuadrantPoint[]
}

const r = (n: number): string => String(Math.round(n * 10) / 10)

export function renderQuadrantSvg(
  positioned: PositionedQuadrant,
  colors: DiagramColors,
  font: string = 'Inter',
  transparent: boolean = false,
): string {
  const { width, height, plot } = positioned
  const parts: string[] = []

  parts.push(svgOpenTag(width, height, colors, transparent))
  parts.push(buildStyleBlock(font, false))

  const midX = plot.x + plot.width / 2
  const midY = plot.y + plot.height / 2

  parts.push(`<style>
  .quadrant-divider { stroke: var(--_inner-stroke); stroke-width: 1.5; }
  .quadrant-label { fill: var(--_text-muted); }
  .quadrant-axis { fill: var(--_text-sec); }
  .quadrant-point { fill: var(--accent, color-mix(in srgb, var(--fg) 85%, var(--bg))); stroke: var(--bg); stroke-width: 2; }
  .quadrant-point-label { fill: var(--_text); }
  .quadrant-title { fill: var(--_text); }
</style>`)

  if (positioned.title) {
    parts.push(
      `<text x="${r(positioned.title.x)}" y="${r(positioned.title.y)}" text-anchor="middle" ` +
      `font-size="18" font-weight="600" dy="${TEXT_BASELINE_SHIFT}" class="quadrant-title">${escapeXml(positioned.title.text)}</text>`
    )
  }

  parts.push(`<line x1="${r(midX)}" y1="${r(plot.y)}" x2="${r(midX)}" y2="${r(plot.y + plot.height)}" class="quadrant-divider"/>`)
  parts.push(`<line x1="${r(plot.x)}" y1="${r(midY)}" x2="${r(plot.x + plot.width)}" y2="${r(midY)}" class="quadrant-divider"/>`)

  if (positioned.xAxis) {
    parts.push(
      `<text x="${r(plot.x)}" y="${r(plot.y + plot.height + 24)}" text-anchor="start" ` +
      `font-size="${FONT_SIZES.edgeLabel}" dy="${TEXT_BASELINE_SHIFT}" class="quadrant-axis">${escapeXml(positioned.xAxis.low ?? '')}</text>`
    )
    parts.push(
      `<text x="${r(plot.x + plot.width)}" y="${r(plot.y + plot.height + 24)}" text-anchor="end" ` +
      `font-size="${FONT_SIZES.edgeLabel}" dy="${TEXT_BASELINE_SHIFT}" class="quadrant-axis">${escapeXml(positioned.xAxis.high ?? '')}</text>`
    )
  }
  if (positioned.yAxis) {
    parts.push(
      `<text x="${r(plot.x)}" y="${r(plot.y + plot.height)}" text-anchor="start" ` +
      `font-size="${FONT_SIZES.edgeLabel}" dy="${TEXT_BASELINE_SHIFT}" class="quadrant-axis">${escapeXml(positioned.yAxis.low ?? '')}</text>`
    )
    parts.push(
      `<text x="${r(plot.x)}" y="${r(plot.y)}" text-anchor="start" ` +
      `font-size="${FONT_SIZES.edgeLabel}" dy="${TEXT_BASELINE_SHIFT}" class="quadrant-axis">${escapeXml(positioned.yAxis.high ?? '')}</text>`
    )
  }

  for (const ql of positioned.quadrantLabels) {
    if (!ql.text) continue
    parts.push(
      `<text x="${r(ql.x)}" y="${r(ql.y)}" text-anchor="${ql.anchor}" ` +
      `font-size="${FONT_SIZES.edgeLabel}" font-weight="500" dy="${TEXT_BASELINE_SHIFT}" class="quadrant-label">${escapeXml(ql.text)}</text>`
    )
  }

  for (const p of positioned.points) {
    parts.push(`<circle cx="${r(p.x)}" cy="${r(p.y)}" r="6" class="quadrant-point"/>`)
    parts.push(
      `<text x="${r(p.labelX)}" y="${r(p.labelY)}" text-anchor="${p.anchor}" ` +
      `font-size="${FONT_SIZES.nodeLabel}" font-weight="${FONT_WEIGHTS.nodeLabel}" ` +
      `dy="${TEXT_BASELINE_SHIFT}" class="quadrant-point-label">${escapeXml(p.label)}</text>`
    )
  }

  parts.push('</svg>')
  return parts.join('\n')
}
