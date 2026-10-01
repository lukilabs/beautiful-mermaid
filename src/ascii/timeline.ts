import type { AsciiConfig, AsciiTheme, ColorMode } from './types.ts'
import { parseTimelineDiagram } from '../timeline/parser.ts'
import { getSeriesColor, CHART_ACCENT_FALLBACK } from '../xychart/colors.ts'
import { colorizeText } from './ansi.ts'

// ============================================================================
// ASCII renderer — Timeline
//
// Renders a timeline as vertical flow: sections top→down, each period
// boxed with its events. Direction is parsed but ASCII always flows vertically.
// ============================================================================

export function renderTimelineAscii(
  text: string,
  config: AsciiConfig,
  colorMode: ColorMode = 'none',
  theme: AsciiTheme = { fg: '', border: '', line: '', arrow: '' },
): string {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('%%'))
  const diagram = parseTimelineDiagram(lines)

  const H = config.useAscii ? '-' : '─'
  const V = config.useAscii ? '|' : '│'
  const TL = config.useAscii ? '+' : '┌'
  const TR = config.useAscii ? '+' : '┐'
  const BL = config.useAscii ? '+' : '└'
  const BR = config.useAscii ? '+' : '┘'

  const rows: string[] = []
  if (diagram.title) rows.push(diagram.title)

  for (const section of diagram.sections) {
    rows.push(`${section.name}:`)
    for (const period of section.periods) {
      const line = ` ${period.label} ${H} ${period.events.join(' ')}`
      rows.push(line)
    }
  }

  const contentW = Math.max(...rows.map(r => r.length), 1)
  const accent = theme.accent ?? CHART_ACCENT_FALLBACK
  const bg = theme.bg
  const colored = (s: string, i: number): string => {
    if (colorMode === 'none') return s
    const hex = i === 0 ? accent : getSeriesColor(i, accent, bg)
    return colorizeText(s, hex, colorMode)
  }

  const out: string[] = []
  let colorIdx = -1
  for (const row of rows) {
    if (row.endsWith(':')) {
      out.push(row)
      continue
    }
    colorIdx++
    out.push(`${TL}${H.repeat(contentW + 2)}${TR}`)
    out.push(`${V} ${colored(row.padEnd(contentW), colorIdx)} ${V}`)
    out.push(`${BL}${H.repeat(contentW + 2)}${BR}`)
    out.push('')
  }

  while (out.length > 0 && out[out.length - 1] === '') out.pop()
  return out.join('\n')
}
