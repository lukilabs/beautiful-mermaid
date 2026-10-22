import type { SequenceDiagram, Block, Note, PositionedSequenceDiagram, PositionedActor, Lifeline, PositionedMessage, Activation, PositionedBlock, PositionedNote } from './types.ts'
import type { RenderOptions } from '../types.ts'
import { estimateTextWidth, FONT_SIZES, FONT_WEIGHTS } from '../styles.ts'
import { LINE_HEIGHT_RATIO } from '../text-metrics.ts'

// ============================================================================
// Sequence diagram layout engine
//
// Custom timeline-based layout (no ELK — sequence diagrams aren't graphs).
//
// Layout strategy:
//   1. Space actors horizontally based on label widths + min gap
//   2. Stack messages vertically in chronological order
//   3. Track activation boxes via a stack
//   4. Position blocks (loop/alt/opt) as background rectangles
//   5. Position notes next to their target actors
// ============================================================================

/** Layout constants specific to sequence diagrams */
const SEQ = {
  /** Padding around the entire diagram */
  padding: 30,
  /** Minimum gap between actor centers */
  actorGap: 140,
  /** Actor box height */
  actorHeight: 40,
  /** Horizontal padding inside actor boxes */
  actorPadX: 16,
  /** Vertical space between actor boxes and first message */
  headerGap: 20,
  /** Vertical space per message row */
  messageRowHeight: 40,
  /** Extra vertical space for self-messages (they loop back) */
  selfMessageHeight: 30,
  /** Activation box width (narrow rectangle on lifeline) */
  activationWidth: 10,
  /** Block padding (loop/alt borders) */
  blockPadX: 10,
  blockPadTop: 40,
  blockPadBottom: 8,
  /** Extra vertical space before the first message in a block (room for the header label) */
  blockHeaderExtra: 28,
  /** Extra vertical space before a message at a divider boundary (room for else/and label) */
  dividerExtra: 24,
  /** Note dimensions */
  noteWidth: 60,
  notePadX: 12,
  notePadY: 6,
  noteGap: 10,
} as const

/** Space kept between a label and the next lifeline */
const LABEL_CLEARANCE = 16

/** Self-message labels start this far right of the lifeline (30px loop + 8px gap in the renderer) */
const SELF_LABEL_X = 38

/** Width of the widest line of a label */
function labelWidth(text: string, weight: number = FONT_WEIGHTS.edgeLabel): number {
  return Math.max(0, ...text.split('\n').map(line => estimateTextWidth(line, FONT_SIZES.edgeLabel, weight)))
}

/** Width of a block's header tab, as drawn by the renderer */
function blockTabWidth(block: Block): number {
  return labelWidth(`${block.type}${block.label ? ` [${block.label}]` : ''}`.split('\n')[0]!, FONT_WEIGHTS.groupHeader) + 16
}

/**
 * For each block, the indices of the blocks nested inside it. The parser emits a block
 * when it closes, so nested blocks always come before the block that holds them.
 */
function nestedBlocks(blocks: Block[]): number[][] {
  return blocks.map((outer, bi) => {
    const inner: number[] = []
    for (let j = 0; j < bi; j++) {
      const b = blocks[j]!
      if (b.startIndex >= outer.startIndex && b.endIndex <= outer.endIndex) inner.push(j)
    }
    return inner
  })
}

/**
 * Widen the gaps between actors so labels do not cross a lifeline: message labels
 * (centred between their endpoints), self-message labels (to the right of the loop),
 * notes beside an actor, and block header tabs and divider labels. `gaps[i]` is the
 * distance between actor i - 1 and actor i, and is widened in place.
 */
function fitLabelsBetweenLifelines(
  diagram: SequenceDiagram,
  actorWidths: number[],
  gaps: number[]
): void {
  const index = new Map(diagram.actors.map((a, i) => [a.id, i]))

  // Spread any shortfall evenly over the gaps between actors `from` and `to`
  const widen = (from: number, to: number, need: number) => {
    if (from < 0 || to <= from || to >= gaps.length) return
    let have = 0
    for (let g = from + 1; g <= to; g++) have += gaps[g]!
    if (have >= need) return
    const add = (need - have) / (to - from)
    for (let g = from + 1; g <= to; g++) gaps[g]! += add
  }

  for (const m of diagram.messages) {
    const a = index.get(m.from)
    const b = index.get(m.to)
    if (a === undefined || b === undefined || !m.label) continue
    const w = labelWidth(m.label)
    if (a === b) widen(a, a + 1, SELF_LABEL_X + w + LABEL_CLEARANCE)
    else widen(Math.min(a, b), Math.max(a, b), w + 2 * LABEL_CLEARANCE)
  }

  for (const n of diagram.notes) {
    const i = index.get(n.actorIds[0] ?? '')
    if (i === undefined) continue
    const w = Math.max(SEQ.noteWidth, labelWidth(n.text) + SEQ.notePadX * 2)
    const reach = actorWidths[i]! / 2 + SEQ.noteGap + w + LABEL_CLEARANCE
    if (n.position === 'right') widen(i, i + 1, reach)
    else if (n.position === 'left') widen(i - 1, i, reach)
    else if (n.actorIds.length <= 1) {
      widen(i, i + 1, w / 2 + LABEL_CLEARANCE)
      widen(i - 1, i, w / 2 + LABEL_CLEARANCE)
    }
  }

  for (const block of diagram.blocks) {
    let first = diagram.actors.length
    for (let mi = block.startIndex; mi <= block.endIndex; mi++) {
      const m = diagram.messages[mi]
      if (m) first = Math.min(first, index.get(m.from) ?? 0, index.get(m.to) ?? 0)
    }
    if (first === diagram.actors.length) first = 0
    // The tab starts at the block's left edge and divider labels 8px inside it,
    // both left of the first lifeline
    const edge = -actorWidths[first]! / 2 - SEQ.blockPadX
    widen(first, first + 1, edge + blockTabWidth(block) + LABEL_CLEARANCE)
    for (const d of block.dividers) {
      if (d.label) widen(first, first + 1, edge + 8 + labelWidth(`[${d.label}]`) + LABEL_CLEARANCE)
    }
  }
}

/**
 * Lay out a parsed sequence diagram.
 * Returns a fully positioned diagram ready for SVG rendering.
 */
export function layoutSequenceDiagram(
  diagram: SequenceDiagram,
  _options: RenderOptions = {}
): PositionedSequenceDiagram {
  if (diagram.actors.length === 0) {
    return { width: 0, height: 0, actors: [], lifelines: [], messages: [], activations: [], blocks: [], notes: [] }
  }

  // 1. Calculate actor widths and assign horizontal positions (center X)
  const actorWidths = diagram.actors.map(a => {
    const textW = estimateTextWidth(a.label, FONT_SIZES.nodeLabel, FONT_WEIGHTS.nodeLabel)
    return Math.max(textW + SEQ.actorPadX * 2, 80)
  })

  // Build actor center X positions with minimum gap, widened to fit labels between lifelines
  const gaps = actorWidths.map((w, i) =>
    i === 0 ? 0 : Math.max(SEQ.actorGap, (actorWidths[i - 1]! + w) / 2 + 40)
  )
  fitLabelsBetweenLifelines(diagram, actorWidths, gaps)

  const actorCenterX: number[] = []
  let currentX = SEQ.padding + actorWidths[0]! / 2
  for (let i = 0; i < diagram.actors.length; i++) {
    currentX += gaps[i]!
    actorCenterX.push(currentX)
  }

  // Build actor ID → index lookup
  const actorIndex = new Map<string, number>()
  for (let i = 0; i < diagram.actors.length; i++) {
    actorIndex.set(diagram.actors[i]!.id, i)
  }

  // 2. Position actors at the top
  const actorY = SEQ.padding
  const actors: PositionedActor[] = diagram.actors.map((a, i) => ({
    id: a.id,
    label: a.label,
    type: a.type,
    x: actorCenterX[i]!,
    y: actorY,
    width: actorWidths[i]!,
    height: SEQ.actorHeight,
  }))

  // 3. Stack messages vertically
  let messageY = actorY + SEQ.actorHeight + SEQ.headerGap
  const messages: PositionedMessage[] = []

  // Pre-scan blocks to determine which message indices need extra vertical
  // space for block headers (e.g. "alt [Valid credentials]") or divider
  // labels (e.g. "[else Invalid]"). Without this, messages inside blocks
  // overlap with the header/divider text that sits above them.
  const headerSpaceBefore = new Map<number, number>()
  const dividerSpaceBefore = new Map<number, number>()
  for (const block of diagram.blocks) {
    // First message in the block needs room for the block header label; nested
    // blocks opening at the same message stack their headers above it
    const prev = headerSpaceBefore.get(block.startIndex) ?? 0
    headerSpaceBefore.set(block.startIndex, prev + SEQ.blockHeaderExtra)

    // Each divider (else/and) needs room for the divider label
    for (const div of block.dividers) dividerSpaceBefore.set(div.index, SEQ.dividerExtra)
  }

  // Blocks closing after each message, innermost first, and their bottom edges once placed
  const nested = nestedBlocks(diagram.blocks)
  const blocksEndingAt = new Map<number, number[]>()
  diagram.blocks.forEach((block, bi) => {
    blocksEndingAt.set(block.endIndex, [...(blocksEndingAt.get(block.endIndex) ?? []), bi])
  })
  const blockBottoms: number[] = []
  const blockNotes = (block: Block) => diagram.notes.slice(block.noteStartIndex, block.noteEndIndex)

  // Pre-group notes by the message index they follow, so we can position
  // them inline during the message stacking loop (avoids overlap bugs).
  const notesByAfterIndex = new Map<number, typeof diagram.notes>()
  for (const note of diagram.notes) {
    const list = notesByAfterIndex.get(note.afterIndex) ?? []
    list.push(note)
    notesByAfterIndex.set(note.afterIndex, list)
  }
  const positionedNotes: PositionedNote[] = []
  const notePositions = new Map<Note, PositionedNote>()

  // Track activation stack per actor: array of { startY, depth } objects
  // Depth is used to offset nested activations horizontally for visual clarity
  const activationStacks = new Map<string, { startY: number; depth: number }[]>()
  const activations: Activation[] = []
  const nestingOffset = 4 // Horizontal offset per nesting level

  for (let msgIdx = 0; msgIdx < diagram.messages.length; msgIdx++) {
    const msg = diagram.messages[msgIdx]!
    const fromIdx = actorIndex.get(msg.from) ?? 0
    const toIdx = actorIndex.get(msg.to) ?? 0
    const isSelf = msg.from === msg.to

    // Add extra vertical space if this message sits below a block header or divider
    messageY += (headerSpaceBefore.get(msgIdx) ?? 0) + (dividerSpaceBefore.get(msgIdx) ?? 0)

    const x1 = actorCenterX[fromIdx]!
    const x2 = actorCenterX[toIdx]!

    messages.push({
      from: msg.from,
      to: msg.to,
      label: msg.label,
      lineStyle: msg.lineStyle,
      arrowHead: msg.arrowHead,
      x1, x2,
      y: messageY,
      isSelf,
    })

    // Handle activation - track nesting depth for visual offset
    if (msg.activate) {
      if (!activationStacks.has(msg.to)) {
        activationStacks.set(msg.to, [])
      }
      const stack = activationStacks.get(msg.to)!
      const depth = stack.length // Current depth before pushing
      stack.push({ startY: messageY, depth })
    }

    if (msg.deactivate) {
      const stack = activationStacks.get(msg.from)
      if (stack && stack.length > 0) {
        const { startY, depth } = stack.pop()!
        const idx = actorIndex.get(msg.from) ?? 0
        // Offset nested activations to the right for visual distinction
        const xOffset = depth * nestingOffset
        activations.push({
          actorId: msg.from,
          x: actorCenterX[idx]! - SEQ.activationWidth / 2 + xOffset,
          topY: startY,
          bottomY: messageY,
          width: SEQ.activationWidth,
        })
      }
    }

    // Advance messageY past the message itself
    messageY += isSelf ? SEQ.selfMessageHeight + SEQ.messageRowHeight : SEQ.messageRowHeight

    // Position notes that appear after this message.
    // Notes start below the self-message loop (if self) or below the arrow,
    // and consecutive notes stack vertically. If notes extend beyond the
    // normal message advance, push messageY further so subsequent messages
    // don't overlap.
    const notesForMsg = notesByAfterIndex.get(msgIdx)
    if (notesForMsg && notesForMsg.length > 0) {
      // Self-message loops extend selfMessageHeight below msg.y;
      // normal arrows sit at msg.y with no extension below.
      const selfLoopExtra = isSelf ? SEQ.selfMessageHeight : 0
      let noteY = messages[msgIdx]!.y + selfLoopExtra + 8

      for (const note of notesForMsg) {
        const noteW = Math.max(SEQ.noteWidth, labelWidth(note.text) + SEQ.notePadX * 2)
        const noteLines = note.text.split('\n').length
        const noteH = FONT_SIZES.edgeLabel * (1 + (noteLines - 1) * LINE_HEIGHT_RATIO) + SEQ.notePadY * 2

        // X positioning based on actor position and note type
        const firstActorIdx = actorIndex.get(note.actorIds[0] ?? '') ?? 0
        let noteX: number
        if (note.position === 'left') {
          noteX = actorCenterX[firstActorIdx]! - actorWidths[firstActorIdx]! / 2 - noteW - SEQ.noteGap
        } else if (note.position === 'right') {
          noteX = actorCenterX[firstActorIdx]! + actorWidths[firstActorIdx]! / 2 + SEQ.noteGap
        } else {
          // over — center between first and last actor
          if (note.actorIds.length > 1) {
            const lastActorIdx = actorIndex.get(note.actorIds[note.actorIds.length - 1] ?? '') ?? firstActorIdx
            noteX = (actorCenterX[firstActorIdx]! + actorCenterX[lastActorIdx]!) / 2 - noteW / 2
          } else {
            noteX = actorCenterX[firstActorIdx]! - noteW / 2
          }
        }

        const positioned: PositionedNote = {
          text: note.text,
          x: noteX,
          y: noteY,
          width: noteW,
          height: noteH,
          position: note.position,
          actors: note.actorIds,
        }
        positionedNotes.push(positioned)
        notePositions.set(note, positioned)

        noteY += noteH + 4 // Stack next note below with gap
      }

      // Push messageY forward if notes extended beyond the normal advance.
      // Add half a row height so the next message's label (rendered at msg.y - 6)
      // has clearance from the last note's bottom edge.
      messageY = Math.max(messageY, noteY + SEQ.messageRowHeight / 2)
    }

    // Close the blocks that end here so each holds its last message (and the
    // self-message loop, 20px tall in the renderer), its notes and its nested
    // blocks, then keep the next message clear of the bottom edge.
    for (const bi of blocksEndingAt.get(msgIdx) ?? []) {
      let bottom = messages[msgIdx]!.y + (isSelf ? 20 : 0) + SEQ.blockPadBottom + 12
      for (const note of blockNotes(diagram.blocks[bi]!)) {
        const n = notePositions.get(note)
        if (n) bottom = Math.max(bottom, n.y + n.height + SEQ.blockPadBottom)
      }
      for (const ci of nested[bi]!) bottom = Math.max(bottom, blockBottoms[ci]! + SEQ.blockPadBottom)
      blockBottoms[bi] = bottom
      messageY = Math.max(messageY, bottom + SEQ.messageRowHeight / 2)
    }
  }

  // Close any unclosed activations (preserving depth for offset)
  for (const [actorId, stack] of activationStacks) {
    for (const { startY, depth } of stack) {
      const idx = actorIndex.get(actorId) ?? 0
      const xOffset = depth * nestingOffset
      activations.push({
        actorId,
        x: actorCenterX[idx]! - SEQ.activationWidth / 2 + xOffset,
        topY: startY,
        bottomY: messageY - SEQ.messageRowHeight / 2,
        width: SEQ.activationWidth,
      })
    }
  }

  // 4. Position blocks (loop/alt/opt), innermost first so a block can enclose
  //    the blocks nested inside it
  const blocks: PositionedBlock[] = []
  diagram.blocks.forEach((block, bi) => {
    const inner = nested[bi]!.map(ci => blocks[ci]!)

    // Block spans from the Y of startIndex to endIndex messages, above the
    // header tabs of nested blocks that open at the same message
    const startMsg = messages[block.startIndex]
    let blockTop = (startMsg?.y ?? messageY) - SEQ.blockPadTop
    for (const c of inner) blockTop = Math.min(blockTop, c.y - SEQ.blockHeaderExtra)
    const blockBottom = blockBottoms[bi] ?? messageY + SEQ.blockPadBottom + 12

    // Block width spans all actors involved in its messages
    const involvedActors = new Set<number>()
    for (let mi = block.startIndex; mi <= block.endIndex; mi++) {
      const m = diagram.messages[mi]
      if (m) {
        involvedActors.add(actorIndex.get(m.from) ?? 0)
        involvedActors.add(actorIndex.get(m.to) ?? 0)
      }
    }
    // Fallback: span all actors if none involved
    if (involvedActors.size === 0) {
      for (let ai = 0; ai < diagram.actors.length; ai++) involvedActors.add(ai)
    }
    const minIdx = Math.min(...involvedActors)
    const maxIdx = Math.max(...involvedActors)
    let blockLeft = actorCenterX[minIdx]! - actorWidths[minIdx]! / 2 - SEQ.blockPadX
    let blockRight = actorCenterX[maxIdx]! + actorWidths[maxIdx]! / 2 + SEQ.blockPadX

    // Widen to hold self-message labels, notes and nested blocks
    for (let mi = block.startIndex; mi <= block.endIndex; mi++) {
      const m = messages[mi]
      if (m?.isSelf && m.label) {
        blockRight = Math.max(blockRight, m.x1 + SELF_LABEL_X + labelWidth(m.label) + LABEL_CLEARANCE)
      }
    }
    for (const note of blockNotes(block)) {
      const n = notePositions.get(note)
      if (!n) continue
      blockLeft = Math.min(blockLeft, n.x - SEQ.blockPadX)
      blockRight = Math.max(blockRight, n.x + n.width + SEQ.blockPadX)
    }
    for (const c of inner) {
      blockLeft = Math.min(blockLeft, c.x - SEQ.blockPadX)
      blockRight = Math.max(blockRight, c.x + c.width + SEQ.blockPadX)
    }
    // ...and the header tab and divider labels, which start at the left edge
    blockRight = Math.max(blockRight, blockLeft + blockTabWidth(block) + SEQ.blockPadX)
    for (const d of block.dividers) {
      if (d.label) blockRight = Math.max(blockRight, blockLeft + 8 + labelWidth(`[${d.label}]`) + LABEL_CLEARANCE)
    }

    // Position dividers — offset from message Y so the divider label text
    // (rendered at divider.y + 14 in the renderer) clears the message label
    // (rendered at msg.y - 10).
    //
    // Default offset 28 is sufficient when the divider label (left-aligned at
    // block edge) and message label (centered between actors) don't share
    // horizontal space. When they DO overlap horizontally (e.g. long divider
    // labels like "[Account locked]" next to centered message labels like
    // "403 Forbidden"), we increase the offset to 40 so the text bounding
    // boxes have ~5px visual clearance.
    const dividers = block.dividers.map(d => {
      // A nested block opening right after the divider: sit above its header tab
      const opening = inner.filter((_, k) => diagram.blocks[nested[bi]![k]!]!.startIndex === d.index)
      if (opening.length > 0) {
        return { y: Math.min(...opening.map(c => c.y)) - SEQ.dividerExtra, label: d.label }
      }

      const msg = messages[d.index]
      const msgY = msg?.y ?? messageY
      let offset = 28

      // Dynamic overlap detection: increase offset when the divider label
      // and message label occupy the same horizontal region, which would
      // cause vertical text overlap at the default offset.
      if (d.label && msg?.label) {
        const divLabelLeft = blockLeft + 8
        const divLabelRight = divLabelLeft + labelWidth(`[${d.label}]`)

        const msgLabelW = labelWidth(msg.label)
        // Self-messages render labels to the right of the loop (left-aligned);
        // normal messages center the label between the two actor lifelines.
        const msgLabelLeft = msg.isSelf
          ? msg.x1 + SELF_LABEL_X
          : (msg.x1 + msg.x2) / 2 - msgLabelW / 2
        const msgLabelRight = msgLabelLeft + msgLabelW

        if (divLabelRight > msgLabelLeft && divLabelLeft < msgLabelRight) {
          offset = 40
        }
      }

      return { y: msgY - offset, label: d.label }
    })

    blocks.push({
      type: block.type,
      label: block.label,
      x: blockLeft,
      y: blockTop,
      width: blockRight - blockLeft,
      height: blockBottom - blockTop,
      dividers,
    })
  })

  // 5. Notes — already positioned inline during the message stacking loop
  //    (step 3) to properly account for self-message loops and vertical stacking.
  const notes = positionedNotes

  // 6. Bounding-box post-processing
  //
  // Notes positioned "left of" the first actor or "right of" the last actor
  // can extend beyond the actor-based viewport. Compute the true bounding box
  // across all positioned elements, then shift everything right if anything
  // extends left of the desired padding margin and expand the width to fit.
  const diagramBottom = messageY + SEQ.padding

  // Find global X extents across actors, blocks, notes, and message labels
  let globalMinX: number = SEQ.padding // actors already start at SEQ.padding
  let globalMaxX = 0
  for (const a of actors) {
    globalMinX = Math.min(globalMinX, a.x - a.width / 2)
    globalMaxX = Math.max(globalMaxX, a.x + a.width / 2)
  }
  for (const b of blocks) {
    globalMinX = Math.min(globalMinX, b.x)
    globalMaxX = Math.max(globalMaxX, b.x + b.width)
  }
  for (const n of notes) {
    globalMinX = Math.min(globalMinX, n.x)
    globalMaxX = Math.max(globalMaxX, n.x + n.width)
  }
  // Include self-message labels in bounding box — they extend to the right of the actor
  // and could be clipped if not accounted for in the SVG width
  for (const m of messages) {
    if (m.isSelf && m.label) {
      const loopW = 30 // matches renderer loopW
      const labelPadding = 8
      const labelLeft = m.x1 + loopW + labelPadding
      const labelWidth = estimateTextWidth(m.label, FONT_SIZES.edgeLabel, FONT_WEIGHTS.edgeLabel)
      globalMaxX = Math.max(globalMaxX, labelLeft + labelWidth + 8) // +8 for safety margin
    }
  }

  // If elements extend left of the desired padding, shift everything right
  const shiftX = globalMinX < SEQ.padding ? SEQ.padding - globalMinX : 0
  if (shiftX > 0) {
    for (const a of actors) a.x += shiftX
    for (const m of messages) { m.x1 += shiftX; m.x2 += shiftX }
    for (const act of activations) act.x += shiftX
    for (const b of blocks) { b.x += shiftX; }
    for (const n of notes) n.x += shiftX
    // Also shift actor center X array (used for lifelines below)
    for (let i = 0; i < actorCenterX.length; i++) actorCenterX[i]! += shiftX
  }

  // 7. Calculate final lifelines (after shift so X positions are correct)
  const lifelines: Lifeline[] = diagram.actors.map((a, i) => ({
    actorId: a.id,
    x: actorCenterX[i]!,
    topY: actorY + SEQ.actorHeight,
    bottomY: diagramBottom - SEQ.padding,
  }))

  // 8. Calculate diagram dimensions from the bounding box
  const diagramWidth = globalMaxX + shiftX + SEQ.padding
  const diagramHeight = diagramBottom

  return {
    width: Math.max(diagramWidth, 200),
    height: Math.max(diagramHeight, 100),
    actors,
    lifelines,
    messages,
    activations,
    blocks,
    notes,
  }
}
