import type {
  PositionedC4Diagram,
  PositionedC4Element,
  PositionedC4Relationship,
  PositionedC4Boundary,
} from './types.ts'
import type { DiagramColors } from '../theme.ts'
import { svgOpenTag, buildStyleBlock } from '../theme.ts'
import { FONT_SIZES, FONT_WEIGHTS, STROKE_WIDTHS, estimateTextWidth, TEXT_BASELINE_SHIFT } from '../styles.ts'

// ============================================================================
// C4 diagram SVG renderer
//
// Renders positioned C4 diagrams to SVG.
// All colors use CSS custom properties (var(--_xxx)) from the theme system.
//
// Render order:
//   1. Boundary boxes (dashed border, label in top-left corner)
//   2. Element boxes (rounded rect with title, technology, description)
//   3. Person shapes (rounded rect with circle head silhouette)
//   4. Relationship arrows with labels
//   5. Title (if present)
// ============================================================================

/** Font sizes specific to C4 diagrams */
const C4_FONT = {
  titleSize: 16,
  titleWeight: 700,
  labelSize: 13,
  labelWeight: 600,
  techSize: 10,
  techWeight: 400,
  descSize: 11,
  descWeight: 400,
  boundaryLabelSize: 12,
  boundaryLabelWeight: 600,
} as const

/** Person silhouette dimensions */
const PERSON = {
  headRadius: 14,
  headOffsetY: 18,
  bodyTopY: 34,
} as const

/** Arrow marker dimensions */
const ARROW = {
  width: 8,
  height: 5,
} as const

/**
 * Render a positioned C4 diagram as an SVG string.
 *
 * @param colors - DiagramColors with bg/fg and optional enrichment variables.
 * @param font - Font family for text rendering. Default: 'Inter'.
 * @param transparent - If true, renders with transparent background.
 */
export function renderC4Svg(
  diagram: PositionedC4Diagram,
  colors: DiagramColors,
  font: string = 'Inter',
  transparent: boolean = false
): string {
  const parts: string[] = []

  // SVG root with CSS variables + style block + defs
  parts.push(svgOpenTag(diagram.width, diagram.height, colors, transparent))
  parts.push(buildStyleBlock(font, false))
  parts.push(buildDefs())

  // 1. Title
  if (diagram.title) {
    parts.push(renderTitle(diagram.title, diagram.width))
  }

  // 2. Boundary boxes (behind everything else)
  for (const boundary of flattenBoundaries(diagram.boundaries)) {
    parts.push(renderBoundaryBox(boundary))
  }

  // 3. Element boxes
  for (const element of diagram.elements) {
    if (element.kind === 'Person') {
      parts.push(renderPersonBox(element))
    } else {
      parts.push(renderElementBox(element))
    }
  }

  // 4. Relationship arrows
  for (const rel of diagram.relationships) {
    parts.push(renderRelationship(rel))
  }

  parts.push('</svg>')
  return parts.join('\n')
}

// ============================================================================
// Defs — arrow markers
// ============================================================================

function buildDefs(): string {
  return [
    '<defs>',
    `  <marker id="c4-arrow" viewBox="0 0 ${ARROW.width} ${ARROW.height * 2}" ` +
    `refX="${ARROW.width}" refY="${ARROW.height}" ` +
    `markerWidth="${ARROW.width}" markerHeight="${ARROW.height * 2}" orient="auto">`,
    `    <path d="M 0 0 L ${ARROW.width} ${ARROW.height} L 0 ${ARROW.height * 2} Z" fill="var(--_arrow)" />`,
    '  </marker>',
    '</defs>',
  ].join('\n')
}

// ============================================================================
// Title rendering
// ============================================================================

function renderTitle(title: string, diagramWidth: number): string {
  const cx = diagramWidth / 2
  return (
    `<text x="${cx}" y="24" text-anchor="middle" dy="${TEXT_BASELINE_SHIFT}" ` +
    `font-size="${C4_FONT.titleSize}" font-weight="${C4_FONT.titleWeight}" ` +
    `fill="var(--_text)">${escapeXml(title)}</text>`
  )
}

// ============================================================================
// Boundary box rendering
// ============================================================================

function renderBoundaryBox(boundary: PositionedC4Boundary): string {
  const { x, y, width, height, label, kind } = boundary
  const parts: string[] = []
  const rx = 2

  // Dashed border rectangle
  parts.push(
    `<rect x="${x}" y="${y}" width="${width}" height="${height}" ` +
    `rx="${rx}" ry="${rx}" fill="none" stroke="var(--_node-stroke)" ` +
    `stroke-width="${STROKE_WIDTHS.outerBox}" stroke-dasharray="8 4" />`
  )

  // Kind label in top-left corner (e.g., "[System_Boundary]")
  const kindLabel = `[${kind.replace(/_/g, ' ')}]`
  parts.push(
    `<text x="${x + 10}" y="${y + 16}" dy="${TEXT_BASELINE_SHIFT}" ` +
    `font-size="${C4_FONT.techSize}" font-weight="${C4_FONT.techWeight}" ` +
    `font-style="italic" fill="var(--_text-muted)">${escapeXml(kindLabel)}</text>`
  )

  // Boundary label
  parts.push(
    `<text x="${x + 10}" y="${y + 30}" dy="${TEXT_BASELINE_SHIFT}" ` +
    `font-size="${C4_FONT.boundaryLabelSize}" font-weight="${C4_FONT.boundaryLabelWeight}" ` +
    `fill="var(--_text-sec)">${escapeXml(label)}</text>`
  )

  return parts.join('\n')
}

// ============================================================================
// Element box rendering
// ============================================================================

/** Render a standard C4 element box (System, Container, Component, etc.) */
function renderElementBox(element: PositionedC4Element): string {
  const { x, y, width, height, label, technology, description, external } = element
  const parts: string[] = []
  const rx = 6
  const fill = external ? 'var(--_text-muted)' : 'var(--_node-fill)'
  const stroke = 'var(--_node-stroke)'

  // Background rounded rectangle
  parts.push(
    `<rect x="${x}" y="${y}" width="${width}" height="${height}" ` +
    `rx="${rx}" ry="${rx}" fill="${fill}" stroke="${stroke}" ` +
    `stroke-width="${STROKE_WIDTHS.outerBox}" />`
  )

  // Calculate text positions — vertically center all text lines
  const cx = x + width / 2
  const lines = buildTextLines(label, technology, description)
  const totalTextHeight = lines.length * 18
  let textY = y + (height - totalTextHeight) / 2 + 12

  for (const line of lines) {
    parts.push(
      `<text x="${cx}" y="${textY}" text-anchor="middle" dy="${TEXT_BASELINE_SHIFT}" ` +
      `font-size="${line.fontSize}" font-weight="${line.fontWeight}" ` +
      `${line.italic ? 'font-style="italic" ' : ''}` +
      `fill="${line.color}">${escapeXml(line.text)}</text>`
    )
    textY += 18
  }

  return parts.join('\n')
}

/** Render a Person element with a circle head silhouette above the box */
function renderPersonBox(element: PositionedC4Element): string {
  const { x, y, width, height, label, description, external } = element
  const parts: string[] = []
  const cx = x + width / 2
  const fill = external ? 'var(--_text-muted)' : 'var(--_node-fill)'
  const stroke = 'var(--_node-stroke)'

  // Circle head
  parts.push(
    `<circle cx="${cx}" cy="${y + PERSON.headOffsetY}" r="${PERSON.headRadius}" ` +
    `fill="${fill}" stroke="${stroke}" stroke-width="${STROKE_WIDTHS.outerBox}" />`
  )

  // Body rectangle (below the head)
  const bodyY = y + PERSON.bodyTopY
  const bodyHeight = height - PERSON.bodyTopY
  const rx = 6

  parts.push(
    `<rect x="${x}" y="${bodyY}" width="${width}" height="${bodyHeight}" ` +
    `rx="${rx}" ry="${rx}" fill="${fill}" stroke="${stroke}" ` +
    `stroke-width="${STROKE_WIDTHS.outerBox}" />`
  )

  // Text lines inside the body
  const lines = buildTextLines(label, undefined, description)
  const totalTextHeight = lines.length * 18
  let textY = bodyY + (bodyHeight - totalTextHeight) / 2 + 12

  for (const line of lines) {
    parts.push(
      `<text x="${cx}" y="${textY}" text-anchor="middle" dy="${TEXT_BASELINE_SHIFT}" ` +
      `font-size="${line.fontSize}" font-weight="${line.fontWeight}" ` +
      `${line.italic ? 'font-style="italic" ' : ''}` +
      `fill="${line.color}">${escapeXml(line.text)}</text>`
    )
    textY += 18
  }

  return parts.join('\n')
}

// ============================================================================
// Text line helpers
// ============================================================================

interface TextLine {
  text: string
  fontSize: number
  fontWeight: number
  italic: boolean
  color: string
}

/** Build the array of text lines for a C4 element */
function buildTextLines(
  label: string,
  technology: string | undefined,
  description: string | undefined,
): TextLine[] {
  const lines: TextLine[] = []

  // Label (bold, primary color)
  lines.push({
    text: label,
    fontSize: C4_FONT.labelSize,
    fontWeight: C4_FONT.labelWeight,
    italic: false,
    color: 'var(--_text)',
  })

  // Technology in brackets (italic, muted)
  if (technology) {
    lines.push({
      text: `[${technology}]`,
      fontSize: C4_FONT.techSize,
      fontWeight: C4_FONT.techWeight,
      italic: true,
      color: 'var(--_text-muted)',
    })
  }

  // Description (normal, secondary color)
  if (description) {
    lines.push({
      text: description,
      fontSize: C4_FONT.descSize,
      fontWeight: C4_FONT.descWeight,
      italic: false,
      color: 'var(--_text-sec)',
    })
  }

  return lines
}

// ============================================================================
// Relationship rendering
// ============================================================================

function renderRelationship(rel: PositionedC4Relationship): string {
  if (rel.points.length < 2) return ''
  const parts: string[] = []

  // Polyline path with arrow marker
  const pathData = rel.points.map(p => `${p.x},${p.y}`).join(' ')
  parts.push(
    `<polyline points="${pathData}" fill="none" stroke="var(--_line)" ` +
    `stroke-width="${STROKE_WIDTHS.connector}" marker-end="url(#c4-arrow)" />`
  )

  // Label at midpoint
  const mid = midpoint(rel.points)
  const labelText = rel.technology ? `${rel.label}` : rel.label
  const techText = rel.technology ? `[${rel.technology}]` : ''

  // Background pill for readability
  const fullLabel = techText ? `${labelText} ${techText}` : labelText
  const textWidth = estimateTextWidth(fullLabel, FONT_SIZES.edgeLabel, FONT_WEIGHTS.edgeLabel)
  const bgW = textWidth + 12
  const bgH = techText ? 28 : 18

  parts.push(
    `<rect x="${mid.x - bgW / 2}" y="${mid.y - bgH / 2}" width="${bgW}" height="${bgH}" ` +
    `rx="2" ry="2" fill="var(--bg)" stroke="var(--_inner-stroke)" stroke-width="0.5" />`
  )

  // Label text
  if (techText) {
    // Two lines: label above, technology below
    parts.push(
      `<text x="${mid.x}" y="${mid.y - 5}" text-anchor="middle" dy="${TEXT_BASELINE_SHIFT}" ` +
      `font-size="${FONT_SIZES.edgeLabel}" font-weight="${FONT_WEIGHTS.edgeLabel}" ` +
      `fill="var(--_text-muted)">${escapeXml(labelText)}</text>`
    )
    parts.push(
      `<text x="${mid.x}" y="${mid.y + 8}" text-anchor="middle" dy="${TEXT_BASELINE_SHIFT}" ` +
      `font-size="${C4_FONT.techSize}" font-weight="${C4_FONT.techWeight}" ` +
      `font-style="italic" fill="var(--_text-faint)">${escapeXml(techText)}</text>`
    )
  } else {
    parts.push(
      `<text x="${mid.x}" y="${mid.y}" text-anchor="middle" dy="${TEXT_BASELINE_SHIFT}" ` +
      `font-size="${FONT_SIZES.edgeLabel}" font-weight="${FONT_WEIGHTS.edgeLabel}" ` +
      `fill="var(--_text-muted)">${escapeXml(labelText)}</text>`
    )
  }

  return parts.join('\n')
}

// ============================================================================
// Utilities
// ============================================================================

/** Compute the arc-length midpoint of a polyline path. */
function midpoint(points: Array<{ x: number; y: number }>): { x: number; y: number } {
  if (points.length === 0) return { x: 0, y: 0 }
  if (points.length === 1) return points[0]!

  let totalLen = 0
  for (let i = 1; i < points.length; i++) {
    const dx = points[i]!.x - points[i - 1]!.x
    const dy = points[i]!.y - points[i - 1]!.y
    totalLen += Math.sqrt(dx * dx + dy * dy)
  }

  if (totalLen === 0) return points[0]!

  const halfLen = totalLen / 2
  let walked = 0
  for (let i = 1; i < points.length; i++) {
    const dx = points[i]!.x - points[i - 1]!.x
    const dy = points[i]!.y - points[i - 1]!.y
    const segLen = Math.sqrt(dx * dx + dy * dy)
    if (walked + segLen >= halfLen) {
      const t = segLen > 0 ? (halfLen - walked) / segLen : 0
      return {
        x: points[i - 1]!.x + dx * t,
        y: points[i - 1]!.y + dy * t,
      }
    }
    walked += segLen
  }

  return points[points.length - 1]!
}

/** Flatten nested boundaries into a single array for rendering */
function flattenBoundaries(boundaries: PositionedC4Boundary[]): PositionedC4Boundary[] {
  const result: PositionedC4Boundary[] = []
  for (const b of boundaries) {
    result.push(b)
    result.push(...flattenBoundaries(b.children))
  }
  return result
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
