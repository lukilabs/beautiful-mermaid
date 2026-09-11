// ============================================================================
// Pie Chart layout engine
//
// Computes geometry (coordinates, radii, angles, paths, text positions) for
// a parsed PieChart.
// ============================================================================

import type { PieChart, PositionedPieChart, PositionedSlice, PieLegendItem, PositionedTitle } from './types.ts'
import type { RenderOptions } from '../types.ts'
import { getPieSliceColor } from './colors.ts'
import { measureTextWidth } from '../text-metrics.ts'

/**
 * Format numeric value for display (integer or trimmed float).
 */
export function formatNumber(val: number): string {
  if (Number.isInteger(val)) return val.toLocaleString('en-US')
  return parseFloat(val.toFixed(2)).toString()
}

/**
 * Format slice percentage into clean text (e.g. "43%", "42.96%", "0.5%").
 */
export function formatPercentage(pct: number): string {
  const p = pct * 100
  if (p === 0) return '0%'
  if (Number.isInteger(p)) return `${p}%`
  if (p >= 10) return `${Math.round(p)}%`
  return `${parseFloat(p.toFixed(1))}%`
}

/**
 * Helper to round coordinate to 1 decimal place.
 */
function r(n: number): string {
  return String(Math.round(n * 10) / 10)
}

/**
 * SVG path for a 100% full circle pie slice.
 */
function fullCirclePath(cx: number, cy: number, radius: number): string {
  return `M ${r(cx)} ${r(cy - radius)} A ${r(radius)} ${r(radius)} 0 1 1 ${r(cx)} ${r(cy + radius)} A ${r(radius)} ${r(radius)} 0 1 1 ${r(cx)} ${r(cy - radius)} Z`
}

/**
 * Layout a parsed PieChart into positioned SVG geometry.
 */
export function layoutPieChart(chart: PieChart, options: RenderOptions = {}): PositionedPieChart {
  const pad = options.padding ?? 32
  const radius = 125
  const calloutPad = 36

  const hasTitle = Boolean(chart.title && chart.title.trim().length > 0)
  const titleHeight = hasTitle ? 32 : 0

  const totalValue = chart.slices.reduce((sum, s) => sum + s.value, 0)
  const accentColor = options.accent ?? '#3b82f6'
  const bgColor = options.bg

  // Center coordinates of pie
  const cx = pad + calloutPad + radius
  const cy = pad + titleHeight + calloutPad + radius

  // 1. Position slices
  const slices: PositionedSlice[] = []
  let currentAngle = -Math.PI / 2 // Start at 12 o'clock

  for (let i = 0; i < chart.slices.length; i++) {
    const slice = chart.slices[i]!
    const percentage = totalValue > 0 ? slice.value / totalValue : 0
    const sliceAngle = percentage * 2 * Math.PI
    const startAngle = currentAngle
    const endAngle = currentAngle + sliceAngle
    const midAngle = startAngle + sliceAngle / 2
    currentAngle = endAngle

    const color = getPieSliceColor(i, accentColor, bgColor)
    const percentageText = formatPercentage(percentage)

    // Generate path data
    let pathData: string
    if (chart.slices.length === 1 || percentage >= 0.9999) {
      pathData = fullCirclePath(cx, cy, radius)
    } else {
      const x1 = cx + radius * Math.cos(startAngle)
      const y1 = cy + radius * Math.sin(startAngle)
      const x2 = cx + radius * Math.cos(endAngle)
      const y2 = cy + radius * Math.sin(endAngle)
      const largeArc = sliceAngle > Math.PI ? 1 : 0
      pathData = `M ${r(cx)} ${r(cy)} L ${r(x1)} ${r(y1)} A ${r(radius)} ${r(radius)} 0 ${largeArc} 1 ${r(x2)} ${r(y2)} Z`
    }

    // Label and callout logic
    let labelX = cx
    let labelY = cy
    let textAnchor: 'start' | 'middle' | 'end' = 'middle'
    let labelText: string | undefined
    let hasCallout = false
    let calloutLine: PositionedSlice['calloutLine']

    if (sliceAngle >= 0.35) {
      // Wide enough: place percentage inside the slice
      const labelRadius = radius * 0.65
      labelX = cx + labelRadius * Math.cos(midAngle)
      labelY = cy + labelRadius * Math.sin(midAngle)
      textAnchor = 'middle'
      labelText = percentageText
      hasCallout = false
    } else if (sliceAngle >= 0.08) {
      // Narrow slice: draw callout line to outside
      const p1x = cx + radius * Math.cos(midAngle)
      const p1y = cy + radius * Math.sin(midAngle)
      const p2x = cx + (radius + 16) * Math.cos(midAngle)
      const p2y = cy + (radius + 16) * Math.sin(midAngle)
      const isRight = Math.cos(midAngle) >= 0
      const p3x = p2x + (isRight ? 14 : -14)
      const p3y = p2y

      labelX = p3x + (isRight ? 4 : -4)
      labelY = p3y
      textAnchor = isRight ? 'start' : 'end'
      labelText = percentageText
      hasCallout = true
      calloutLine = {
        x1: p1x,
        y1: p1y,
        x2: p2x,
        y2: p2y,
        x3: p3x,
        y3: p3y,
      }
    }

    slices.push({
      label: slice.label,
      value: slice.value,
      percentage,
      percentageText,
      startAngle,
      endAngle,
      midAngle,
      pathData,
      color,
      colorIndex: i,
      labelX,
      labelY,
      textAnchor,
      labelText,
      hasCallout,
      calloutLine,
    })
  }

  // 2. Position legend
  const legendX = cx + radius + calloutPad + 16
  const legendItemHeight = 24
  const legendItems: PieLegendItem[] = []

  let maxLegendTextW = 40
  for (let i = 0; i < chart.slices.length; i++) {
    const slice = chart.slices[i]!
    const pct = totalValue > 0 ? slice.value / totalValue : 0
    const labelText = chart.showData
      ? `${slice.label} [${formatNumber(slice.value)}]`
      : slice.label

    const textW = measureTextWidth(labelText, 13, 400)
    if (textW > maxLegendTextW) maxLegendTextW = textW

    legendItems.push({
      label: labelText,
      value: slice.value,
      percentage: pct,
      x: legendX,
      y: 0, // Assigned below once total height is known
      colorIndex: i,
    })
  }

  const legendTotalHeight = chart.slices.length * legendItemHeight
  const legendStartY = Math.max(cy - legendTotalHeight / 2 + 6, pad + titleHeight)

  for (let i = 0; i < legendItems.length; i++) {
    legendItems[i]!.y = legendStartY + i * legendItemHeight
  }

  // 3. Compute overall dimensions
  const swatchWidth = 14
  const swatchGap = 8
  const legendWidth = swatchWidth + swatchGap + maxLegendTextW

  const width = Math.max(legendX + legendWidth + pad, 360)
  const height = Math.max(cy + radius + calloutPad, legendStartY + legendTotalHeight + 10) + pad

  const title: PositionedTitle | undefined = hasTitle
    ? { text: chart.title!, x: width / 2, y: pad + 14 }
    : undefined

  return {
    width,
    height,
    cx,
    cy,
    radius,
    title,
    slices,
    legend: legendItems,
    showData: chart.showData,
    totalValue,
  }
}
