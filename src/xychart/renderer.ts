import type { PositionedXYChart } from './types.ts'
import type { DiagramColors } from '../theme.ts'
import { svgOpenTag, buildStyleBlock } from '../theme.ts'
import { TEXT_BASELINE_SHIFT, estimateTextWidth } from '../styles.ts'

// ============================================================================
// XY Chart SVG renderer
//
// Renders positioned XY charts to SVG strings.
// All colors use CSS custom properties (var(--_xxx)) from the theme system.
//
// Render order (back to front):
//   1. Grid lines
//   2. Bars
//   3. Lines + dots
//   4. Axis lines + tick marks
//   5. Axis labels
//   6. Axis titles
//   7. Chart title
// ============================================================================

const CHART_FONT = {
  titleSize: 14,
  titleWeight: 600,
  axisTitleSize: 12,
  axisTitleWeight: 500,
  labelSize: 12,
  labelWeight: 400,
  legendSize: 12,
  legendWeight: 400,
  dotRadius: 3,
  lineWidth: 2,
} as const

const TIP = {
  fontSize: 11,
  fontWeight: 500,
  height: 18,
  padX: 8,
  offsetY: 6,
  rx: 4,
  minY: 4,
} as const

/**
 * Render a positioned XY chart as an SVG string.
 */
export function renderXYChartSvg(
  chart: PositionedXYChart,
  colors: DiagramColors,
  font: string = 'Inter',
  transparent: boolean = false,
  interactive: boolean = false,
): string {
  const parts: string[] = []

  // SVG root + base styles
  parts.push(svgOpenTag(chart.width, chart.height, colors, transparent))
  parts.push(buildStyleBlock(font, false))

  // Chart-specific styles
  parts.push(chartStyles(chart, interactive))

  // 1. Grid lines
  for (const g of chart.gridLines) {
    parts.push(
      `<line x1="${g.x1}" y1="${g.y1}" x2="${g.x2}" y2="${g.y2}" class="xychart-grid"/>`
    )
  }

  // 2. Bars
  for (const bar of chart.bars) {
    const dataAttrs = ` data-value="${bar.value}"${bar.label ? ` data-label="${escapeXml(bar.label)}"` : ''}`
    if (interactive) {
      const tipText = formatTipValue(bar.value)
      const tipTitle = bar.label ? `${bar.label}: ${tipText}` : tipText
      const tip = tooltipAbove(bar.x + bar.width / 2, bar.y, tipText)
      parts.push(
        `<g class="xychart-bar-group">` +
        `<rect x="${bar.x}" y="${bar.y}" width="${bar.width}" height="${bar.height}" rx="2" class="xychart-bar xychart-bar-${bar.seriesIndex}"${dataAttrs}/>` +
        `<title>${escapeXml(tipTitle)}</title>` +
        tip +
        `</g>`
      )
    } else {
      parts.push(
        `<rect x="${bar.x}" y="${bar.y}" width="${bar.width}" height="${bar.height}" rx="2" class="xychart-bar xychart-bar-${bar.seriesIndex}"${dataAttrs}/>`
      )
    }
  }

  // 3. Lines + dots
  for (const line of chart.lines) {
    if (line.points.length === 0) continue
    const d = line.points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
    parts.push(`<path d="${d}" class="xychart-line xychart-line-${line.seriesIndex}"/>`)
    for (const p of line.points) {
      const dataAttrs = ` data-value="${p.value}"${p.label ? ` data-label="${escapeXml(p.label)}"` : ''}`
      if (interactive) {
        const tipText = formatTipValue(p.value)
        const tipTitle = p.label ? `${p.label}: ${tipText}` : tipText
        const tip = tooltipAbove(p.x, p.y - CHART_FONT.dotRadius, tipText)
        parts.push(
          `<g class="xychart-dot-group">` +
          `<circle cx="${p.x}" cy="${p.y}" r="${CHART_FONT.dotRadius}" class="xychart-dot xychart-line-${line.seriesIndex}"${dataAttrs}/>` +
          `<title>${escapeXml(tipTitle)}</title>` +
          tip +
          `</g>`
        )
      } else {
        parts.push(
          `<circle cx="${p.x}" cy="${p.y}" r="${CHART_FONT.dotRadius}" class="xychart-dot xychart-line-${line.seriesIndex}"${dataAttrs}/>`
        )
      }
    }
  }

  // 4. Axis lines + tick marks
  const xLine = chart.xAxis.line
  const yLine = chart.yAxis.line
  parts.push(`<line x1="${xLine.x1}" y1="${xLine.y1}" x2="${xLine.x2}" y2="${xLine.y2}" class="xychart-axis"/>`)
  parts.push(`<line x1="${yLine.x1}" y1="${yLine.y1}" x2="${yLine.x2}" y2="${yLine.y2}" class="xychart-axis"/>`)

  for (const tick of chart.xAxis.ticks) {
    parts.push(`<line x1="${tick.x}" y1="${tick.y}" x2="${tick.tx}" y2="${tick.ty}" class="xychart-axis"/>`)
  }
  for (const tick of chart.yAxis.ticks) {
    parts.push(`<line x1="${tick.x}" y1="${tick.y}" x2="${tick.tx}" y2="${tick.ty}" class="xychart-axis"/>`)
  }

  // 5. Axis labels
  for (const tick of chart.xAxis.ticks) {
    parts.push(
      `<text x="${tick.labelX}" y="${tick.labelY}" text-anchor="${tick.textAnchor}" ` +
      `font-size="${CHART_FONT.labelSize}" font-weight="${CHART_FONT.labelWeight}" ` +
      `dy="${TEXT_BASELINE_SHIFT}" class="xychart-label">${escapeXml(tick.label)}</text>`
    )
  }
  for (const tick of chart.yAxis.ticks) {
    parts.push(
      `<text x="${tick.labelX}" y="${tick.labelY}" text-anchor="${tick.textAnchor}" ` +
      `font-size="${CHART_FONT.labelSize}" font-weight="${CHART_FONT.labelWeight}" ` +
      `dy="${TEXT_BASELINE_SHIFT}" class="xychart-label">${escapeXml(tick.label)}</text>`
    )
  }

  // 6. Axis titles
  if (chart.xAxis.title) {
    const t = chart.xAxis.title
    const transform = t.rotate ? ` transform="rotate(${t.rotate},${t.x},${t.y})"` : ''
    parts.push(
      `<text x="${t.x}" y="${t.y}" text-anchor="middle"${transform} ` +
      `font-size="${CHART_FONT.axisTitleSize}" font-weight="${CHART_FONT.axisTitleWeight}" ` +
      `dy="${TEXT_BASELINE_SHIFT}" class="xychart-axis-title">${escapeXml(t.text)}</text>`
    )
  }
  if (chart.yAxis.title) {
    const t = chart.yAxis.title
    const transform = t.rotate ? ` transform="rotate(${t.rotate},${t.x},${t.y})"` : ''
    parts.push(
      `<text x="${t.x}" y="${t.y}" text-anchor="middle"${transform} ` +
      `font-size="${CHART_FONT.axisTitleSize}" font-weight="${CHART_FONT.axisTitleWeight}" ` +
      `dy="${TEXT_BASELINE_SHIFT}" class="xychart-axis-title">${escapeXml(t.text)}</text>`
    )
  }

  // 7. Chart title
  if (chart.title) {
    parts.push(
      `<text x="${chart.title.x}" y="${chart.title.y}" text-anchor="middle" ` +
      `font-size="${CHART_FONT.titleSize}" font-weight="${CHART_FONT.titleWeight}" ` +
      `dy="${TEXT_BASELINE_SHIFT}" class="xychart-title">${escapeXml(chart.title.text)}</text>`
    )
  }

  // 8. Legend
  for (const item of chart.legend) {
    const swatchW = 40, swatchH = 12
    const gap = 6
    if (item.type === 'bar') {
      // Colored rectangle swatch (matches Chart.js boxWidth: 40)
      parts.push(
        `<rect x="${item.x}" y="${item.y - swatchH / 2}" width="${swatchW}" height="${swatchH}" rx="1" ` +
        `class="xychart-bar xychart-bar-${item.seriesIndex}"/>`
      )
    } else {
      // Line swatch with center dot
      const ly = item.y
      parts.push(
        `<line x1="${item.x}" y1="${ly}" x2="${item.x + swatchW}" y2="${ly}" ` +
        `stroke-width="${CHART_FONT.lineWidth}" stroke-linecap="round" class="xychart-legend-line xychart-line-${item.seriesIndex}"/>` +
        `<circle cx="${item.x + swatchW / 2}" cy="${ly}" r="${CHART_FONT.dotRadius}" class="xychart-dot xychart-line-${item.seriesIndex}"/>`
      )
    }
    parts.push(
      `<text x="${item.x + swatchW + gap}" y="${item.y}" text-anchor="start" ` +
      `font-size="${CHART_FONT.legendSize}" font-weight="${CHART_FONT.legendWeight}" ` +
      `dy="${TEXT_BASELINE_SHIFT}" class="xychart-label">${escapeXml(item.label)}</text>`
    )
  }

  parts.push('</svg>')
  return parts.join('\n')
}

// ============================================================================
// Chart-specific CSS styles
// ============================================================================

function chartStyles(chart: PositionedXYChart, interactive: boolean): string {
  // Count unique bar and line series
  const barSeriesCount = new Set(chart.bars.map(b => b.seriesIndex)).size
  const lineSeriesCount = new Set(chart.lines.map(l => l.seriesIndex)).size

  const seriesRules: string[] = []

  // Single-series: use theme accent. Multi-series: use distinct hue palette.
  for (let i = 0; i < barSeriesCount; i++) {
    if (barSeriesCount <= 1) {
      seriesRules.push(`  .xychart-bar-${i} { fill: color-mix(in srgb, var(--_arrow) 70%, var(--bg)); stroke: var(--_arrow); stroke-width: 0.5; }`)
    } else {
      const c = BAR_PALETTE[i % BAR_PALETTE.length]
      seriesRules.push(`  .xychart-bar-${i} { fill: ${c}; fill-opacity: 0.7; stroke: ${c}; stroke-width: 1; }`)
    }
  }

  for (let i = 0; i < lineSeriesCount; i++) {
    if (lineSeriesCount <= 1 && barSeriesCount === 0) {
      // Solo line chart: use theme accent
      seriesRules.push(`  path.xychart-line-${i}, line.xychart-line-${i} { stroke: var(--_arrow); }`)
      seriesRules.push(`  circle.xychart-line-${i} { fill: var(--_arrow); }`)
    } else {
      const c = LINE_PALETTE[i % LINE_PALETTE.length]
      seriesRules.push(`  path.xychart-line-${i}, line.xychart-line-${i} { stroke: ${c}; }`)
      seriesRules.push(`  circle.xychart-line-${i} { fill: ${c}; }`)
    }
  }

  const tipRules = interactive ? `
  .xychart-tip { opacity: 0; pointer-events: none; transition: opacity 0.15s ease; }
  .xychart-tip-bg { fill: var(--_text); }
  .xychart-tip-text { fill: var(--bg); font-size: ${TIP.fontSize}px; font-weight: ${TIP.fontWeight}; }
  .xychart-bar-group:hover .xychart-tip,
  .xychart-dot-group:hover .xychart-tip { opacity: 1; }
  .xychart-bar-group:hover .xychart-bar { filter: brightness(1.1); }
  .xychart-dot-group:hover .xychart-dot { r: 5; transition: r 0.15s ease; }` : ''

  return `<style>
  .xychart-grid { stroke: var(--_inner-stroke); stroke-width: 1; }
  .xychart-bar { rx: 2; }
  .xychart-line { fill: none; stroke-width: ${CHART_FONT.lineWidth}; stroke-linecap: round; stroke-linejoin: round; }
  .xychart-dot { stroke: var(--bg); stroke-width: 1.5; }
  .xychart-axis { stroke: var(--_line); stroke-width: 1; }
  .xychart-label { fill: var(--_text-muted); }
  .xychart-axis-title { fill: var(--_text-sec); }
  .xychart-title { fill: var(--_text); }
${seriesRules.join('\n')}${tipRules}
</style>`
}

/**
 * Multi-hue palettes matching Chart.js defaults.
 * Used for multi-series charts where series must be visually distinct.
 * Single-series charts use the theme accent instead.
 */
const BAR_PALETTE = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
]

const LINE_PALETTE = [
  '#ef4444', // red
  '#10b981', // emerald
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#3b82f6', // blue
  '#84cc16', // lime
]

/**
 * Generate tooltip SVG elements (background rect + text) positioned above a point.
 */
function tooltipAbove(cx: number, topY: number, text: string): string {
  const textW = estimateTextWidth(text, TIP.fontSize, TIP.fontWeight)
  const bgW = textW + TIP.padX * 2
  const bgH = TIP.height
  const tipY = Math.max(TIP.minY, topY - TIP.offsetY - bgH)
  const bgX = cx - bgW / 2
  const textX = cx
  const textY = tipY + bgH / 2
  return (
    `<rect x="${r(bgX)}" y="${r(tipY)}" width="${r(bgW)}" height="${bgH}" rx="${TIP.rx}" class="xychart-tip xychart-tip-bg"/>` +
    `<text x="${r(textX)}" y="${r(textY)}" text-anchor="middle" dy="${TEXT_BASELINE_SHIFT}" class="xychart-tip xychart-tip-text">${escapeXml(text)}</text>`
  )
}

/** Format a numeric value for tooltip display */
function formatTipValue(v: number): string {
  if (Number.isInteger(v)) return String(v)
  return v.toFixed(Math.abs(v) < 10 ? 1 : 0)
}

/** Round to 1 decimal place for cleaner SVG output */
function r(n: number): string {
  return String(Math.round(n * 10) / 10)
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
