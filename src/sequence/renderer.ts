import type { PositionedSequenceDiagram, PositionedActor, Lifeline, PositionedMessage, Activation, PositionedBlock, PositionedNote } from './types.ts'
import type { DiagramColors, ResolvedColors } from '../theme.ts'
import { svgOpenTag, buildStyleBlock, svgOpenTagStatic, buildStaticStyleBlock, createColorFn } from '../theme.ts'
import { FONT_SIZES, FONT_WEIGHTS, STROKE_WIDTHS, ARROW_HEAD, estimateTextWidth, TEXT_BASELINE_SHIFT } from '../styles.ts'

// ============================================================================
// Sequence diagram SVG renderer
//
// Renders a positioned sequence diagram to SVG string.
// All colors use CSS custom properties (var(--_xxx)) from the theme system.
//
// Render order (back to front):
//   1. Block backgrounds (loop/alt/opt)
//   2. Lifelines (dashed vertical lines)
//   3. Activation boxes
//   4. Messages (arrows with labels)
//   5. Notes
//   6. Actor boxes (at top)
// ============================================================================

/**
 * Render a positioned sequence diagram as an SVG string.
 *
 * @param colors - DiagramColors with bg/fg and optional enrichment variables.
 * @param transparent - If true, renders with transparent background.
 */
/** Color accessor function type */
type ColorFn = ReturnType<typeof createColorFn>

export function renderSequenceSvg(
  diagram: PositionedSequenceDiagram,
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

  // SVG root with CSS variables + style block + defs
  if (resolved) {
    parts.push(svgOpenTagStatic(diagram.width, diagram.height, resolved.bg, transparent, font, noStyleBlock))
    parts.push(buildStaticStyleBlock(font, false, noStyleBlock))
  } else {
    parts.push(svgOpenTag(diagram.width, diagram.height, colors, transparent))
    parts.push(buildStyleBlock(font, false))
  }
  parts.push('<defs>')

  // Arrow marker definitions
  parts.push(arrowMarkerDefs(c, mid))
  parts.push('</defs>')

  // 1. Block backgrounds (loop/alt/opt rectangles)
  for (const block of diagram.blocks) {
    parts.push(renderBlock(block, c))
  }

  // 2. Lifelines (dashed vertical lines from actor to bottom)
  for (const lifeline of diagram.lifelines) {
    parts.push(renderLifeline(lifeline, c))
  }

  // 3. Activation boxes
  for (const activation of diagram.activations) {
    parts.push(renderActivation(activation, c))
  }

  // 4. Messages (horizontal arrows with labels)
  for (const message of diagram.messages) {
    parts.push(renderMessage(message, c, mid))
  }

  // 5. Notes
  for (const note of diagram.notes) {
    parts.push(renderNote(note, c))
  }

  // 6. Actor boxes at top (rendered last so they're on top)
  for (const actor of diagram.actors) {
    parts.push(renderActor(actor, c))
  }

  parts.push('</svg>')
  return parts.join('\n')
}

// ============================================================================
// Arrow marker definitions
// ============================================================================

function arrowMarkerDefs(c: ColorFn, mid: string): string {
  const w = ARROW_HEAD.width
  const h = ARROW_HEAD.height
  return (
    `  <marker id="${mid}seq-arrow" markerWidth="${w}" markerHeight="${h}" refX="${w}" refY="${h / 2}" orient="auto-start-reverse">` +
    `\n    <polygon points="0 0, ${w} ${h / 2}, 0 ${h}" fill="${c('_arrow')}" />` +
    `\n  </marker>` +
    // Open arrow head (just lines, no fill)
    `\n  <marker id="${mid}seq-arrow-open" markerWidth="${w}" markerHeight="${h}" refX="${w}" refY="${h / 2}" orient="auto-start-reverse">` +
    `\n    <polyline points="0 0, ${w} ${h / 2}, 0 ${h}" fill="none" stroke="${c('_arrow')}" stroke-width="1" />` +
    `\n  </marker>`
  )
}

// ============================================================================
// Component renderers
// ============================================================================

/** Render an actor box (participant = rectangle, actor = stick figure) */
function renderActor(actor: PositionedActor, c: ColorFn): string {
  const { x, y, width, height, label, type } = actor

  if (type === 'actor') {
    const s = (height / 24) * 0.9
    const tx = x - 12 * s
    const ty = y + (height - 24 * s) / 2
    const sw = STROKE_WIDTHS.outerBox / s
    const iconStroke = c('_line')

    return (
      `<g transform="translate(${tx},${ty}) scale(${s})">` +
      `\n  <path d="M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" fill="none" stroke="${iconStroke}" stroke-width="${sw}" />` +
      `\n  <path d="M15 10C15 11.6569 13.6569 13 12 13C10.3431 13 9 11.6569 9 10C9 8.34315 10.3431 7 12 7C13.6569 7 15 8.34315 15 10Z" fill="none" stroke="${iconStroke}" stroke-width="${sw}" />` +
      `\n  <path d="M5.62842 18.3563C7.08963 17.0398 9.39997 16 12 16C14.6 16 16.9104 17.0398 18.3716 18.3563" fill="none" stroke="${iconStroke}" stroke-width="${sw}" />` +
      `\n</g>` +
      `\n<text x="${x}" y="${y + height + 14}" text-anchor="middle" font-size="${FONT_SIZES.nodeLabel}" font-weight="${FONT_WEIGHTS.nodeLabel}" fill="${c('_text')}">${escapeXml(label)}</text>`
    )
  }

  // Participant: rectangle box with label
  const boxX = x - width / 2
  return (
    `<rect x="${boxX}" y="${y}" width="${width}" height="${height}" rx="4" ry="4" ` +
    `fill="${c('_node-fill')}" stroke="${c('_node-stroke')}" stroke-width="${STROKE_WIDTHS.outerBox}" />` +
    `\n<text x="${x}" y="${y + height / 2}" text-anchor="middle" dy="${TEXT_BASELINE_SHIFT}" ` +
    `font-size="${FONT_SIZES.nodeLabel}" font-weight="${FONT_WEIGHTS.nodeLabel}" fill="${c('_text')}">${escapeXml(label)}</text>`
  )
}

/** Render a lifeline (dashed vertical line from actor to bottom) */
function renderLifeline(lifeline: Lifeline, c: ColorFn): string {
  return (
    `<line x1="${lifeline.x}" y1="${lifeline.topY}" x2="${lifeline.x}" y2="${lifeline.bottomY}" ` +
    `stroke="${c('_line')}" stroke-width="0.75" stroke-dasharray="6 4" />`
  )
}

/** Render an activation box (narrow filled rectangle on lifeline) */
function renderActivation(activation: Activation, c: ColorFn): string {
  return (
    `<rect x="${activation.x}" y="${activation.topY}" width="${activation.width}" height="${activation.bottomY - activation.topY}" ` +
    `fill="${c('_node-fill')}" stroke="${c('_node-stroke')}" stroke-width="${STROKE_WIDTHS.innerBox}" />`
  )
}

/** Render a message arrow with label */
function renderMessage(msg: PositionedMessage, c: ColorFn, mid: string): string {
  const parts: string[] = []
  const dashArray = msg.lineStyle === 'dashed' ? ' stroke-dasharray="6 4"' : ''
  const markerDefId = msg.arrowHead === 'filled' ? `${mid}seq-arrow` : `${mid}seq-arrow-open`

  if (msg.isSelf) {
    // Self-message: curved loop going right and back
    const loopW = 30
    const loopH = 20
    parts.push(
      `<polyline points="${msg.x1},${msg.y} ${msg.x1 + loopW},${msg.y} ${msg.x1 + loopW},${msg.y + loopH} ${msg.x2},${msg.y + loopH}" ` +
      `fill="none" stroke="${c('_line')}" stroke-width="${STROKE_WIDTHS.connector}"${dashArray} marker-end="url(#${markerDefId})" />`
    )
    // Label to the right of the loop
    parts.push(
      `<text x="${msg.x1 + loopW + 6}" y="${msg.y + loopH / 2}" dy="${TEXT_BASELINE_SHIFT}" ` +
      `font-size="${FONT_SIZES.edgeLabel}" font-weight="${FONT_WEIGHTS.edgeLabel}" fill="${c('_text-muted')}">${escapeXml(msg.label)}</text>`
    )
  } else {
    // Normal message: horizontal arrow
    parts.push(
      `<line x1="${msg.x1}" y1="${msg.y}" x2="${msg.x2}" y2="${msg.y}" ` +
      `stroke="${c('_line')}" stroke-width="${STROKE_WIDTHS.connector}"${dashArray} marker-end="url(#${markerDefId})" />`
    )
    // Label above the arrow, centered
    const midX = (msg.x1 + msg.x2) / 2
    parts.push(
      `<text x="${midX}" y="${msg.y - 6}" text-anchor="middle" ` +
      `font-size="${FONT_SIZES.edgeLabel}" font-weight="${FONT_WEIGHTS.edgeLabel}" fill="${c('_text-muted')}">${escapeXml(msg.label)}</text>`
    )
  }

  return parts.join('\n')
}

/** Render a block background (loop/alt/opt) */
function renderBlock(block: PositionedBlock, c: ColorFn): string {
  const parts: string[] = []

  // Outer rectangle
  parts.push(
    `<rect x="${block.x}" y="${block.y}" width="${block.width}" height="${block.height}" ` +
    `rx="0" ry="0" fill="none" stroke="${c('_node-stroke')}" stroke-width="${STROKE_WIDTHS.outerBox}" />`
  )

  // Type label tab (top-left corner)
  const labelText = `${block.type}${block.label ? ` [${block.label}]` : ''}`
  const tabWidth = estimateTextWidth(labelText, FONT_SIZES.edgeLabel, FONT_WEIGHTS.groupHeader) + 16
  const tabHeight = 18

  parts.push(
    `<rect x="${block.x}" y="${block.y}" width="${tabWidth}" height="${tabHeight}" ` +
    `fill="${c('_group-hdr')}" stroke="${c('_node-stroke')}" stroke-width="${STROKE_WIDTHS.outerBox}" />`
  )
  parts.push(
    `<text x="${block.x + 6}" y="${block.y + tabHeight / 2}" dy="${TEXT_BASELINE_SHIFT}" ` +
    `font-size="${FONT_SIZES.edgeLabel}" font-weight="${FONT_WEIGHTS.groupHeader}" fill="${c('_text-sec')}">${escapeXml(labelText)}</text>`
  )

  // Divider lines (for alt/else, par/and)
  for (const divider of block.dividers) {
    parts.push(
      `<line x1="${block.x}" y1="${divider.y}" x2="${block.x + block.width}" y2="${divider.y}" ` +
      `stroke="${c('_line')}" stroke-width="0.75" stroke-dasharray="6 4" />`
    )
    if (divider.label) {
      parts.push(
        `<text x="${block.x + 8}" y="${divider.y + 14}" font-size="${FONT_SIZES.edgeLabel}" ` +
        `font-weight="${FONT_WEIGHTS.edgeLabel}" fill="${c('_text-muted')}">[${escapeXml(divider.label)}]</text>`
      )
    }
  }

  return parts.join('\n')
}

/** Render a note box */
function renderNote(note: PositionedNote, c: ColorFn): string {
  // Folded corner effect: note rectangle + small triangle in top-right
  const foldSize = 6
  return (
    `<rect x="${note.x}" y="${note.y}" width="${note.width}" height="${note.height}" ` +
    `fill="${c('_group-hdr')}" stroke="${c('_node-stroke')}" stroke-width="${STROKE_WIDTHS.innerBox}" />` +
    // Fold triangle
    `\n<polygon points="${note.x + note.width - foldSize},${note.y} ${note.x + note.width},${note.y + foldSize} ${note.x + note.width - foldSize},${note.y + foldSize}" ` +
    `fill="${c('_inner-stroke')}" />` +
    // Note text
    `\n<text x="${note.x + note.width / 2}" y="${note.y + note.height / 2}" text-anchor="middle" dy="${TEXT_BASELINE_SHIFT}" ` +
    `font-size="${FONT_SIZES.edgeLabel}" font-weight="${FONT_WEIGHTS.edgeLabel}" fill="${c('_text-muted')}">${escapeXml(note.text)}</text>`
  )
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
