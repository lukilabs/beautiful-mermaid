import type { TimelineDiagram, TimelineDirection, TimelineSection } from './types.ts'

// ============================================================================
// Timeline parser
//
// Supported syntax (mermaid-compatible + extensions):
//   timeline [LR|TD]          — direction keyword; LR (left→right) is default
//   title <text>
//   section <name>            — optional grouping; periods after it belong here
//   {time period} : {event}   — period first, one or more colon-separated events
//   {time period} : {event} : {event}
//   : {event}                 — continuation line adds another event to the last period
//   {year} / {year-range}     — a bare year (or range) opens a period with no events yet
//   {event text}              — plain text becomes an event under the current period
// ============================================================================

export function parseTimelineDiagram(lines: string[]): TimelineDiagram {
  const diagram: TimelineDiagram = { direction: 'LR', sections: [] }
  let current: TimelineSection | null = null

  const ensureSection = (name = 'default'): TimelineSection => {
    const section: TimelineSection = { name, periods: [] }
    diagram.sections.push(section)
    current = section
    return section
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd()

    // Header: timeline [LR|TD]
    if (/^timeline(?:\s|$)/i.test(line)) {
      const dir = line.match(/\bTD\b/i)
      if (dir) diagram.direction = 'TD' as TimelineDirection
      continue
    }

    // Title: title <text>
    const titleMatch = line.match(/^title\s+(.+)$/)
    if (titleMatch) {
      diagram.title = titleMatch[1]!.trim()
      continue
    }

    // Section: section <name>
    const sectionMatch = line.match(/^section\s+(.+)$/)
    if (sectionMatch) {
      ensureSection(sectionMatch[1]!.trim())
      continue
    }

    // Continuation event: ": {event}" or "    : {event}" (indented)
    const contMatch = line.match(/^\s*:\s*(.+)$/)
    if (contMatch) {
      const section = current ?? ensureSection()
      const last = section.periods[section.periods.length - 1]
      if (!last) throw new Error('Timeline event continuation requires a preceding time period')
      last.events.push(contMatch[1]!.trim())
      continue
    }

    // Period with events: "{period} : {event}" or "{period} : {e1} : {e2}"
    const periodMatch = line.match(/^(.+?)\s*:\s*(.+)$/)
    if (periodMatch) {
      const section = current ?? ensureSection()
      const label = periodMatch[1]!.trim()
      const events = periodMatch[2]!.split(':').map(e => e.trim()).filter(Boolean)
      section.periods.push({ label, events })
      continue
    }

    // Lines without colons: year or year-range lines open a new period,
    // anything else is an event under the last period (or opens the first
    // period when there is none yet). Empty lines are ignored.
    const trimmed = line.trim()
    if (trimmed.length > 0) {
      const section = current ?? ensureSection()
      if (/^\d{4}(?:\s*[–-]\s*\d{4})?$/.test(trimmed)) {
        const last = section.periods[section.periods.length - 1]
        if (!last || last.label !== trimmed) section.periods.push({ label: trimmed, events: [] })
      } else {
        const last = section.periods[section.periods.length - 1]
        if (last) last.events.push(trimmed)
        else section.periods.push({ label: trimmed, events: [] })
      }
    }
  }

  // If no explicit sections were declared, collapse to a single default section
  if (diagram.sections.length === 0) {
    diagram.sections.push({ name: 'default', periods: [] })
  }

  return diagram
}