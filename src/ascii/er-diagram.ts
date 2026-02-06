// ============================================================================
// ASCII renderer — ER diagrams
//
// Renders erDiagram text to ASCII/Unicode art.
// Each entity is a 2-section box (header | attributes).
// Relationships are drawn as lines with crow's foot notation at endpoints.
//
// Layout: entities are placed in a grid pattern (multiple rows if needed).
// Relationship lines use Manhattan routing between entity boxes.
// ============================================================================

import { parseErDiagram } from '../er/parser.ts'
import type { ErDiagram, ErEntity, ErAttribute, Cardinality } from '../er/types.ts'
import type { Canvas, AsciiConfig } from './types.ts'
import { mkCanvas, canvasToString, increaseSize } from './canvas.ts'
import { drawMultiBox } from './draw.ts'
import { displayWidth, drawTextWide } from './display-width.ts'

// ============================================================================
// Entity box content
// ============================================================================

/** Format an attribute line: "PK type name" or "FK type name" etc. */
function formatAttribute(attr: ErAttribute): string {
  const keyStr = attr.keys.length > 0 ? attr.keys.join(',') + ' ' : '   '
  return `${keyStr}${attr.type} ${attr.name}`
}

/** Build sections for an entity box: [header], [attributes] */
function buildEntitySections(entity: ErEntity): string[][] {
  const header = [entity.label]
  const attrs = entity.attributes.map(formatAttribute)
  if (attrs.length === 0) return [header]
  return [header, attrs]
}

// ============================================================================
// Crow's foot notation
// ============================================================================

/**
 * Returns the ASCII/Unicode characters for a crow's foot cardinality marker.
 * These are drawn near the endpoint of a relationship line.
 *
 * Cardinality markers (horizontal direction):
 *   one:       ──║──   or  --||--
 *   zero-one:  ──o║──  or  --o|--
 *   many:      ──╢──   or  --<|--  (or }|)
 *   zero-many: ──o╢──  or  --o<--  (or o{)
 */
function getCrowsFootChars(card: Cardinality, useAscii: boolean): string {
  if (useAscii) {
    switch (card) {
      case 'one':       return '||'
      case 'zero-one':  return 'o|'
      case 'many':      return '}|'
      case 'zero-many': return 'o{'
    }
  } else {
    switch (card) {
      case 'one':       return '║'
      case 'zero-one':  return 'o║'
      case 'many':      return '╟'
      case 'zero-many': return 'o╟'
    }
  }
}

// ============================================================================
// Positioned entity
// ============================================================================

interface PlacedEntity {
  entity: ErEntity
  sections: string[][]
  x: number
  y: number
  width: number
  height: number
}

// ============================================================================
// Layout and rendering
// ============================================================================

/**
 * Render a Mermaid ER diagram to ASCII/Unicode text.
 *
 * Pipeline: parse → build boxes → grid layout → draw boxes → draw relationships → string.
 */
export function renderErAscii(text: string, config: AsciiConfig): string {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('%%'))
  const diagram = parseErDiagram(lines)

  if (diagram.entities.length === 0) return ''

  const useAscii = config.useAscii
  const hGap = 6  // horizontal gap between entity boxes
  const vGap = 4  // vertical gap between rows (for relationship lines)

  // --- Build entity box dimensions ---
  const entitySections = new Map<string, string[][]>()
  const entityBoxW = new Map<string, number>()
  const entityBoxH = new Map<string, number>()

  for (const ent of diagram.entities) {
    const sections = buildEntitySections(ent)
    entitySections.set(ent.id, sections)

    let maxTextW = 0
    for (const section of sections) {
      for (const line of section) maxTextW = Math.max(maxTextW, displayWidth(line))
    }
    const boxW = maxTextW + 4 // 2 border + 2 padding

    let totalLines = 0
    for (const section of sections) totalLines += Math.max(section.length, 1)
    const boxH = totalLines + (sections.length - 1) + 2

    entityBoxW.set(ent.id, boxW)
    entityBoxH.set(ent.id, boxH)
  }

  // --- Layout: place entities in rows ---
  // Use a simple grid: max N entities per row (based on count).
  // Entities involved in relationships are placed adjacent when possible.
  const maxPerRow = Math.max(2, Math.ceil(Math.sqrt(diagram.entities.length)))

  const placed = new Map<string, PlacedEntity>()
  let currentX = 0
  let currentY = 0
  let maxRowH = 0
  let colCount = 0

  for (const ent of diagram.entities) {
    const w = entityBoxW.get(ent.id)!
    const h = entityBoxH.get(ent.id)!

    if (colCount >= maxPerRow) {
      // Wrap to next row
      currentY += maxRowH + vGap
      currentX = 0
      maxRowH = 0
      colCount = 0
    }

    placed.set(ent.id, {
      entity: ent,
      sections: entitySections.get(ent.id)!,
      x: currentX,
      y: currentY,
      width: w,
      height: h,
    })

    currentX += w + hGap
    maxRowH = Math.max(maxRowH, h)
    colCount++
  }

  // --- Create canvas ---
  let totalW = 0
  let totalH = 0
  for (const p of placed.values()) {
    totalW = Math.max(totalW, p.x + p.width)
    totalH = Math.max(totalH, p.y + p.height)
  }
  totalW += 4
  totalH += 2

  const canvas = mkCanvas(totalW - 1, totalH - 1)

  // --- Draw entity boxes ---
  for (const p of placed.values()) {
    const boxCanvas = drawMultiBox(p.sections, useAscii)
    for (let bx = 0; bx < boxCanvas.length; bx++) {
      for (let by = 0; by < boxCanvas[0]!.length; by++) {
        const ch = boxCanvas[bx]![by]!
        if (ch !== ' ') {
          const cx = p.x + bx
          const cy = p.y + by
          if (cx < totalW && cy < totalH) {
            canvas[cx]![cy] = ch
          }
        }
      }
    }
  }

  // --- Draw relationships ---
  const H = useAscii ? '-' : '─'
  const V = useAscii ? '|' : '│'
  const dashH = useAscii ? '.' : '╌'
  const dashV = useAscii ? ':' : '┊'

  for (const rel of diagram.relationships) {
    const e1 = placed.get(rel.entity1)
    const e2 = placed.get(rel.entity2)
    if (!e1 || !e2) continue

    const lineH = rel.identifying ? H : dashH
    const lineV = rel.identifying ? V : dashV

    // Determine connection direction based on relative position.
    // Connect from right side of left entity to left side of right entity (horizontal),
    // or from bottom of upper entity to top of lower entity (vertical).
    const e1CX = e1.x + Math.floor(e1.width / 2)
    const e1CY = e1.y + Math.floor(e1.height / 2)
    const e2CX = e2.x + Math.floor(e2.width / 2)
    const e2CY = e2.y + Math.floor(e2.height / 2)

    // Check if entities are on the same row (horizontal connection)
    const sameRow = Math.abs(e1CY - e2CY) < Math.max(e1.height, e2.height)

    if (sameRow) {
      // Horizontal connection: right side of left entity → left side of right entity
      const [left, right] = e1CX < e2CX ? [e1, e2] : [e2, e1]
      const [leftCard, rightCard] = e1CX < e2CX
        ? [rel.cardinality1, rel.cardinality2]
        : [rel.cardinality2, rel.cardinality1]

      const startX = left.x + left.width
      const endX = right.x - 1
      const lineY = left.y + Math.floor(left.height / 2)

      // Draw horizontal line
      for (let x = startX; x <= endX; x++) {
        if (x < totalW) canvas[x]![lineY] = lineH
      }

      // Draw crow's foot markers at endpoints
      const leftChars = getCrowsFootChars(leftCard, useAscii)
      for (let i = 0; i < leftChars.length; i++) {
        const mx = startX + i
        if (mx < totalW) canvas[mx]![lineY] = leftChars[i]!
      }

      const rightChars = getCrowsFootChars(rightCard, useAscii)
      for (let i = 0; i < rightChars.length; i++) {
        const mx = endX - rightChars.length + 1 + i
        if (mx >= 0 && mx < totalW) canvas[mx]![lineY] = rightChars[i]!
      }

      // Relationship label centered in the gap between the two entities, above the line.
      // Clamp label to the gap region [startX, endX] to avoid overwriting box borders.
      if (rel.label) {
        const gapMid = Math.floor((startX + endX) / 2)
        const labelStart = Math.max(startX, gapMid - Math.floor(displayWidth(rel.label) / 2))
        const labelY = lineY - 1
        if (labelY >= 0) {
          drawTextWide(canvas, labelStart, labelY, rel.label)
        }
      }
    } else {
      // Vertical connection: bottom of upper entity → top of lower entity
      const [upper, lower] = e1CY < e2CY ? [e1, e2] : [e2, e1]
      const [upperCard, lowerCard] = e1CY < e2CY
        ? [rel.cardinality1, rel.cardinality2]
        : [rel.cardinality2, rel.cardinality1]

      const startY = upper.y + upper.height
      const endY = lower.y - 1
      const lineX = upper.x + Math.floor(upper.width / 2)

      // Vertical line
      for (let y = startY; y <= endY; y++) {
        if (y < totalH) canvas[lineX]![y] = lineV
      }

      // If horizontal offset needed, add a horizontal segment
      const lowerCX = lower.x + Math.floor(lower.width / 2)
      if (lineX !== lowerCX) {
        const midY = Math.floor((startY + endY) / 2)
        // Horizontal segment at midY
        const lx = Math.min(lineX, lowerCX)
        const rx = Math.max(lineX, lowerCX)
        for (let x = lx; x <= rx; x++) {
          if (x < totalW && midY < totalH) canvas[x]![midY] = lineH
        }
        // Vertical from midY to lower entity
        for (let y = midY + 1; y <= endY; y++) {
          if (y < totalH) canvas[lowerCX]![y] = lineV
        }
      }

      // Crow's foot markers (vertical direction)
      // Place markers near the entity connection points
      const upperChars = getCrowsFootChars(upperCard, useAscii)
      if (startY < totalH) {
        for (let i = 0; i < upperChars.length; i++) {
          const mx = lineX - Math.floor(upperChars.length / 2) + i
          if (mx >= 0 && mx < totalW) canvas[mx]![startY] = upperChars[i]!
        }
      }

      const targetX = lineX !== lowerCX ? lowerCX : lineX
      const lowerChars = getCrowsFootChars(lowerCard, useAscii)
      if (endY >= 0 && endY < totalH) {
        for (let i = 0; i < lowerChars.length; i++) {
          const mx = targetX - Math.floor(lowerChars.length / 2) + i
          if (mx >= 0 && mx < totalW) canvas[mx]![endY] = lowerChars[i]!
        }
      }

      // Relationship label — placed to the right of the vertical line at the midpoint.
      // We expand the canvas as needed since labels can extend beyond the initial bounds.
      if (rel.label) {
        const midY = Math.floor((startY + endY) / 2)
        const labelX = lineX + 2
        if (midY >= 0) {
          const labelW = displayWidth(rel.label)
          increaseSize(canvas, labelX + labelW, midY + 1)
          drawTextWide(canvas, labelX, midY, rel.label)
        }
      }
    }
  }

  return canvasToString(canvas)
}
