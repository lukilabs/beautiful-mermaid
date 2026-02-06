import type {
  PositionedArchiMateDiagram,
  PositionedArchiMateElement,
  PositionedArchiMateLayer,
  PositionedArchiMateRelationship,
  ArchiMateLayer,
  ArchiMateRelationshipType,
} from './types.ts'
import type { DiagramColors } from '../theme.ts'
import { svgOpenTag, buildStyleBlock } from '../theme.ts'
import { FONT_SIZES, FONT_WEIGHTS, STROKE_WIDTHS, estimateTextWidth, TEXT_BASELINE_SHIFT } from '../styles.ts'

// ============================================================================
// ArchiMate diagram SVG renderer
//
// Renders positioned ArchiMate diagrams to SVG.
// All colors use CSS custom properties (var(--_xxx)) from the theme system.
//
// Render order:
//   1. Layer bands (background rectangles with color tints)
//   2. Relationship lines (behind element boxes)
//   3. Element boxes (rounded rectangles with type indicators)
//   4. Relationship labels
//   5. Relationship markers (arrowheads, diamonds)
// ============================================================================

/** ArchiMate-specific font sizes */
const ARCHIMATE_FONT = {
  typeIndicatorSize: 9,
  typeIndicatorWeight: 400,
  layerLabelSize: 11,
  layerLabelWeight: 600,
} as const

/** Layer color tints — mixed with var(--bg) at 12% for subtle background fill */
const LAYER_TINTS: Record<ArchiMateLayer, string> = {
  business:       'color-mix(in srgb, #F0C040 12%, var(--bg))',
  application:    'color-mix(in srgb, #4488CC 12%, var(--bg))',
  technology:     'color-mix(in srgb, #44AA66 12%, var(--bg))',
  strategy:       'color-mix(in srgb, #CCB366 12%, var(--bg))',
  motivation:     'color-mix(in srgb, #AA77CC 12%, var(--bg))',
  physical:       'color-mix(in srgb, #66BB99 12%, var(--bg))',
  implementation: 'color-mix(in srgb, #CC6666 12%, var(--bg))',
}

/** Layer border colors — slightly stronger tint for the border stroke */
const LAYER_BORDERS: Record<ArchiMateLayer, string> = {
  business:       'color-mix(in srgb, #F0C040 30%, var(--_node-stroke))',
  application:    'color-mix(in srgb, #4488CC 30%, var(--_node-stroke))',
  technology:     'color-mix(in srgb, #44AA66 30%, var(--_node-stroke))',
  strategy:       'color-mix(in srgb, #CCB366 30%, var(--_node-stroke))',
  motivation:     'color-mix(in srgb, #AA77CC 30%, var(--_node-stroke))',
  physical:       'color-mix(in srgb, #66BB99 30%, var(--_node-stroke))',
  implementation: 'color-mix(in srgb, #CC6666 30%, var(--_node-stroke))',
}

/** Human-readable layer display names */
const LAYER_LABELS: Record<ArchiMateLayer, string> = {
  business:       'Business',
  application:    'Application',
  technology:     'Technology',
  strategy:       'Strategy',
  motivation:     'Motivation',
  physical:       'Physical',
  implementation: 'Implementation & Migration',
}

/**
 * Render a positioned ArchiMate diagram as an SVG string.
 *
 * @param diagram - Positioned ArchiMate diagram with coordinates
 * @param colors - DiagramColors with bg/fg and optional enrichment variables
 * @param font - Font family for text rendering. Default: 'Inter'
 * @param transparent - If true, renders with transparent background
 */
export function renderArchiMateSvg(
  diagram: PositionedArchiMateDiagram,
  colors: DiagramColors,
  font: string = 'Inter',
  transparent: boolean = false
): string {
  const parts: string[] = []

  // SVG root with CSS variables + style block + defs
  parts.push(svgOpenTag(diagram.width, diagram.height, colors, transparent))
  parts.push(buildStyleBlock(font, false))
  parts.push(buildDefs())

  // 1. Layer bands
  for (const layer of diagram.layers) {
    parts.push(renderLayerBand(layer))
  }

  // 2. Relationship lines (behind boxes)
  for (const rel of diagram.relationships) {
    parts.push(renderRelationshipLine(rel))
  }

  // 3. Element boxes
  for (const element of diagram.elements) {
    parts.push(renderElementBox(element))
  }

  // 4. Relationship labels
  for (const rel of diagram.relationships) {
    parts.push(renderRelationshipLabel(rel))
  }

  // 5. Relationship markers (arrowheads, diamonds)
  for (const rel of diagram.relationships) {
    parts.push(renderRelationshipMarkers(rel))
  }

  parts.push('</svg>')
  return parts.join('\n')
}

// ============================================================================
// SVG marker definitions
// ============================================================================

/** Build SVG <defs> with arrow and diamond markers */
function buildDefs(): string {
  const parts: string[] = ['<defs>']

  // Filled arrowhead (for triggering, flow, assignment, access)
  parts.push(
    `<marker id="archimate-arrow-filled" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto" markerUnits="userSpaceOnUse">` +
    `<path d="M0,0 L10,4 L0,8 Z" fill="var(--_line)" />` +
    `</marker>`
  )

  // Open arrowhead (for serving, realization, influence)
  parts.push(
    `<marker id="archimate-arrow-open" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto" markerUnits="userSpaceOnUse">` +
    `<path d="M0,0 L10,4 L0,8" fill="none" stroke="var(--_line)" stroke-width="1.25" />` +
    `</marker>`
  )

  // Open triangle (for specialization)
  parts.push(
    `<marker id="archimate-triangle-open" markerWidth="12" markerHeight="10" refX="11" refY="5" orient="auto" markerUnits="userSpaceOnUse">` +
    `<path d="M0,0 L12,5 L0,10 Z" fill="var(--bg)" stroke="var(--_line)" stroke-width="1" />` +
    `</marker>`
  )

  // Filled diamond (for composition)
  parts.push(
    `<marker id="archimate-diamond-filled" markerWidth="12" markerHeight="8" refX="1" refY="4" orient="auto" markerUnits="userSpaceOnUse">` +
    `<path d="M6,0 L12,4 L6,8 L0,4 Z" fill="var(--_line)" />` +
    `</marker>`
  )

  // Open diamond (for aggregation)
  parts.push(
    `<marker id="archimate-diamond-open" markerWidth="12" markerHeight="8" refX="1" refY="4" orient="auto" markerUnits="userSpaceOnUse">` +
    `<path d="M6,0 L12,4 L6,8 L0,4 Z" fill="var(--bg)" stroke="var(--_line)" stroke-width="1" />` +
    `</marker>`
  )

  // Filled circle (for assignment — start marker)
  parts.push(
    `<marker id="archimate-circle-filled" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto" markerUnits="userSpaceOnUse">` +
    `<circle cx="4" cy="4" r="3" fill="var(--_line)" />` +
    `</marker>`
  )

  parts.push('</defs>')
  return parts.join('\n')
}

// ============================================================================
// Layer band rendering
// ============================================================================

/** Render a layer band — background rectangle with layer label */
function renderLayerBand(layer: PositionedArchiMateLayer): string {
  const parts: string[] = []
  const tint = LAYER_TINTS[layer.name]
  const border = LAYER_BORDERS[layer.name]
  const label = LAYER_LABELS[layer.name]

  // Background rectangle
  parts.push(
    `<rect x="${layer.x}" y="${layer.y}" width="${layer.width}" height="${layer.height}" ` +
    `rx="4" ry="4" fill="${tint}" stroke="${border}" stroke-width="${STROKE_WIDTHS.outerBox}" />`
  )

  // Layer label in the top-left corner
  parts.push(
    `<text x="${layer.x + 8}" y="${layer.y + 16}" ` +
    `font-size="${ARCHIMATE_FONT.layerLabelSize}" font-weight="${ARCHIMATE_FONT.layerLabelWeight}" ` +
    `fill="var(--_text-muted)">${escapeXml(label)}</text>`
  )

  return parts.join('\n')
}

// ============================================================================
// Element box rendering
// ============================================================================

/** Render an element box — rounded rectangle with label and type indicator */
function renderElementBox(element: PositionedArchiMateElement): string {
  const { x, y, width, height, label, type } = element
  const parts: string[] = []

  // Outer rounded rectangle
  parts.push(
    `<rect x="${x}" y="${y}" width="${width}" height="${height}" ` +
    `rx="4" ry="4" fill="var(--_node-fill)" stroke="var(--_node-stroke)" stroke-width="${STROKE_WIDTHS.outerBox}" />`
  )

  // Element label — centered
  parts.push(
    `<text x="${x + width / 2}" y="${y + height / 2 + 2}" text-anchor="middle" dy="${TEXT_BASELINE_SHIFT}" ` +
    `font-size="${FONT_SIZES.nodeLabel}" font-weight="${FONT_WEIGHTS.nodeLabel}" fill="var(--_text)">${escapeXml(label)}</text>`
  )

  // Type indicator — small text in the top-right corner
  const typeLabel = formatTypeName(type)
  parts.push(
    `<text x="${x + width - 6}" y="${y + 12}" text-anchor="end" ` +
    `font-size="${ARCHIMATE_FONT.typeIndicatorSize}" font-weight="${ARCHIMATE_FONT.typeIndicatorWeight}" ` +
    `fill="var(--_text-faint)">${escapeXml(typeLabel)}</text>`
  )

  return parts.join('\n')
}

/** Convert camelCase type names to human-readable form */
function formatTypeName(type: string): string {
  // Insert space before uppercase letters: "dataObject" → "data Object" → "Data Object"
  const spaced = type.replace(/([a-z])([A-Z])/g, '$1 $2')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

// ============================================================================
// Relationship rendering
// ============================================================================

/** Get SVG attributes for a relationship line based on its type */
function getRelationshipLineStyle(type: ArchiMateRelationshipType): {
  dashArray: string
  markerStart: string
  markerEnd: string
} {
  switch (type) {
    case 'composition':
      return {
        dashArray: '',
        markerStart: 'url(#archimate-diamond-filled)',
        markerEnd: '',
      }
    case 'aggregation':
      return {
        dashArray: '',
        markerStart: 'url(#archimate-diamond-open)',
        markerEnd: '',
      }
    case 'assignment':
      return {
        dashArray: '',
        markerStart: 'url(#archimate-circle-filled)',
        markerEnd: 'url(#archimate-arrow-filled)',
      }
    case 'realization':
      return {
        dashArray: '6 4',
        markerStart: '',
        markerEnd: 'url(#archimate-arrow-open)',
      }
    case 'serving':
      return {
        dashArray: '',
        markerStart: '',
        markerEnd: 'url(#archimate-arrow-open)',
      }
    case 'access':
      return {
        dashArray: '6 4',
        markerStart: '',
        markerEnd: 'url(#archimate-arrow-filled)',
      }
    case 'influence':
      return {
        dashArray: '6 4',
        markerStart: '',
        markerEnd: 'url(#archimate-arrow-open)',
      }
    case 'triggering':
      return {
        dashArray: '',
        markerStart: '',
        markerEnd: 'url(#archimate-arrow-filled)',
      }
    case 'flow':
      return {
        dashArray: '6 4',
        markerStart: '',
        markerEnd: 'url(#archimate-arrow-filled)',
      }
    case 'specialization':
      return {
        dashArray: '',
        markerStart: '',
        markerEnd: 'url(#archimate-triangle-open)',
      }
    case 'association':
      return {
        dashArray: '',
        markerStart: '',
        markerEnd: '',
      }
  }
}

/** Render a relationship line (polyline) */
function renderRelationshipLine(rel: PositionedArchiMateRelationship): string {
  if (rel.points.length < 2) return ''

  const style = getRelationshipLineStyle(rel.type)
  const pathData = rel.points.map(p => `${p.x},${p.y}`).join(' ')

  const attrs: string[] = [
    `points="${pathData}"`,
    'fill="none"',
    'stroke="var(--_line)"',
    `stroke-width="${STROKE_WIDTHS.connector}"`,
  ]

  if (style.dashArray) {
    attrs.push(`stroke-dasharray="${style.dashArray}"`)
  }
  if (style.markerStart) {
    attrs.push(`marker-start="${style.markerStart}"`)
  }
  if (style.markerEnd) {
    attrs.push(`marker-end="${style.markerEnd}"`)
  }

  return `<polyline ${attrs.join(' ')} />`
}

/** Render a relationship label at the arc-length midpoint */
function renderRelationshipLabel(rel: PositionedArchiMateRelationship): string {
  if (!rel.label || rel.points.length < 2) return ''

  const mid = midpoint(rel.points)
  const textWidth = estimateTextWidth(rel.label, FONT_SIZES.edgeLabel, FONT_WEIGHTS.edgeLabel)

  // Background pill for readability
  const bgW = textWidth + 8
  const bgH = FONT_SIZES.edgeLabel + 6

  return (
    `<rect x="${mid.x - bgW / 2}" y="${mid.y - bgH / 2}" width="${bgW}" height="${bgH}" rx="2" ry="2" ` +
    `fill="var(--bg)" stroke="var(--_inner-stroke)" stroke-width="0.5" />` +
    `\n<text x="${mid.x}" y="${mid.y}" text-anchor="middle" dy="${TEXT_BASELINE_SHIFT}" ` +
    `font-size="${FONT_SIZES.edgeLabel}" font-weight="${FONT_WEIGHTS.edgeLabel}" fill="var(--_text-muted)">${escapeXml(rel.label)}</text>`
  )
}

/** Render relationship endpoint markers that aren't handled by SVG marker defs */
function renderRelationshipMarkers(rel: PositionedArchiMateRelationship): string {
  // All markers are handled via SVG <marker> defs on the polyline
  // This function is a placeholder for any additional custom markers
  // that might be needed in the future (e.g., inline decorations)
  if (rel.points.length < 2) return ''
  return ''
}

// ============================================================================
// Geometry utilities
// ============================================================================

/** Compute the arc-length midpoint of a polyline path.
 *  Walks along each segment, finds the point at exactly 50% of total path length.
 *  This ensures the label sits ON the path even for orthogonal routes with bends. */
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

  // Walk to 50% of total length
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
