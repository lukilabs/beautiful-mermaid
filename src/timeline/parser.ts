import type { TimelineDiagram, TimelineSection, TimelinePeriod, TimelineEvent } from './types.ts'
import { normalizeBrTags } from '../multiline-utils.ts'

// ============================================================================
// Timeline diagram parser
//
// Parses Mermaid timeline syntax into a TimelineDiagram structure.
//
// Supported syntax:
//   timeline
//   title Timeline Title
//   section Section Label
//   2020 : Event 1
//   2021 : Event 1 : Event 2
//        : Continued event for the previous period
// ============================================================================

/**
 * Parse a Mermaid timeline diagram.
 * Expects the first line to be "timeline".
 */
export function parseTimelineDiagram(lines: string[]): TimelineDiagram {
  const diagram: TimelineDiagram = { sections: [] }

  let currentSection: TimelineSection | undefined
  let currentPeriod: TimelinePeriod | undefined
  let sectionIndex = 0
  let periodIndex = 0
  let eventIndex = 0

  const ensureSection = (): TimelineSection => {
    if (currentSection) return currentSection
    currentSection = {
      id: `section-${sectionIndex++}`,
      periods: [],
    }
    diagram.sections.push(currentSection)
    return currentSection
  }

  const pushEvents = (period: TimelinePeriod, rawEvents: string[]): void => {
    for (const rawEvent of rawEvents) {
      const normalized = normalizeBrTags(rawEvent.trim())
      if (!normalized) continue

      const event: TimelineEvent = {
        id: `event-${eventIndex++}`,
        text: normalized,
      }
      period.events.push(event)
    }
  }

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!

    if (/^timeline\b/i.test(line)) continue
    if (/^#/.test(line)) continue

    const titleMatch = line.match(/^title\s+(.+)$/i)
    if (titleMatch) {
      diagram.title = normalizeBrTags(titleMatch[1]!.trim())
      continue
    }

    const accTitleMatch = line.match(/^accTitle\s*:\s*(.+)$/i)
    if (accTitleMatch) {
      diagram.accessibilityTitle = normalizeBrTags(accTitleMatch[1]!.trim())
      continue
    }

    const accDescrMatch = line.match(/^accDescr\s*:\s*(.+)$/i)
    if (accDescrMatch) {
      diagram.accessibilityDescription = normalizeBrTags(accDescrMatch[1]!.trim())
      continue
    }

    if (/^accDescr\s*\{\s*$/i.test(line)) {
      const descriptionLines: string[] = []
      let foundClosingBrace = false

      while (++i < lines.length) {
        const blockLine = lines[i]!
        if (blockLine === '}') {
          foundClosingBrace = true
          break
        }
        descriptionLines.push(blockLine)
      }

      if (!foundClosingBrace) {
        throw new Error('Timeline accDescr block was not closed with "}"')
      }

      diagram.accessibilityDescription = normalizeBrTags(descriptionLines.join('\n').trim())
      continue
    }

    const sectionMatch = line.match(/^section\s+([^:]+)$/i)
    if (sectionMatch) {
      currentSection = {
        id: `section-${sectionIndex++}`,
        label: normalizeBrTags(sectionMatch[1]!.trim()),
        periods: [],
      }
      diagram.sections.push(currentSection)
      currentPeriod = undefined
      continue
    }

    const continuationMatch = line.match(/^:\s+(.+)$/)
    if (continuationMatch) {
      if (!currentPeriod) {
        throw new Error('Timeline continuation found before any period was declared')
      }
      pushEvents(currentPeriod, splitTimelineEvents(`: ${continuationMatch[1]!}`))
      continue
    }

    const periodMatch = line.match(/^([^:#\n]+?)(\s*:\s+.+)$/)
    if (periodMatch) {
      const periodLabel = normalizeBrTags(periodMatch[1]!.trim())
      const events = splitTimelineEvents(periodMatch[2]!)

      if (!periodLabel) {
        throw new Error(`Invalid timeline period: "${line}"`)
      }

      const period: TimelinePeriod = {
        id: `period-${periodIndex++}`,
        label: periodLabel,
        events: [],
      }

      pushEvents(period, events)

      if (period.events.length === 0) {
        throw new Error(`Timeline period "${periodLabel}" must include at least one event`)
      }

      ensureSection().periods.push(period)
      currentPeriod = period
      continue
    }

    throw new Error(`Unsupported timeline syntax: "${line}"`)
  }

  if (diagram.sections.length === 0 || diagram.sections.every(section => section.periods.length === 0)) {
    throw new Error('Timeline diagram must include at least one period with events')
  }

  return diagram
}

function splitTimelineEvents(raw: string): string[] {
  const events: string[] = []
  let index = 0

  while (index < raw.length) {
    while (index < raw.length && /\s/.test(raw[index]!)) index++
    if (index >= raw.length) break

    if (raw[index] !== ':') {
      throw new Error(`Invalid timeline event list: "${raw}"`)
    }

    index++
    if (index >= raw.length || !/\s/.test(raw[index]!)) {
      throw new Error(`Timeline events must use ": " separators: "${raw}"`)
    }

    while (index < raw.length && /\s/.test(raw[index]!)) index++
    const start = index

    while (index < raw.length) {
      if (raw[index] === ':' && /\s/.test(raw[index + 1] ?? '')) break
      index++
    }

    events.push(raw.slice(start, index).trim())
  }

  return events
}
