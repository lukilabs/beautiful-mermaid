/**
 * Integration tests for the full renderMermaidSVG pipeline.
 *
 * These tests exercise parse → layout → render end-to-end.
 * They use the synchronous ELK.js-based rendering pipeline.
 *
 * Covers: original features, Batch 1 (new shapes), Batch 2 (edges, styles),
 * and Batch 3 (state diagrams).
 */
import { describe, it, expect } from 'bun:test'
import { renderMermaidSVG } from '../index.ts'

// ============================================================================
// Basic rendering
// ============================================================================

describe('renderMermaidSVG – basic', () => {
  it('renders a simple graph to valid SVG', () => {
    const svg = renderMermaidSVG('graph TD\n  A --> B')
    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"')
    expect(svg).toContain('</svg>')
    // Should contain both nodes
    expect(svg).toContain('>A</text>')
    expect(svg).toContain('>B</text>')
  })

  it('renders a graph with labeled nodes', () => {
    const svg = renderMermaidSVG('graph TD\n  A[Start] --> B[End]')
    expect(svg).toContain('>Start</text>')
    expect(svg).toContain('>End</text>')
  })

  it('renders edges with labels', () => {
    const svg = renderMermaidSVG('graph TD\n  A -->|Yes| B')
    expect(svg).toContain('>Yes</text>')
  })
})

// ============================================================================
// Options
// ============================================================================

describe('renderMermaidSVG – options', () => {
  it('applies dark colors', () => {
    const svg = renderMermaidSVG('graph TD\n  A --> B', { bg: '#18181B', fg: '#FAFAFA' })
    expect(svg).toContain('--bg:#18181B')
  })

  it('applies default light colors', () => {
    const svg = renderMermaidSVG('graph TD\n  A --> B')
    expect(svg).toContain('--bg:#FFFFFF')
  })

  it('applies custom font', () => {
    const svg = renderMermaidSVG('graph TD\n  A --> B', { font: 'JetBrains Mono' })
    expect(svg).toContain("'JetBrains Mono'")
  })

  it('respects padding option', () => {
    const small = renderMermaidSVG('graph TD\n  A --> B', { padding: 10 })
    const large = renderMermaidSVG('graph TD\n  A --> B', { padding: 80 })
    const getWidth = (svg: string) => {
      const match = svg.match(/width="([\d.]+)"/)
      return match ? Number(match[1]) : 0
    }
    expect(getWidth(large)).toBeGreaterThan(getWidth(small))
  })
})

// ============================================================================
// Complex diagrams
// ============================================================================

describe('renderMermaidSVG – complex diagrams', () => {
  it('renders all original node shapes', () => {
    const svg = renderMermaidSVG(`graph TD
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

  it('renders all edge styles', () => {
    const svg = renderMermaidSVG(`graph TD
      A -->|solid| B
      B -.->|dotted| C
      C ==>|thick| D`)

    expect(svg).toContain('>solid</text>')
    expect(svg).toContain('>dotted</text>')
    expect(svg).toContain('>thick</text>')
    expect(svg).toContain('stroke-dasharray="4 4"')
  })

  it('renders subgraphs', () => {
    const svg = renderMermaidSVG(`graph TD
      subgraph Backend
        A[API] --> B[DB]
      end
      C[Client] --> A`)

    expect(svg).toContain('>Backend</text>')
    expect(svg).toContain('>API</text>')
    expect(svg).toContain('>DB</text>')
    expect(svg).toContain('>Client</text>')
  })

  it('renders a complex real-world diagram', () => {
    const svg = renderMermaidSVG(`graph TD
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

  it('renders different directions', () => {
    const lr = renderMermaidSVG('graph LR\n  A --> B --> C')
    const td = renderMermaidSVG('graph TD\n  A --> B --> C')

    const getDimensions = (svg: string) => {
      const w = svg.match(/width="([\d.]+)"/)
      const h = svg.match(/height="([\d.]+)"/)
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

describe('renderMermaidSVG – Batch 1 shapes', () => {
  it('renders subroutine shape with inner vertical lines', () => {
    const svg = renderMermaidSVG('graph TD\n  A[[Subroutine]] --> B')
    expect(svg).toContain('>Subroutine</text>')
    expect(svg).toContain('<line') // inner vertical lines
  })

  it('renders double circle with two <circle> elements', () => {
    const svg = renderMermaidSVG('graph TD\n  A(((Important))) --> B')
    expect(svg).toContain('>Important</text>')
    const circleCount = (svg.match(/<circle/g) ?? []).length
    expect(circleCount).toBeGreaterThanOrEqual(2)
  })

  it('renders hexagon as a polygon', () => {
    const svg = renderMermaidSVG('graph TD\n  A{{Decision}} --> B')
    expect(svg).toContain('>Decision</text>')
    expect(svg).toContain('<polygon')
  })
})

// ============================================================================
// Batch 2: New shapes and edge features (end-to-end)
// ============================================================================

describe('renderMermaidSVG – Batch 2 shapes', () => {
  it('renders cylinder / database', () => {
    const svg = renderMermaidSVG('graph TD\n  A[(Database)] --> B')
    expect(svg).toContain('>Database</text>')
    expect(svg).toContain('<ellipse') // cylinder cap
  })

  it('renders asymmetric / flag', () => {
    const svg = renderMermaidSVG('graph TD\n  A>Flag Shape] --> B')
    expect(svg).toContain('>Flag Shape</text>')
    expect(svg).toContain('<polygon')
  })

  it('renders trapezoid shapes', () => {
    const svg = renderMermaidSVG('graph TD\n  A[/Wider Bottom\\] --> B[\\Wider Top/]')
    expect(svg).toContain('>Wider Bottom</text>')
    expect(svg).toContain('>Wider Top</text>')
  })
})

describe('renderMermaidSVG – Batch 2 edge features', () => {
  it('renders no-arrow edges', () => {
    const svg = renderMermaidSVG('graph TD\n  A --- B')
    expect(svg).toContain('<polyline')
    // No marker-end for no-arrow edges
    expect(svg).not.toContain('marker-end')
  })

  it('renders bidirectional arrows', () => {
    const svg = renderMermaidSVG('graph TD\n  A <--> B')
    expect(svg).toContain('marker-end="url(#arrowhead)"')
    expect(svg).toContain('marker-start="url(#arrowhead-start)"')
  })

  it('renders parallel links with &', () => {
    const svg = renderMermaidSVG('graph TD\n  A & B --> C')
    // Should have node labels for A, B, and C
    expect(svg).toContain('>A</text>')
    expect(svg).toContain('>B</text>')
    expect(svg).toContain('>C</text>')
    // Should have 2 edges (A→C and B→C)
    const polylines = (svg.match(/<polyline/g) ?? []).length
    expect(polylines).toBe(2)
  })

  it('applies inline style overrides', () => {
    const svg = renderMermaidSVG(`graph TD
      A[Red Node] --> B
      style A fill:#ff0000,stroke:#cc0000`)
    expect(svg).toContain('fill="#ff0000"')
    expect(svg).toContain('stroke="#cc0000"')
  })

  it('emits :::className as a CSS class on the SVG node element', () => {
    const svg = renderMermaidSVG(`graph LR
      A[Start]:::highlight --> B[End]`)
    expect(svg).toContain('class="node highlight"')
    // Node without a class assignment still has only the base class
    expect(svg).toContain('class="node"')
  })

  it('emits :::className even without a matching classDef', () => {
    const svg = renderMermaidSVG(`graph LR
      A[Only]:::external --> B[Other]`)
    expect(svg).toContain('class="node external"')
  })
})

// ============================================================================
// Batch 3: State diagrams (end-to-end)
// ============================================================================

describe('renderMermaidSVG – state diagrams', () => {
  it('renders a basic state diagram', () => {
    const svg = renderMermaidSVG(`stateDiagram-v2
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

  it('renders start pseudostate as filled circle', () => {
    const svg = renderMermaidSVG(`stateDiagram-v2
      [*] --> Ready`)
    // Start pseudostate: filled circle with stroke="none"
    expect(svg).toContain('stroke="none"')
    expect(svg).toContain('<circle')
  })

  it('renders end pseudostate as bullseye', () => {
    const svg = renderMermaidSVG(`stateDiagram-v2
      Done --> [*]`)
    // End pseudostate: two circles (outer ring + inner filled)
    const circleCount = (svg.match(/<circle/g) ?? []).length
    expect(circleCount).toBeGreaterThanOrEqual(2)
  })

  it('renders composite state with inner nodes', () => {
    const svg = renderMermaidSVG(`stateDiagram-v2
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

  it('renders full state diagram lifecycle', () => {
    const svg = renderMermaidSVG(`stateDiagram-v2
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

  it('cycle edge labels do not overlap (Running ↔ Paused)', () => {
    const svg = renderMermaidSVG(`stateDiagram-v2
      [*] --> Ready
      Ready --> Running : start
      Running --> Paused : pause
      Paused --> Running : resume
      Running --> Stopped : stop
      Stopped --> [*]`)

    // Extract all label pill <rect> elements (rx="2" distinguishes them from node rects)
    const pillPattern = /<rect x="([^"]+)" y="([^"]+)" width="([^"]+)" height="([^"]+)" rx="2"/g
    const pills: { x: number; y: number; w: number; h: number }[] = []
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

describe('renderMermaidSVG – source order', () => {
  it('does not duplicate composite state nodes in SVG', () => {
    const svg = renderMermaidSVG(`stateDiagram-v2
      [*] --> Idle
      Idle --> Processing : submit
      state Processing {
        parse --> validate
        validate --> execute
      }
      Processing --> Complete : done
      Complete --> [*]`)

    // "Processing" should appear exactly once as a group label, not also as a standalone node.
    const processingLabels = (svg.match(/>Processing<\/text>/g) ?? []).length
    expect(processingLabels).toBe(1)
  })

  it('renders subgraph-first diagrams with subgraph at top in TD layout', () => {
    const svg = renderMermaidSVG(`graph TD
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

describe('renderMermaidSVG – edge cases', () => {
  it('renders a self-loop (source === target)', () => {
    const svg = renderMermaidSVG(`graph TD
      A[Node] --> A`)

    expect(svg).toContain('<svg')
    expect(svg).toContain('>Node</text>')
    // Should have at least one edge polyline
    expect(svg).toContain('<polyline')
  })

  it('renders a self-loop with label', () => {
    const svg = renderMermaidSVG(`graph TD
      A[Retry] -->|again| A`)

    expect(svg).toContain('>Retry</text>')
    expect(svg).toContain('>again</text>')
  })

  it('renders an empty subgraph without crashing', () => {
    const svg = renderMermaidSVG(`graph TD
      subgraph Empty
      end
      A --> B`)

    expect(svg).toContain('<svg')
    expect(svg).toContain('>Empty</text>')
    expect(svg).toContain('>A</text>')
    expect(svg).toContain('>B</text>')
  })

  it('renders edges targeting an empty subgraph', () => {
    const svg = renderMermaidSVG(`graph TD
      subgraph S [Empty Group]
      end
      A --> S
      S --> B`)

    expect(svg).toContain('<svg')
    expect(svg).toContain('>Empty Group</text>')
    expect(svg).toContain('>A</text>')
    expect(svg).toContain('>B</text>')
  })

  it('renders a single-node subgraph', () => {
    const svg = renderMermaidSVG(`graph TD
      subgraph Single
        A[Only Node]
      end
      B --> A`)

    expect(svg).toContain('>Single</text>')
    expect(svg).toContain('>Only Node</text>')
    expect(svg).toContain('>B</text>')
  })

  it('renders 3-level nested subgraphs', () => {
    const svg = renderMermaidSVG(`graph TD
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

  it('renders 3-level nested composite states', () => {
    const svg = renderMermaidSVG(`stateDiagram-v2
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

describe('renderMermaidSVG – all shapes combined', () => {
  it('renders a diagram with all 12 flowchart shapes', () => {
    const svg = renderMermaidSVG(`graph LR
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
