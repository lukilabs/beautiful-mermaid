// ============================================================================
// ASCII renderer — journey diagrams
//
// Renders Mermaid user journeys as compact scored task lists with optional
// section headings and actor annotations.
// ============================================================================

import { parseJourneyDiagram } from '../journey/parser.ts'
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

function renderScoreSegments(score: number, useAscii: boolean): StyledSegment[] {
  const filled = useAscii ? '#' : '●'
  const empty = useAscii ? '.' : '○'

  return [
    { text: filled.repeat(score), role: 'arrow' },
    { text: empty.repeat(5 - score), role: 'border' },
  ].filter(segment => segment.text.length > 0)
}

/**
 * Render a Mermaid journey diagram to ASCII/Unicode text.
 */
export function renderJourneyAscii(
  text: string,
  config: AsciiConfig,
  colorMode: ColorMode = 'none',
  theme: AsciiTheme = DEFAULT_ASCII_THEME,
): string {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('%%'))
  const diagram = parseJourneyDiagram(lines)
  const useAscii = config.useAscii
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

    for (let taskIndex = 0; taskIndex < section.tasks.length; taskIndex++) {
      const task = section.tasks[taskIndex]!
      const scoreSegments = renderScoreSegments(task.score, useAscii)
      const scoreWidth = 5
      const taskLines = task.text.split('\n')

      pushLine([
        ...scoreSegments,
        { text: ' ', role: null },
        { text: taskLines[0] ?? '', role: 'text' },
      ])
      for (const line of taskLines.slice(1)) {
        pushLine([
          { text: `${' '.repeat(scoreWidth + 1)} `, role: null },
          { text: line, role: 'text' },
        ])
      }

      if (task.actors.length > 0) {
        pushLine([
          { text: '  ', role: null },
          { text: 'by', role: 'border' },
          { text: ' ', role: null },
          { text: task.actors.join(', '), role: 'text' },
        ])
      }

      const moreTasks = taskIndex < section.tasks.length - 1
      const moreSections = sectionIndex < diagram.sections.length - 1
      if (moreTasks || moreSections) pushLine()
    }
  }

  return out.join('\n').trimEnd()
}
