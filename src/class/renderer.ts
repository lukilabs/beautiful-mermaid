import type { PositionedClassDiagram, PositionedClassNode, PositionedClassRelationship, ClassMember, RelationshipType } from './types.ts'
import type { DiagramColors, ResolvedColors } from '../theme.ts'
import { svgOpenTag, buildStyleBlock, svgOpenTagStatic, buildStaticStyleBlock, createColorFn } from '../theme.ts'
import { FONT_SIZES, FONT_WEIGHTS, STROKE_WIDTHS, estimateTextWidth, TEXT_BASELINE_SHIFT } from '../styles.ts'
import { CLS } from './layout.ts'

// ============================================================================
// Class diagram SVG renderer
//
// Renders positioned class diagrams to SVG.
// All colors use CSS custom properties (var(--_xxx)) from the theme system.
//
// Render order:
//   1. Relationship lines (behind boxes)
//   2. Class boxes (header + attributes + methods compartments)
//   3. Relationship endpoint markers (diamonds, triangles)
//   4. Labels and cardinality
// ============================================================================

/** Font sizes specific to class diagrams */
const CLS_FONT = {
  memberSize: 11,
  memberWeight: 400,
  annotationSize: 10,
  annotationWeight: 500,
} as const

/**
 * Render a positioned class diagram as an SVG string.
 *
 * @param colors - DiagramColors with bg/fg and optional enrichment variables.
 * @param transparent - If true, renders with transparent background.
 */
/** Color accessor function type */
type ColorFn = ReturnType<typeof createColorFn>

export function renderClassSvg(
  diagram: PositionedClassDiagram,
  colors: DiagramColors,
  font: string = 'Inter',
  transparent: boolean = false,
  resolved: ResolvedColors | null = null,
  noStyleBlock: boolean = false,
  markerId: string = ''
): string {
  const parts: string[] = []
  const c = createColorFn(resolved)
  const mid = markerId ? `${markerId}-` : ''

  // SVG root with CSS variables + style block (with mono font) + defs
  if (resolved) {
    parts.push(svgOpenTagStatic(diagram.width, diagram.height, resolved.bg, transparent, font, noStyleBlock))
    parts.push(buildStaticStyleBlock(font, true, noStyleBlock))
  } else {
    parts.push(svgOpenTag(diagram.width, diagram.height, colors, transparent))
    parts.push(buildStyleBlock(font, true))
  }
  parts.push('<defs>')
  parts.push(relationshipMarkerDefs(c, mid))
  parts.push('</defs>')

  // 1. Relationship lines (rendered behind boxes)
  for (const rel of diagram.relationships) {
    parts.push(renderRelationship(rel, c, mid))
  }

  // 2. Class boxes
  for (const cls of diagram.classes) {
    parts.push(renderClassBox(cls, c, noStyleBlock))
  }

  // 3. Relationship labels and cardinality
  for (const rel of diagram.relationships) {
    parts.push(renderRelationshipLabels(rel, c))
  }

  parts.push('</svg>')
  return parts.join('\n')
}

// ============================================================================
// Marker definitions
// ============================================================================

/**
 * Marker definitions for class relationship endpoints.
 * Each relationship type has a distinct marker:
 *   - inheritance: hollow triangle
 *   - composition: filled diamond
 *   - aggregation: hollow diamond
 *   - association: open arrow (simple >)
 *   - dependency: open arrow (simple >)
 *   - realization: hollow triangle (same as inheritance)
 *
 * Uses var(--_arrow) for fill/stroke and var(--bg) for hollow marker fills.
 */
function relationshipMarkerDefs(c: ColorFn, mid: string): string {
  return (
    // Hollow triangle (inheritance, realization) — points at target
    `  <marker id="${mid}cls-inherit" markerWidth="12" markerHeight="10" refX="12" refY="5" orient="auto-start-reverse">` +
    `\n    <polygon points="0 0, 12 5, 0 10" fill="${c.bg()}" stroke="${c('_arrow')}" stroke-width="1.5" />` +
    `\n  </marker>` +
    // Filled diamond (composition) — points at source
    `\n  <marker id="${mid}cls-composition" markerWidth="12" markerHeight="10" refX="0" refY="5" orient="auto-start-reverse">` +
    `\n    <polygon points="6 0, 12 5, 6 10, 0 5" fill="${c('_arrow')}" stroke="${c('_arrow')}" stroke-width="1" />` +
    `\n  </marker>` +
    // Hollow diamond (aggregation) — points at source
    `\n  <marker id="${mid}cls-aggregation" markerWidth="12" markerHeight="10" refX="0" refY="5" orient="auto-start-reverse">` +
    `\n    <polygon points="6 0, 12 5, 6 10, 0 5" fill="${c.bg()}" stroke="${c('_arrow')}" stroke-width="1.5" />` +
    `\n  </marker>` +
    // Open arrow (association, dependency)
    `\n  <marker id="${mid}cls-arrow" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto-start-reverse">` +
    `\n    <polyline points="0 0, 8 3, 0 6" fill="none" stroke="${c('_arrow')}" stroke-width="1.5" />` +
    `\n  </marker>`
  )
}

// ============================================================================
// Class box rendering
// ============================================================================

/** Render a class box with 3 compartments: header, attributes, methods */
function renderClassBox(cls: PositionedClassNode, c: ColorFn, noStyleBlock: boolean = false): string {
  const { x, y, width, height, headerHeight, attrHeight, methodHeight } = cls
  const parts: string[] = []

  // Outer rectangle (full box)
  parts.push(
    `<rect x="${x}" y="${y}" width="${width}" height="${height}" ` +
    `rx="0" ry="0" fill="${c('_node-fill')}" stroke="${c('_node-stroke')}" stroke-width="${STROKE_WIDTHS.outerBox}" />`
  )

  // Header background
  parts.push(
    `<rect x="${x}" y="${y}" width="${width}" height="${headerHeight}" ` +
    `rx="0" ry="0" fill="${c('_group-hdr')}" stroke="${c('_node-stroke')}" stroke-width="${STROKE_WIDTHS.outerBox}" />`
  )

  // Annotation (<<interface>>, <<abstract>>, etc.)
  let nameY = y + headerHeight / 2
  if (cls.annotation) {
    const annotY = y + 12
    parts.push(
      `<text x="${x + width / 2}" y="${annotY}" text-anchor="middle" dy="${TEXT_BASELINE_SHIFT}" ` +
      `font-size="${CLS_FONT.annotationSize}" font-weight="${CLS_FONT.annotationWeight}" ` +
      `font-style="italic" fill="${c('_text-muted')}">&lt;&lt;${escapeXml(cls.annotation)}&gt;&gt;</text>`
    )
    nameY = y + headerHeight / 2 + 6
  }

  // Class name
  parts.push(
    `<text x="${x + width / 2}" y="${nameY}" text-anchor="middle" dy="${TEXT_BASELINE_SHIFT}" ` +
    `font-size="${FONT_SIZES.nodeLabel}" font-weight="700" fill="${c('_text')}">${escapeXml(cls.label)}</text>`
  )

  // Divider line between header and attributes
  const attrTop = y + headerHeight
  parts.push(
    `<line x1="${x}" y1="${attrTop}" x2="${x + width}" y2="${attrTop}" ` +
    `stroke="${c('_node-stroke')}" stroke-width="${STROKE_WIDTHS.innerBox}" />`
  )

  // Attributes
  const memberRowH = 20
  for (let i = 0; i < cls.attributes.length; i++) {
    const member = cls.attributes[i]!
    const memberY = attrTop + 4 + i * memberRowH + memberRowH / 2
    parts.push(renderMember(member, x + CLS.boxPadX, memberY, c, noStyleBlock))
  }

  // Divider line between attributes and methods
  const methodTop = attrTop + attrHeight
  parts.push(
    `<line x1="${x}" y1="${methodTop}" x2="${x + width}" y2="${methodTop}" ` +
    `stroke="${c('_node-stroke')}" stroke-width="${STROKE_WIDTHS.innerBox}" />`
  )

  // Methods
  for (let i = 0; i < cls.methods.length; i++) {
    const member = cls.methods[i]!
    const memberY = methodTop + 4 + i * memberRowH + memberRowH / 2
    parts.push(renderMember(member, x + CLS.boxPadX, memberY, c, noStyleBlock))
  }

  return parts.join('\n')
}

/**
 * Render a single class member with syntax highlighting.
 * Uses <tspan> elements to color each part of the member differently:
 *   - visibility symbol (+/-/#/~) → textFaint
 *   - member name (incl. parens for methods) → textSecondary
 *   - colon separator → textFaint
 *   - type annotation → textMuted
 */
function renderMember(member: ClassMember, x: number, y: number, c: ColorFn, noStyleBlock: boolean = false): string {
  const fontStyle = member.isAbstract ? ' font-style="italic"' : ''
  const decoration = member.isStatic ? ' text-decoration="underline"' : ''
  const monoFont = noStyleBlock ? ` font-family="'JetBrains Mono','SF Mono','Fira Code',ui-monospace,monospace"` : ''

  // Build tspan parts for syntax-highlighted member text
  const spans: string[] = []

  if (member.visibility) {
    spans.push(`<tspan fill="${c('_text-faint')}">${escapeXml(member.visibility)} </tspan>`)
  }

  spans.push(`<tspan fill="${c('_text-sec')}">${escapeXml(member.name)}</tspan>`)

  if (member.type) {
    spans.push(`<tspan fill="${c('_text-faint')}">: </tspan>`)
    spans.push(`<tspan fill="${c('_text-muted')}">${escapeXml(member.type)}</tspan>`)
  }

  return (
    `<text x="${x}" y="${y}" class="mono"${monoFont} dy="${TEXT_BASELINE_SHIFT}" ` +
    `font-size="${CLS_FONT.memberSize}" font-weight="${CLS_FONT.memberWeight}"${fontStyle}${decoration}>` +
    `${spans.join('')}</text>`
  )
}

// ============================================================================
// Relationship rendering
// ============================================================================

/** Render a relationship line with appropriate markers */
function renderRelationship(rel: PositionedClassRelationship, c: ColorFn, mid: string): string {
  if (rel.points.length < 2) return ''

  const pathData = rel.points.map(p => `${p.x},${p.y}`).join(' ')
  const isDashed = rel.type === 'dependency' || rel.type === 'realization'
  const dashArray = isDashed ? ' stroke-dasharray="6 4"' : ''

  // Determine markers based on relationship type and which end has the marker
  const markers = getRelationshipMarkers(rel.type, rel.markerAt, mid)

  return (
    `<polyline points="${pathData}" fill="none" stroke="${c('_line')}" ` +
    `stroke-width="${STROKE_WIDTHS.connector}"${dashArray}${markers} />`
  )
}

/**
 * Get marker-start/marker-end attributes for a relationship type.
 * Uses `markerAt` from the parser to place the marker on the correct end:
 *   - 'from' → marker-start (prefix arrows like `<|--`, `*--`, `o--`)
 *   - 'to'   → marker-end   (suffix arrows like `..|>`, `-->`, `--*`)
 */
function getRelationshipMarkers(type: RelationshipType, markerAt: 'from' | 'to', mid: string): string {
  const defId = getMarkerDefId(type, mid)
  if (!defId) return ''

  if (markerAt === 'from') {
    return ` marker-start="url(#${defId})"`
  } else {
    return ` marker-end="url(#${defId})"`
  }
}

/** Map relationship type to its SVG marker definition ID */
function getMarkerDefId(type: RelationshipType, mid: string): string | null {
  switch (type) {
    case 'inheritance':
    case 'realization':
      return `${mid}cls-inherit`
    case 'composition':
      return `${mid}cls-composition`
    case 'aggregation':
      return `${mid}cls-aggregation`
    case 'association':
    case 'dependency':
      return `${mid}cls-arrow`
    default:
      return null
  }
}

/** Render relationship labels and cardinality text */
function renderRelationshipLabels(rel: PositionedClassRelationship, c: ColorFn): string {
  if (!rel.label && !rel.fromCardinality && !rel.toCardinality) return ''
  if (rel.points.length < 2) return ''

  const parts: string[] = []

  // Label — prefer dagre-computed position (collision-aware), fall back to midpoint
  if (rel.label) {
    const pos = rel.labelPosition ?? midpoint(rel.points)
    parts.push(
      `<text x="${pos.x}" y="${pos.y - 8}" text-anchor="middle" ` +
      `font-size="${FONT_SIZES.edgeLabel}" font-weight="${FONT_WEIGHTS.edgeLabel}" ` +
      `fill="${c('_text-muted')}">${escapeXml(rel.label)}</text>`
    )
  }

  // From cardinality (near start)
  if (rel.fromCardinality) {
    const p = rel.points[0]!
    const next = rel.points[1]!
    const offset = cardinalityOffset(p, next)
    parts.push(
      `<text x="${p.x + offset.x}" y="${p.y + offset.y}" text-anchor="middle" ` +
      `font-size="${FONT_SIZES.edgeLabel}" font-weight="${FONT_WEIGHTS.edgeLabel}" ` +
      `fill="${c('_text-muted')}">${escapeXml(rel.fromCardinality)}</text>`
    )
  }

  // To cardinality (near end)
  if (rel.toCardinality) {
    const p = rel.points[rel.points.length - 1]!
    const prev = rel.points[rel.points.length - 2]!
    const offset = cardinalityOffset(p, prev)
    parts.push(
      `<text x="${p.x + offset.x}" y="${p.y + offset.y}" text-anchor="middle" ` +
      `font-size="${FONT_SIZES.edgeLabel}" font-weight="${FONT_WEIGHTS.edgeLabel}" ` +
      `fill="${c('_text-muted')}">${escapeXml(rel.toCardinality)}</text>`
    )
  }

  return parts.join('\n')
}

/** Get the midpoint of a point array */
function midpoint(points: Array<{ x: number; y: number }>): { x: number; y: number } {
  if (points.length === 0) return { x: 0, y: 0 }
  const mid = Math.floor(points.length / 2)
  return points[mid]!
}

/** Calculate offset for cardinality label perpendicular to edge direction */
function cardinalityOffset(
  from: { x: number; y: number },
  to: { x: number; y: number }
): { x: number; y: number } {
  const dx = to.x - from.x
  const dy = to.y - from.y
  // Place label perpendicular to the edge, 14px away
  if (Math.abs(dx) > Math.abs(dy)) {
    // Mostly horizontal — offset vertically
    return { x: dx > 0 ? 14 : -14, y: -10 }
  }
  // Mostly vertical — offset horizontally
  return { x: -14, y: dy > 0 ? 14 : -14 }
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
