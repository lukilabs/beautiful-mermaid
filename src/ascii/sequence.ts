// ============================================================================
// ASCII renderer — sequence diagrams
//
// Renders sequenceDiagram text to ASCII/Unicode art using a column-based layout.
// Each actor occupies a column with a vertical lifeline; messages are horizontal
// arrows between lifelines. Blocks (loop/alt/opt/par) wrap around message groups.
//
// Layout is fundamentally different from flowcharts — no grid or A* pathfinding.
// Instead: actors → columns, messages → rows, all positioned linearly.
// ============================================================================

import { parseSequenceDiagram } from '../sequence/parser.ts'
import type { SequenceDiagram, Block } from '../sequence/types.ts'
import type { Canvas, AsciiConfig } from './types.ts'
import { mkCanvas, canvasToString, increaseSize, drawText } from './canvas.ts'
import { charWidth, stringWidth } from './text-width.ts'

/**
 * Render a Mermaid sequence diagram to ASCII/Unicode text.
 *
 * Pipeline: parse → layout (columns + rows) → draw onto canvas → string.
 */
export function renderSequenceAscii(text: string, config: AsciiConfig): string {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('%%'))
  const diagram = parseSequenceDiagram(lines)

  if (diagram.actors.length === 0) return ''

  const useAscii = config.useAscii

  // Box-drawing characters
  const H = useAscii ? '-' : '─'
  const V = useAscii ? '|' : '│'
  const TL = useAscii ? '+' : '┌'
  const TR = useAscii ? '+' : '┐'
  const BL = useAscii ? '+' : '└'
  const BR = useAscii ? '+' : '┘'
  const JT = useAscii ? '+' : '┬' // top junction on lifeline
  const JB = useAscii ? '+' : '┴' // bottom junction on lifeline
  const JL = useAscii ? '+' : '├' // left junction
  const JR = useAscii ? '+' : '┤' // right junction

  // ---- LAYOUT: compute lifeline X positions ----

  const actorIdx = new Map<string, number>()
  diagram.actors.forEach((a, i) => actorIdx.set(a.id, i))

  const boxPad = 1
  const actorBoxWidths = diagram.actors.map(a => stringWidth(a.label) + 2 * boxPad + 2)
  const halfBox = actorBoxWidths.map(w => Math.ceil(w / 2))
  const actorBoxH = 3 // top border + label row + bottom border

  // Compute minimum gap between adjacent lifelines based on message labels.
  // For messages spanning multiple actors, distribute the required width across gaps.
  const adjMaxWidth: number[] = new Array(Math.max(diagram.actors.length - 1, 0)).fill(0)

  for (const msg of diagram.messages) {
    const fi = actorIdx.get(msg.from)!
    const ti = actorIdx.get(msg.to)!
    if (fi === ti) continue // self-messages don't affect spacing
    const lo = Math.min(fi, ti)
    const hi = Math.max(fi, ti)
    // Required gap per span = (label + arrow decorations) / number of gaps
    const needed = stringWidth(msg.label) + 4
    const numGaps = hi - lo
    const perGap = Math.ceil(needed / numGaps)
    for (let g = lo; g < hi; g++) {
      adjMaxWidth[g] = Math.max(adjMaxWidth[g]!, perGap)
    }
  }

  // Compute lifeline x-positions (greedy left-to-right)
  const llX: number[] = [halfBox[0]!]
  for (let i = 1; i < diagram.actors.length; i++) {
    const gap = Math.max(
      halfBox[i - 1]! + halfBox[i]! + 2,
      adjMaxWidth[i - 1]! + 2,
      10,
    )
    llX[i] = llX[i - 1]! + gap
  }

  // ---- LAYOUT: compute vertical positions for messages ----

  // For each message index, track the y where its arrow is drawn.
  // Also track block start/end y positions and divider y positions.
  const msgArrowY: number[] = []
  const msgLabelY: number[] = []
  const blockStartY = new Map<number, number>()
  const blockEndY = new Map<number, number>()
  const divYMap = new Map<string, number>() // "blockIdx:divIdx" → y
  const notePositions: Array<{ x: number; y: number; width: number; height: number; lines: string[] }> = []

  let curY = actorBoxH // start right below header boxes

  for (let m = 0; m < diagram.messages.length; m++) {
    // Block openings at this message
    for (let b = 0; b < diagram.blocks.length; b++) {
      if (diagram.blocks[b]!.startIndex === m) {
        curY += 2 // 1 blank + 1 header row
        blockStartY.set(b, curY - 1)
      }
    }

    // Dividers at this message index
    for (let b = 0; b < diagram.blocks.length; b++) {
      for (let d = 0; d < diagram.blocks[b]!.dividers.length; d++) {
        if (diagram.blocks[b]!.dividers[d]!.index === m) {
          curY += 1
          divYMap.set(`${b}:${d}`, curY)
          curY += 1
        }
      }
    }

    curY += 1 // blank row before message

    const msg = diagram.messages[m]!
    const isSelf = msg.from === msg.to

    if (isSelf) {
      // Self-message occupies 3 rows: top-arm, label-col, bottom-arm
      msgLabelY[m] = curY + 1
      msgArrowY[m] = curY
      curY += 3
    } else {
      // Normal message: label row then arrow row
      msgLabelY[m] = curY
      msgArrowY[m] = curY + 1
      curY += 2
    }

    // Notes after this message
    for (let n = 0; n < diagram.notes.length; n++) {
      if (diagram.notes[n]!.afterIndex === m) {
        curY += 1
        const note = diagram.notes[n]!
        const nLines = note.text.split('\\n')
        const nWidth = Math.max(...nLines.map(l => stringWidth(l))) + 4
        const nHeight = nLines.length + 2

        // Determine x position based on note.position
        const aIdx = actorIdx.get(note.actorIds[0]!) ?? 0
        let nx: number
        if (note.position === 'left') {
          nx = llX[aIdx]! - nWidth - 1
        } else if (note.position === 'right') {
          nx = llX[aIdx]! + 2
        } else {
          // 'over' — center over actor(s)
          if (note.actorIds.length >= 2) {
            const aIdx2 = actorIdx.get(note.actorIds[1]!) ?? aIdx
            nx = Math.floor((llX[aIdx]! + llX[aIdx2]!) / 2) - Math.floor(nWidth / 2)
          } else {
            nx = llX[aIdx]! - Math.floor(nWidth / 2)
          }
        }
        nx = Math.max(0, nx)

        notePositions.push({ x: nx, y: curY, width: nWidth, height: nHeight, lines: nLines })
        curY += nHeight
      }
    }

    // Block closings after this message
    for (let b = 0; b < diagram.blocks.length; b++) {
      if (diagram.blocks[b]!.endIndex === m) {
        curY += 1
        blockEndY.set(b, curY)
        curY += 1
      }
    }
  }

  curY += 1 // gap before footer
  const footerY = curY
  const totalH = footerY + actorBoxH

  // Total canvas width
  const lastLL = llX[llX.length - 1] ?? 0
  const lastHalf = halfBox[halfBox.length - 1] ?? 0
  let totalW = lastLL + lastHalf + 2

  // Ensure canvas is wide enough for self-message labels and notes
  for (let m = 0; m < diagram.messages.length; m++) {
    const msg = diagram.messages[m]!
    if (msg.from === msg.to) {
      const fi = actorIdx.get(msg.from)!
      const selfRight = llX[fi]! + 6 + 2 + stringWidth(msg.label)
      totalW = Math.max(totalW, selfRight + 1)
    }
  }
  for (const np of notePositions) {
    totalW = Math.max(totalW, np.x + np.width + 1)
  }

  const canvas = mkCanvas(totalW, totalH - 1)

  // ---- DRAW: helper to place a bordered actor box ----

  const ZERO_WIDTH = '\u200b'

  function drawTextClipped(x: number, y: number, text: string, maxX: number): void {
    let cx = x
    for (const ch of text) {
      const w = charWidth(ch)
      if (w === 0) {
        if (cx <= maxX) canvas[cx]![y] = ch
        continue
      }
      if (cx + w - 1 > maxX) break
      canvas[cx]![y] = ch
      for (let i = 1; i < w; i++) {
        if (canvas[cx + i]![y] === ' ') {
          canvas[cx + i]![y] = ZERO_WIDTH
        }
      }
      cx += w
    }
  }

  function drawActorBox(cx: number, topY: number, label: string): void {
    const w = stringWidth(label) + 2 * boxPad + 2
    const left = cx - Math.floor(w / 2)
    // Top border
    canvas[left]![topY] = TL
    for (let x = 1; x < w - 1; x++) canvas[left + x]![topY] = H
    canvas[left + w - 1]![topY] = TR
    // Sides + label
    canvas[left]![topY + 1] = V
    canvas[left + w - 1]![topY + 1] = V
    const ls = left + 1 + boxPad
    drawText(canvas, { x: ls, y: topY + 1 }, label)
    // Bottom border
    canvas[left]![topY + 2] = BL
    for (let x = 1; x < w - 1; x++) canvas[left + x]![topY + 2] = H
    canvas[left + w - 1]![topY + 2] = BR
  }

  // ---- DRAW: lifelines ----

  for (let i = 0; i < diagram.actors.length; i++) {
    const x = llX[i]!
    for (let y = actorBoxH; y <= footerY; y++) {
      canvas[x]![y] = V
    }
  }

  // ---- DRAW: actor header + footer boxes (drawn over lifelines) ----

  for (let i = 0; i < diagram.actors.length; i++) {
    const actor = diagram.actors[i]!
    drawActorBox(llX[i]!, 0, actor.label)
    drawActorBox(llX[i]!, footerY, actor.label)

    // Lifeline junctions on box borders (Unicode only)
    if (!useAscii) {
      canvas[llX[i]!]![actorBoxH - 1] = JT // bottom of header → ┬
      canvas[llX[i]!]![footerY] = JB        // top of footer → ┴
    }
  }

  // ---- DRAW: messages ----

  for (let m = 0; m < diagram.messages.length; m++) {
    const msg = diagram.messages[m]!
    const fi = actorIdx.get(msg.from)!
    const ti = actorIdx.get(msg.to)!
    const fromX = llX[fi]!
    const toX = llX[ti]!
    const isSelf = fi === ti
    const isDashed = msg.lineStyle === 'dashed'
    const isFilled = msg.arrowHead === 'filled'

    // Arrow line character (solid vs dashed)
    const lineChar = isDashed ? (useAscii ? '.' : '╌') : H

    if (isSelf) {
      // Self-message: 3-row loop to the right of the lifeline
      //   ├──┐           (row 0 = msgArrowY)
      //   │  │ Label     (row 1)
      //   │◄─┘           (row 2)
      const y0 = msgArrowY[m]!
      const loopW = Math.max(4, 4)

      // Row 0: start junction + horizontal + top-right corner
      canvas[fromX]![y0] = JL
      for (let x = fromX + 1; x < fromX + loopW; x++) canvas[x]![y0] = lineChar
      canvas[fromX + loopW]![y0] = useAscii ? '+' : '┐'

      // Row 1: vertical on right side + label
      canvas[fromX + loopW]![y0 + 1] = V
      const labelX = fromX + loopW + 2
      drawText(canvas, { x: labelX, y: y0 + 1 }, msg.label)

      // Row 2: arrow-back + horizontal + bottom-right corner
      const arrowChar = isFilled ? (useAscii ? '<' : '◀') : (useAscii ? '<' : '◁')
      canvas[fromX]![y0 + 2] = arrowChar
      for (let x = fromX + 1; x < fromX + loopW; x++) canvas[x]![y0 + 2] = lineChar
      canvas[fromX + loopW]![y0 + 2] = useAscii ? '+' : '┘'
    } else {
      // Normal message: label on row above, arrow on row below
      const labelY = msgLabelY[m]!
      const arrowY = msgArrowY[m]!
      const leftToRight = fromX < toX

      // Draw label centered between the two lifelines
      const midX = Math.floor((fromX + toX) / 2)
      const labelStart = midX - Math.floor(stringWidth(msg.label) / 2)
      if (labelStart >= 0) drawText(canvas, { x: labelStart, y: labelY }, msg.label)

      // Draw arrow line
      if (leftToRight) {
        for (let x = fromX + 1; x < toX; x++) canvas[x]![arrowY] = lineChar
        // Arrowhead at destination
        const ah = isFilled ? (useAscii ? '>' : '▶') : (useAscii ? '>' : '▷')
        canvas[toX]![arrowY] = ah
      } else {
        for (let x = toX + 1; x < fromX; x++) canvas[x]![arrowY] = lineChar
        const ah = isFilled ? (useAscii ? '<' : '◀') : (useAscii ? '<' : '◁')
        canvas[toX]![arrowY] = ah
      }
    }
  }

  // ---- DRAW: blocks (loop, alt, opt, par, etc.) ----

  for (let b = 0; b < diagram.blocks.length; b++) {
    const block = diagram.blocks[b]!
    const topY = blockStartY.get(b)
    const botY = blockEndY.get(b)
    if (topY === undefined || botY === undefined) continue

    // Find the leftmost/rightmost lifelines involved in this block's messages
    let minLX = totalW
    let maxLX = 0
    for (let m = block.startIndex; m <= block.endIndex; m++) {
      if (m >= diagram.messages.length) break
      const msg = diagram.messages[m]!
      const f = actorIdx.get(msg.from) ?? 0
      const t = actorIdx.get(msg.to) ?? 0
      minLX = Math.min(minLX, llX[Math.min(f, t)]!)
      maxLX = Math.max(maxLX, llX[Math.max(f, t)]!)
    }

    const bLeft = Math.max(0, minLX - 4)
    const bRight = Math.min(totalW - 1, maxLX + 4)

    // Top border with block type label
    canvas[bLeft]![topY] = TL
    for (let x = bLeft + 1; x < bRight; x++) canvas[x]![topY] = H
    canvas[bRight]![topY] = TR
    // Write block header label over the top border
    const hdrLabel = block.label ? `${block.type} [${block.label}]` : block.type
    drawTextClipped(bLeft + 1, topY, hdrLabel, bRight - 1)

    // Bottom border
    canvas[bLeft]![botY] = BL
    for (let x = bLeft + 1; x < bRight; x++) canvas[x]![botY] = H
    canvas[bRight]![botY] = BR

    // Side borders
    for (let y = topY + 1; y < botY; y++) {
      canvas[bLeft]![y] = V
      canvas[bRight]![y] = V
    }

    // Dividers
    for (let d = 0; d < block.dividers.length; d++) {
      const dY = divYMap.get(`${b}:${d}`)
      if (dY === undefined) continue
      const dashChar = isDashedH()
      canvas[bLeft]![dY] = JL
      for (let x = bLeft + 1; x < bRight; x++) canvas[x]![dY] = dashChar
      canvas[bRight]![dY] = JR
      // Divider label
      const dLabel = block.dividers[d]!.label
      if (dLabel) {
        const dStr = `[${dLabel}]`
        drawTextClipped(bLeft + 1, dY, dStr, bRight - 1)
      }
    }
  }

  // ---- DRAW: notes ----

  for (const np of notePositions) {
    // Ensure canvas is big enough
    increaseSize(canvas, np.x + np.width, np.y + np.height)
    // Top border
    canvas[np.x]![np.y] = TL
    for (let x = 1; x < np.width - 1; x++) canvas[np.x + x]![np.y] = H
    canvas[np.x + np.width - 1]![np.y] = TR
    // Content rows
    for (let l = 0; l < np.lines.length; l++) {
      const ly = np.y + 1 + l
      canvas[np.x]![ly] = V
      canvas[np.x + np.width - 1]![ly] = V
      drawText(canvas, { x: np.x + 2, y: ly }, np.lines[l]!)
    }
    // Bottom border
    const by = np.y + np.height - 1
    canvas[np.x]![by] = BL
    for (let x = 1; x < np.width - 1; x++) canvas[np.x + x]![by] = H
    canvas[np.x + np.width - 1]![by] = BR
  }

  return canvasToString(canvas, !config.preserveDisplayWidth)

  // ---- Helper: dashed horizontal character ----
  function isDashedH(): string {
    return useAscii ? '-' : '╌'
  }
}
