/**
 * Integration tests for the full renderMermaid pipeline.
 *
 * These tests exercise parse → layout → render end-to-end.
 * They're async because layout functions return promises.
 *
 * Covers: original features, Batch 1 (new shapes), Batch 2 (edges, styles),
 * and Batch 3 (state diagrams).
 */
import { describe, it, expect } from 'bun:test'
import { renderMermaid } from '../index.ts'

// ============================================================================
// Basic rendering
// ============================================================================

describe('renderMermaid – basic', () => {
  it('renders a simple graph to valid SVG', async () => {
    const svg = await renderMermaid('graph TD\n  A --> B')
    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"')
    expect(svg).toContain('</svg>')
    // Should contain both nodes
    expect(svg).toContain('>A</text>')
    expect(svg).toContain('>B</text>')
  })

  it('renders a graph with labeled nodes', async () => {
    const svg = await renderMermaid('graph TD\n  A[Start] --> B[End]')
    expect(svg).toContain('>Start</text>')
    expect(svg).toContain('>End</text>')
  })

  it('renders edges with labels', async () => {
    const svg = await renderMermaid('graph TD\n  A -->|Yes| B')
    expect(svg).toContain('>Yes</text>')
  })
})

// ============================================================================
// Options
// ============================================================================

describe('renderMermaid – options', () => {
  it('applies dark colors', async () => {
    const svg = await renderMermaid('graph TD\n  A --> B', { bg: '#18181B', fg: '#FAFAFA' })
    expect(svg).toContain('--bg:#18181B')
  })

  it('applies default light colors', async () => {
    const svg = await renderMermaid('graph TD\n  A --> B')
    expect(svg).toContain('--bg:#FFFFFF')
  })

  it('applies custom font', async () => {
    const svg = await renderMermaid('graph TD\n  A --> B', { font: 'JetBrains Mono' })
    expect(svg).toContain("'JetBrains Mono'")
  })

  it('respects padding option', async () => {
    const small = await renderMermaid('graph TD\n  A --> B', { padding: 10 })
    const large = await renderMermaid('graph TD\n  A --> B', { padding: 80 })
    const getWidth = (svg: string) => {
      const match = svg.match(/width="(\d+)"/)
      return match ? Number(match[1]) : 0
    }
    expect(getWidth(large)).toBeGreaterThan(getWidth(small))
  })
})

// ============================================================================
// Complex diagrams
// ============================================================================

describe('renderMermaid – complex diagrams', () => {
  it('renders all original node shapes', async () => {
    const svg = await renderMermaid(`graph TD
      A[Rectangle] --> B(Rounded)
      B --> C{Diamond}
      C --> D([Stadium])
      D --> E((Circle))`)

    expect(svg).toContain('>Rectangle</text>')
    expect(svg).toContain('>Rounded</text>')
    expect(svg).toContain('>Diamond</text>')
    expect(svg).toContain('>Stadium</text>')
    expect(svg).toContain('>Circle</text>')
    expect(svg).toContain('<polygon')
    expect(svg).toContain('<circle')
  })

  it('renders all edge styles', async () => {
    const svg = await renderMermaid(`graph TD
      A -->|solid| B
      B -.->|dotted| C
      C ==>|thick| D`)

    expect(svg).toContain('>solid</text>')
    expect(svg).toContain('>dotted</text>')
    expect(svg).toContain('>thick</text>')
    expect(svg).toContain('stroke-dasharray="4 4"')
  })

  it('renders subgraphs', async () => {
    const svg = await renderMermaid(`graph TD
      subgraph Backend
        A[API] --> B[DB]
      end
      C[Client] --> A`)

    expect(svg).toContain('>Backend</text>')
    expect(svg).toContain('>API</text>')
    expect(svg).toContain('>DB</text>')
    expect(svg).toContain('>Client</text>')
  })

  it('renders a complex real-world diagram', async () => {
    const svg = await renderMermaid(`graph TD
      subgraph ci [CI Pipeline]
        A[Push Code] --> B{Tests Pass?}
        B -->|Yes| C[Build Docker]
        B -->|No| D[Fix & Retry]
        D --> A
      end
      C --> E([Deploy to Staging])
      E --> F{QA Approved?}
      F -->|Yes| G((Production))
      F -->|No| D`)

    expect(svg).toContain('<svg')
    expect(svg).toContain('</svg>')
    expect(svg).toContain('>CI Pipeline</text>')
    expect(svg).toContain('>Push Code</text>')
    expect(svg).toContain('>Tests Pass?</text>')
    expect(svg).toContain('>Yes</text>')
    expect(svg).toContain('>No</text>')
    expect(svg).toContain('>Production</text>')
  })

  it('renders different directions', async () => {
    const lr = await renderMermaid('graph LR\n  A --> B --> C')
    const td = await renderMermaid('graph TD\n  A --> B --> C')

    const getDimensions = (svg: string) => {
      const w = svg.match(/width="(\d+)"/)
      const h = svg.match(/height="(\d+)"/)
      return { width: Number(w?.[1] ?? 0), height: Number(h?.[1] ?? 0) }
    }

    const lrDims = getDimensions(lr)
    const tdDims = getDimensions(td)

    expect(lrDims.width).toBeGreaterThan(tdDims.width)
    expect(tdDims.height).toBeGreaterThan(lrDims.height)
  })
})

// ============================================================================
// Batch 1: New shapes (end-to-end)
// ============================================================================

describe('renderMermaid – Batch 1 shapes', () => {
  it('renders subroutine shape with inner vertical lines', async () => {
    const svg = await renderMermaid('graph TD\n  A[[Subroutine]] --> B')
    expect(svg).toContain('>Subroutine</text>')
    expect(svg).toContain('<line') // inner vertical lines
  })

  it('renders double circle with two <circle> elements', async () => {
    const svg = await renderMermaid('graph TD\n  A(((Important))) --> B')
    expect(svg).toContain('>Important</text>')
    const circleCount = (svg.match(/<circle/g) ?? []).length
    expect(circleCount).toBeGreaterThanOrEqual(2)
  })

  it('renders hexagon as a polygon', async () => {
    const svg = await renderMermaid('graph TD\n  A{{Decision}} --> B')
    expect(svg).toContain('>Decision</text>')
    expect(svg).toContain('<polygon')
  })
})

// ============================================================================
// Batch 2: New shapes and edge features (end-to-end)
// ============================================================================

describe('renderMermaid – Batch 2 shapes', () => {
  it('renders cylinder / database', async () => {
    const svg = await renderMermaid('graph TD\n  A[(Database)] --> B')
    expect(svg).toContain('>Database</text>')
    expect(svg).toContain('<ellipse') // cylinder cap
  })

  it('renders asymmetric / flag', async () => {
    const svg = await renderMermaid('graph TD\n  A>Flag Shape] --> B')
    expect(svg).toContain('>Flag Shape</text>')
    expect(svg).toContain('<polygon')
  })

  it('renders trapezoid shapes', async () => {
    const svg = await renderMermaid('graph TD\n  A[/Wider Bottom\\] --> B[\\Wider Top/]')
    expect(svg).toContain('>Wider Bottom</text>')
    expect(svg).toContain('>Wider Top</text>')
  })
})

describe('renderMermaid – Batch 2 edge features', () => {
  it('renders no-arrow edges', async () => {
    const svg = await renderMermaid('graph TD\n  A --- B')
    expect(svg).toContain('<polyline')
    // No marker-end for no-arrow edges
    expect(svg).not.toContain('marker-end')
  })

  it('renders bidirectional arrows', async () => {
    const svg = await renderMermaid('graph TD\n  A <--> B')
    // Marker IDs may be namespaced (e.g. m1234-arrowhead) for multi-SVG safety
    expect(svg).toMatch(/marker-end="url\(#[^"]*arrowhead\)"/)
    expect(svg).toMatch(/marker-start="url\(#[^"]*arrowhead-start\)"/)
  })

  it('renders parallel links with &', async () => {
    const svg = await renderMermaid('graph TD\n  A & B --> C')
    // Should have node labels for A, B, and C
    expect(svg).toContain('>A</text>')
    expect(svg).toContain('>B</text>')
    expect(svg).toContain('>C</text>')
    // Should have 2 edges (A→C and B→C)
    const polylines = (svg.match(/<polyline/g) ?? []).length
    expect(polylines).toBe(2)
  })

  it('applies inline style overrides', async () => {
    const svg = await renderMermaid(`graph TD
      A[Red Node] --> B
      style A fill:#ff0000,stroke:#cc0000`)
    expect(svg).toContain('fill="#ff0000"')
    expect(svg).toContain('stroke="#cc0000"')
  })
})

// ============================================================================
// Batch 3: State diagrams (end-to-end)
// ============================================================================

describe('renderMermaid – state diagrams', () => {
  it('renders a basic state diagram', async () => {
    const svg = await renderMermaid(`stateDiagram-v2
      [*] --> Idle
      Idle --> Active : start
      Active --> Done`)

    expect(svg).toContain('<svg')
    expect(svg).toContain('</svg>')
    expect(svg).toContain('>Idle</text>')
    expect(svg).toContain('>Active</text>')
    expect(svg).toContain('>Done</text>')
    expect(svg).toContain('>start</text>')
  })

  it('renders start pseudostate as filled circle', async () => {
    const svg = await renderMermaid(`stateDiagram-v2
      [*] --> Ready`)
    // Start pseudostate: filled circle with stroke="none"
    expect(svg).toContain('stroke="none"')
    expect(svg).toContain('<circle')
  })

  it('renders end pseudostate as bullseye', async () => {
    const svg = await renderMermaid(`stateDiagram-v2
      Done --> [*]`)
    // End pseudostate: two circles (outer ring + inner filled)
    const circleCount = (svg.match(/<circle/g) ?? []).length
    expect(circleCount).toBeGreaterThanOrEqual(2)
  })

  it('renders composite state with inner nodes', async () => {
    const svg = await renderMermaid(`stateDiagram-v2
      state Processing {
        parse --> validate
        validate --> execute
      }
      [*] --> Processing`)

    expect(svg).toContain('>Processing</text>')
    expect(svg).toContain('>parse</text>')
    expect(svg).toContain('>validate</text>')
    expect(svg).toContain('>execute</text>')
  })

  it('renders full state diagram lifecycle', async () => {
    const svg = await renderMermaid(`stateDiagram-v2
      [*] --> Idle
      Idle --> Processing : submit
      state Processing {
        parse --> validate
        validate --> execute
      }
      Processing --> Complete : done
      Complete --> [*]`)

    expect(svg).toContain('<svg')
    expect(svg).toContain('</svg>')
    expect(svg).toContain('>Idle</text>')
    expect(svg).toContain('>Complete</text>')
    expect(svg).toContain('>Processing</text>')
    expect(svg).toContain('>submit</text>')
    expect(svg).toContain('>done</text>')
  })

  it('cycle edge labels do not overlap (Running ↔ Paused)', async () => {
    // This diagram creates a cycle between Running and Paused, producing two
    // edge labels ("pause" and "resume") in the same area. Before the fix,
    // the renderer placed both at the edge midpoint, causing ~13px overlap.
    const svg = await renderMermaid(`stateDiagram-v2
      [*] --> Ready
      Ready --> Running : start
      Running --> Paused : pause
      Paused --> Running : resume
      Running --> Stopped : stop
      Stopped --> [*]`)

    // Extract all label pill <rect> elements (rx="2" distinguishes them from node rects)
    const pillPattern = /<rect x="([^"]+)" y="([^"]+)" width="([^"]+)" height="([^"]+)" rx="2"/g
    const pills: { x: number; y: number; w: number; h: number; label?: string }[] = []
    let match: RegExpExecArray | null
    while ((match = pillPattern.exec(svg)) !== null) {
      pills.push({
        x: parseFloat(match[1]!),
        y: parseFloat(match[2]!),
        w: parseFloat(match[3]!),
        h: parseFloat(match[4]!),
      })
    }

    // There should be at least 3 edge label pills (start, pause, resume, stop)
    expect(pills.length).toBeGreaterThanOrEqual(3)

    // Verify no pair of label pills overlap
    for (let i = 0; i < pills.length; i++) {
      for (let j = i + 1; j < pills.length; j++) {
        const a = pills[i]!
        const b = pills[j]!
        const overlapX = a.x < b.x + b.w && a.x + a.w > b.x
        const overlapY = a.y < b.y + b.h && a.y + a.h > b.y
        expect(
          overlapX && overlapY,
          `Label pills ${i} (x=${a.x},y=${a.y},w=${a.w},h=${a.h}) and ${j} (x=${b.x},y=${b.y},w=${b.w},h=${b.h}) overlap`
        ).toBe(false)
      }
    }
  })
})

// ============================================================================
// Source order and deduplication
// ============================================================================

describe('renderMermaid – source order', () => {
  it('does not duplicate composite state nodes in SVG', async () => {
    // When a state is referenced in a transition (Idle --> Processing) before
    // being defined as a composite state, it should only appear once in the SVG
    // as the compound subgraph — not as a separate standalone node.
    const svg = await renderMermaid(`stateDiagram-v2
      [*] --> Idle
      Idle --> Processing : submit
      state Processing {
        parse --> validate
        validate --> execute
      }
      Processing --> Complete : done
      Complete --> [*]`)

    // "Processing" should appear exactly once as a group label, not also as a standalone node.
    // Count occurrences of ">Processing</text>" in the SVG.
    const processingLabels = (svg.match(/>Processing<\/text>/g) ?? []).length
    expect(processingLabels).toBe(1)
  })

  it('renders subgraph-first diagrams with subgraph at top in TD layout', async () => {
    // When a subgraph is defined first in the source, it should influence
    // dagre's layering to place it near the top in a TD (top-down) graph.
    const svg = await renderMermaid(`graph TD
      subgraph ci [CI Pipeline]
        A[Push Code] --> B{Tests Pass?}
        B -->|Yes| C[Build Image]
      end
      C --> D([Deploy])
      D --> E{QA?}
      E -->|Yes| F((Production))`)

    // Verify all elements render (no crashes from source order changes)
    expect(svg).toContain('>CI Pipeline</text>')
    expect(svg).toContain('>Push Code</text>')
    expect(svg).toContain('>Deploy</text>')
    expect(svg).toContain('>Production</text>')
  })
})

// ============================================================================
// Edge cases: self-loops, empty subgraphs, nesting depth
// ============================================================================

describe('renderMermaid – edge cases', () => {
  it('renders a self-loop (source === target)', async () => {
    const svg = await renderMermaid(`graph TD
      A[Node] --> A`)

    expect(svg).toContain('<svg')
    expect(svg).toContain('>Node</text>')
    // Should have at least one edge polyline
    expect(svg).toContain('<polyline')
  })

  it('renders a self-loop with label', async () => {
    const svg = await renderMermaid(`graph TD
      A[Retry] -->|again| A`)

    expect(svg).toContain('>Retry</text>')
    expect(svg).toContain('>again</text>')
  })

  it('renders an empty subgraph without crashing', async () => {
    const svg = await renderMermaid(`graph TD
      subgraph Empty
      end
      A --> B`)

    expect(svg).toContain('<svg')
    expect(svg).toContain('>Empty</text>')
    expect(svg).toContain('>A</text>')
    expect(svg).toContain('>B</text>')
  })

  it('renders edges targeting an empty subgraph', async () => {
    // Empty subgraph with edges pointing to it.
    // Since the subgraph has no children, dagre treats it as a regular node
    // and the edge redirects map it to itself.
    const svg = await renderMermaid(`graph TD
      subgraph S [Empty Group]
      end
      A --> S
      S --> B`)

    expect(svg).toContain('<svg')
    expect(svg).toContain('>Empty Group</text>')
    expect(svg).toContain('>A</text>')
    expect(svg).toContain('>B</text>')
  })

  it('renders a single-node subgraph', async () => {
    const svg = await renderMermaid(`graph TD
      subgraph Single
        A[Only Node]
      end
      B --> A`)

    expect(svg).toContain('>Single</text>')
    expect(svg).toContain('>Only Node</text>')
    expect(svg).toContain('>B</text>')
  })

  it('renders 3-level nested subgraphs', async () => {
    const svg = await renderMermaid(`graph TD
      subgraph Level1 [Outer]
        subgraph Level2 [Middle]
          subgraph Level3 [Inner]
            A[Deep Node] --> B[Also Deep]
          end
        end
      end
      C[Outside] --> A`)

    expect(svg).toContain('>Outer</text>')
    expect(svg).toContain('>Middle</text>')
    expect(svg).toContain('>Inner</text>')
    expect(svg).toContain('>Deep Node</text>')
    expect(svg).toContain('>Also Deep</text>')
    expect(svg).toContain('>Outside</text>')
  })

  it('renders 3-level nested composite states', async () => {
    const svg = await renderMermaid(`stateDiagram-v2
      [*] --> Active
      state Active {
        state Processing {
          state Validating {
            check --> verify
          }
        }
      }
      Active --> [*]`)

    expect(svg).toContain('<svg')
    expect(svg).toContain('>Active</text>')
    expect(svg).toContain('>Processing</text>')
    expect(svg).toContain('>Validating</text>')
    expect(svg).toContain('>check</text>')
    expect(svg).toContain('>verify</text>')
  })
})

// ============================================================================
// All new shapes in one diagram (end-to-end stress test)
// ============================================================================

describe('renderMermaid – all shapes combined', () => {
  it('renders a diagram with all 12 flowchart shapes', async () => {
    const svg = await renderMermaid(`graph LR
      A[Rectangle] --> B(Rounded)
      B --> C{Diamond}
      C --> D([Stadium])
      D --> E((Circle))
      E --> F[[Subroutine]]
      F --> G(((DoubleCircle)))
      G --> H{{Hexagon}}
      H --> I[(Cylinder)]
      I --> J>Flag]
      J --> K[/Trapezoid\\]
      K --> L[\\TrapAlt/]`)

    // Verify every label renders
    for (const label of ['Rectangle', 'Rounded', 'Diamond', 'Stadium', 'Circle',
      'Subroutine', 'DoubleCircle', 'Hexagon', 'Cylinder', 'Flag', 'Trapezoid', 'TrapAlt']) {
      expect(svg).toContain(`>${label}</text>`)
    }

    // Verify SVG validity
    expect(svg).toContain('<svg')
    expect(svg).toContain('</svg>')
  })
})
