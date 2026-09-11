// ============================================================================
// ASCII renderer — Pie Chart
//
// Renders pie charts to ASCII/Unicode text art with a proportional
// distribution bar and a data breakdown table.
// ============================================================================

import { parsePieChart } from '../pie/parser.ts'
import type { PieChart } from '../pie/types.ts'
import type { AsciiConfig, AsciiTheme, ColorMode } from './types.ts'
import { colorizeText } from './ansi.ts'
import { getPieSliceColor, DEFAULT_PIE_ACCENT } from '../pie/colors.ts'

const BAR_WIDTH = 50

export function renderPieAscii(
  text: string,
  config: AsciiConfig,
  colorMode: ColorMode,
  theme: AsciiTheme,
): string {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('%%'))
  const chart = parsePieChart(lines)
  if (chart.slices.length === 0) return ''

  const output: string[] = []
  const blockChar = config.useAscii ? '#' : '█'
  const total = chart.slices.reduce((sum, s) => sum + s.value, 0)
  const accent = theme.accent ?? DEFAULT_PIE_ACCENT

  // 1. Title
  if (chart.title) {
    if (colorMode !== 'none') {
      output.push(colorizeText(chart.title, theme.fg, colorMode))
    } else {
      output.push(chart.title)
    }
    output.push('')
  }

  // 2. Distribution bar: [████████████████████████████████████████]
  const barSegments: string[] = []
  let allocated = 0
  const counts: number[] = []

  for (let i = 0; i < chart.slices.length; i++) {
    const s = chart.slices[i]!
    const count = i === chart.slices.length - 1
      ? Math.max(0, BAR_WIDTH - allocated)
      : Math.round((total > 0 ? s.value / total : 1 / chart.slices.length) * BAR_WIDTH)
    counts.push(count)
    allocated += count
  }

  for (let i = 0; i < chart.slices.length; i++) {
    const count = counts[i]!
    if (count <= 0) continue
    const seg = blockChar.repeat(count)
    if (colorMode !== 'none') {
      const color = getPieSliceColor(i, accent, theme.bg)
      barSegments.push(colorizeText(seg, color, colorMode))
    } else {
      barSegments.push(seg)
    }
  }

  const leftBracket = colorMode !== 'none' ? colorizeText('[', theme.border, colorMode) : '['
  const rightBracket = colorMode !== 'none' ? colorizeText(']', theme.border, colorMode) : ']'
  output.push(`${leftBracket}${barSegments.join('')}${rightBracket}`)
  output.push('')

  // 3. Breakdown table
  const maxLabelWidth = Math.max(...chart.slices.map(s => s.label.length), 4)
  const maxValueWidth = Math.max(...chart.slices.map(s => s.value.toString().length), 1)

  for (let i = 0; i < chart.slices.length; i++) {
    const slice = chart.slices[i]!
    const pct = total > 0 ? (slice.value / total) * 100 : 0
    const pctStr = `${pct.toFixed(1)}%`
    const paddedPct = pct.toFixed(1).padStart(5, ' ')
    const sliceColor = getPieSliceColor(i, accent, theme.bg)

    const swatch = colorMode !== 'none'
      ? colorizeText(blockChar, sliceColor, colorMode)
      : blockChar

    const label = colorMode !== 'none'
      ? colorizeText(slice.label.padEnd(maxLabelWidth), theme.fg, colorMode)
      : slice.label.padEnd(maxLabelWidth)

    if (chart.showData) {
      const valStr = slice.value.toString().padStart(maxValueWidth)
      const dataText = colorMode !== 'none'
        ? colorizeText(`${valStr} (${paddedPct}%)`, theme.fg, colorMode)
        : `${valStr} (${paddedPct}%)`
      output.push(`  ${swatch} ${label}   ${dataText}`)
    } else {
      const pctText = colorMode !== 'none'
        ? colorizeText(pctStr, theme.fg, colorMode)
        : pctStr
      output.push(`  ${swatch} ${label}   ${pctText}`)
    }
  }

  return output.join('\n')
}
