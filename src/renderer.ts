import type { PositionedGraph, PositionedNode, PositionedEdge, PositionedGroup, Point } from './types.ts'
import type { DiagramColors } from './theme.ts'
import { svgOpenTag, buildStyleBlock } from './theme.ts'
import { FONT_SIZES, FONT_WEIGHTS, STROKE_WIDTHS, ARROW_HEAD, estimateTextWidth, TEXT_BASELINE_SHIFT } from './styles.ts'

// ============================================================================
// SVG renderer — converts a PositionedGraph into an SVG string.
//
// Pure string concatenation, no DOM manipulation.
// Renders back-to-front: groups → edges → arrow heads → edge labels → nodes → node labels.
//
// All colors are referenced via CSS custom properties (var(--_xxx)) defined
// in the <style> block. The caller provides bg/fg (+ optional enrichment
// colors) via DiagramColors, which are set as inline CSS variables on the
// <svg> tag. See src/theme.ts for the full variable system.
//
// Style spec:
// - All corners rx=0 ry=0 (sharp)
// - Stroke widths: outer box 1px, inner box 0.75px, connectors 0.75px
// - Arrow heads: filled triangles, 8px wide × 4.8px tall
// - Dashed edges: stroke-dasharray="4 4"
// - Font: Inter with weight per element type
// ============================================================================

/**
 * Render a positioned graph as an SVG string.
 *
 * @param colors - DiagramColors with bg/fg and optional enrichment variables.
 *                 These are set as CSS custom properties on the <svg> tag.
 *                 All element colors reference derived --_xxx variables.
 * @param transparent - If true, renders with transparent background.
 */
export function renderSvg(
  graph: PositionedGraph,
  colors: DiagramColors,
  font: string = 'Inter',
  transparent: boolean = false
): string {
  const parts: string[] = []

  // SVG root with CSS variables + style block + defs
  parts.push(svgOpenTag(graph.width, graph.height, colors, transparent))
  parts.push(buildStyleBlock(font, false))
  parts.push('<defs>')
  parts.push(arrowMarkerDefs())
  parts.push('</defs>')

  // 1. Group backgrounds (subgraph rectangles with header bands)
  for (const group of graph.groups) {
    parts.push(renderGroup(group, font))
  }

  // 2. Edges (polylines — rendered behind nodes)
  for (const edge of graph.edges) {
    parts.push(renderEdge(edge))
  }

  // 3. Edge labels (positioned at midpoint of edge)
  for (const edge of graph.edges) {
    if (edge.label) {
      parts.push(renderEdgeLabel(edge, font))
    }
  }

  // 4. Node shapes
  for (const node of graph.nodes) {
    parts.push(renderNodeShape(node))
  }

  // 5. Node labels
  for (const node of graph.nodes) {
    parts.push(renderNodeLabel(node, font))
  }

  parts.push('</svg>')

  return parts.join('\n')
}

// ============================================================================
// Arrow marker definitions
// ============================================================================

/**
 * Reusable arrow head markers — both forward (end) and reverse (start) variants.
 * The reverse marker uses orient="auto-start-reverse" to flip automatically.
 * Arrow color uses var(--_arrow) CSS variable.
 */
function arrowMarkerDefs(): string {
  const w = ARROW_HEAD.width
  const h = ARROW_HEAD.height
  return (
    // Forward arrow (marker-end) — orient="auto" ensures arrow points along line direction
    `  <marker id="arrowhead" markerWidth="${w}" markerHeight="${h}" refX="${w}" refY="${h / 2}" orient="auto">` +
    `\n    <polygon points="0 0, ${w} ${h / 2}, 0 ${h}" fill="var(--_arrow)" />` +
    `\n  </marker>` +
    // Reverse arrow (marker-start) — refX=0 so it sits at the line start, auto-start-reverse flips it
    `\n  <marker id="arrowhead-start" markerWidth="${w}" markerHeight="${h}" refX="0" refY="${h / 2}" orient="auto-start-reverse">` +
    `\n    <polygon points="${w} 0, 0 ${h / 2}, ${w} ${h}" fill="var(--_arrow)" />` +
    `\n  </marker>`
  )
}

// ============================================================================
// Group rendering (subgraph backgrounds)
// ============================================================================

function renderGroup(group: PositionedGroup, font: string): string {
  const headerHeight = FONT_SIZES.groupHeader + 16
  const parts: string[] = []

  // Outer rectangle
  parts.push(
    `<rect x="${group.x}" y="${group.y}" width="${group.width}" height="${group.height}" ` +
    `rx="0" ry="0" fill="var(--_group-fill)" stroke="var(--_node-stroke)" stroke-width="${STROKE_WIDTHS.outerBox}" />`
  )

  // Header band
  parts.push(
    `<rect x="${group.x}" y="${group.y}" width="${group.width}" height="${headerHeight}" ` +
    `rx="0" ry="0" fill="var(--_group-hdr)" stroke="var(--_node-stroke)" stroke-width="${STROKE_WIDTHS.outerBox}" />`
  )

  // Header label
  parts.push(
    `<text x="${group.x + 12}" y="${group.y + headerHeight / 2}" ` +
    `dy="${TEXT_BASELINE_SHIFT}" font-size="${FONT_SIZES.groupHeader}" font-weight="${FONT_WEIGHTS.groupHeader}" ` +
    `fill="var(--_text-sec)">${escapeXml(group.label)}</text>`
  )

  // Render nested groups recursively
  for (const child of group.children) {
    parts.push(renderGroup(child, font))
  }

  return parts.join('\n')
}

// ============================================================================
// Edge rendering
// ============================================================================

function renderEdge(edge: PositionedEdge): string {
  if (edge.points.length < 2) return ''

  const pathData = pointsToPolylinePath(edge.points)
  const dashArray = edge.style === 'dotted' ? ' stroke-dasharray="4 4"' : ''

  // Resolve stroke and stroke-width — inline styles (from linkStyle) override defaults
  const stroke = escapeXml(edge.inlineStyle?.stroke ?? 'var(--_line)')
  const defaultStrokeWidth = edge.style === 'thick' ? STROKE_WIDTHS.connector * 2 : STROKE_WIDTHS.connector
  const strokeWidth = escapeXml(edge.inlineStyle?.['stroke-width'] ?? String(defaultStrokeWidth))

  // Build marker attributes based on arrow direction flags
  let markers = ''
  if (edge.hasArrowEnd) markers += ' marker-end="url(#arrowhead)"'
  if (edge.hasArrowStart) markers += ' marker-start="url(#arrowhead-start)"'

  return (
    `<polyline points="${pathData}" fill="none" stroke="${stroke}" ` +
    `stroke-width="${strokeWidth}"${dashArray}${markers} />`
  )
}

/** Convert points to SVG polyline points attribute: "x1,y1 x2,y2 ..." */
function pointsToPolylinePath(points: Point[]): string {
  return points.map(p => `${p.x},${p.y}`).join(' ')
}

function renderEdgeLabel(edge: PositionedEdge, font: string): string {
  // Use dagre-computed label position when available (layout-aware, avoids collisions).
  // Fall back to geometric midpoint of the edge polyline.
  const mid = edge.labelPosition ?? edgeMidpoint(edge.points)
  const label = edge.label!
  const textWidth = estimateTextWidth(label, FONT_SIZES.edgeLabel, FONT_WEIGHTS.edgeLabel)
  const padding = 8

  // Background pill behind text for readability
  const bgWidth = textWidth + padding * 2
  const bgHeight = FONT_SIZES.edgeLabel + padding * 2

  return (
    `<rect x="${mid.x - bgWidth / 2}" y="${mid.y - bgHeight / 2}" ` +
    `width="${bgWidth}" height="${bgHeight}" rx="4" ry="4" ` +
    `fill="var(--bg)" stroke="var(--_inner-stroke)" stroke-width="0.5" />\n` +
    `<text x="${mid.x}" y="${mid.y}" text-anchor="middle" dy="${TEXT_BASELINE_SHIFT}" ` +
    `font-size="${FONT_SIZES.edgeLabel}" font-weight="${FONT_WEIGHTS.edgeLabel}" ` +
    `fill="var(--_text-muted)">${escapeXml(label)}</text>`
  )
}

/** Get the midpoint of a polyline (by walking segments) */
function edgeMidpoint(points: Point[]): Point {
  if (points.length === 0) return { x: 0, y: 0 }
  if (points.length === 1) return points[0]!

  // Calculate total length
  let totalLength = 0
  for (let i = 1; i < points.length; i++) {
    totalLength += dist(points[i - 1]!, points[i]!)
  }

  // Walk to the halfway point
  let remaining = totalLength / 2
  for (let i = 1; i < points.length; i++) {
    const segLen = dist(points[i - 1]!, points[i]!)
    if (remaining <= segLen) {
      const t = remaining / segLen
      return {
        x: points[i - 1]!.x + t * (points[i]!.x - points[i - 1]!.x),
        y: points[i - 1]!.y + t * (points[i]!.y - points[i - 1]!.y),
      }
    }
    remaining -= segLen
  }

  return points[points.length - 1]!
}

function dist(a: Point, b: Point): number {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2)
}

// ============================================================================
// Node rendering
// ============================================================================

function renderNodeShape(node: PositionedNode): string {
  const { x, y, width, height, shape, inlineStyle } = node

  // Resolve fill and stroke — inline styles (from mermaid `style` directives)
  // override the CSS variable defaults. When no inline style is present, the
  // CSS variable handles theming automatically via color-mix() derivation.
  const fill = escapeXml(inlineStyle?.fill ?? 'var(--_node-fill)')
  const stroke = escapeXml(inlineStyle?.stroke ?? 'var(--_node-stroke)')
  const sw = escapeXml(inlineStyle?.['stroke-width'] ?? String(STROKE_WIDTHS.innerBox))

  switch (shape) {
    case 'diamond':
      return renderDiamond(x, y, width, height, fill, stroke, sw)
    case 'rounded':
      return renderRoundedRect(x, y, width, height, fill, stroke, sw)
    case 'stadium':
      return renderStadium(x, y, width, height, fill, stroke, sw)
    case 'circle':
      return renderCircle(x, y, width, height, fill, stroke, sw)
    case 'subroutine':
      return renderSubroutine(x, y, width, height, fill, stroke, sw)
    case 'doublecircle':
      return renderDoubleCircle(x, y, width, height, fill, stroke, sw)
    case 'hexagon':
      return renderHexagon(x, y, width, height, fill, stroke, sw)
    case 'cylinder':
      return renderCylinder(x, y, width, height, fill, stroke, sw)
    case 'asymmetric':
      return renderAsymmetric(x, y, width, height, fill, stroke, sw)
    case 'trapezoid':
      return renderTrapezoid(x, y, width, height, fill, stroke, sw)
    case 'trapezoid-alt':
      return renderTrapezoidAlt(x, y, width, height, fill, stroke, sw)
    case 'state-start':
      return renderStateStart(x, y, width, height)
    case 'state-end':
      return renderStateEnd(x, y, width, height)
    case 'rectangle':
    default:
      return renderRect(x, y, width, height, fill, stroke, sw)
  }
}

// --- Basic shapes ---

function renderRect(x: number, y: number, w: number, h: number, fill: string, stroke: string, sw: string): string {
  return (
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" ` +
    `rx="0" ry="0" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" />`
  )
}

function renderRoundedRect(x: number, y: number, w: number, h: number, fill: string, stroke: string, sw: string): string {
  return (
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" ` +
    `rx="6" ry="6" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" />`
  )
}

function renderStadium(x: number, y: number, w: number, h: number, fill: string, stroke: string, sw: string): string {
  const r = h / 2
  return (
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" ` +
    `rx="${r}" ry="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" />`
  )
}

function renderCircle(x: number, y: number, w: number, h: number, fill: string, stroke: string, sw: string): string {
  const cx = x + w / 2
  const cy = y + h / 2
  const r = Math.min(w, h) / 2
  return (
    `<circle cx="${cx}" cy="${cy}" r="${r}" ` +
    `fill="${fill}" stroke="${stroke}" stroke-width="${sw}" />`
  )
}

function renderDiamond(x: number, y: number, w: number, h: number, fill: string, stroke: string, sw: string): string {
  const cx = x + w / 2
  const cy = y + h / 2
  const hw = w / 2
  const hh = h / 2
  const points = [
    `${cx},${cy - hh}`,   // top
    `${cx + hw},${cy}`,   // right
    `${cx},${cy + hh}`,   // bottom
    `${cx - hw},${cy}`,   // left
  ].join(' ')

  return (
    `<polygon points="${points}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" />`
  )
}

// --- Batch 1 shapes ---

/** Subroutine: rectangle with double vertical borders on left and right */
function renderSubroutine(x: number, y: number, w: number, h: number, fill: string, stroke: string, sw: string): string {
  const inset = 8 // distance from edge to inner vertical line
  return (
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" ` +
    `rx="0" ry="0" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" />` +
    `\n<line x1="${x + inset}" y1="${y}" x2="${x + inset}" y2="${y + h}" ` +
    `stroke="${stroke}" stroke-width="${sw}" />` +
    `\n<line x1="${x + w - inset}" y1="${y}" x2="${x + w - inset}" y2="${y + h}" ` +
    `stroke="${stroke}" stroke-width="${sw}" />`
  )
}

/** Double circle: two concentric circles with a gap between them */
function renderDoubleCircle(x: number, y: number, w: number, h: number, fill: string, stroke: string, sw: string): string {
  const cx = x + w / 2
  const cy = y + h / 2
  const outerR = Math.min(w, h) / 2
  const innerR = outerR - 5 // 5px gap between rings
  return (
    `<circle cx="${cx}" cy="${cy}" r="${outerR}" ` +
    `fill="${fill}" stroke="${stroke}" stroke-width="${sw}" />` +
    `\n<circle cx="${cx}" cy="${cy}" r="${innerR}" ` +
    `fill="${fill}" stroke="${stroke}" stroke-width="${sw}" />`
  )
}

/** Hexagon: 6-point polygon with flat top/bottom and angled sides */
function renderHexagon(x: number, y: number, w: number, h: number, fill: string, stroke: string, sw: string): string {
  const inset = h / 4 // horizontal inset for the angled sides
  const points = [
    `${x + inset},${y}`,           // top-left
    `${x + w - inset},${y}`,       // top-right
    `${x + w},${y + h / 2}`,       // mid-right
    `${x + w - inset},${y + h}`,   // bottom-right
    `${x + inset},${y + h}`,       // bottom-left
    `${x},${y + h / 2}`,           // mid-left
  ].join(' ')

  return `<polygon points="${points}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" />`
}

// --- Batch 2 shapes ---

/** Cylinder / database: top ellipse cap + body rect + bottom ellipse */
function renderCylinder(x: number, y: number, w: number, h: number, fill: string, stroke: string, sw: string): string {
  const ry = 7 // ellipse vertical radius for the cap
  const cx = x + w / 2
  const bodyTop = y + ry
  const bodyH = h - 2 * ry

  return (
    // Body rectangle (no top border — covered by top ellipse)
    `<rect x="${x}" y="${bodyTop}" width="${w}" height="${bodyH}" ` +
    `fill="${fill}" stroke="none" />` +
    // Left and right body borders
    `\n<line x1="${x}" y1="${bodyTop}" x2="${x}" y2="${bodyTop + bodyH}" stroke="${stroke}" stroke-width="${sw}" />` +
    `\n<line x1="${x + w}" y1="${bodyTop}" x2="${x + w}" y2="${bodyTop + bodyH}" stroke="${stroke}" stroke-width="${sw}" />` +
    // Bottom ellipse (half visible)
    `\n<ellipse cx="${cx}" cy="${y + h - ry}" rx="${w / 2}" ry="${ry}" ` +
    `fill="${fill}" stroke="${stroke}" stroke-width="${sw}" />` +
    // Top ellipse (full, on top)
    `\n<ellipse cx="${cx}" cy="${bodyTop}" rx="${w / 2}" ry="${ry}" ` +
    `fill="${fill}" stroke="${stroke}" stroke-width="${sw}" />`
  )
}

/** Asymmetric / flag: rectangle with a pointed left edge */
function renderAsymmetric(x: number, y: number, w: number, h: number, fill: string, stroke: string, sw: string): string {
  const indent = 12 // how far the point indents
  const points = [
    `${x + indent},${y}`,       // top-left (indented)
    `${x + w},${y}`,            // top-right
    `${x + w},${y + h}`,        // bottom-right
    `${x + indent},${y + h}`,   // bottom-left (indented)
    `${x},${y + h / 2}`,        // left point
  ].join(' ')

  return `<polygon points="${points}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" />`
}

/** Trapezoid [/text\]: wider bottom, narrower top */
function renderTrapezoid(x: number, y: number, w: number, h: number, fill: string, stroke: string, sw: string): string {
  const inset = w * 0.15 // top edge is narrower by this amount on each side
  const points = [
    `${x + inset},${y}`,         // top-left (indented)
    `${x + w - inset},${y}`,     // top-right (indented)
    `${x + w},${y + h}`,         // bottom-right (full width)
    `${x},${y + h}`,             // bottom-left (full width)
  ].join(' ')

  return `<polygon points="${points}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" />`
}

/** Trapezoid-alt [\text/]: wider top, narrower bottom */
function renderTrapezoidAlt(x: number, y: number, w: number, h: number, fill: string, stroke: string, sw: string): string {
  const inset = w * 0.15 // bottom edge is narrower
  const points = [
    `${x},${y}`,                     // top-left (full width)
    `${x + w},${y}`,                 // top-right (full width)
    `${x + w - inset},${y + h}`,     // bottom-right (indented)
    `${x + inset},${y + h}`,         // bottom-left (indented)
  ].join(' ')

  return `<polygon points="${points}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" />`
}

// --- Batch 3: State diagram pseudostates ---

/** State start: small filled circle using primary text color */
function renderStateStart(x: number, y: number, w: number, h: number): string {
  const cx = x + w / 2
  const cy = y + h / 2
  const r = Math.min(w, h) / 2 - 2
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="var(--_text)" stroke="none" />`
}

/** State end: bullseye — outer ring + inner filled circle using primary text color */
function renderStateEnd(x: number, y: number, w: number, h: number): string {
  const cx = x + w / 2
  const cy = y + h / 2
  const outerR = Math.min(w, h) / 2 - 2
  const innerR = outerR - 4
  return (
    `<circle cx="${cx}" cy="${cy}" r="${outerR}" ` +
    `fill="none" stroke="var(--_text)" stroke-width="${STROKE_WIDTHS.innerBox * 2}" />` +
    `\n<circle cx="${cx}" cy="${cy}" r="${innerR}" fill="var(--_text)" stroke="none" />`
  )
}

// ============================================================================
// Node label rendering
// ============================================================================

function renderNodeLabel(node: PositionedNode, font: string): string {
  // State pseudostates have no label
  if (node.shape === 'state-start' || node.shape === 'state-end') {
    if (!node.label) return ''
  }

  const cx = node.x + node.width / 2
  const cy = node.y + node.height / 2

  // Resolve text color — inline styles can override the CSS variable default
  const textColor = escapeXml(node.inlineStyle?.color ?? 'var(--_text)')

  return (
    `<text x="${cx}" y="${cy}" text-anchor="middle" dy="${TEXT_BASELINE_SHIFT}" ` +
    `font-size="${FONT_SIZES.nodeLabel}" font-weight="${FONT_WEIGHTS.nodeLabel}" ` +
    `fill="${textColor}">${escapeXml(node.label)}</text>`
  )
}

// ============================================================================
// Utilities
// ============================================================================

/** Escape special XML characters in text content */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
