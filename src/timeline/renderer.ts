import type { DiagramColors } from '../theme.ts'
import { svgOpenTag, buildStyleBlock } from '../theme.ts'
import { escapeXml } from '../multiline-utils.ts'
import { TEXT_BASELINE_SHIFT, FONT_SIZES, FONT_WEIGHTS, STROKE_WIDTHS } from '../styles.ts'

// ============================================================================
// Timeline — SVG renderer
//
// Flat like the rest of the blocks: boxes use var(--_node-fill) /
// var(--_node-stroke) with var(--_text) labels, connectors use var(--_line),
// and only the small TD dots use the single accent (same as quadrant
// points). No per-section solid fills, no contrast-text computation.
// ============================================================================

export interface PositionedTimelineEvent { text: string; x: number; y: number; width: number; height: number }
export interface PositionedTimelinePeriod {
  label: string
  /** Box left x (LR) or dot center x (TD). */
  x: number
  /** Box top y (LR) or dot center y (TD). */
  y: number
  width: number
  height: number
  /** Box center (LR) or dot/spine column (TD). */
  centerX: number
  events: PositionedTimelineEvent[]
}
export interface PositionedTimelineSection {
  name: string
  x: number
  y: number
  width: number
  height: number
  /** LR: horizontal axis below the period boxes. */
  axisX1?: number
  axisX2?: number
  axisY?: number
  /** TD: vertical axis through the period rows. */
  axisX?: number
  axisY1?: number
  axisY2?: number
  periods: PositionedTimelinePeriod[]
}
export interface PositionedTimeline {
  width: number
  height: number
  direction: 'LR' | 'TD'
  title?: { text: string; x: number; y: number }
  sections: PositionedTimelineSection[]
}

const r = (n: number): string => String(Math.round(n * 10) / 10)

export const PERIOD_DOT_R = 4.5
export const EVENT_DOT_R = 3

export function renderTimelineSvg(
  positioned: PositionedTimeline,
  colors: DiagramColors,
  font: string = 'Inter',
  transparent: boolean = false,
): string {
  const { width, height } = positioned
  const parts: string[] = []

  parts.push(svgOpenTag(width, height, colors, transparent))
  parts.push(buildStyleBlock(font, false))
  parts.push(
    `<defs><marker id="timeline-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">` +
    `<path d="M0,0 L8,4 L0,8 Z" fill="var(--_line)"/></marker></defs>`
  )

  parts.push(`<style>
  .timeline-axis-line { stroke: var(--_line); stroke-width: 1.5; stroke-linecap: round; }
  .timeline-connector { stroke: var(--_line); stroke-width: 1; stroke-dasharray: 3 3; fill: none; }
  .timeline-box { fill: var(--_node-fill); stroke: var(--_node-stroke); stroke-width: ${STROKE_WIDTHS.innerBox}; }
  .timeline-box-label { fill: var(--_text); font-weight: 600; }
  .timeline-event-label { fill: var(--_text); font-weight: 500; }
  .timeline-period-dot { fill: var(--accent, color-mix(in srgb, var(--fg) 85%, var(--bg))); stroke: var(--bg); stroke-width: 2; }
  .timeline-event-dot { fill: var(--accent, color-mix(in srgb, var(--fg) 85%, var(--bg))); stroke: var(--bg); stroke-width: 1.5; }
  .timeline-period-label { fill: var(--_text); }
  .timeline-event-label-side { fill: var(--_text-sec); }
  .timeline-spine { stroke: var(--_line); stroke-width: 1; stroke-dasharray: 3 3; }
  .timeline-section-label { fill: var(--_text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
  .timeline-title { fill: var(--_text); }
</style>`)

  if (positioned.title) {
    parts.push(
      `<text x="${r(positioned.title.x)}" y="${r(positioned.title.y)}" text-anchor="middle" ` +
      `font-size="18" font-weight="600" dy="${TEXT_BASELINE_SHIFT}" class="timeline-title">${escapeXml(positioned.title.text)}</text>`
    )
  }

  for (const section of positioned.sections) {
    // Section label — hidden for the implicit default section (periods with
    // no explicit `section` line), matching mermaid.
    if (section.name !== 'default') {
      parts.push(
        `<text x="${r(section.x)}" y="${r(section.y + 16)}" text-anchor="start" ` +
        `font-size="${FONT_SIZES.groupHeader}" font-weight="${FONT_WEIGHTS.groupHeader}" ` +
        `dy="${TEXT_BASELINE_SHIFT}" class="timeline-section-label">${escapeXml(section.name)}</text>`
      )
    }

    if (positioned.direction === 'LR') {
      const { axisX1, axisX2, axisY } = section
      if (axisX1 === undefined || axisX2 === undefined || axisY === undefined) continue
      parts.push(
        `<line x1="${r(axisX1)}" y1="${r(axisY)}" x2="${r(axisX2)}" y2="${r(axisY)}" ` +
        `class="timeline-axis-line" marker-end="url(#timeline-arrow)"/>`
      )

      for (const period of section.periods) {
        // Dashed connector, drawn BEFORE the boxes so they occlude it where
        // they overlap — dashes show only in the gaps.
        const lastEvent = period.events[period.events.length - 1]
        const throughY = lastEvent ? lastEvent.y + lastEvent.height : axisY
        // Keep in sync with TIMELINE.tailLen in layout.ts.
        const connectorBottom = throughY + 22
        parts.push(
          `<line x1="${r(period.centerX)}" y1="${r(period.y)}" x2="${r(period.centerX)}" y2="${r(connectorBottom)}" ` +
          `class="timeline-connector" marker-end="url(#timeline-arrow)"/>`
        )

        parts.push(`<rect x="${r(period.x)}" y="${r(period.y)}" width="${r(period.width)}" height="${r(period.height)}" rx="0" class="timeline-box"/>`)
        parts.push(
          `<text x="${r(period.centerX)}" y="${r(period.y + period.height / 2)}" text-anchor="middle" ` +
          `font-size="${FONT_SIZES.nodeLabel}" dy="${TEXT_BASELINE_SHIFT}" class="timeline-box-label">${escapeXml(period.label)}</text>`
        )

        for (const ev of period.events) {
          parts.push(`<rect x="${r(ev.x)}" y="${r(ev.y)}" width="${r(ev.width)}" height="${r(ev.height)}" rx="0" class="timeline-box"/>`)
          parts.push(
            `<text x="${r(period.centerX)}" y="${r(ev.y + ev.height / 2)}" text-anchor="middle" ` +
            `font-size="${FONT_SIZES.nodeLabel}" dy="${TEXT_BASELINE_SHIFT}" class="timeline-event-label">${escapeXml(ev.text)}</text>`
          )
        }
      }
      continue
    }

    // TD: dot-based rendering.
    const { axisX, axisY1, axisY2 } = section
    if (axisX === undefined || axisY1 === undefined || axisY2 === undefined) continue
    parts.push(
      `<line x1="${r(axisX)}" y1="${r(axisY1)}" x2="${r(axisX)}" y2="${r(axisY2)}" ` +
      `class="timeline-axis-line"/>`
    )
    for (const period of section.periods) {
      parts.push(
        `<circle cx="${r(axisX)}" cy="${r(period.y)}" r="${PERIOD_DOT_R}" ` +
        `class="timeline-period-dot"/>`
      )
      parts.push(
        `<text x="${r(axisX + PERIOD_DOT_R + 8)}" y="${r(period.y)}" text-anchor="start" ` +
        `font-size="${FONT_SIZES.nodeLabel}" font-weight="${FONT_WEIGHTS.nodeLabel}" ` +
        `dy="${TEXT_BASELINE_SHIFT}" class="timeline-period-label">${escapeXml(period.label)}</text>`
      )

      if (period.events.length > 0) {
        parts.push(
          `<line x1="${r(axisX + PERIOD_DOT_R)}" y1="${r(period.y)}" ` +
          `x2="${r(axisX + PERIOD_DOT_R + 12)}" y2="${r(period.y)}" ` +
          `class="timeline-spine"/>`
        )
        for (const ev of period.events) {
          parts.push(
            `<circle cx="${r(axisX + PERIOD_DOT_R + 12)}" cy="${r(ev.y)}" r="${EVENT_DOT_R}" ` +
            `class="timeline-event-dot"/>`
          )
          parts.push(
            `<text x="${r(ev.x)}" y="${r(ev.y)}" text-anchor="start" ` +
            `font-size="${FONT_SIZES.edgeLabel}" font-weight="${FONT_WEIGHTS.edgeLabel}" ` +
            `dy="${TEXT_BASELINE_SHIFT}" class="timeline-event-label-side">${escapeXml(ev.text)}</text>`
          )
        }
      }
    }
  }

  parts.push('</svg>')
  return parts.join('\n')
}
