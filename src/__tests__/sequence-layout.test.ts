/**
 * Layout tests for sequence diagrams — verify that block headers and dividers
 * get extra vertical space so they don't overlap with messages.
 *
 * These tests call parseSequenceDiagram + layoutSequenceDiagram directly
 * to inspect Y coordinates, rather than checking SVG output.
 */
import { describe, it, expect } from 'bun:test'
import { parseSequenceDiagram } from '../sequence/parser.ts'
import { layoutSequenceDiagram } from '../sequence/layout.ts'

/** Helper: parse and layout a sequence diagram from source lines */
function layout(source: string) {
  const lines = source
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0 && !l.startsWith('%%'))
  return layoutSequenceDiagram(parseSequenceDiagram(lines))
}

describe('sequence layout – block spacing', () => {
  it('messages outside blocks are spaced at the base row height', () => {
    const result = layout(`sequenceDiagram
      A->>B: First
      B->>A: Second
      A->>B: Third`)

    // Three messages with no blocks — uniform spacing
    expect(result.messages).toHaveLength(3)
    const gap1 = result.messages[1]!.y - result.messages[0]!.y
    const gap2 = result.messages[2]!.y - result.messages[1]!.y
    // Both gaps should be identical (base messageRowHeight, 40px)
    expect(gap1).toBe(gap2)
    expect(gap1).toBe(40) // SEQ.messageRowHeight
  })

  it('first message in a loop block gets extra header space', () => {
    const result = layout(`sequenceDiagram
      A->>B: Before loop
      loop Every 5s
        A->>B: Inside loop
      end`)

    expect(result.messages).toHaveLength(2)
    const gap = result.messages[1]!.y - result.messages[0]!.y
    // Should be baseRowHeight + blockHeaderExtra = 40 + 28 = 68
    expect(gap).toBe(40 + 28)
  })

  it('first message in an alt block gets extra header space', () => {
    const result = layout(`sequenceDiagram
      A->>B: Login
      alt Success
        B->>A: 200
      end`)

    expect(result.messages).toHaveLength(2)
    const gap = result.messages[1]!.y - result.messages[0]!.y
    expect(gap).toBe(40 + 28)
  })

  it('messages after else dividers get extra divider space', () => {
    const result = layout(`sequenceDiagram
      A->>B: Login
      alt Valid
        B->>A: 200 OK
      else Invalid
        B->>A: 401
      end`)

    expect(result.messages).toHaveLength(3)
    // msg[0] → msg[1]: base + blockHeaderExtra (first message in alt block)
    const gap01 = result.messages[1]!.y - result.messages[0]!.y
    expect(gap01).toBe(40 + 28)

    // msg[1] → msg[2]: base + dividerExtra (message after "else Invalid")
    const gap12 = result.messages[2]!.y - result.messages[1]!.y
    expect(gap12).toBe(40 + 24)
  })

  it('multiple else dividers each get extra space', () => {
    const result = layout(`sequenceDiagram
      C->>S: Login
      alt Valid credentials
        S-->>C: 200 OK
      else Invalid
        S-->>C: 401 Unauthorized
      else Account locked
        S-->>C: 403 Forbidden
      end`)

    expect(result.messages).toHaveLength(4)

    // msg[0] → msg[1]: base + blockHeaderExtra
    const gap01 = result.messages[1]!.y - result.messages[0]!.y
    expect(gap01).toBe(40 + 28)

    // msg[1] → msg[2]: base + dividerExtra (else Invalid)
    const gap12 = result.messages[2]!.y - result.messages[1]!.y
    expect(gap12).toBe(40 + 24)

    // msg[2] → msg[3]: base + dividerExtra (else Account locked)
    const gap23 = result.messages[3]!.y - result.messages[2]!.y
    expect(gap23).toBe(40 + 24)
  })

  it('par block with and dividers gets correct spacing', () => {
    // Messages: Validate (idx 0), Get user (idx 1), Get orders (idx 2)
    // Block: startIndex=1, dividers=[{index:2}]
    const result = layout(`sequenceDiagram
      G->>A: Validate
      par Fetch user
        G->>U: Get user
      and Fetch orders
        G->>O: Get orders
      end`)

    expect(result.messages).toHaveLength(3)

    // msg[0] → msg[1]: base + blockHeaderExtra (first in par block)
    const gap01 = result.messages[1]!.y - result.messages[0]!.y
    expect(gap01).toBe(40 + 28)

    // msg[1] → msg[2]: base + dividerExtra (and Fetch orders)
    const gap12 = result.messages[2]!.y - result.messages[1]!.y
    expect(gap12).toBe(40 + 24)
  })

  it('opt block header gets extra space', () => {
    const result = layout(`sequenceDiagram
      A->>B: Request
      opt Cache available
        B-->>A: Cached response
      end`)

    expect(result.messages).toHaveLength(2)
    const gap = result.messages[1]!.y - result.messages[0]!.y
    expect(gap).toBe(40 + 28)
  })

  it('critical block header gets extra space', () => {
    const result = layout(`sequenceDiagram
      A->>DB: BEGIN
      critical Transaction
        A->>DB: UPDATE
      end`)

    expect(result.messages).toHaveLength(2)
    const gap = result.messages[1]!.y - result.messages[0]!.y
    expect(gap).toBe(40 + 28)
  })

  it('messages after a block return to normal spacing', () => {
    const result = layout(`sequenceDiagram
      A->>B: Before
      loop Retry
        A->>B: Attempt
      end
      A->>B: After`)

    expect(result.messages).toHaveLength(3)
    // msg[1] → msg[2]: no block boundary, just base row height
    const gap12 = result.messages[2]!.y - result.messages[1]!.y
    expect(gap12).toBe(40)
  })
})

describe('sequence layout – block positioning', () => {
  it('block top is above the first message with room for the header', () => {
    const result = layout(`sequenceDiagram
      A->>B: Before
      loop Retry
        A->>B: Inside
      end`)

    const block = result.blocks[0]!
    const firstMsg = result.messages[1]! // msg at index 1 is startIndex
    // Block top should be above message Y by blockPadTop (40px)
    expect(block.y).toBeLessThan(firstMsg.y)
    expect(firstMsg.y - block.y).toBe(40) // SEQ.blockPadTop
  })

  it('divider Y is between the messages it separates', () => {
    const result = layout(`sequenceDiagram
      A->>B: Login
      alt Success
        B->>A: 200
      else Failure
        B->>A: 500
      end`)

    const block = result.blocks[0]!
    expect(block.dividers).toHaveLength(1)
    const divY = block.dividers[0]!.y
    const msg1Y = result.messages[1]!.y // 200
    const msg2Y = result.messages[2]!.y // 500

    // Divider should be between the two messages
    expect(divY).toBeGreaterThan(msg1Y)
    expect(divY).toBeLessThan(msg2Y)
  })

  it('multiple dividers are each between their respective messages', () => {
    const result = layout(`sequenceDiagram
      C->>S: Login
      alt Valid
        S-->>C: 200
      else Invalid
        S-->>C: 401
      else Locked
        S-->>C: 403
      end`)

    const block = result.blocks[0]!
    expect(block.dividers).toHaveLength(2)

    // First divider between msg[1] (200) and msg[2] (401)
    expect(block.dividers[0]!.y).toBeGreaterThan(result.messages[1]!.y)
    expect(block.dividers[0]!.y).toBeLessThan(result.messages[2]!.y)

    // Second divider between msg[2] (401) and msg[3] (403)
    expect(block.dividers[1]!.y).toBeGreaterThan(result.messages[2]!.y)
    expect(block.dividers[1]!.y).toBeLessThan(result.messages[3]!.y)
  })

  it('block height encompasses all its messages', () => {
    const result = layout(`sequenceDiagram
      A->>B: Before
      alt Yes
        B->>A: Response 1
      else No
        B->>A: Response 2
      end`)

    const block = result.blocks[0]!
    const firstMsgY = result.messages[1]!.y
    const lastMsgY = result.messages[2]!.y

    // Block top is above first message
    expect(block.y).toBeLessThan(firstMsgY)
    // Block bottom is below last message
    expect(block.y + block.height).toBeGreaterThan(lastMsgY)
  })
})

describe('sequence layout – diagram dimensions', () => {
  it('diagram height increases with block extra space', () => {
    // Diagram without blocks
    const plain = layout(`sequenceDiagram
      A->>B: One
      B->>A: Two
      A->>B: Three`)

    // Diagram with same messages but wrapped in a loop block
    const withBlock = layout(`sequenceDiagram
      A->>B: One
      loop Repeat
        B->>A: Two
      end
      A->>B: Three`)

    // The block version should be taller due to header extra space
    expect(withBlock.height).toBeGreaterThan(plain.height)
    expect(withBlock.height - plain.height).toBe(28) // blockHeaderExtra
  })

  it('diagram with multiple dividers is taller than one with none', () => {
    const noDividers = layout(`sequenceDiagram
      A->>B: M1
      B->>A: M2
      A->>B: M3
      B->>A: M4`)

    const withDividers = layout(`sequenceDiagram
      A->>B: M1
      alt Case1
        B->>A: M2
      else Case2
        A->>B: M3
      else Case3
        B->>A: M4
      end`)

    // blockHeaderExtra (28) + 2 × dividerExtra (24 each) = 76 extra
    expect(withDividers.height - noDividers.height).toBe(28 + 24 + 24)
  })
})

// ============================================================================
// Clearance tests — verify that block headers, divider labels, and message
// labels don't overlap at the rendered pixel level.
//
// The renderer draws:
//   - Block header tab:  top at block.y, bottom at block.y + 18
//   - Header label text: at block.y + 9 (dominant-baseline central)
//   - Divider line:      at divider.y
//   - Divider label:     baseline at divider.y + 14
//   - Message arrow:     at msg.y
//   - Message label:     at msg.y - 10 (above the arrow)
// ============================================================================

describe('sequence layout – render clearance', () => {
  it('block header tab bottom is above the first message label', () => {
    // The header tab has height 18, drawn starting at block.y.
    // The message label is at msg.y - 6.
    // We need: block.y + 18 < firstMsg.y - 6
    const result = layout(`sequenceDiagram
      A->>B: Before
      loop Repeat
        A->>B: Inside
      end`)

    const block = result.blocks[0]!
    const firstMsg = result.messages[1]!
    const tabBottom = block.y + 18
    const msgLabel = firstMsg.y - 6

    expect(tabBottom).toBeLessThan(msgLabel)
    // Verify at least 10px of clearance
    expect(msgLabel - tabBottom).toBeGreaterThanOrEqual(10)
  })

  it('block header tab does not overlap the previous message arrow', () => {
    // The previous message arrow is at prevMsg.y.
    // The block header tab starts at block.y.
    // We need: prevMsg.y < block.y (header starts below previous arrow)
    const result = layout(`sequenceDiagram
      A->>B: Previous
      alt Valid
        B->>A: Response
      end`)

    const prevMsg = result.messages[0]!
    const block = result.blocks[0]!

    expect(prevMsg.y).toBeLessThan(block.y)
    // Verify at least 20px clearance between previous arrow and block top
    expect(block.y - prevMsg.y).toBeGreaterThanOrEqual(20)
  })

  it('divider label does not overlap the message label below it', () => {
    // Divider label baseline at divider.y + 14 (approx bottom of text).
    // Message label at msg.y - 6.
    // We need: divider.y + 14 < msg.y - 6
    const result = layout(`sequenceDiagram
      A->>B: Login
      alt Success
        B->>A: 200
      else Failure
        B->>A: 500
      end`)

    const block = result.blocks[0]!
    const divider = block.dividers[0]!
    const msg2 = result.messages[2]! // 500 (after divider)

    const divLabelBottom = divider.y + 14
    const msgLabel = msg2.y - 6

    expect(divLabelBottom).toBeLessThan(msgLabel)
  })

  it('divider line does not overlap the previous message arrow', () => {
    // The previous message arrow is at prevMsg.y.
    // The divider line is at divider.y.
    // We need: prevMsg.y < divider.y
    const result = layout(`sequenceDiagram
      A->>B: Login
      alt Success
        B->>A: 200 OK
      else Failure
        B->>A: 500 Error
      end`)

    const block = result.blocks[0]!
    const divider = block.dividers[0]!
    const prevMsg = result.messages[1]! // 200 OK (before divider)

    expect(prevMsg.y).toBeLessThan(divider.y)
    // Verify at least 10px clearance
    expect(divider.y - prevMsg.y).toBeGreaterThanOrEqual(10)
  })

  it('alt block with 3 else: no overlap at any boundary', () => {
    const result = layout(`sequenceDiagram
      C->>S: Login
      alt Valid
        S-->>C: 200
      else Invalid
        S-->>C: 401
      else Locked
        S-->>C: 403
      end`)

    const block = result.blocks[0]!

    // Header tab bottom vs first message label
    const tabBottom = block.y + 18
    const firstMsgLabel = result.messages[1]!.y - 6
    expect(tabBottom).toBeLessThan(firstMsgLabel)

    // Each divider label vs its message label
    for (let d = 0; d < block.dividers.length; d++) {
      const divider = block.dividers[d]!
      // The message after this divider is at index (d + 2):
      // msg[0]=Login, msg[1]=200 (start), msg[2]=401 (div0), msg[3]=403 (div1)
      const msgAfter = result.messages[d + 2]!
      const divLabelBottom = divider.y + 14
      const msgLabelTop = msgAfter.y - 6
      expect(divLabelBottom).toBeLessThan(msgLabelTop)
    }

    // Each divider line is below the previous message arrow
    expect(block.dividers[0]!.y).toBeGreaterThan(result.messages[1]!.y)
    expect(block.dividers[1]!.y).toBeGreaterThan(result.messages[2]!.y)
  })

  it('long divider labels get extra offset to avoid overlapping message labels', () => {
    // "Account locked" is long enough that "[Account locked]" (left-aligned at
    // the block edge) overlaps horizontally with "403 Forbidden" (centered
    // between actors). The layout should detect this and use a larger vertical
    // offset so the two text elements don't collide.
    const result = layout(`sequenceDiagram
      participant C as Client
      participant S as Server
      C->>S: Login
      alt Valid credentials
        S-->>C: 200 OK
      else Account locked
        S-->>C: 403 Forbidden
      end`)

    const block = result.blocks[0]!
    expect(block.dividers).toHaveLength(1)

    const divider = block.dividers[0]!
    const msgAfter = result.messages[2]! // "403 Forbidden"

    // With the overlap-aware offset (36 instead of default 28), the divider
    // label baseline (divider.y + 14) should be further from the message
    // label baseline (msg.y - 6), giving at least 14px baseline clearance.
    const divLabelBaseline = divider.y + 14
    const msgLabelBaseline = msgAfter.y - 6
    const baselineClearance = msgLabelBaseline - divLabelBaseline

    expect(baselineClearance).toBeGreaterThanOrEqual(14)
  })

  it('short divider labels keep the default offset (no unnecessary extra space)', () => {
    // "No" is short enough that "[No]" doesn't reach the centered message
    // label — no overlap, so the default offset (28) is used.
    const result = layout(`sequenceDiagram
      A->>B: Login
      alt Yes
        B->>A: 200
      else No
        B->>A: 500
      end`)

    const block = result.blocks[0]!
    const divider = block.dividers[0]!
    const msgAfter = result.messages[2]!

    // Default offset 28: baseline clearance = (msg.y - 6) - (msg.y - 28 + 14) = 8
    const baselineClearance = (msgAfter.y - 6) - (divider.y + 14)
    expect(baselineClearance).toBe(8)
  })
})

// ============================================================================
// Bounding-box tests — verify that notes positioned outside the actor columns
// are fully contained within the diagram viewport after the post-processing
// shift-and-expand step (layout.ts step 6).
//
// The layout engine positions actors first, then notes may extend left of the
// first actor ("left of") or right of the last actor ("right of"). The
// bounding-box post-processing shifts all elements right if needed and expands
// the diagram width so every element has at least SEQ.padding (30px) margin.
// ============================================================================

describe('sequence layout – note bounding box', () => {
  it('note "right of" last actor is within diagram width', () => {
    const result = layout(`sequenceDiagram
      A->>B: Hello
      Note right of B: Right-side note
      B-->>A: Hi`)

    // Every note must fit within the diagram width with padding margin
    for (const note of result.notes) {
      expect(note.x).toBeGreaterThanOrEqual(0)
      expect(note.x + note.width).toBeLessThanOrEqual(result.width)
    }
  })

  it('note "left of" first actor is within diagram width', () => {
    const result = layout(`sequenceDiagram
      A->>B: Hello
      Note left of A: Left-side note
      B-->>A: Hi`)

    // Left note should have been shifted right so x >= padding (30)
    for (const note of result.notes) {
      expect(note.x).toBeGreaterThanOrEqual(0)
      expect(note.x + note.width).toBeLessThanOrEqual(result.width)
    }
  })

  it('both left and right notes are within diagram width', () => {
    const result = layout(`sequenceDiagram
      A->>B: Hello
      Note left of A: Left note
      Note right of B: Right note
      B-->>A: Hi`)

    expect(result.notes).toHaveLength(2)
    for (const note of result.notes) {
      expect(note.x).toBeGreaterThanOrEqual(0)
      expect(note.x + note.width).toBeLessThanOrEqual(result.width)
    }
  })

  it('note "over" actor stays centered and within bounds', () => {
    const result = layout(`sequenceDiagram
      A->>B: Hello
      Note over A: Centered note
      B-->>A: Hi`)

    for (const note of result.notes) {
      expect(note.x).toBeGreaterThanOrEqual(0)
      expect(note.x + note.width).toBeLessThanOrEqual(result.width)
    }
  })

  it('shift preserves relative positions of all elements', () => {
    // A "left of" note on the first actor triggers a right-shift.
    // Verify that after the shift, messages still connect the correct actors
    // (i.e. message x1/x2 match actor x positions).
    const result = layout(`sequenceDiagram
      A->>B: Hello
      Note left of A: This shifts everything
      B-->>A: Reply`)

    // Build actor lookup
    const actorX = new Map<string, number>()
    for (const a of result.actors) actorX.set(a.id, a.x)

    // Each message's x1/x2 should match its from/to actor center X
    for (const msg of result.messages) {
      expect(msg.x1).toBe(actorX.get(msg.from)!)
      expect(msg.x2).toBe(actorX.get(msg.to)!)
    }

    // Lifelines should align with their actors
    for (const ll of result.lifelines) {
      expect(ll.x).toBe(actorX.get(ll.actorId)!)
    }
  })

  it('diagram without notes has no unnecessary shift', () => {
    // No notes → no shift needed. Actors should start near SEQ.padding (30).
    const result = layout(`sequenceDiagram
      A->>B: Hello
      B-->>A: Hi`)

    // First actor center should be near the padding
    // (actorWidth/2 + padding = ~70, but the key check is no extra shift)
    const firstActorX = result.actors[0]!.x
    const firstActorLeft = firstActorX - result.actors[0]!.width / 2

    // Left edge should be at exactly SEQ.padding (30) — no shift applied
    expect(firstActorLeft).toBe(30)
  })

  it('diagram width expands for right-side notes beyond actors', () => {
    // Compare diagram with and without a right-side note
    const withoutNote = layout(`sequenceDiagram
      A->>B: Hello
      B-->>A: Hi`)

    const withNote = layout(`sequenceDiagram
      A->>B: Hello
      Note right of B: Extra wide note text here
      B-->>A: Hi`)

    // The diagram with the right-side note should be wider
    expect(withNote.width).toBeGreaterThan(withoutNote.width)
  })

  it('left-side note shifts actors right, expanding diagram width', () => {
    const withoutNote = layout(`sequenceDiagram
      A->>B: Hello
      B-->>A: Hi`)

    const withNote = layout(`sequenceDiagram
      A->>B: Hello
      Note left of A: Left note
      B-->>A: Hi`)

    // Actors should have shifted right in the note version
    expect(withNote.actors[0]!.x).toBeGreaterThan(withoutNote.actors[0]!.x)

    // The left note's left edge should be at or near padding
    const leftNote = withNote.notes[0]!
    expect(leftNote.x).toBeGreaterThanOrEqual(0)
  })
})

// ============================================================================
// Note positioning tests — verify that notes after self-messages clear the
// loop, consecutive notes stack vertically, and notes push subsequent
// messages down so nothing overlaps.
// ============================================================================

describe('sequence layout – note positioning', () => {
  it('note after a self-message is positioned below the loop', () => {
    const result = layout(`sequenceDiagram
      A->>A: Process
      Note over A: Done`)

    const msg = result.messages[0]!
    const note = result.notes[0]!

    // Self-message loop bottom is at msg.y + selfMessageHeight (30).
    // Note must start below that.
    expect(note.y).toBeGreaterThan(msg.y + 30)
  })

  it('note after a normal message has clearance from the arrow', () => {
    const result = layout(`sequenceDiagram
      A->>B: Hello
      Note over A: Noted`)

    const msg = result.messages[0]!
    const note = result.notes[0]!

    // Note should be below the message arrow
    expect(note.y).toBeGreaterThan(msg.y)
  })

  it('consecutive notes after the same message are stacked vertically', () => {
    const result = layout(`sequenceDiagram
      A->>B: Hello
      Note over A: First
      Note over A: Second
      Note over A: Third`)

    expect(result.notes).toHaveLength(3)

    // Each note starts at or below the previous note's bottom edge
    for (let i = 1; i < result.notes.length; i++) {
      const prev = result.notes[i - 1]!
      const curr = result.notes[i]!
      expect(curr.y).toBeGreaterThanOrEqual(prev.y + prev.height)
    }
  })

  it('consecutive notes after a self-message clear the loop and each other', () => {
    const result = layout(`sequenceDiagram
      A->>A: Process
      Note over A: Step 1
      Note over A: Step 2`)

    const msg = result.messages[0]!
    const note1 = result.notes[0]!
    const note2 = result.notes[1]!

    // First note below loop
    expect(note1.y).toBeGreaterThan(msg.y + 30)
    // Second note below first
    expect(note2.y).toBeGreaterThanOrEqual(note1.y + note1.height)
  })

  it('messages after notes are pushed down to avoid overlap', () => {
    // Multiple notes overflow the default self-message vertical space (70px),
    // forcing the next message to shift down.
    const withNotes = layout(`sequenceDiagram
      A->>A: Self
      Note over A: Note 1
      Note over A: Note 2
      Note over A: Note 3
      A->>B: Next`)

    const withoutNotes = layout(`sequenceDiagram
      A->>A: Self
      A->>B: Next`)

    // Gap between messages should be larger when multiple notes are present
    const gapWith = withNotes.messages[1]!.y - withNotes.messages[0]!.y
    const gapWithout = withoutNotes.messages[1]!.y - withoutNotes.messages[0]!.y

    expect(gapWith).toBeGreaterThan(gapWithout)

    // Every note's bottom edge must be above the next message's label
    const lastNote = withNotes.notes[withNotes.notes.length - 1]!
    const nextMsg = withNotes.messages[1]!
    expect(lastNote.y + lastNote.height).toBeLessThan(nextMsg.y - 10) // -10 is label offset
  })

  it('notes inside alt blocks with self-messages have no overlap', () => {
    const result = layout(`sequenceDiagram
      participant A
      participant B
      alt Case 1
        A->>A: handle()
        Note over A: Handled
      else Case 2
        B->>B: process()
        Note over B: Processed
      end`)

    // Each note must be below its self-message's loop
    for (let i = 0; i < result.notes.length; i++) {
      const note = result.notes[i]!
      const refMsg = result.messages[i]!
      expect(note.y).toBeGreaterThan(refMsg.y + 30)
    }
  })

  it('diagram height increases to accommodate notes', () => {
    const withNotes = layout(`sequenceDiagram
      A->>A: Process
      Note over A: Note 1
      Note over A: Note 2
      A->>B: Done`)

    const withoutNotes = layout(`sequenceDiagram
      A->>A: Process
      A->>B: Done`)

    expect(withNotes.height).toBeGreaterThan(withoutNotes.height)
  })

  it('all notes remain within diagram bounds', () => {
    const result = layout(`sequenceDiagram
      A->>A: Self message
      Note over A: Note 1
      Note right of A: Right note
      Note left of A: Left note`)

    for (const note of result.notes) {
      expect(note.x).toBeGreaterThanOrEqual(0)
      expect(note.x + note.width).toBeLessThanOrEqual(result.width)
      expect(note.y).toBeGreaterThanOrEqual(0)
      expect(note.y + note.height).toBeLessThanOrEqual(result.height)
    }
  })
})
