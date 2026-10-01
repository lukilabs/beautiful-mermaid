import type { TimelineDiagram } from './types.ts'
import { EVENT_DOT_R, PERIOD_DOT_R } from './renderer.ts'
import type { PositionedTimeline } from './renderer.ts'
import type { RenderOptions } from '../types.ts'
import { estimateTextWidth, FONT_SIZES, FONT_WEIGHTS } from '../styles.ts'

// ============================================================================
// Timeline layout — direction-aware
//
// LR (default): each section is a horizontal band with a thin continuous
//     axis line. Periods are flat boxes above the axis; events are flat
//     boxes below it, joined by a dashed connector. Bands stack.
// TD: sections top→down; within a section, periods flow top→bottom along a
//     vertical axis; events are listed to the right of each period.
// ============================================================================

const TIMELINE = {
  padding: 40,
  titleGap: 44,
  sectionGap: 56,
  sectionLabelH: 24,
  /** Period box height. */
  periodBoxH: 40,
  /** Event box height (stacked with no gap for multiple events of one period). */
  eventBoxH: 38,
  /** Horizontal padding inside a box around its text. */
  boxPadX: 14,
  /** Horizontal gap between adjacent period columns. */
  colGapX: 22,
  /** Vertical gap from the period box's bottom edge down to the axis line. */
  axisGapAbove: 32,
  /** Vertical gap from the axis line down to the first event box's top edge. */
  axisGapBelow: 32,
  /** Dashed connector tail past the last box in a column. */
  tailLen: 22,
  /** Extra axis length past the last column for the arrowhead. */
  axisArrowExtra: 26,
  /** Minimum column width, even for very short labels like "2024". */
  minColW: 72,
  /** TD: horizontal offset of the axis from the left padding. */
  tdAxisOffsetX: 80,
  /** TD: gap between rows, event dot radius, label gap, row metrics. */
  tdRowGapY: 20,
  tdEventTopPad: 16,
  tdEventRowH: 22,
  tdEventDotR: EVENT_DOT_R,
  tdLabelGap: 8,
  tdMinRowH: 27,
} as const

const textW = (t: string): number => estimateTextWidth(t, FONT_SIZES.nodeLabel, FONT_WEIGHTS.nodeLabel)

export function layoutTimelineDiagram(diagram: TimelineDiagram, _options: RenderOptions = {}): PositionedTimeline {
  const hasTitle = !!diagram.title
  const titleH = hasTitle ? TIMELINE.titleGap : 0

  if (diagram.direction === 'TD') {
    let y = TIMELINE.padding + titleH
    let maxWidth = 0
    const sections = diagram.sections.map((section) => {
      const y0 = y

      // Heading-only section: no axis, just the label.
      if (section.periods.length === 0) {
        const sectionH = TIMELINE.sectionLabelH + 12
        const width = textW(section.name) + TIMELINE.padding * 2
        maxWidth = Math.max(maxWidth, width)
        y = y0 + sectionH + TIMELINE.sectionGap
        return { name: section.name, x: TIMELINE.padding, y: y0, width, height: sectionH, periods: [] }
      }

      const centerX = TIMELINE.padding + TIMELINE.tdAxisOffsetX
      let rowY = y0 + TIMELINE.sectionLabelH
      let sectionWidth = textW(section.name) + TIMELINE.padding
      const periods = section.periods.map(period => {
        const py = rowY
        const rowH = Math.max(
          TIMELINE.tdEventTopPad + period.events.length * TIMELINE.tdEventRowH,
          TIMELINE.tdMinRowH,
        )
        rowY += rowH + TIMELINE.tdRowGapY
        for (const ev of period.events) {
          sectionWidth = Math.max(sectionWidth, centerX + TIMELINE.tdLabelGap + TIMELINE.tdEventDotR + textW(ev))
        }
        sectionWidth = Math.max(sectionWidth, centerX + TIMELINE.tdLabelGap + textW(period.label))
        return {
          label: period.label,
          x: centerX,
          y: py,
          width: PERIOD_DOT_R * 2,
          height: PERIOD_DOT_R * 2,
          centerX,
          events: period.events.map((ev, ei) => ({
            text: ev,
            x: centerX + TIMELINE.tdEventDotR + TIMELINE.tdLabelGap,
            y: py + TIMELINE.tdEventTopPad + ei * TIMELINE.tdEventRowH,
            width: textW(ev),
            height: 14,
          })),
        }
      })
      const sectionH = rowY - TIMELINE.tdRowGapY - y0
      const axisY1 = y0 + TIMELINE.sectionLabelH
      const axisY2 = y0 + sectionH
      const width = sectionWidth + TIMELINE.padding
      maxWidth = Math.max(maxWidth, width)
      y = y0 + sectionH + TIMELINE.sectionGap
      return { name: section.name, x: TIMELINE.padding, y: y0, width, height: sectionH, axisX: centerX, axisY1, axisY2, periods }
    })
    return { width: maxWidth, height: y - TIMELINE.sectionGap, direction: 'TD', ...(diagram.title ? { title: { text: diagram.title, x: maxWidth / 2, y: TIMELINE.padding + 16 } } : {}), sections }
  }

  // LR: a uniform grid of flat boxes — one box per period above an
  // arrow-tipped axis, one stacked box per event below it, joined by a
  // dashed connector. Every box shares the same column width (the widest
  // label sets it) so columns line up like a grid.
  let maxContentW = 0
  for (const section of diagram.sections) {
    for (const period of section.periods) {
      maxContentW = Math.max(maxContentW, textW(period.label))
      for (const ev of period.events) maxContentW = Math.max(maxContentW, textW(ev))
    }
  }
  const colW = Math.max(TIMELINE.minColW, maxContentW + TIMELINE.boxPadX * 2)

  let y = TIMELINE.padding + titleH
  let maxWidth = 0
  const sections = diagram.sections.map((section) => {
    const y0 = y

    // Heading-only section: no axis, just the label.
    if (section.periods.length === 0) {
      const sectionH = TIMELINE.sectionLabelH + 12
      const width = textW(section.name) + TIMELINE.padding * 2
      maxWidth = Math.max(maxWidth, width)
      y += sectionH + TIMELINE.sectionGap
      return { name: section.name, x: TIMELINE.padding, y: y0, width, height: sectionH, periods: [] }
    }

    const hasLabel = section.name !== 'default'
    const periodBoxY = y0 + (hasLabel ? TIMELINE.sectionLabelH : 0)
    const axisY = periodBoxY + TIMELINE.periodBoxH + TIMELINE.axisGapAbove
    const firstEventY = axisY + TIMELINE.axisGapBelow

    let x = TIMELINE.padding
    let sectionBottom = axisY + TIMELINE.tailLen
    const periods = section.periods.map(period => {
      const boxX = x
      x += colW + TIMELINE.colGapX
      const events = period.events.map((ev, ei) => ({
        text: ev,
        x: boxX,
        y: firstEventY + ei * TIMELINE.eventBoxH,
        width: colW,
        height: TIMELINE.eventBoxH,
      }))
      const lastBottom = events.length > 0
        ? events[events.length - 1]!.y + events[events.length - 1]!.height
        : axisY
      sectionBottom = Math.max(sectionBottom, lastBottom + TIMELINE.tailLen)
      return {
        label: period.label,
        x: boxX,
        y: periodBoxY,
        width: colW,
        height: TIMELINE.periodBoxH,
        centerX: boxX + colW / 2,
        events,
      }
    })
    const axisX1 = TIMELINE.padding
    const axisX2 = x - TIMELINE.colGapX + TIMELINE.axisArrowExtra
    const width = axisX2 + TIMELINE.padding
    maxWidth = Math.max(maxWidth, width)
    const sectionH = sectionBottom - y0
    y = y0 + sectionH + TIMELINE.sectionGap
    return { name: section.name, x: TIMELINE.padding, y: y0, width, height: sectionH, axisX1, axisX2, axisY, periods }
  })

  const width = maxWidth
  const height = y - TIMELINE.sectionGap + TIMELINE.padding

  return { width, height, direction: 'LR', ...(diagram.title ? { title: { text: diagram.title, x: width / 2, y: TIMELINE.padding + 16 } } : {}), sections }
}
