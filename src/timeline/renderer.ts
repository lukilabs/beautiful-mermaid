import type { PositionedTimelineDiagram, PositionedTimelineSection, PositionedTimelinePeriod, PositionedTimelineEvent } from './types.ts'
import type { DiagramColors } from '../theme.ts'
import { svgOpenTag, buildStyleBlock } from '../theme.ts'
import { renderMultilineText, escapeXml } from '../multiline-utils.ts'

// ============================================================================
// Timeline diagram SVG renderer
//
// Visual language:
//   - crisp section frames aligned with the rest of beautiful-mermaid
//   - a single horizontal rail
//   - period pills above the rail
//   - stacked event cards below with a subtle accent strip
//   - color families grouped by section (or by period when unsectioned)
// ============================================================================

const TL = {
  titleFontSize: 18,
  titleFontWeight: 600,
  sectionFontSize: 12,
  sectionFontWeight: 600,
  pillFontSize: 12,
  pillFontWeight: 600,
  eventFontSize: 12,
  eventFontWeight: 400,
  markerOuterRadius: 8,
  markerInnerRadius: 4.5,
  eventAccentWidth: 4,
} as const

interface TimelineFamilyPalette {
  accent: string
  fill: string
  label: string
  line: string
}

const TL_THEME_FAMILY_ACCENTS = [
  'var(--_arrow)',
  mix('var(--_arrow)', 'var(--_line)', 72),
  mix('var(--_arrow)', 'var(--_text-sec)', 60),
  mix('var(--_line)', 'var(--_text)', 56),
  mix('var(--_arrow)', 'var(--_node-stroke)', 46),
] as const

const TL_DEFAULT_FAMILY_ACCENTS = [
  '#5B7FFF',
  '#159A72',
  '#D18A24',
  '#CC5A5A',
  '#6B7280',
] as const

/**
 * Render a positioned timeline diagram as an SVG string.
 */
export function renderTimelineSvg(
  diagram: PositionedTimelineDiagram,
  colors: DiagramColors,
  font: string = 'Inter',
  transparent: boolean = false,
): string {
  const parts: string[] = []
  const useSectionFamilies = diagram.sections.some(section => Boolean(section.label))
  const accessibleTitle = diagram.accessibilityTitle ?? diagram.title?.text.replace(/\n+/g, ' ')
  const accessibleDescription = diagram.accessibilityDescription
  const familyPalettes = getTimelineFamilyPalettes(colors)
  const uid = `tl-${hashTimeline(diagram)}`
  const titleId = `${uid}-title`
  const descId = `${uid}-desc`
  const rootAttrs = buildAccessibilityAttrs(accessibleTitle, accessibleDescription, titleId, descId)

  parts.push(withRootAttrs(svgOpenTag(diagram.width, diagram.height, colors, transparent), rootAttrs))
  parts.push(buildStyleBlock(font, false))
  parts.push(timelineStyles())

  if (accessibleTitle) {
    parts.push(`<title id="${titleId}">${escapeXml(accessibleTitle)}</title>`)
  }
  if (accessibleDescription) {
    parts.push(`<desc id="${descId}">${escapeXml(accessibleDescription)}</desc>`)
  }

  for (let sectionIndex = 0; sectionIndex < diagram.sections.length; sectionIndex++) {
    const section = diagram.sections[sectionIndex]!
    const familyIndex = useSectionFamilies ? sectionIndex : 0
    if (section.framed) {
      parts.push(renderSectionFrame(section, familyIndex, familyPalettes))
    }
  }

  parts.push(
    `<line class="timeline-rail" x1="${diagram.rail.x1}" y1="${diagram.rail.y}" x2="${diagram.rail.x2}" y2="${diagram.rail.y}" />`
  )

  let periodFamilyIndex = 0
  for (let sectionIndex = 0; sectionIndex < diagram.sections.length; sectionIndex++) {
    const section = diagram.sections[sectionIndex]!
    const sectionFamilyIndex = useSectionFamilies ? sectionIndex : undefined
    for (const period of section.periods) {
      const familyIndex = sectionFamilyIndex ?? periodFamilyIndex++
      parts.push(renderPeriod(period, section.label, familyIndex, familyPalettes))
    }
  }

  if (diagram.title) {
    parts.push(
      renderMultilineText(
        diagram.title.text,
        diagram.title.x,
        diagram.title.y,
        TL.titleFontSize,
        `class="timeline-title" text-anchor="middle" font-size="${TL.titleFontSize}" font-weight="${TL.titleFontWeight}"`,
      )
    )
  }

  parts.push('</svg>')
  return parts.join('\n')
}

function timelineStyles(): string {
  return `<style>
  .timeline-title { fill: var(--_text); }
  .timeline-rail { stroke: var(--_line); stroke-width: 1.5; stroke-linecap: round; }
  .timeline-section-bg { fill: var(--tl-section-bg, color-mix(in srgb, var(--_node-fill) 88%, var(--bg))); stroke: var(--tl-line, var(--_node-stroke)); stroke-width: 1; }
  .timeline-section-band { fill: var(--tl-section-band, color-mix(in srgb, var(--_arrow) 8%, var(--bg))); stroke: var(--tl-line, var(--_node-stroke)); stroke-width: 1; }
  .timeline-section-label { fill: var(--tl-label, var(--_text-sec)); }
  .timeline-stem { stroke: var(--tl-line, color-mix(in srgb, var(--_arrow) 32%, var(--_line))); stroke-width: 1; stroke-dasharray: 3 4; }
  .timeline-marker-ring { fill: var(--bg); stroke: var(--tl-line, var(--_arrow)); stroke-width: 1.5; }
  .timeline-marker-core { fill: var(--tl-accent, var(--_arrow)); }
  .timeline-period-pill { fill: var(--tl-pill-fill, color-mix(in srgb, var(--_arrow) 7%, var(--bg))); stroke: var(--tl-pill-stroke, color-mix(in srgb, var(--_arrow) 20%, var(--bg))); stroke-width: 1; }
  .timeline-period-text { fill: var(--tl-label, var(--_text)); }
  .timeline-event-card { fill: var(--tl-event-fill, var(--_node-fill)); stroke: var(--tl-line, var(--_node-stroke)); stroke-width: 1; }
  .timeline-event-accent { fill: var(--tl-event-accent, color-mix(in srgb, var(--_arrow) 18%, var(--bg))); }
  .timeline-event-text { fill: var(--tl-label, var(--_text-muted)); }
</style>`
}

function renderSectionFrame(
  section: PositionedTimelineSection,
  familyIndex: number,
  familyPalettes: readonly TimelineFamilyPalette[],
): string {
  const parts: string[] = []
  const labelAttr = section.label ? ` data-label="${escapeAttr(section.label)}"` : ''
  const familyAttr = renderFamilyAttr(familyIndex, familyPalettes)
  parts.push(`<g class="timeline-section" data-id="${escapeAttr(section.id)}"${labelAttr}${familyAttr}>`)
  parts.push(
    `  <rect class="timeline-section-bg" x="${section.x}" y="${section.y}" width="${section.width}" height="${section.height}" rx="0" ry="0" />`
  )

  if (section.headerHeight > 0) {
    parts.push(
      `  <rect class="timeline-section-band" x="${section.x}" y="${section.y}" width="${section.width}" height="${section.headerHeight}" rx="0" ry="0" />`
    )
    if (section.label) {
      parts.push(
        '  ' + renderMultilineText(
          section.label,
          section.x + 12,
          section.y + section.headerHeight / 2,
          TL.sectionFontSize,
          `class="timeline-section-label" text-anchor="start" font-size="${TL.sectionFontSize}" font-weight="${TL.sectionFontWeight}"`,
        )
      )
    }
  }

  parts.push('</g>')
  return parts.join('\n')
}

function renderPeriod(
  period: PositionedTimelinePeriod,
  sectionLabel: string | undefined,
  familyIndex: number,
  familyPalettes: readonly TimelineFamilyPalette[],
): string {
  const parts: string[] = []
  const sectionAttr = sectionLabel ? ` data-section="${escapeAttr(sectionLabel)}"` : ''
  const familyAttr = renderFamilyAttr(familyIndex, familyPalettes)

  parts.push(
    `<g class="timeline-period" data-id="${escapeAttr(period.id)}" data-label="${escapeAttr(period.label)}"${sectionAttr}${familyAttr}>`
  )
  parts.push(
    `  <line class="timeline-stem" x1="${period.centerX}" y1="${period.stemTopY}" x2="${period.centerX}" y2="${period.stemBottomY}" />`
  )
  parts.push(
    `  <rect class="timeline-period-pill" x="${period.pillX}" y="${period.pillY}" width="${period.pillWidth}" height="${period.pillHeight}" rx="0" ry="0" />`
  )
  parts.push(
    '  ' + renderMultilineText(
      period.label,
      period.centerX,
      period.pillY + period.pillHeight / 2,
      TL.pillFontSize,
      `class="timeline-period-text" text-anchor="middle" font-size="${TL.pillFontSize}" font-weight="${TL.pillFontWeight}"`,
    )
  )
  parts.push(
    `  <circle class="timeline-marker-ring" cx="${period.centerX}" cy="${period.markerY}" r="${TL.markerOuterRadius}" />`
  )
  parts.push(
    `  <circle class="timeline-marker-core" cx="${period.centerX}" cy="${period.markerY}" r="${TL.markerInnerRadius}" />`
  )

  for (const event of period.events) {
    parts.push(renderEvent(event, sectionLabel, familyIndex, familyPalettes))
  }

  parts.push('</g>')
  return parts.join('\n')
}

function renderEvent(
  event: PositionedTimelineEvent,
  sectionLabel: string | undefined,
  familyIndex: number,
  familyPalettes: readonly TimelineFamilyPalette[],
): string {
  const sectionAttr = sectionLabel ? ` data-section="${escapeAttr(sectionLabel)}"` : ''
  const familyAttr = ` data-family="${familyIndex % familyPalettes.length}"`

  return [
    `<g class="timeline-event" data-id="${escapeAttr(event.id)}" data-period="${escapeAttr(event.periodLabel)}"${sectionAttr}${familyAttr}>`,
    `  <rect class="timeline-event-card" x="${event.x}" y="${event.y}" width="${event.width}" height="${event.height}" rx="0" ry="0" />`,
    `  <rect class="timeline-event-accent" x="${event.x}" y="${event.y}" width="${TL.eventAccentWidth}" height="${event.height}" rx="0" ry="0" />`,
    '  ' + renderMultilineText(
      event.text,
      event.x + TL.eventAccentWidth + 12,
      event.y + event.height / 2,
      TL.eventFontSize,
      `class="timeline-event-text" text-anchor="start" font-size="${TL.eventFontSize}" font-weight="${TL.eventFontWeight}"`,
    ),
    '</g>',
].join('\n')
}

function renderFamilyAttr(familyIndex: number, familyPalettes: readonly TimelineFamilyPalette[]): string {
  const family = familyIndex % familyPalettes.length
  const palette = familyPalettes[family]!
  const style = [
    `--tl-accent:${palette.accent}`,
    `--tl-fill:${palette.fill}`,
    `--tl-label:${palette.label}`,
    `--tl-line:${palette.line}`,
    `--tl-section-bg:${mix(palette.fill, 'var(--bg)', 6)}`,
    `--tl-section-band:${mix(palette.fill, 'var(--bg)', 12)}`,
    `--tl-pill-fill:${mix(palette.fill, 'var(--bg)', 11)}`,
    `--tl-pill-stroke:${mix(palette.fill, palette.line, 36)}`,
    `--tl-event-fill:${mix(palette.fill, 'var(--_node-fill)', 16)}`,
    `--tl-event-accent:${mix(palette.fill, 'var(--bg)', 26)}`,
  ].join(';')

  return ` data-family="${family}" style="${escapeAttr(style)}"`
}

function getTimelineFamilyPalettes(
  colors: DiagramColors,
): readonly TimelineFamilyPalette[] {
  const hasThemeEnrichment = Boolean(
    colors.accent ||
    colors.line ||
    colors.muted ||
    colors.surface ||
    colors.border
  )

  return Array.from({ length: 12 }, (_, index) => {
    const defaultFill = hasThemeEnrichment
      ? TL_THEME_FAMILY_ACCENTS[index % TL_THEME_FAMILY_ACCENTS.length]!
      : TL_DEFAULT_FAMILY_ACCENTS[index % TL_DEFAULT_FAMILY_ACCENTS.length]!
    const fill = defaultFill
    const label = 'var(--_text)'
    const line = mix(fill, 'var(--_line)', 48)

    return { accent: fill, fill, label, line }
  })
}

function mix(primary: string, secondary: string, amount: number): string {
  return `color-mix(in srgb, ${primary} ${amount}%, ${secondary})`
}

function withRootAttrs(svgTag: string, attrs: Record<string, string>): string {
  const attrText = Object.entries(attrs)
    .map(([key, value]) => ` ${key}="${escapeAttr(value)}"`)
    .join('')
  return svgTag.replace(/>$/, `${attrText}>`)
}

function buildAccessibilityAttrs(
  title: string | undefined,
  description: string | undefined,
  titleId: string,
  descId: string,
): Record<string, string> {
  if (!title && !description) return {}

  const attrs: Record<string, string> = { role: 'img' }
  if (title) attrs['aria-labelledby'] = titleId
  if (description) attrs['aria-describedby'] = descId
  return attrs
}

function hashTimeline(diagram: { width: number; height: number; sections: Array<{ periods: unknown[] }> }): string {
  let h = 0x811c9dc5
  const s = `${diagram.width}|${diagram.height}|${diagram.sections.map(s => s.periods.length).join(',')}`
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(36)
}

function escapeAttr(text: string): string {
  return escapeXml(text)
}
