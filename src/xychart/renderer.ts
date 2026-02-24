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
// Visual style: clean, minimal, modern. Inspired by Apple/Craft chart design.
//   - No axis lines or tick marks — labels float freely
//   - Ultra-subtle solid grid lines
//   - Bars with rounded tops, flat at baseline
//   - Smooth curved lines, no visible dots (dots appear on hover)
//
// Render order (back to front):
//   1. Grid lines
//   2. Bars (as paths with rounded tops)
//   3. Lines (smooth curves)
//   4. Dots (hidden by default, visible on hover when interactive)
//   5. Axis labels
//   6. Axis titles
//   7. Chart title
//   8. Legend
// ============================================================================

const CHART_FONT = {
  titleSize: 18,
  titleWeight: 600,
  axisTitleSize: 15,
  axisTitleWeight: 500,
  labelSize: 14,
  labelWeight: 400,
  legendSize: 14,
  legendWeight: 400,
  dotRadius: 5,
  lineWidth: 2.5,
  barRadius: 4,
} as const

const TIP = {
  fontSize: 13,
  fontWeight: 500,
  height: 26,
  padX: 12,
  offsetY: 10,
  rx: 6,
  minY: 4,
  pointerSize: 5,
  legendDot: 6,
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

  // Sparse lines (≤12 points) show dots by default
  const maxLinePoints = Math.max(...chart.lines.map(l => l.points.length), 0)
  const sparse = maxLinePoints > 0 && maxLinePoints <= 12

  // Chart-specific styles
  parts.push(chartStyles(chart, interactive, sparse))

  // 1. Grid lines (subtle horizontal/vertical lines spanning the plot area)
  for (const g of chart.gridLines) {
    parts.push(
      `<line x1="${g.x1}" y1="${g.y1}" x2="${g.x2}" y2="${g.y2}" class="xychart-grid"/>`
    )
  }

  // 2. Bars — rendered as paths with rounded top corners, flat at baseline
  for (const bar of chart.bars) {
    const dataAttrs = ` data-value="${bar.value}"${bar.label ? ` data-label="${escapeXml(bar.label)}"` : ''}`
    const barPath = chart.horizontal
      ? roundedRightBarPath(bar.x, bar.y, bar.width, bar.height, CHART_FONT.barRadius)
      : roundedTopBarPath(bar.x, bar.y, bar.width, bar.height, CHART_FONT.barRadius)
    if (interactive) {
      const tipText = formatTipValue(bar.value)
      const tipTitle = bar.label ? `${bar.label}: ${tipText}` : tipText
      const tip = tooltipAbove(bar.x + bar.width / 2, bar.y, tipText)
      parts.push(
        `<g class="xychart-bar-group">` +
        `<path d="${barPath}" class="xychart-bar xychart-bar-${bar.seriesIndex}"${dataAttrs}/>` +
        `<title>${escapeXml(tipTitle)}</title>` +
        tip +
        `</g>`
      )
    } else {
      parts.push(
        `<path d="${barPath}" class="xychart-bar xychart-bar-${bar.seriesIndex}"${dataAttrs}/>`
      )
    }
  }

  // 3. Lines — shadow first (wider, low opacity), then crisp line on top
  for (const line of chart.lines) {
    if (line.points.length === 0) continue
    const d = smoothCurvePath(line.points)
    parts.push(`<path d="${d}" class="xychart-line-shadow xychart-line-${line.seriesIndex}" transform="translate(0,2)"/>`)
    parts.push(`<path d="${d}" class="xychart-line xychart-line-${line.seriesIndex}"/>`)
  }

  // 4. Dots — grouped by x-position so multi-series columns share one tooltip
  if (interactive || sparse) {
    type DotEntry = { x: number; y: number; value: number; label?: string; seriesIndex: number }
    const columns = new Map<string, DotEntry[]>()

    for (const line of chart.lines) {
      for (const p of line.points) {
        const key = r(p.x)
        if (!columns.has(key)) columns.set(key, [])
        columns.get(key)!.push({ x: p.x, y: p.y, value: p.value, label: p.label, seriesIndex: line.seriesIndex })
      }
    }

    for (const entries of columns.values()) {
      const cx = entries[0].x
      const label = entries[0].label || ''

      if (interactive && entries.length > 1) {
        // Multi-series column: combined hover group with stacked tooltip
        const topY = Math.min(...entries.map(e => e.y))
        const botY = Math.max(...entries.map(e => e.y))
        const hitPad = CHART_FONT.dotRadius * 3
        const hitArea = `<rect x="${r(cx - hitPad)}" y="${r(topY - hitPad)}" width="${r(hitPad * 2)}" height="${r(botY - topY + hitPad * 2)}" fill="transparent" class="xychart-hit"/>`
        const tipEntries = entries.map(e => ({ text: formatTipValue(e.value), seriesIndex: e.seriesIndex }))
        const tip = multiTooltipAbove(cx, topY - CHART_FONT.dotRadius, label, tipEntries)
        const valStrs = tipEntries.map(e => e.text)
        const titleText = label ? `${label}: ${valStrs.join(' · ')}` : valStrs.join(' · ')

        let group = `<g class="xychart-dot-group">${hitArea}`
        for (const e of entries) {
          const dataAttrs = ` data-value="${e.value}"${e.label ? ` data-label="${escapeXml(e.label)}"` : ''}`
          group += `<circle cx="${r(e.x)}" cy="${r(e.y)}" r="${CHART_FONT.dotRadius}" class="xychart-dot xychart-line-${e.seriesIndex}"${dataAttrs}/>`
        }
        group += `<title>${escapeXml(titleText)}</title>${tip}</g>`
        parts.push(group)

      } else if (interactive) {
        // Single-series column
        const e = entries[0]
        const dataAttrs = ` data-value="${e.value}"${e.label ? ` data-label="${escapeXml(e.label)}"` : ''}`
        const tipText = formatTipValue(e.value)
        const tipTitle = e.label ? `${e.label}: ${tipText}` : tipText
        const tip = tooltipAbove(cx, e.y - CHART_FONT.dotRadius, tipText)
        const hitArea = sparse
          ? `<circle cx="${r(cx)}" cy="${r(e.y)}" r="${CHART_FONT.dotRadius * 3}" fill="transparent" class="xychart-hit"/>`
          : ''
        parts.push(
          `<g class="xychart-dot-group">${hitArea}` +
          `<circle cx="${r(e.x)}" cy="${r(e.y)}" r="${CHART_FONT.dotRadius}" class="xychart-dot xychart-line-${e.seriesIndex}"${dataAttrs}/>` +
          `<title>${escapeXml(tipTitle)}</title>${tip}</g>`
        )

      } else {
        // Sparse, not interactive: static visible dots
        for (const e of entries) {
          const dataAttrs = ` data-value="${e.value}"${e.label ? ` data-label="${escapeXml(e.label)}"` : ''}`
          parts.push(
            `<circle cx="${r(e.x)}" cy="${r(e.y)}" r="${CHART_FONT.dotRadius}" class="xychart-dot xychart-line-${e.seriesIndex}"${dataAttrs}/>`
          )
        }
      }
    }
  }

  // 5. Axis labels (no axis lines, no tick marks — just floating labels)
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
    const swatchW = 14, swatchH = 14
    const gap = 6
    if (item.type === 'bar') {
      parts.push(
        `<rect x="${item.x}" y="${item.y - swatchH / 2}" width="${swatchW}" height="${swatchH}" rx="3" ` +
        `class="xychart-bar xychart-bar-${item.seriesIndex}"/>`
      )
    } else {
      const ly = item.y
      parts.push(
        `<line x1="${item.x}" y1="${ly}" x2="${item.x + swatchW}" y2="${ly}" ` +
        `stroke-width="${CHART_FONT.lineWidth}" stroke-linecap="round" class="xychart-legend-line xychart-line-${item.seriesIndex}"/>`
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

function chartStyles(chart: PositionedXYChart, interactive: boolean, sparse: boolean): string {
  const barSeriesCount = new Set(chart.bars.map(b => b.seriesIndex)).size
  const lineSeriesCount = new Set(chart.lines.map(l => l.seriesIndex)).size

  const seriesRules: string[] = []

  // --- Bar series colors: accent outline + subtle fill (like ER entity boxes) ---
  for (let i = 0; i < barSeriesCount; i++) {
    if (barSeriesCount <= 1 && lineSeriesCount === 0) {
      // Bar-only chart: accent stroke, subtle accent fill
      seriesRules.push(`  .xychart-bar-${i} { stroke: var(--_arrow); fill: color-mix(in srgb, var(--_arrow) 12%, var(--bg)); }`)
    } else if (barSeriesCount <= 1) {
      // Mixed chart: muted solid stroke + very subtle fill
      seriesRules.push(`  .xychart-bar-${i} { stroke: color-mix(in srgb, var(--_arrow) 45%, var(--bg)); fill: color-mix(in srgb, var(--_arrow) 8%, var(--bg)); }`)
    } else {
      const color = lineSeriesCount > 0 ? BAR_THEME_MIX[i % BAR_THEME_MIX.length] : BAR_BOLD_MIX[i % BAR_BOLD_MIX.length]
      const strokeMix = lineSeriesCount > 0 ? `color-mix(in srgb, ${color} 55%, var(--bg))` : color
      seriesRules.push(`  .xychart-bar-${i} { stroke: ${strokeMix}; fill: color-mix(in srgb, ${color} 12%, var(--bg)); }`)
    }
  }

  // --- Line series colors ---
  for (let i = 0; i < lineSeriesCount; i++) {
    if (lineSeriesCount <= 1 && barSeriesCount === 0) {
      seriesRules.push(`  path.xychart-line-${i}, line.xychart-line-${i} { stroke: var(--_arrow); }`)
      seriesRules.push(`  circle.xychart-line-${i} { fill: var(--_arrow); }`)
    } else {
      const mix = LINE_THEME_MIX[i % LINE_THEME_MIX.length]
      seriesRules.push(`  path.xychart-line-${i}, line.xychart-line-${i} { stroke: ${mix}; }`)
      seriesRules.push(`  circle.xychart-line-${i} { fill: ${mix}; }`)
    }
  }

  const tipRules = interactive ? `
  .xychart-tip { opacity: 0; pointer-events: none; transition: opacity 0.15s ease; }
  .xychart-tip-bg { fill: var(--_text); filter: drop-shadow(0 1px 3px color-mix(in srgb, var(--fg) 20%, transparent)); }
  .xychart-tip-text { fill: var(--bg); font-size: ${TIP.fontSize}px; font-weight: ${TIP.fontWeight}; }
  .xychart-tip-ptr { fill: var(--_text); }
  .xychart-bar-group:hover .xychart-tip,
  .xychart-dot-group:hover .xychart-tip { opacity: 1; }
  .xychart-bar-group:hover .xychart-bar { filter: brightness(0.92); transition: filter 0.15s ease; }` : ''

  return `<style>
  .xychart-grid { stroke: var(--_inner-stroke); stroke-width: 0.75; opacity: 0.4; }
  .xychart-bar { stroke-width: 1.5; }
  .xychart-line { fill: none; stroke-width: ${CHART_FONT.lineWidth}; stroke-linecap: round; stroke-linejoin: round; }
  .xychart-line-shadow { fill: none; stroke-width: 5; stroke-linecap: round; stroke-linejoin: round; opacity: 0.07; }
  .xychart-dot { stroke: var(--bg); stroke-width: 2; }
  .xychart-label { fill: var(--_text-muted); }
  .xychart-axis-title { fill: var(--_text-sec); }
  .xychart-title { fill: var(--_text); }
${seriesRules.join('\n')}${tipRules}
</style>`
}

// ============================================================================
// Theme-derived color palettes
// ============================================================================

// Bars (bold): full-strength palette for bar-only charts
const BAR_BOLD_MIX = [
  'var(--_arrow)',
  'color-mix(in srgb, var(--_arrow) 55%, var(--fg))',
  'color-mix(in srgb, var(--fg) 65%, var(--_arrow))',
  'color-mix(in srgb, var(--_arrow) 70%, var(--_text-muted))',
  'color-mix(in srgb, var(--fg) 50%, var(--bg))',
  'color-mix(in srgb, var(--_arrow) 40%, var(--fg))',
  'color-mix(in srgb, var(--_line) 70%, var(--fg))',
  'color-mix(in srgb, var(--fg) 45%, var(--_arrow))',
]

// Bars (muted): blended towards background — for mixed charts with lines
const BAR_THEME_MIX = [
  'color-mix(in srgb, var(--_arrow) 70%, var(--_line))',
  'color-mix(in srgb, var(--fg) 40%, var(--bg))',
  'color-mix(in srgb, var(--_arrow) 45%, var(--_text-muted))',
  'color-mix(in srgb, var(--_line) 60%, var(--bg))',
  'color-mix(in srgb, var(--fg) 30%, var(--bg))',
  'color-mix(in srgb, var(--_arrow) 35%, var(--_line))',
  'color-mix(in srgb, var(--_text-muted) 50%, var(--bg))',
  'color-mix(in srgb, var(--fg) 35%, var(--_arrow))',
]

// Lines: vibrant, full-strength — they sit on top and need to pop
const LINE_THEME_MIX = [
  'var(--_arrow)',
  'color-mix(in srgb, var(--fg) 75%, var(--bg))',
  'color-mix(in srgb, var(--_arrow) 60%, var(--fg))',
  'color-mix(in srgb, var(--fg) 90%, var(--bg))',
  'color-mix(in srgb, var(--_arrow) 45%, var(--fg))',
  'color-mix(in srgb, var(--fg) 65%, var(--_arrow))',
  'color-mix(in srgb, var(--_arrow) 80%, var(--_line))',
  'color-mix(in srgb, var(--fg) 55%, var(--_arrow))',
]

// ============================================================================
// Bar path with rounded top corners only
//
// Creates a path where the top-left and top-right corners are rounded
// but the bottom edge is flat against the baseline. This gives bars
// a modern, clean look.
// ============================================================================

function roundedTopBarPath(x: number, y: number, w: number, h: number, radius: number): string {
  // Clamp radius to half the bar width and half the bar height
  const rr = Math.min(radius, w / 2, h / 2)
  if (rr <= 0) {
    // No rounding possible — just a simple rect
    return `M${r(x)},${r(y)} h${r(w)} v${r(h)} h${r(-w)} Z`
  }
  // Start at top-left (just after the curve start), go clockwise
  return [
    `M${r(x)},${r(y + rr)}`,           // start below top-left corner
    `Q${r(x)},${r(y)} ${r(x + rr)},${r(y)}`,  // top-left rounded corner
    `L${r(x + w - rr)},${r(y)}`,       // top edge
    `Q${r(x + w)},${r(y)} ${r(x + w)},${r(y + rr)}`, // top-right rounded corner
    `L${r(x + w)},${r(y + h)}`,        // right edge (straight down)
    `L${r(x)},${r(y + h)}`,            // bottom edge (flat)
    'Z',                                // close path
  ].join(' ')
}

// ============================================================================
// Bar path with rounded right corners only (for horizontal charts)
//
// Rounds the top-right and bottom-right corners while keeping the left
// edge flat against the baseline.
// ============================================================================

function roundedRightBarPath(x: number, y: number, w: number, h: number, radius: number): string {
  const rr = Math.min(radius, w / 2, h / 2)
  if (rr <= 0) {
    return `M${r(x)},${r(y)} h${r(w)} v${r(h)} h${r(-w)} Z`
  }
  return [
    `M${r(x)},${r(y)}`,                               // top-left (flat)
    `L${r(x + w - rr)},${r(y)}`,                      // top edge
    `Q${r(x + w)},${r(y)} ${r(x + w)},${r(y + rr)}`, // top-right rounded
    `L${r(x + w)},${r(y + h - rr)}`,                  // right edge
    `Q${r(x + w)},${r(y + h)} ${r(x + w - rr)},${r(y + h)}`, // bottom-right rounded
    `L${r(x)},${r(y + h)}`,                           // bottom edge (flat)
    'Z',
  ].join(' ')
}

// ============================================================================
// Smooth line interpolation — monotone cubic spline (Fritsch-Carlson)
//
// Produces smooth curves that respect the data's monotonicity: no overshoots
// past data values, natural-looking bends. Much gentler than flat-tangent
// S-curves while still avoiding the jaggedness of straight line segments.
// ============================================================================

function smoothCurvePath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return ''
  if (points.length === 1) return `M${r(points[0].x)},${r(points[0].y)}`
  if (points.length === 2) {
    return `M${r(points[0].x)},${r(points[0].y)} L${r(points[1].x)},${r(points[1].y)}`
  }

  const n = points.length
  const dx: number[] = []
  const dy: number[] = []
  const m: number[] = []

  for (let i = 0; i < n - 1; i++) {
    dx.push(points[i + 1].x - points[i].x)
    dy.push(points[i + 1].y - points[i].y)
    m.push(dx[i] === 0 ? 0 : dy[i] / dx[i])
  }

  // Fritsch-Carlson tangent computation
  const tangents: number[] = new Array(n)
  tangents[0] = m[0]
  tangents[n - 1] = m[n - 2]

  for (let i = 1; i < n - 1; i++) {
    if (m[i - 1] * m[i] <= 0) {
      tangents[i] = 0
    } else {
      tangents[i] = (m[i - 1] + m[i]) / 2
    }
  }

  // Monotonicity enforcement
  for (let i = 0; i < n - 1; i++) {
    if (Math.abs(m[i]) < 1e-10) {
      tangents[i] = 0
      tangents[i + 1] = 0
    } else {
      const alpha = tangents[i] / m[i]
      const beta = tangents[i + 1] / m[i]
      const s = alpha * alpha + beta * beta
      if (s > 9) {
        const t = 3 / Math.sqrt(s)
        tangents[i] = t * alpha * m[i]
        tangents[i + 1] = t * beta * m[i]
      }
    }
  }

  let path = `M${r(points[0].x)},${r(points[0].y)}`
  for (let i = 0; i < n - 1; i++) {
    const seg = dx[i] / 3
    const cp1x = points[i].x + seg
    const cp1y = points[i].y + tangents[i] * seg
    const cp2x = points[i + 1].x - seg
    const cp2y = points[i + 1].y - tangents[i + 1] * seg
    path += ` C${r(cp1x)},${r(cp1y)} ${r(cp2x)},${r(cp2y)} ${r(points[i + 1].x)},${r(points[i + 1].y)}`
  }

  return path
}

// ============================================================================
// Tooltip rendering
// ============================================================================

/**
 * Multi-value tooltip: category label on top, each series value below with a colored legend dot.
 */
function multiTooltipAbove(cx: number, topY: number, label: string, entries: Array<{ text: string; seriesIndex: number }>): string {
  const lineH = 20
  const padY = 6
  const dotR = TIP.legendDot
  const dotGap = 6
  const labelW = estimateTextWidth(label, TIP.fontSize, 600)
  const maxValW = Math.max(...entries.map(e => estimateTextWidth(e.text, TIP.fontSize, TIP.fontWeight)))
  const valRowW = dotR * 2 + dotGap + maxValW
  const bgW = Math.max(labelW, valRowW) + TIP.padX * 2
  const bgH = padY + lineH + entries.length * lineH + padY

  const tipY = Math.max(TIP.minY, topY - TIP.offsetY - bgH - TIP.pointerSize)
  const bgX = cx - bgW / 2

  const ptrX = cx
  const ptrY = tipY + bgH
  const ps = TIP.pointerSize
  const pointer = `<polygon points="${r(ptrX - ps)},${r(ptrY)} ${r(ptrX + ps)},${r(ptrY)} ${r(ptrX)},${r(ptrY + ps)}" class="xychart-tip xychart-tip-ptr"/>`

  let svg = `<rect x="${r(bgX)}" y="${r(tipY)}" width="${r(bgW)}" height="${bgH}" rx="${TIP.rx}" class="xychart-tip xychart-tip-bg"/>`
  svg += pointer

  // Category label (bold, centered)
  let textY = tipY + padY + lineH / 2
  svg += `<text x="${r(cx)}" y="${r(textY)}" text-anchor="middle" font-weight="600" font-size="${TIP.fontSize}" dy="${TEXT_BASELINE_SHIFT}" class="xychart-tip xychart-tip-text">${escapeXml(label)}</text>`

  // Value lines with colored legend dot
  const rowLeft = cx - valRowW / 2
  for (const entry of entries) {
    textY += lineH
    // Legend dot (uses the series color via class)
    svg += `<circle cx="${r(rowLeft + dotR)}" cy="${r(textY)}" r="${dotR}" class="xychart-tip xychart-line-${entry.seriesIndex}" style="stroke:none"/>`
    // Value text
    svg += `<text x="${r(rowLeft + dotR * 2 + dotGap)}" y="${r(textY)}" text-anchor="start" font-size="${TIP.fontSize}" font-weight="${TIP.fontWeight}" dy="${TEXT_BASELINE_SHIFT}" class="xychart-tip xychart-tip-text">${escapeXml(entry.text)}</text>`
  }

  return svg
}

function tooltipAbove(cx: number, topY: number, text: string): string {
  const textW = estimateTextWidth(text, TIP.fontSize, TIP.fontWeight)
  const bgW = textW + TIP.padX * 2
  const bgH = TIP.height
  const tipY = Math.max(TIP.minY, topY - TIP.offsetY - bgH - TIP.pointerSize)
  const bgX = cx - bgW / 2
  const textX = cx
  const textY = tipY + bgH / 2

  const ptrX = cx
  const ptrY = tipY + bgH
  const ps = TIP.pointerSize
  const pointer = `<polygon points="${r(ptrX - ps)},${r(ptrY)} ${r(ptrX + ps)},${r(ptrY)} ${r(ptrX)},${r(ptrY + ps)}" class="xychart-tip xychart-tip-ptr"/>`

  return (
    `<rect x="${r(bgX)}" y="${r(tipY)}" width="${r(bgW)}" height="${bgH}" rx="${TIP.rx}" class="xychart-tip xychart-tip-bg"/>` +
    pointer +
    `<text x="${r(textX)}" y="${r(textY)}" text-anchor="middle" dy="${TEXT_BASELINE_SHIFT}" class="xychart-tip xychart-tip-text">${escapeXml(text)}</text>`
  )
}

function formatTipValue(v: number): string {
  if (Number.isInteger(v)) return v.toLocaleString('en-US')
  return v.toFixed(Math.abs(v) < 10 ? 1 : 0)
}

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
