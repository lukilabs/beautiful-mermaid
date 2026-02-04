import type { PositionedErDiagram, PositionedErEntity, PositionedErRelationship, ErAttribute, Cardinality } from './types.ts'
import type { DiagramColors, ResolvedColors } from '../theme.ts'
import { svgOpenTag, buildStyleBlock, svgOpenTagStatic, buildStaticStyleBlock, createColorFn } from '../theme.ts'
import { FONT_SIZES, FONT_WEIGHTS, STROKE_WIDTHS, estimateTextWidth, TEXT_BASELINE_SHIFT } from '../styles.ts'

// ============================================================================
// ER diagram SVG renderer
//
// Renders positioned ER diagrams to SVG.
// All colors use CSS custom properties (var(--_xxx)) from the theme system.
//
// Render order:
//   1. Relationship lines (behind boxes)
//   2. Entity boxes (header + attribute rows)
//   3. Cardinality markers (crow's foot notation)
//   4. Relationship labels
// ============================================================================

/** Font sizes specific to ER diagrams */
const ER_FONT = {
  attrSize: 11,
  attrWeight: 400,
  keySize: 9,
  keyWeight: 600,
} as const

/**
 * Render a positioned ER diagram as an SVG string.
 *
 * @param colors - DiagramColors with bg/fg and optional enrichment variables.
 * @param transparent - If true, renders with transparent background.
 */
/** Color accessor function type */
type ColorFn = ReturnType<typeof createColorFn>

export function renderErSvg(
  diagram: PositionedErDiagram,
  colors: DiagramColors,
  font: string = 'Inter',
  transparent: boolean = false,
  resolved: ResolvedColors | null = null,
  noStyleBlock: boolean = false,
  markerId: string = ''
): string {
  const parts: string[] = []
  const c = createColorFn(resolved)

  // SVG root with CSS variables + style block (with mono font) + defs
  if (resolved) {
    parts.push(svgOpenTagStatic(diagram.width, diagram.height, resolved.bg, transparent, font, noStyleBlock))
    parts.push(buildStaticStyleBlock(font, true, noStyleBlock))
  } else {
    parts.push(svgOpenTag(diagram.width, diagram.height, colors, transparent))
    parts.push(buildStyleBlock(font, true))
  }
  parts.push('<defs>')
  parts.push('</defs>') // No marker defs — we draw crow's foot inline

  // 1. Relationship lines
  for (const rel of diagram.relationships) {
    parts.push(renderRelationshipLine(rel, c))
  }

  // 2. Entity boxes
  for (const entity of diagram.entities) {
    parts.push(renderEntityBox(entity, c, noStyleBlock))
  }

  // 3. Cardinality markers at relationship endpoints
  for (const rel of diagram.relationships) {
    parts.push(renderCardinality(rel, c))
  }

  // 4. Relationship labels
  for (const rel of diagram.relationships) {
    parts.push(renderRelationshipLabel(rel, c))
  }

  parts.push('</svg>')
  return parts.join('\n')
}

// ============================================================================
// Entity box rendering
// ============================================================================

/** Render an entity box with header and attribute rows */
function renderEntityBox(entity: PositionedErEntity, c: ColorFn, noStyleBlock: boolean = false): string {
  const { x, y, width, height, headerHeight, rowHeight, label, attributes } = entity
  const parts: string[] = []

  // Outer rectangle
  parts.push(
    `<rect x="${x}" y="${y}" width="${width}" height="${height}" ` +
    `rx="0" ry="0" fill="${c('_node-fill')}" stroke="${c('_node-stroke')}" stroke-width="${STROKE_WIDTHS.outerBox}" />`
  )

  // Header background
  parts.push(
    `<rect x="${x}" y="${y}" width="${width}" height="${headerHeight}" ` +
    `rx="0" ry="0" fill="${c('_group-hdr')}" stroke="${c('_node-stroke')}" stroke-width="${STROKE_WIDTHS.outerBox}" />`
  )

  // Entity name
  parts.push(
    `<text x="${x + width / 2}" y="${y + headerHeight / 2}" text-anchor="middle" dy="${TEXT_BASELINE_SHIFT}" ` +
    `font-size="${FONT_SIZES.nodeLabel}" font-weight="700" fill="${c('_text')}">${escapeXml(label)}</text>`
  )

  // Divider
  const attrTop = y + headerHeight
  parts.push(
    `<line x1="${x}" y1="${attrTop}" x2="${x + width}" y2="${attrTop}" ` +
    `stroke="${c('_node-stroke')}" stroke-width="${STROKE_WIDTHS.innerBox}" />`
  )

  // Attribute rows
  for (let i = 0; i < attributes.length; i++) {
    const attr = attributes[i]!
    const rowY = attrTop + i * rowHeight + rowHeight / 2
    parts.push(renderAttribute(attr, x, rowY, width, c, noStyleBlock))
  }

  // Empty row placeholder when no attributes
  if (attributes.length === 0) {
    parts.push(
      `<text x="${x + width / 2}" y="${attrTop + rowHeight / 2}" text-anchor="middle" dy="${TEXT_BASELINE_SHIFT}" ` +
      `font-size="${ER_FONT.attrSize}" fill="${c('_text-faint')}" font-style="italic">(no attributes)</text>`
    )
  }

  return parts.join('\n')
}

/**
 * Render a single attribute row with monospace syntax highlighting.
 * Layout: [PK badge]  type  name  (left-aligned in mono, name right-aligned)
 * Uses <tspan> elements for per-part coloring, matching the class diagram style.
 *
 * Key badge uses var(--_key-badge) for background tint.
 */
function renderAttribute(attr: ErAttribute, boxX: number, y: number, boxWidth: number, c: ColorFn, noStyleBlock: boolean = false): string {
  const parts: string[] = []
  const monoFont = noStyleBlock ? ` font-family="'JetBrains Mono','SF Mono','Fira Code',ui-monospace,monospace"` : ''

  // Key badges on the left (keep proportional font — they're visual tags, not code)
  let keyWidth = 0
  if (attr.keys.length > 0) {
    const keyText = attr.keys.join(',')
    keyWidth = estimateTextWidth(keyText, ER_FONT.keySize, ER_FONT.keyWeight) + 8
    parts.push(
      `<rect x="${boxX + 6}" y="${y - 7}" width="${keyWidth}" height="14" rx="2" ry="2" ` +
      `fill="${c('_key-badge')}" />`
    )
    parts.push(
      `<text x="${boxX + 6 + keyWidth / 2}" y="${y}" text-anchor="middle" dy="${TEXT_BASELINE_SHIFT}" ` +
      `font-size="${ER_FONT.keySize}" font-weight="${ER_FONT.keyWeight}" fill="${c('_text-sec')}">${attr.keys.join(',')}</text>`
    )
  }

  // Type (left-aligned after keys, monospace with syntax highlighting)
  const typeX = boxX + 8 + (keyWidth > 0 ? keyWidth + 6 : 0)
  parts.push(
    `<text x="${typeX}" y="${y}" class="mono"${monoFont} dy="${TEXT_BASELINE_SHIFT}" ` +
    `font-size="${ER_FONT.attrSize}" font-weight="${ER_FONT.attrWeight}">` +
    `<tspan fill="${c('_text-muted')}">${escapeXml(attr.type)}</tspan></text>`
  )

  // Name (right-aligned, monospace with syntax highlighting)
  const nameX = boxX + boxWidth - 8
  parts.push(
    `<text x="${nameX}" y="${y}" class="mono"${monoFont} text-anchor="end" dy="${TEXT_BASELINE_SHIFT}" ` +
    `font-size="${ER_FONT.attrSize}" font-weight="${ER_FONT.attrWeight}">` +
    `<tspan fill="${c('_text-sec')}">${escapeXml(attr.name)}</tspan></text>`
  )

  return parts.join('\n')
}

// ============================================================================
// Relationship rendering
// ============================================================================

/** Render a relationship line */
function renderRelationshipLine(rel: PositionedErRelationship, c: ColorFn): string {
  if (rel.points.length < 2) return ''

  const pathData = rel.points.map(p => `${p.x},${p.y}`).join(' ')
  const dashArray = !rel.identifying ? ' stroke-dasharray="6 4"' : ''

  return (
    `<polyline points="${pathData}" fill="none" stroke="${c('_line')}" ` +
    `stroke-width="${STROKE_WIDTHS.connector}"${dashArray} />`
  )
}

/** Render a relationship label at the midpoint */
function renderRelationshipLabel(rel: PositionedErRelationship, c: ColorFn): string {
  if (!rel.label || rel.points.length < 2) return ''

  const mid = midpoint(rel.points)
  const textWidth = estimateTextWidth(rel.label, FONT_SIZES.edgeLabel, FONT_WEIGHTS.edgeLabel)

  // Background pill for readability
  const bgW = textWidth + 8
  const bgH = FONT_SIZES.edgeLabel + 6

  return (
    `<rect x="${mid.x - bgW / 2}" y="${mid.y - bgH / 2}" width="${bgW}" height="${bgH}" rx="2" ry="2" ` +
    `fill="${c.bg()}" stroke="${c('_inner-stroke')}" stroke-width="0.5" />` +
    `\n<text x="${mid.x}" y="${mid.y}" text-anchor="middle" dy="${TEXT_BASELINE_SHIFT}" ` +
    `font-size="${FONT_SIZES.edgeLabel}" font-weight="${FONT_WEIGHTS.edgeLabel}" fill="${c('_text-muted')}">${escapeXml(rel.label)}</text>`
  )
}

/**
 * Render crow's foot cardinality markers at both endpoints of a relationship.
 *
 * Crow's foot notation:
 *   'one':       ─║─   (single vertical line)
 *   'zero-one':  ─o║─  (circle + single line)
 *   'many':      ─╢─   (crow's foot + single line)
 *   'zero-many': ─o╣─  (circle + crow's foot)
 */
function renderCardinality(rel: PositionedErRelationship, c: ColorFn): string {
  if (rel.points.length < 2) return ''
  const parts: string[] = []

  // Entity1 side (first point, direction toward second point)
  const p1 = rel.points[0]!
  const p2 = rel.points[1]!
  parts.push(renderCrowsFoot(p1, p2, rel.cardinality1, c))

  // Entity2 side (last point, direction toward second-to-last point)
  const pN = rel.points[rel.points.length - 1]!
  const pN1 = rel.points[rel.points.length - 2]!
  parts.push(renderCrowsFoot(pN, pN1, rel.cardinality2, c))

  return parts.join('\n')
}

/**
 * Render a crow's foot marker at a given endpoint.
 * `point` is the endpoint, `toward` gives the direction the line comes from.
 */
function renderCrowsFoot(
  point: { x: number; y: number },
  toward: { x: number; y: number },
  cardinality: Cardinality,
  c: ColorFn
): string {
  const parts: string[] = []
  const sw = STROKE_WIDTHS.connector + 0.25

  // Calculate direction from toward → point (unit vector)
  const dx = point.x - toward.x
  const dy = point.y - toward.y
  const len = Math.sqrt(dx * dx + dy * dy)
  if (len === 0) return ''
  const ux = dx / len
  const uy = dy / len

  // Perpendicular direction
  const px = -uy
  const py = ux

  // Marker sits 4px from the endpoint, extending 12px back along the edge
  const tipX = point.x - ux * 4
  const tipY = point.y - uy * 4
  const backX = point.x - ux * 16
  const backY = point.y - uy * 16

  // Single line: always present for 'one' and part of others
  const hasOneLine = cardinality === 'one' || cardinality === 'zero-one'
  const hasCrowsFoot = cardinality === 'many' || cardinality === 'zero-many'
  const hasCircle = cardinality === 'zero-one' || cardinality === 'zero-many'

  // Draw single vertical line (perpendicular to edge) at the tip
  if (hasOneLine) {
    const halfW = 6
    parts.push(
      `<line x1="${tipX + px * halfW}" y1="${tipY + py * halfW}" ` +
      `x2="${tipX - px * halfW}" y2="${tipY - py * halfW}" ` +
      `stroke="${c('_line')}" stroke-width="${sw}" />`
    )
    // Second line slightly back for "exactly one" emphasis
    const line2X = tipX - ux * 4
    const line2Y = tipY - uy * 4
    parts.push(
      `<line x1="${line2X + px * halfW}" y1="${line2Y + py * halfW}" ` +
      `x2="${line2X - px * halfW}" y2="${line2Y - py * halfW}" ` +
      `stroke="${c('_line')}" stroke-width="${sw}" />`
    )
  }

  // Crow's foot (three lines fanning out from tip)
  if (hasCrowsFoot) {
    const fanW = 7
    // Center line
    const cfTipX = tipX
    const cfTipY = tipY
    // Three lines from tip to back, fanning out
    parts.push(
      // Top fan line
      `<line x1="${cfTipX + px * fanW}" y1="${cfTipY + py * fanW}" ` +
      `x2="${backX}" y2="${backY}" ` +
      `stroke="${c('_line')}" stroke-width="${sw}" />`
    )
    parts.push(
      // Center line
      `<line x1="${cfTipX}" y1="${cfTipY}" ` +
      `x2="${backX}" y2="${backY}" ` +
      `stroke="${c('_line')}" stroke-width="${sw}" />`
    )
    parts.push(
      // Bottom fan line
      `<line x1="${cfTipX - px * fanW}" y1="${cfTipY - py * fanW}" ` +
      `x2="${backX}" y2="${backY}" ` +
      `stroke="${c('_line')}" stroke-width="${sw}" />`
    )
  }

  // Circle (for zero variants)
  if (hasCircle) {
    const circleOffset = hasCrowsFoot ? 20 : 12
    const circleX = point.x - ux * circleOffset
    const circleY = point.y - uy * circleOffset
    parts.push(
      `<circle cx="${circleX}" cy="${circleY}" r="4" ` +
      `fill="${c.bg()}" stroke="${c('_line')}" stroke-width="${sw}" />`
    )
  }

  return parts.join('\n')
}

/** Compute the arc-length midpoint of a polyline path.
 *  Walks along each segment, finds the point at exactly 50% of total path length.
 *  This ensures the label sits ON the path even for orthogonal routes with bends,
 *  unlike the naive first/last geometric center which floats in space for L/Z shapes. */
function midpoint(points: Array<{ x: number; y: number }>): { x: number; y: number } {
  if (points.length === 0) return { x: 0, y: 0 }
  if (points.length === 1) return points[0]!

  // Compute total path length
  let totalLen = 0
  for (let i = 1; i < points.length; i++) {
    const dx = points[i]!.x - points[i - 1]!.x
    const dy = points[i]!.y - points[i - 1]!.y
    totalLen += Math.sqrt(dx * dx + dy * dy)
  }

  if (totalLen === 0) return points[0]!

  // Walk to 50% of total length, interpolating within the segment that crosses the halfway mark
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

// ============================================================================
// Utilities
// ============================================================================

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
