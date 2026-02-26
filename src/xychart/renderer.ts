import type { PositionedXYChart } from './types.ts'
import type { DiagramColors } from '../theme.ts'
import { svgOpenTag, buildStyleBlock } from '../theme.ts'
import { TEXT_BASELINE_SHIFT, estimateTextWidth } from '../styles.ts'
import { getSeriesColor, CHART_ACCENT_FALLBACK } from './colors.ts'

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
  barRadius: 8,
} as const

const TIP = {
  fontSize: 15,
  fontWeight: 500,
  height: 32,
  padX: 14,
  offsetY: 12,
  rx: 8,
  minY: 4,
  pointerSize: 6,
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
  // Stamp data-xychart-colors so theme-switching JS knows how many series color vars to update
  const maxColorIdx = Math.max(0, ...chart.bars.map(b => b.colorIndex), ...chart.lines.map(l => l.colorIndex))
  const svgTag = svgOpenTag(chart.width, chart.height, colors, transparent)
    .replace('<svg ', `<svg data-xychart-colors="${maxColorIdx}" `)
  parts.push(svgTag)
  parts.push(buildStyleBlock(font, false))

  // Sparse lines (≤12 points) show dots by default
  const maxLinePoints = Math.max(...chart.lines.map(l => l.points.length), 0)
  const sparse = maxLinePoints > 0 && maxLinePoints <= 12

  // Chart-specific styles + gradient defs
  const { style: chartCss, defs: chartDefs } = chartStyles(chart, interactive, sparse, colors.accent, colors.bg)
  parts.push(chartCss)
  if (chartDefs) parts.push(chartDefs)

  // 1. Dot grid (dense dots across plot area, aligned to tick spacing)
  const { plotArea } = chart
  const xTicks = chart.xAxis.ticks.map(t => t.x)
  const yVals = chart.horizontal
    ? chart.yAxis.ticks.map(t => t.y)
    : chart.gridLines.map(g => g.y1)
  const xBase = xTicks.length > 1 ? Math.abs(xTicks[1]! - xTicks[0]!) : plotArea.width / 6
  const yBase = yVals.length > 1 ? Math.abs(yVals[1]! - yVals[0]!) : plotArea.height / 6
  const xGap = xBase / Math.max(1, Math.round(xBase / 20))
  const yGap = yBase / Math.max(1, Math.round(yBase / 20))
  const xAnchor = xTicks[0] ?? plotArea.x
  const yAnchor = yVals[0] ?? plotArea.y
  const xStart = xAnchor - Math.ceil((xAnchor - plotArea.x) / xGap) * xGap
  const yStart = yAnchor - Math.ceil((yAnchor - plotArea.y) / yGap) * yGap
  for (let y = yStart; y <= plotArea.y + plotArea.height + 0.5; y += yGap) {
    for (let x = xStart; x <= plotArea.x + plotArea.width + 0.5; x += xGap) {
      parts.push(`<circle cx="${r(x)}" cy="${r(y)}" r="1.5" class="xychart-grid"/>`)
    }
  }

  // 2. Bars — always render bar paths inline (before lines for correct z-order)
  //    Interactive: also build overlay groups with transparent hit-areas + tooltips (deferred to step 9)
  const barOverlay: string[] = []
  for (const bar of chart.bars) {
    const dataAttrs = ` data-value="${bar.value}"${bar.label ? ` data-label="${escapeXml(bar.label)}"` : ''}`
    const barPath = chart.horizontal
      ? roundedRightBarPath(bar.x, bar.y, bar.width, bar.height, CHART_FONT.barRadius)
      : roundedTopBarPath(bar.x, bar.y, bar.width, bar.height, CHART_FONT.barRadius)
    parts.push(
      `<path d="${barPath}" class="xychart-bar xychart-color-${bar.colorIndex}"${dataAttrs}/>`
    )
    if (interactive) {
      const tipText = formatTipValue(bar.value)
      const tipTitle = bar.label ? `${bar.label}: ${tipText}` : tipText
      const tip = tooltipAbove(bar.x + bar.width / 2, bar.y, tipText)
      barOverlay.push(
        `<g class="xychart-bar-group">` +
        `<rect x="${r(bar.x)}" y="${r(bar.y)}" width="${r(bar.width)}" height="${r(bar.height)}" fill="transparent"/>` +
        `<title>${escapeXml(tipTitle)}</title>` +
        tip +
        `</g>`
      )
    }
  }

  // 3. Lines — shadow first (wider, low opacity), then crisp line on top
  for (const line of chart.lines) {
    if (line.points.length === 0) continue
    const d = smoothCurvePath(line.points)
    parts.push(`<path d="${d}" class="xychart-line-shadow xychart-color-${line.colorIndex}" transform="translate(0,2)"/>`)
    parts.push(`<path d="${d}" class="xychart-line xychart-color-${line.colorIndex}"/>`)
  }

  // 4. Dots — grouped by x-position; interactive groups deferred to overlay
  const dotOverlay: string[] = []
  if (interactive || sparse) {
    // Build legend label lookup: line seriesIndex → "Line 1", "Line 2", etc.
    const lineLegendLabels = new Map<number, string>()
    for (const item of chart.legend) {
      if (item.type === 'line') lineLegendLabels.set(item.seriesIndex, item.label)
    }

    type DotEntry = { x: number; y: number; value: number; label?: string; seriesIndex: number; colorIndex: number }
    const columns = new Map<string, DotEntry[]>()

    for (const line of chart.lines) {
      for (const p of line.points) {
        const key = r(p.x)
        if (!columns.has(key)) columns.set(key, [])
        columns.get(key)!.push({ x: p.x, y: p.y, value: p.value, label: p.label, seriesIndex: line.seriesIndex, colorIndex: line.colorIndex })
      }
    }

    for (const entries of columns.values()) {
      const cx = entries[0]!.x
      const label = entries[0]!.label || ''

      if (interactive && entries.length > 1) {
        const topY = Math.min(...entries.map(e => e.y))
        const botY = Math.max(...entries.map(e => e.y))
        const hitPad = CHART_FONT.dotRadius * 3
        const hitArea = `<rect x="${r(cx - hitPad)}" y="${r(topY - hitPad)}" width="${r(hitPad * 2)}" height="${r(botY - topY + hitPad * 2)}" fill="transparent" class="xychart-hit"/>`
        const tipEntries = entries.map(e => ({
          text: formatTipValue(e.value),
          legendLabel: lineLegendLabels.get(e.seriesIndex) || `Line ${e.seriesIndex + 1}`,
        }))
        const tip = multiTooltipAbove(cx, topY - CHART_FONT.dotRadius, label, tipEntries)
        const valStrs = tipEntries.map(e => e.text)
        const titleText = label ? `${label}: ${valStrs.join(' · ')}` : valStrs.join(' · ')

        let group = `<g class="xychart-dot-group">${hitArea}`
        for (const e of entries) {
          const dataAttrs = ` data-value="${e.value}"${e.label ? ` data-label="${escapeXml(e.label)}"` : ''}`
          group += `<circle cx="${r(e.x)}" cy="${r(e.y)}" r="${CHART_FONT.dotRadius}" class="xychart-dot xychart-color-${e.colorIndex}"${dataAttrs}/>`
        }
        group += `<title>${escapeXml(titleText)}</title>${tip}</g>`
        dotOverlay.push(group)

      } else if (interactive) {
        const e = entries[0]!
        const dataAttrs = ` data-value="${e.value}"${e.label ? ` data-label="${escapeXml(e.label)}"` : ''}`
        const tipText = formatTipValue(e.value)
        const tipTitle = e.label ? `${e.label}: ${tipText}` : tipText
        const tip = tooltipAbove(cx, e.y - CHART_FONT.dotRadius, tipText)
        const hitArea = sparse
          ? `<circle cx="${r(cx)}" cy="${r(e.y)}" r="${CHART_FONT.dotRadius * 3}" fill="transparent" class="xychart-hit"/>`
          : ''
        dotOverlay.push(
          `<g class="xychart-dot-group">${hitArea}` +
          `<circle cx="${r(e.x)}" cy="${r(e.y)}" r="${CHART_FONT.dotRadius}" class="xychart-dot xychart-color-${e.colorIndex}"${dataAttrs}/>` +
          `<title>${escapeXml(tipTitle)}</title>${tip}</g>`
        )

      } else {
        // Sparse, not interactive: static dots render inline
        for (const e of entries) {
          const dataAttrs = ` data-value="${e.value}"${e.label ? ` data-label="${escapeXml(e.label)}"` : ''}`
          parts.push(
            `<circle cx="${r(e.x)}" cy="${r(e.y)}" r="${CHART_FONT.dotRadius}" class="xychart-dot xychart-color-${e.colorIndex}"${dataAttrs}/>`
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
        `class="xychart-bar xychart-color-${item.colorIndex}"/>`
      )
    } else {
      const ly = item.y
      parts.push(
        `<line x1="${item.x}" y1="${ly}" x2="${item.x + swatchW}" y2="${ly}" ` +
        `stroke-width="${CHART_FONT.lineWidth}" stroke-linecap="round" class="xychart-legend-line xychart-color-${item.colorIndex}"/>`
      )
    }
    parts.push(
      `<text x="${item.x + swatchW + gap}" y="${item.y}" text-anchor="start" ` +
      `font-size="${CHART_FONT.legendSize}" font-weight="${CHART_FONT.legendWeight}" ` +
      `dy="${TEXT_BASELINE_SHIFT}" class="xychart-label">${escapeXml(item.label)}</text>`
    )
  }

  // 9. Interactive overlay — rendered last so tooltips are always on top
  for (const g of barOverlay) parts.push(g)
  for (const g of dotOverlay) parts.push(g)

  parts.push('</svg>')
  return parts.join('\n')
}

// ============================================================================
// Chart-specific CSS styles
// ============================================================================

function chartStyles(chart: PositionedXYChart, interactive: boolean, sparse: boolean, themeAccent?: string, bgColor?: string): { style: string; defs: string } {
  const accentHex = themeAccent ?? CHART_ACCENT_FALLBACK

  // Collect all unique global color indices from bars + lines
  const colorIndices = new Set<number>()
  for (const b of chart.bars) colorIndices.add(b.colorIndex)
  for (const l of chart.lines) colorIndices.add(l.colorIndex)

  // Define --xychart-color-N CSS custom properties (updatable by theme-switching JS)
  // Also define --xychart-bar-fill-N via color-mix() so it stays dynamic on theme change
  const colorVarDefs: string[] = []
  for (const idx of [...colorIndices].sort((a, b) => a - b)) {
    const value = idx === 0
      ? `var(--accent, ${CHART_ACCENT_FALLBACK})`
      : getSeriesColor(idx, accentHex, bgColor)
    colorVarDefs.push(`    --xychart-color-${idx}: ${value};`)
    colorVarDefs.push(`    --xychart-bar-fill-${idx}: color-mix(in srgb, var(--bg) 75%, var(--xychart-color-${idx}) 25%);`)
  }

  // Generate unified color rules — one per global index, referencing the CSS vars
  const seriesRules: string[] = []
  for (const idx of [...colorIndices].sort((a, b) => a - b)) {
    const color = `var(--xychart-color-${idx})`
    // Bar-specific: stroke + solid blended fill (no opacity)
    seriesRules.push(`  .xychart-bar.xychart-color-${idx} { stroke: ${color}; fill: var(--xychart-bar-fill-${idx}); }`)
    // Line/dot-specific: stroke for paths, fill for circles
    seriesRules.push(`  path.xychart-color-${idx}, line.xychart-color-${idx} { stroke: ${color}; }`)
    seriesRules.push(`  circle.xychart-color-${idx} { fill: ${color}; }`)
  }

  const tipRules = interactive ? `
  .xychart-tip { opacity: 0; pointer-events: none; }
  .xychart-tip-bg { fill: var(--_text); filter: drop-shadow(0 1px 3px color-mix(in srgb, var(--fg) 20%, transparent)); }
  .xychart-tip-text { fill: var(--bg); font-size: ${TIP.fontSize}px; font-weight: ${TIP.fontWeight}; }
  .xychart-tip-ptr { fill: var(--_text); }
  .xychart-bar-group:hover .xychart-tip,
  .xychart-dot-group:hover .xychart-tip { opacity: 1; }` : ''

  const colorVarsBlock = colorVarDefs.length > 0 ? `\n  svg {\n${colorVarDefs.join('\n')}\n  }` : ''

  const style = `<style>
  .xychart-grid { fill: var(--_inner-stroke); stroke: none; opacity: 0.65; }
  .xychart-bar { stroke-width: 1.5; }
  .xychart-line { fill: none; stroke-width: ${CHART_FONT.lineWidth}; stroke-linecap: round; stroke-linejoin: round; }
  .xychart-line-shadow { fill: none; stroke-width: 5; stroke-linecap: round; stroke-linejoin: round; opacity: 0.12; }
  .xychart-dot { stroke: var(--bg); stroke-width: 2; }
  .xychart-label { fill: var(--_text-muted); }
  .xychart-axis-title { fill: var(--_text-sec); }
  .xychart-title { fill: var(--_text); }${colorVarsBlock}
${seriesRules.join('\n')}${tipRules}
</style>`

  return { style, defs: '' }
}


// ============================================================================
// Bar path with all corners rounded
// ============================================================================

function roundedTopBarPath(x: number, y: number, w: number, h: number, radius: number): string {
  const rr = Math.min(radius, w / 2, h / 2)
  if (rr <= 0) {
    return `M${r(x)},${r(y)} h${r(w)} v${r(h)} h${r(-w)} Z`
  }
  return [
    `M${r(x)},${r(y + rr)}`,                                   // start below top-left
    `Q${r(x)},${r(y)} ${r(x + rr)},${r(y)}`,                   // top-left
    `L${r(x + w - rr)},${r(y)}`,                                // top edge
    `Q${r(x + w)},${r(y)} ${r(x + w)},${r(y + rr)}`,           // top-right
    `L${r(x + w)},${r(y + h - rr)}`,                            // right edge
    `Q${r(x + w)},${r(y + h)} ${r(x + w - rr)},${r(y + h)}`,   // bottom-right
    `L${r(x + rr)},${r(y + h)}`,                                // bottom edge
    `Q${r(x)},${r(y + h)} ${r(x)},${r(y + h - rr)}`,           // bottom-left
    'Z',
  ].join(' ')
}

// ============================================================================
// Bar path with all corners rounded (for horizontal charts)
// ============================================================================

function roundedRightBarPath(x: number, y: number, w: number, h: number, radius: number): string {
  const rr = Math.min(radius, w / 2, h / 2)
  if (rr <= 0) {
    return `M${r(x)},${r(y)} h${r(w)} v${r(h)} h${r(-w)} Z`
  }
  return [
    `M${r(x + rr)},${r(y)}`,                                    // start after top-left
    `L${r(x + w - rr)},${r(y)}`,                                // top edge
    `Q${r(x + w)},${r(y)} ${r(x + w)},${r(y + rr)}`,           // top-right
    `L${r(x + w)},${r(y + h - rr)}`,                            // right edge
    `Q${r(x + w)},${r(y + h)} ${r(x + w - rr)},${r(y + h)}`,   // bottom-right
    `L${r(x + rr)},${r(y + h)}`,                                // bottom edge
    `Q${r(x)},${r(y + h)} ${r(x)},${r(y + h - rr)}`,           // bottom-left
    `L${r(x)},${r(y + rr)}`,                                    // left edge
    `Q${r(x)},${r(y)} ${r(x + rr)},${r(y)}`,                   // top-left
    'Z',
  ].join(' ')
}

// ============================================================================
// Smooth line interpolation — Natural cubic spline
//
// Computes the mathematically smoothest curve through all data points by
// minimizing total curvature (integrated second derivative). Treats y as a
// function of x, so the curve can never go backwards.
//
// Algorithm: tridiagonal system for second derivatives (Thomas algorithm),
// then convert each cubic segment to SVG cubic Bezier commands.
// ============================================================================

function smoothCurvePath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return ''
  if (points.length === 1) return `M${r(points[0]!.x)},${r(points[0]!.y)}`
  if (points.length === 2) {
    return `M${r(points[0]!.x)},${r(points[0]!.y)} L${r(points[1]!.x)},${r(points[1]!.y)}`
  }

  const n = points.length

  // 1. Interval widths and secant slopes
  const h: number[] = []
  const delta: number[] = []
  for (let i = 0; i < n - 1; i++) {
    h.push(points[i + 1]!.x - points[i]!.x)
    delta.push(h[i]! === 0 ? 0 : (points[i + 1]!.y - points[i]!.y) / h[i]!)
  }

  // 2. Solve tridiagonal system for second derivatives c[] (natural boundary: c[0] = c[n-1] = 0)
  const c = new Array<number>(n).fill(0)
  if (n > 2) {
    // Forward elimination
    const cp = new Array<number>(n).fill(0) // modified upper diagonal
    const dp = new Array<number>(n).fill(0) // modified right-hand side
    for (let i = 1; i < n - 1; i++) {
      const diag = 2 * (h[i - 1]! + h[i]!)
      const rhs = 3 * (delta[i]! - delta[i - 1]!)
      if (i === 1) {
        cp[i] = h[i]! / diag
        dp[i] = rhs / diag
      } else {
        const w = diag - h[i - 1]! * cp[i - 1]!
        cp[i] = h[i]! / w
        dp[i] = (rhs - h[i - 1]! * dp[i - 1]!) / w
      }
    }
    // Back substitution
    for (let i = n - 2; i >= 1; i--) {
      c[i] = dp[i]! - cp[i]! * c[i + 1]!
    }
  }

  // 3. Compute first derivatives (slopes) at each knot
  const slopes = new Array<number>(n).fill(0)
  for (let i = 0; i < n - 1; i++) {
    slopes[i] = delta[i]! - h[i]! * (2 * c[i]! + c[i + 1]!) / 3
  }
  // Slope at last point: derivative of last segment at its end
  slopes[n - 1] = delta[n - 2]! + h[n - 2]! * (c[n - 2]!) / 3

  // 4. Convert to cubic Bezier — control points strictly between endpoints in x
  let path = `M${r(points[0]!.x)},${r(points[0]!.y)}`
  for (let i = 0; i < n - 1; i++) {
    const seg = h[i]! / 3
    const cp1x = points[i]!.x + seg
    const cp1y = points[i]!.y + slopes[i]! * seg
    const cp2x = points[i + 1]!.x - seg
    const cp2y = points[i + 1]!.y - slopes[i + 1]! * seg
    path += ` C${r(cp1x)},${r(cp1y)} ${r(cp2x)},${r(cp2y)} ${r(points[i + 1]!.x)},${r(points[i + 1]!.y)}`
  }

  return path
}

// ============================================================================
// Tooltip rendering
// ============================================================================

/**
 * Multi-value tooltip: category label on top, each series value below with legend text label.
 */
function multiTooltipAbove(cx: number, topY: number, label: string, entries: Array<{ text: string; legendLabel: string }>): string {
  const lineH = 20
  const padY = 6
  const labelGap = 10
  const headingW = estimateTextWidth(label, TIP.fontSize, 600)
  const maxRowW = Math.max(...entries.map(e => {
    const legendW = estimateTextWidth(e.legendLabel, TIP.fontSize, TIP.fontWeight)
    const valW = estimateTextWidth(e.text, TIP.fontSize, TIP.fontWeight)
    return legendW + labelGap + valW
  }))
  const bgW = Math.max(headingW, maxRowW) + TIP.padX * 2
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

  // Value lines: legend label left-aligned, value right-aligned
  const rowLeft = bgX + TIP.padX
  const rowRight = bgX + bgW - TIP.padX
  for (const entry of entries) {
    textY += lineH
    svg += `<text x="${r(rowLeft)}" y="${r(textY)}" text-anchor="start" font-size="${TIP.fontSize}" font-weight="${TIP.fontWeight}" dy="${TEXT_BASELINE_SHIFT}" class="xychart-tip xychart-tip-text">${escapeXml(entry.legendLabel)}</text>`
    svg += `<text x="${r(rowRight)}" y="${r(textY)}" text-anchor="end" font-size="${TIP.fontSize}" font-weight="${TIP.fontWeight}" dy="${TEXT_BASELINE_SHIFT}" class="xychart-tip xychart-tip-text">${escapeXml(entry.text)}</text>`
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


