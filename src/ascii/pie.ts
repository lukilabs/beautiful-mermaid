import type { AsciiConfig, AsciiTheme, ColorMode } from './types.ts'
import { parsePieDiagram } from '../pie/parser.ts'
import { getSeriesColor, CHART_ACCENT_FALLBACK } from '../xychart/colors.ts'
import { colorizeText } from './ansi.ts'

// ============================================================================
// ASCII renderer — Pie chart
//
// Horizontal bar breakdown, one row per slice:
//   Product A  ████████████████████ 45%
//   Product B  ██████████████      30%
//
// Bars use the theme accent palette (series colors).
// ============================================================================

const BAR_WIDTH = 20

export function renderPieAscii(
  text: string,
  config: AsciiConfig,
  colorMode: ColorMode = 'none',
  theme: AsciiTheme = { fg: '', border: '', line: '', arrow: '' },
): string {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('%%'))
  const chart = parsePieDiagram(lines)

  const total = chart.slices.reduce((sum, s) => sum + s.value, 0)
  if (total <= 0) return ''

  const barChar = config.useAscii ? '#' : '█'
  const maxLabel = Math.max(...chart.slices.map(s => s.label.length))

  const rows: string[] = []
  if (chart.title) rows.push(chart.title, '')

  chart.slices.forEach((slice, i) => {
    const pct = Math.round((slice.value / total) * 100)
    const barLen = Math.round((slice.value / total) * BAR_WIDTH)
    const bar = barChar.repeat(barLen).padEnd(BAR_WIDTH, ' ')
    const accent = theme.accent ?? CHART_ACCENT_FALLBACK
    const bg = theme.bg
    const hex = i === 0 ? accent : getSeriesColor(i, accent, bg)
    const coloredBar = colorMode === 'none' ? bar : colorizeText(bar, hex, colorMode)
    const label = slice.label.padEnd(maxLabel)
    rows.push(`${label}  ${coloredBar}  ${pct}%`)
  })

  return rows.join('\n')
}
