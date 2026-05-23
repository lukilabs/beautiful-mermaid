// ============================================================================
// ASCII renderer — timeline diagrams
//
// Renders Mermaid timeline syntax as a chronological outline with per-period
// markers and indented milestone lists. This keeps the ASCII variant compact
// and readable in terminals while preserving chronology and section grouping.
// ============================================================================

import { parseTimelineDiagram } from '../timeline/parser.ts'
import { colorizeLine, DEFAULT_ASCII_THEME } from './ansi.ts'
import type { AsciiConfig, AsciiTheme, CharRole, ColorMode } from './types.ts'

interface StyledSegment {
  text: string
  role: CharRole | null
}

function renderStyledLine(
  segments: StyledSegment[],
  colorMode: ColorMode,
  theme: AsciiTheme,
): string {
  const chars: string[] = []
  const roles: (CharRole | null)[] = []

  for (const segment of segments) {
    for (const char of segment.text) {
      chars.push(char)
      roles.push(segment.role)
    }
  }

  return colorizeLine(chars, roles, theme, colorMode)
}

/**
 * Render a Mermaid timeline diagram to ASCII/Unicode text.
 */
export function renderTimelineAscii(
  lines: string[],
  config: AsciiConfig,
  colorMode: ColorMode = 'none',
  theme: AsciiTheme = DEFAULT_ASCII_THEME,
): string {
  const diagram = parseTimelineDiagram(lines)
  const useAscii = config.useAscii

  const marker = useAscii ? 'o' : '○'
  const vertical = useAscii ? '|' : '│'
  const branch = useAscii ? '|' : '├'
  const lastBranch = useAscii ? '`' : '└'
  const horizontal = useAscii ? '-' : '─'
  const periodContinuation = '  '

  const out: string[] = []
  const pushLine = (segments: StyledSegment[] = []): void => {
    out.push(segments.length === 0 ? '' : renderStyledLine(segments, colorMode, theme))
  }

  if (diagram.title) {
    for (const line of diagram.title.split('\n')) {
      pushLine([{ text: line, role: 'text' }])
    }
    pushLine()
  }

  for (let sectionIndex = 0; sectionIndex < diagram.sections.length; sectionIndex++) {
    const section = diagram.sections[sectionIndex]!

    if (section.label) {
      pushLine([
        { text: '[', role: 'border' },
        { text: section.label.replace(/\n/g, ' / '), role: 'text' },
        { text: ']', role: 'border' },
      ])
    }

    for (let periodIndex = 0; periodIndex < section.periods.length; periodIndex++) {
      const period = section.periods[periodIndex]!
      const periodLines = period.label.split('\n')

      pushLine([
        { text: marker, role: 'junction' },
        { text: ' ', role: null },
        { text: periodLines[0] ?? '', role: 'text' },
      ])
      for (const line of periodLines.slice(1)) {
        pushLine([
          { text: `${periodContinuation} `, role: null },
          { text: line, role: 'text' },
        ])
      }

      for (let eventIndex = 0; eventIndex < period.events.length; eventIndex++) {
        const event = period.events[eventIndex]!
        const eventLines = event.text.split('\n')
        const junction = eventIndex === period.events.length - 1 ? lastBranch : branch
        pushLine([
          { text: vertical, role: 'line' },
          { text: '  ', role: null },
          { text: junction, role: eventIndex === period.events.length - 1 ? 'corner' : 'junction' },
          { text: horizontal, role: 'line' },
          { text: ' ', role: null },
          { text: eventLines[0] ?? '', role: 'text' },
        ])

        for (const line of eventLines.slice(1)) {
          pushLine(eventIndex === period.events.length - 1
            ? [
                { text: '    ', role: null },
                { text: line, role: 'text' },
              ]
            : [
                { text: vertical, role: 'line' },
                { text: '   ', role: null },
                { text: line, role: 'text' },
              ])
        }
      }

      const morePeriods = periodIndex < section.periods.length - 1
      const moreSections = sectionIndex < diagram.sections.length - 1
      if (morePeriods || moreSections) pushLine()
    }
  }

  return out.join('\n').trimEnd()
}
