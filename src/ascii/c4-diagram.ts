// ============================================================================
// ASCII renderer — C4 diagrams
//
// Renders C4 diagram text to ASCII/Unicode art.
// Elements are multi-section boxes with label, technology, and description.
// Person elements get a stick figure silhouette above the box.
// Boundaries are dashed-line boxes surrounding their content.
// Relationships are drawn as horizontal/vertical lines between elements.
//
// Layout: elements are placed in a grid pattern (multiple rows if needed).
// Relationship lines use Manhattan routing between element boxes.
// ============================================================================

import { parseC4 } from '../c4/parser.ts'
import type { C4Diagram, C4Element, C4Boundary, C4Relationship } from '../c4/types.ts'
import type { Canvas, AsciiConfig } from './types.ts'
import { mkCanvas, canvasToString, increaseSize, drawText } from './canvas.ts'
import { drawMultiBox } from './draw.ts'

// ============================================================================
// Element box content
// ============================================================================

/** Build sections for an element box: [label], [technology + description] */
function buildElementSections(element: C4Element): string[][] {
  const header = [element.label]
  const details: string[] = []

  if (element.technology) {
    details.push(`[${element.technology}]`)
  }
  if (element.description) {
    details.push(element.description)
  }

  if (details.length === 0) return [header]
  return [header, details]
}

/** Compute box dimensions for an element's sections */
function computeBoxSize(sections: string[][]): { width: number; height: number } {
  let maxTextW = 0
  for (const section of sections) {
    for (const line of section) maxTextW = Math.max(maxTextW, line.length)
  }
  const boxW = maxTextW + 4 // 2 border + 2 padding

  let totalLines = 0
  for (const section of sections) totalLines += Math.max(section.length, 1)
  const boxH = totalLines + (sections.length - 1) + 2

  return { width: boxW, height: boxH }
}

// ============================================================================
// Person stick figure
// ============================================================================

/** Height of the stick figure above the person box */
const PERSON_FIGURE_HEIGHT = 3

/**
 * Draw a person stick figure on the canvas.
 * The figure is drawn above the box at (boxX, boxY).
 *
 * Unicode:
 *    ┌─┐
 *    │ │
 *   ─┴─┴─
 *
 * ASCII:
 *    +-+
 *    | |
 *   -+-+-
 */
function drawPersonFigure(
  canvas: Canvas,
  boxX: number,
  boxY: number,
  boxWidth: number,
  useAscii: boolean,
): void {
  const cx = boxX + Math.floor(boxWidth / 2)
  const figureY = boxY - PERSON_FIGURE_HEIGHT

  if (figureY < 0) return

  if (useAscii) {
    // Head: +-+
    const headX = cx - 1
    if (headX >= 0) {
      increaseSize(canvas, headX + 2 + 1, figureY + 1)
      canvas[headX]![figureY] = '+'
      canvas[headX + 1]![figureY] = '-'
      canvas[headX + 2]![figureY] = '+'
    }
    // Body: | |
    if (headX >= 0) {
      increaseSize(canvas, headX + 2 + 1, figureY + 1 + 1)
      canvas[headX]![figureY + 1] = '|'
      canvas[headX + 1]![figureY + 1] = ' '
      canvas[headX + 2]![figureY + 1] = '|'
    }
    // Base: -+-+-
    const baseX = cx - 2
    if (baseX >= 0) {
      increaseSize(canvas, baseX + 4 + 1, figureY + 2 + 1)
      canvas[baseX]![figureY + 2] = '-'
      canvas[baseX + 1]![figureY + 2] = '+'
      canvas[baseX + 2]![figureY + 2] = '-'
      canvas[baseX + 3]![figureY + 2] = '+'
      canvas[baseX + 4]![figureY + 2] = '-'
    }
  } else {
    // Head: ┌─┐
    const headX = cx - 1
    if (headX >= 0) {
      increaseSize(canvas, headX + 2 + 1, figureY + 1)
      canvas[headX]![figureY] = '\u250C'     // ┌
      canvas[headX + 1]![figureY] = '\u2500'  // ─
      canvas[headX + 2]![figureY] = '\u2510'  // ┐
    }
    // Body: │ │
    if (headX >= 0) {
      increaseSize(canvas, headX + 2 + 1, figureY + 1 + 1)
      canvas[headX]![figureY + 1] = '\u2502'      // │
      canvas[headX + 1]![figureY + 1] = ' '
      canvas[headX + 2]![figureY + 1] = '\u2502'  // │
    }
    // Base: ─┴─┴─
    const baseX = cx - 2
    if (baseX >= 0) {
      increaseSize(canvas, baseX + 4 + 1, figureY + 2 + 1)
      canvas[baseX]![figureY + 2] = '\u2500'      // ─
      canvas[baseX + 1]![figureY + 2] = '\u2534'  // ┴
      canvas[baseX + 2]![figureY + 2] = '\u2500'  // ─
      canvas[baseX + 3]![figureY + 2] = '\u2534'  // ┴
      canvas[baseX + 4]![figureY + 2] = '\u2500'  // ─
    }
  }
}

// ============================================================================
// Boundary box drawing
// ============================================================================

/**
 * Draw a dashed-line boundary box on the canvas.
 *
 * Unicode uses box-drawing dashes: ╌ (horizontal) and ┊ (vertical).
 * ASCII uses . (horizontal) and : (vertical).
 */
function drawBoundaryBox(
  canvas: Canvas,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  useAscii: boolean,
): void {
  if (width <= 0 || height <= 0) return
  // Clamp negative coordinates to 0
  if (x < 0) { width += x; x = 0 }
  if (y < 0) { height += y; y = 0 }
  if (width <= 0 || height <= 0) return

  const right = x + width - 1
  const bottom = y + height - 1

  increaseSize(canvas, right + 1, bottom + 1)

  const hDash = useAscii ? '.' : '\u254C' // ╌
  const vDash = useAscii ? ':' : '\u250A' // ┊
  const corner = useAscii ? '+' : '+'

  // Corners
  canvas[x]![y] = corner
  canvas[right]![y] = corner
  canvas[x]![bottom] = corner
  canvas[right]![bottom] = corner

  // Top and bottom edges
  for (let cx = x + 1; cx < right; cx++) {
    canvas[cx]![y] = hDash
    canvas[cx]![bottom] = hDash
  }

  // Left and right edges
  for (let cy = y + 1; cy < bottom; cy++) {
    canvas[x]![cy] = vDash
    canvas[right]![cy] = vDash
  }

  // Label in top-left corner, inside the border
  if (label.length > 0) {
    const labelX = x + 2
    const labelY = y + 1
    if (labelY < bottom) {
      for (let i = 0; i < label.length; i++) {
        const lx = labelX + i
        if (lx < right) {
          canvas[lx]![labelY] = label[i]!
        }
      }
    }
  }
}

// ============================================================================
// Positioned element
// ============================================================================

interface PlacedElement {
  element: C4Element
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
 * Render a Mermaid C4 diagram to ASCII/Unicode text.
 *
 * Pipeline: parse -> build boxes -> grid layout -> draw boundaries -> draw boxes -> draw relationships -> string.
 */
export function renderC4Ascii(text: string, config: AsciiConfig): string {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('%%'))
  const diagram = parseC4(lines)

  if (diagram.elements.length === 0) return ''

  const useAscii = config.useAscii
  const hGap = 6  // horizontal gap between element boxes
  const vGap = 4  // vertical gap between rows

  // --- Build element box dimensions ---
  const elementSections = new Map<string, string[][]>()
  const elementBoxW = new Map<string, number>()
  const elementBoxH = new Map<string, number>()

  for (const el of diagram.elements) {
    const sections = buildElementSections(el)
    elementSections.set(el.alias, sections)

    const size = computeBoxSize(sections)

    // Person elements need extra height for the stick figure
    const extraH = el.kind === 'Person' ? PERSON_FIGURE_HEIGHT : 0

    elementBoxW.set(el.alias, Math.max(size.width, 16))
    elementBoxH.set(el.alias, size.height + extraH)
  }

  // --- Layout: place elements in rows ---
  const maxPerRow = Math.max(2, Math.ceil(Math.sqrt(diagram.elements.length)))

  const placed = new Map<string, PlacedElement>()
  let currentX = 0
  let currentY = 0
  let maxRowH = 0
  let colCount = 0

  for (const el of diagram.elements) {
    const w = elementBoxW.get(el.alias)!
    const h = elementBoxH.get(el.alias)!

    if (colCount >= maxPerRow) {
      currentY += maxRowH + vGap
      currentX = 0
      maxRowH = 0
      colCount = 0
    }

    placed.set(el.alias, {
      element: el,
      sections: elementSections.get(el.alias)!,
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

  // --- Draw boundary boxes ---
  drawBoundariesRecursive(canvas, diagram.boundaries, placed, useAscii)

  // --- Draw element boxes ---
  for (const p of placed.values()) {
    const isPerson = p.element.kind === 'Person'
    const boxY = isPerson ? p.y + PERSON_FIGURE_HEIGHT : p.y
    const boxSections = p.sections

    const boxCanvas = drawMultiBox(boxSections, useAscii)
    for (let bx = 0; bx < boxCanvas.length; bx++) {
      for (let by = 0; by < boxCanvas[0]!.length; by++) {
        const ch = boxCanvas[bx]![by]!
        if (ch !== ' ') {
          const cx = p.x + bx
          const cy = boxY + by
          if (cx < totalW && cy < totalH) {
            canvas[cx]![cy] = ch
          }
        }
      }
    }

    // Draw stick figure for Person elements
    if (isPerson) {
      const boxW = computeBoxSize(boxSections).width
      drawPersonFigure(canvas, p.x, boxY, boxW, useAscii)
    }
  }

  // --- Draw relationships ---
  const H = useAscii ? '-' : '\u2500'  // ─
  const V = useAscii ? '|' : '\u2502'  // │

  for (const rel of diagram.relationships) {
    const e1 = placed.get(rel.from)
    const e2 = placed.get(rel.to)
    if (!e1 || !e2) continue

    const e1CX = e1.x + Math.floor(e1.width / 2)
    const e1CY = e1.y + Math.floor(e1.height / 2)
    const e2CX = e2.x + Math.floor(e2.width / 2)
    const e2CY = e2.y + Math.floor(e2.height / 2)

    const sameRow = Math.abs(e1CY - e2CY) < Math.max(e1.height, e2.height)

    if (sameRow) {
      // Horizontal connection
      const [left, right] = e1CX < e2CX ? [e1, e2] : [e2, e1]
      const startX = left.x + left.width
      const endX = right.x - 1
      const lineY = left.y + Math.floor(left.height / 2)

      for (let lx = startX; lx <= endX; lx++) {
        if (lx < totalW) canvas[lx]![lineY] = H
      }

      // Arrow head at right end
      if (endX >= 0 && endX < totalW) {
        canvas[endX]![lineY] = useAscii ? '>' : '\u25BA' // ►
      }

      // Relationship label centered in the gap, above the line
      const labelText = buildRelLabel(rel)
      if (labelText) {
        const gapMid = Math.floor((startX + endX) / 2)
        const labelStart = Math.max(startX, gapMid - Math.floor(labelText.length / 2))
        const labelY = lineY - 1
        if (labelY >= 0) {
          for (let i = 0; i < labelText.length; i++) {
            const lx = labelStart + i
            if (lx >= startX && lx <= endX && lx < totalW) {
              canvas[lx]![labelY] = labelText[i]!
            }
          }
        }
      }
    } else {
      // Vertical connection
      const [upper, lower] = e1CY < e2CY ? [e1, e2] : [e2, e1]
      const startY = upper.y + upper.height
      const endY = lower.y - 1
      const lineX = upper.x + Math.floor(upper.width / 2)

      for (let ly = startY; ly <= endY; ly++) {
        if (ly < totalH) canvas[lineX]![ly] = V
      }

      // Arrow head at bottom end
      if (endY >= 0 && endY < totalH) {
        canvas[lineX]![endY] = useAscii ? 'v' : '\u25BC' // ▼
      }

      // Horizontal adjustment if needed
      const lowerCX = lower.x + Math.floor(lower.width / 2)
      if (lineX !== lowerCX) {
        const midY = Math.floor((startY + endY) / 2)
        const lx = Math.min(lineX, lowerCX)
        const rx = Math.max(lineX, lowerCX)
        for (let lxi = lx; lxi <= rx; lxi++) {
          if (lxi < totalW && midY < totalH) canvas[lxi]![midY] = H
        }
        for (let ly = midY + 1; ly <= endY; ly++) {
          if (ly < totalH) canvas[lowerCX]![ly] = V
        }
        // Arrow head at bottom of adjusted line
        if (endY >= 0 && endY < totalH) {
          canvas[lowerCX]![endY] = useAscii ? 'v' : '\u25BC' // ▼
        }
      }

      // Relationship label to the right of the vertical line
      const labelText = buildRelLabel(rel)
      if (labelText) {
        const midY = Math.floor((startY + endY) / 2)
        const labelX = lineX + 2
        if (midY >= 0) {
          for (let i = 0; i < labelText.length; i++) {
            const lx = labelX + i
            if (lx >= 0) {
              increaseSize(canvas, lx + 1, midY + 1)
              canvas[lx]![midY] = labelText[i]!
            }
          }
        }
      }
    }
  }

  return canvasToString(canvas)
}

// ============================================================================
// Helpers
// ============================================================================

/** Build a relationship label combining label and optional technology */
function buildRelLabel(rel: C4Relationship): string {
  if (rel.technology) {
    return `${rel.label} [${rel.technology}]`
  }
  return rel.label
}

/** Recursively draw boundary boxes around their child elements */
function drawBoundariesRecursive(
  canvas: Canvas,
  boundaries: C4Boundary[],
  placed: Map<string, PlacedElement>,
  useAscii: boolean,
): void {
  for (const boundary of boundaries) {
    // Find bounding box of all elements in this boundary
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity

    for (const el of boundary.elements) {
      const p = placed.get(el.alias)
      if (p) {
        minX = Math.min(minX, p.x)
        minY = Math.min(minY, p.y)
        maxX = Math.max(maxX, p.x + p.width)
        maxY = Math.max(maxY, p.y + p.height)
      }
    }

    // Include child boundaries in the bounding box
    collectChildBoundaryBounds(boundary.childBoundaries, placed, {
      update(x1: number, y1: number, x2: number, y2: number) {
        minX = Math.min(minX, x1)
        minY = Math.min(minY, y1)
        maxX = Math.max(maxX, x2)
        maxY = Math.max(maxY, y2)
      },
    })

    if (minX !== Infinity) {
      // Add padding around elements
      const padX = 2
      const padY = 2
      const headerH = 2 // space for boundary label

      const bx = minX - padX
      const by = minY - padY - headerH
      const bw = (maxX - minX) + padX * 2 + 1
      const bh = (maxY - minY) + padY * 2 + headerH + 1

      drawBoundaryBox(canvas, bx, by, bw, bh, boundary.label, useAscii)
    }

    // Recursively draw child boundaries
    drawBoundariesRecursive(canvas, boundary.childBoundaries, placed, useAscii)
  }
}

/** Collect bounding box coordinates from nested child boundaries */
function collectChildBoundaryBounds(
  boundaries: C4Boundary[],
  placed: Map<string, PlacedElement>,
  accumulator: { update(x1: number, y1: number, x2: number, y2: number): void },
): void {
  for (const boundary of boundaries) {
    for (const el of boundary.elements) {
      const p = placed.get(el.alias)
      if (p) {
        accumulator.update(p.x, p.y, p.x + p.width, p.y + p.height)
      }
    }
    collectChildBoundaryBounds(boundary.childBoundaries, placed, accumulator)
  }
}
