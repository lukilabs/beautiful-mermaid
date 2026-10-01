import type { DiagramColors } from '../theme.ts'
import { svgOpenTag, buildStyleBlock } from '../theme.ts'
import { getSeriesColor, CHART_ACCENT_FALLBACK } from '../xychart/colors.ts'
import { escapeXml } from '../multiline-utils.ts'
import { TEXT_BASELINE_SHIFT, FONT_SIZES, FONT_WEIGHTS } from '../styles.ts'

// ============================================================================
// Pie chart SVG renderer
//
// Renders a positioned pie chart (donut) to SVG string.
//
// Structure:
//   1. Title
//   2. Donut slices with percent labels
//   3. Legend rows (swatch + label + value + percent)
// ============================================================================

export interface PositionedPieSlice {
  label: string
  value: number
  percent: number
  startAngle: number
  endAngle: number
  midAngle: number
  colorIndex: number
}

export interface PositionedPie {
  width: number
  height: number
  cx: number
  cy: number
  outerRadius: number
  innerRadius: number
  title?: { text: string; x: number; y: number }
  slices: PositionedPieSlice[]
  legend: Array<{
    label: string
    value: number
    percent: number
    swatchX: number
    labelX: number
    valueX: number
    pctX: number
    y: number
    colorIndex: number
  }>
}

const r = (n: number): string => String(Math.round(n * 10) / 10)

const fmtPct = (p: number): string => `${Math.round(p * 100)}%`

/** Format a slice value: integers as-is, decimals trimmed to 2 places. */
const fmtValue = (v: number): string => {
  if (Number.isInteger(v)) return String(v)
  return String(Math.round(v * 100) / 100)
}

function polar(cx: number, cy: number, radius: number, angle: number): { x: number; y: number } {
  return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) }
}

/** Annular (donut) slice path from startAngle to endAngle (radians, clockwise from top). */
function donutSlicePath(cx: number, cy: number, outerR: number, innerR: number, a0: number, a1: number): string {
  if (a1 - a0 >= Math.PI * 2 - 1e-6) {
    return [
      `M${r(cx - outerR)},${r(cy)}`,
      `a${r(outerR)},${r(outerR)} 0 1 1 ${r(outerR * 2)},0`,
      `a${r(outerR)},${r(outerR)} 0 1 1 ${r(-outerR * 2)},0`,
      `M${r(cx - innerR)},${r(cy)}`,
      `a${r(innerR)},${r(innerR)} 0 1 1 ${r(innerR * 2)},0`,
      `a${r(innerR)},${r(innerR)} 0 1 1 ${r(-innerR * 2)},0`,
      'Z',
    ].join(' ')
  }
  const o0 = polar(cx, cy, outerR, a0)
  const o1 = polar(cx, cy, outerR, a1)
  const i0 = polar(cx, cy, innerR, a0)
  const i1 = polar(cx, cy, innerR, a1)
  const large = a1 - a0 > Math.PI ? 1 : 0
  return [
    `M${r(o0.x)},${r(o0.y)}`,
    `A${r(outerR)},${r(outerR)} 0 ${large} 1 ${r(o1.x)},${r(o1.y)}`,
    `L${r(i1.x)},${r(i1.y)}`,
    `A${r(innerR)},${r(innerR)} 0 ${large} 0 ${r(i0.x)},${r(i0.y)}`,
    'Z',
  ].join(' ')
}

export function renderPieSvg(
  positioned: PositionedPie,
  colors: DiagramColors,
  font: string = 'Inter',
  transparent: boolean = false,
): string {
  const { width, height, cx, cy, outerRadius, innerRadius } = positioned
  const parts: string[] = []

  const maxColorIdx = Math.max(0, ...positioned.slices.map(s => s.colorIndex))
  const svgTag = svgOpenTag(width, height, colors, transparent)
    .replace('<svg ', `<svg data-pie-colors="${maxColorIdx}" `)
  parts.push(svgTag)
  parts.push(buildStyleBlock(font, false))

  // Slice color CSS vars + rules (mirrors xychart chartStyles pattern)
  const accentHex = colors.accent ?? CHART_ACCENT_FALLBACK
  const bgHex = colors.bg
  const colorVarDefs: string[] = []
  const seriesRules: string[] = []
  for (let idx = 0; idx <= maxColorIdx; idx++) {
    const value = idx === 0
      ? `var(--accent, ${CHART_ACCENT_FALLBACK})`
      : getSeriesColor(idx, accentHex, bgHex)
    colorVarDefs.push(`    --pie-color-${idx}: ${value};`)
    seriesRules.push(`  path.pie-slice.pie-color-${idx} { fill: var(--pie-color-${idx}); }`)
    seriesRules.push(`  rect.pie-swatch.pie-color-${idx} { fill: var(--pie-color-${idx}); }`)
  }

  parts.push(`<style>
  .pie-slice { stroke: var(--bg); stroke-width: 2; }
  .pie-label { fill: var(--bg); }
  .pie-legend-label { fill: var(--_text); }
  .pie-legend-value { fill: var(--_text); }
  .pie-legend-pct { fill: var(--_text-muted); }
  .pie-title { fill: var(--_text); }
  svg {
${colorVarDefs.join('\n')}
  }
${seriesRules.join('\n')}
</style>`)

  if (positioned.title) {
    parts.push(
      `<text x="${r(positioned.title.x)}" y="${r(positioned.title.y)}" text-anchor="middle" ` +
      `font-size="18" font-weight="600" dy="${TEXT_BASELINE_SHIFT}" class="pie-title">${escapeXml(positioned.title.text)}</text>`
    )
  }

  for (const s of positioned.slices) {
    const d = donutSlicePath(cx, cy, outerRadius, innerRadius, s.startAngle, s.endAngle)
    // data-value is always emitted on every slice, regardless of showData
    parts.push(`<path d="${d}" fill-rule="evenodd" class="pie-slice pie-color-${s.colorIndex}" data-value="${s.value}"/>`)

    const midR = (outerRadius + innerRadius) / 2
    const lp = polar(cx, cy, midR, s.midAngle)
    parts.push(
      `<text x="${r(lp.x)}" y="${r(lp.y)}" text-anchor="middle" ` +
      `font-size="${FONT_SIZES.nodeLabel}" font-weight="${FONT_WEIGHTS.nodeLabel}" ` +
      `dy="${TEXT_BASELINE_SHIFT}" class="pie-label">${escapeXml(fmtPct(s.percent))}</text>`
    )
  }

  // Legend rows
  for (const item of positioned.legend) {
    parts.push(
      `<rect x="${r(item.swatchX)}" y="${r(item.y - 7)}" width="14" height="14" rx="3" ` +
      `class="pie-swatch pie-color-${item.colorIndex}"/>`
    )
    parts.push(
      `<text x="${r(item.labelX)}" y="${r(item.y)}" text-anchor="start" ` +
      `font-size="${FONT_SIZES.nodeLabel}" font-weight="${FONT_WEIGHTS.nodeLabel}" ` +
      `dy="${TEXT_BASELINE_SHIFT}" class="pie-legend-label">${escapeXml(item.label)}</text>`
    )
    parts.push(
      `<text x="${r(item.valueX)}" y="${r(item.y)}" text-anchor="end" ` +
      `font-size="${FONT_SIZES.nodeLabel}" font-weight="600" ` +
      `dy="${TEXT_BASELINE_SHIFT}" class="pie-legend-value">${escapeXml(fmtValue(item.value))}</text>`
    )
    parts.push(
      `<text x="${r(item.pctX)}" y="${r(item.y)}" text-anchor="end" ` +
      `font-size="${FONT_SIZES.edgeLabel}" font-weight="400" ` +
      `dy="${TEXT_BASELINE_SHIFT}" class="pie-legend-pct">${escapeXml(fmtPct(item.percent))}</text>`
    )
  }

  parts.push('</svg>')
  return parts.join('\n')
}
