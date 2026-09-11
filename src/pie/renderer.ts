// ============================================================================
// Pie Chart SVG renderer
//
// Renders positioned Pie charts to SVG strings.
// All colors use CSS custom properties from the theme system.
// ============================================================================

import type { PositionedPieChart } from './types.ts'
import type { DiagramColors } from '../theme.ts'
import { svgOpenTag, buildStyleBlock } from '../theme.ts'
import { TEXT_BASELINE_SHIFT } from '../styles.ts'
import { getPieSliceColor, DEFAULT_PIE_ACCENT } from './colors.ts'

/** Font and layout styling constants for pie chart */
const PIE_FONT = {
  titleSize: 16,
  titleWeight: 600,
  sliceLabelSize: 12,
  sliceLabelWeight: 600,
  calloutLabelSize: 12,
  calloutLabelWeight: 500,
  legendLabelSize: 13,
  legendLabelWeight: 400,
  swatchSize: 14,
} as const

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

/**
 * Build pie chart specific CSS styles.
 */
function pieStyles(
  chart: PositionedPieChart,
  interactive: boolean,
  accent?: string,
  bgColor?: string
): string {
  const accentHex = accent ?? DEFAULT_PIE_ACCENT

  const colorIndices = new Set<number>()
  for (const s of chart.slices) colorIndices.add(s.colorIndex)

  const colorVarDefs: string[] = []
  for (const idx of [...colorIndices].sort((a, b) => a - b)) {
    const value = idx === 0
      ? `var(--accent, ${DEFAULT_PIE_ACCENT})`
      : getPieSliceColor(idx, accentHex, bgColor)
    colorVarDefs.push(`    --pie-color-${idx}: ${value};`)
  }

  const seriesRules: string[] = []
  for (const idx of [...colorIndices].sort((a, b) => a - b)) {
    const color = `var(--pie-color-${idx})`
    seriesRules.push(`  .pie-slice.pie-color-${idx} { fill: ${color}; }`)
    seriesRules.push(`  .pie-legend-swatch.pie-color-${idx} { fill: ${color}; }`)
  }

  const tipRules = interactive ? `
  .pie-tip { opacity: 0; pointer-events: none; transition: opacity 0.15s ease-in-out; }
  .pie-tip-bg { fill: var(--_text); filter: drop-shadow(0 1px 3px color-mix(in srgb, var(--fg) 20%, transparent)); }
  .pie-tip-text { fill: var(--bg); font-size: 13px; font-weight: 500; }
  .pie-slice-group:hover .pie-tip { opacity: 1; }
  .pie-slice-group:hover .pie-slice { opacity: 0.85; filter: brightness(1.05); }` : ''

  const colorVarsBlock = colorVarDefs.length > 0 ? `\n  svg {\n${colorVarDefs.join('\n')}\n  }` : ''

  return `<style>
  .pie-slice { stroke: var(--bg); stroke-width: 2px; stroke-linejoin: round; }
  .pie-slice-label { fill: #ffffff; font-size: ${PIE_FONT.sliceLabelSize}px; font-weight: ${PIE_FONT.sliceLabelWeight}; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.4); }
  .pie-callout-line { stroke: var(--_line); stroke-width: 1.2px; fill: none; stroke-linecap: round; stroke-linejoin: round; }
  .pie-callout-label { fill: var(--_text); font-size: ${PIE_FONT.calloutLabelSize}px; font-weight: ${PIE_FONT.calloutLabelWeight}; }
  .pie-legend-swatch { rx: 3px; stroke: var(--_inner-stroke); stroke-width: 0.5px; }
  .pie-legend-label { fill: var(--_text-sec); font-size: ${PIE_FONT.legendLabelSize}px; font-weight: ${PIE_FONT.legendLabelWeight}; }
  .pie-title { fill: var(--_text); font-size: ${PIE_FONT.titleSize}px; font-weight: ${PIE_FONT.titleWeight}; }${colorVarsBlock}
${seriesRules.join('\n')}${tipRules}
</style>`
}

/**
 * Render a positioned Pie chart as an SVG string.
 */
export function renderPieChartSvg(
  chart: PositionedPieChart,
  colors: DiagramColors,
  font: string = 'Inter',
  transparent: boolean = false,
  interactive: boolean = false,
): string {
  const parts: string[] = []

  // SVG root
  const maxColorIdx = Math.max(0, ...chart.slices.map(s => s.colorIndex))
  const svgTag = svgOpenTag(chart.width, chart.height, colors, transparent)
    .replace('<svg ', `<svg data-pie-colors="${maxColorIdx}" `)
  parts.push(svgTag)
  parts.push(buildStyleBlock(font, false))

  // Pie chart styles
  parts.push(pieStyles(chart, interactive, colors.accent, colors.bg))

  // 1. Slices
  const sliceOverlay: string[] = []
  for (const slice of chart.slices) {
    const dataAttrs = ` data-value="${slice.value}" data-label="${escapeXml(slice.label)}" data-percentage="${slice.percentageText}"`
    const pathElem = `<path d="${slice.pathData}" class="pie-slice pie-color-${slice.colorIndex}"${dataAttrs}/>`

    if (interactive) {
      const tipText = `${slice.label}: ${slice.value} (${slice.percentageText})`
      parts.push(
        `<g class="pie-slice-group">` +
        pathElem +
        `<title>${escapeXml(tipText)}</title>` +
        `</g>`
      )
    } else {
      parts.push(pathElem)
    }
  }

  // 2. Callout lines and Slice labels
  for (const slice of chart.slices) {
    if (slice.hasCallout && slice.calloutLine) {
      const cl = slice.calloutLine
      const points = `${r(cl.x1)},${r(cl.y1)} ${r(cl.x2)},${r(cl.y2)} ${r(cl.x3)},${r(cl.y3)}`
      parts.push(`<polyline points="${points}" class="pie-callout-line"/>`)
      if (slice.labelText) {
        parts.push(
          `<text x="${r(slice.labelX)}" y="${r(slice.labelY)}" text-anchor="${slice.textAnchor}" ` +
          `dy="${TEXT_BASELINE_SHIFT}" class="pie-callout-label">${escapeXml(slice.labelText)}</text>`
        )
      }
    } else if (slice.labelText) {
      parts.push(
        `<text x="${r(slice.labelX)}" y="${r(slice.labelY)}" text-anchor="${slice.textAnchor}" ` +
        `dy="${TEXT_BASELINE_SHIFT}" class="pie-slice-label">${escapeXml(slice.labelText)}</text>`
      )
    }
  }

  // 3. Title
  if (chart.title) {
    parts.push(
      `<text x="${r(chart.title.x)}" y="${r(chart.title.y)}" text-anchor="middle" ` +
      `dy="${TEXT_BASELINE_SHIFT}" class="pie-title">${escapeXml(chart.title.text)}</text>`
    )
  }

  // 4. Legend
  for (const item of chart.legend) {
    const swatchY = item.y - PIE_FONT.swatchSize / 2
    parts.push(
      `<rect x="${r(item.x)}" y="${r(swatchY)}" width="${PIE_FONT.swatchSize}" height="${PIE_FONT.swatchSize}" ` +
      `class="pie-legend-swatch pie-color-${item.colorIndex}"/>`
    )
    const textX = item.x + PIE_FONT.swatchSize + 8
    parts.push(
      `<text x="${r(textX)}" y="${r(item.y)}" text-anchor="start" ` +
      `dy="${TEXT_BASELINE_SHIFT}" class="pie-legend-label">${escapeXml(item.label)}</text>`
    )
  }

  parts.push('</svg>')
  return parts.join('\n')
}

/** Alias for renderPieChartSvg */
export const renderPieSvg = renderPieChartSvg
