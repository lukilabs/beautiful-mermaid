import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'bun:test'
import { renderMermaidASCII } from '../ascii/index.ts'

const WIDTHS = [
  { name: 'unbounded', value: undefined },
  { name: '120', value: 120 },
  { name: '100', value: 100 },
  { name: '80', value: 80 },
  { name: '60', value: 60 },
  { name: '40', value: 40 },
] as const

const LONG_TOKEN = `LONGTOKEN${'X'.repeat(140)}`
const LONG_ENTITY = `ENTITY${'X'.repeat(140)}`
const LONG_TITLE = `TITLE${'X'.repeat(140)}`

function renderPlain(diagram: string, maxWidth?: number): string {
  return renderMermaidASCII(diagram, {
    useAscii: false,
    colorMode: 'none',
    maxWidth,
  })
}

function maxLineWidth(output: string): number {
  return Math.max(...output.split('\n').map(line => line.length), 0)
}

function maxVisibleLineWidth(output: string): number {
  return Math.max(...output.split('\n').map(line => line.replace(/\s+$/u, '').length), 0)
}

function squashedContent(output: string): string {
  return output.replace(/[^A-Za-z0-9_]+/g, '')
}

function containsOrderedSubsequence(haystack: string, needle: string): boolean {
  let idx = 0
  for (const ch of haystack) {
    if (ch === needle[idx]) idx++
    if (idx === needle.length) return true
  }
  return needle.length === 0
}

function expectContent(output: string, labels: readonly string[]): void {
  const squashed = squashedContent(output)
  for (const label of labels) {
    for (const token of label.split(/\s+/).filter(Boolean)) {
      expect(containsOrderedSubsequence(squashed, squashedContent(token))).toBe(true)
    }
  }
}

function expectWidth(output: string, maxWidth: number): void {
  for (const line of output.split('\n')) {
    expect(line.length).toBeLessThanOrEqual(maxWidth)
  }
}

function expectMinWidth(output: string, minWidth: number): void {
  expect(maxLineWidth(output)).toBeGreaterThanOrEqual(minWidth)
}

function expectUniformLineWidth(output: string): void {
  const widths = output.split('\n').map(line => line.length)
  expect(new Set(widths).size).toBe(1)
}

const diagrams = [
  {
    name: 'flowchart',
    diagram: `graph TD
      A[${LONG_TOKEN}]`,
    labels: [LONG_TOKEN],
  },
  {
    name: 'state diagram',
    diagram: `stateDiagram-v2
      state "${LONG_TOKEN}" as WideState
      [*] --> WideState`,
    labels: [LONG_TOKEN],
  },
  {
    name: 'sequence diagram',
    diagram: `sequenceDiagram
      participant L as ${LONG_TOKEN}
      L->>L: pingToken`,
    labels: [LONG_TOKEN, 'pingToken'],
  },
  {
    name: 'class diagram',
    diagram: `classDiagram
      class ${LONG_TOKEN}`,
    labels: [LONG_TOKEN],
  },
  {
    name: 'ER diagram',
    diagram: `erDiagram
      ${LONG_ENTITY} {
        string entityToken
      }`,
    labels: [LONG_ENTITY, 'entityToken'],
  },
  {
    name: 'xychart',
    diagram: `xychart-beta
      title "${LONG_TITLE}"
      x-axis [Q1]
      bar [120]`,
    labels: [LONG_TITLE, 'Q1'],
  },
] as const

const flowchartWidthFloorCases = [
  {
    name: 'graph TD',
    diagram: `graph TD
      Root[Alpha Service Platform] --> Left[Beta Service Cluster]
      Root --> Right[Gamma Service Cluster]
      Left --> LeftLeaf[Delta Service Output]
      Right --> RightLeaf[Epsilon Service Output]`,
    labels: ['Alpha Service Platform', 'Beta Service Cluster', 'Gamma Service Cluster', 'Delta Service Output', 'Epsilon Service Output'],
    maxWidth: 50,
    minWidth: 46,
  },
  {
    name: 'flowchart TD',
    diagram: `flowchart TD
      Root[Alpha Service Platform] --> Left[Beta Service Cluster]
      Root --> Right[Gamma Service Cluster]
      Left --> LeftLeaf[Delta Service Output]
      Right --> RightLeaf[Epsilon Service Output]`,
    labels: ['Alpha Service Platform', 'Beta Service Cluster', 'Gamma Service Cluster', 'Delta Service Output', 'Epsilon Service Output'],
    maxWidth: 50,
    minWidth: 46,
  },
  {
    name: 'graph LR',
    diagram: `graph LR
      A[Alpha Service Platform] --> B[Beta Service Cluster] --> C[Gamma Service Cluster] --> D[Delta Service Output]`,
    labels: ['Alpha Service Platform', 'Beta Service Cluster', 'Gamma Service Cluster', 'Delta Service Output'],
    maxWidth: 60,
    minWidth: 45,
  },
  {
    name: 'flowchart LR',
    diagram: `flowchart LR
      A[Alpha Service Platform] --> B[Beta Service Cluster] --> C[Gamma Service Cluster] --> D[Delta Service Output]`,
    labels: ['Alpha Service Platform', 'Beta Service Cluster', 'Gamma Service Cluster', 'Delta Service Output'],
    maxWidth: 60,
    minWidth: 45,
  },
] as const

const rootSampleScripts = [
  'bmd-flowchart',
  'bmd-state',
  'bmd-sequence',
  'bmd-class',
  'bmd-er',
  'bmd-xychart',
] as const

function readDiagramFromScript(scriptName: typeof rootSampleScripts[number]): string {
  const contents = readFileSync(new URL(`../../${scriptName}`, import.meta.url), 'utf8')
  const match = contents.match(/<<'EOF'[^\n]*\n([\s\S]*?)\nEOF/u)
  if (!match) throw new Error(`Failed to extract heredoc diagram from ${scriptName}`)
  return match[1]!
}

describe('ASCII width bounding', () => {
  it('keeps the reported LR flowchart sample within visible width in API output', () => {
    const diagram = `graph LR
      A[Alpha Service] --> B[Beta Service] --> C[Gamma Service] --> D[REAALLLLLY LOOOOOOOOOOOOOOOOOOOOOOOOONG]`
    const output = renderMermaidASCII(diagram, {
      useAscii: false,
      colorMode: 'none',
      maxWidth: 60,
    })

    expectContent(output, ['Alpha Service', 'Beta Service', 'Gamma Service', 'REAALLLLLY LOOOOOOOOOOOOOOOOOOOOOOOOONG'])
    expectWidth(output, 60)
  })

  it('does not unnecessarily shrink the reported LR flowchart sample once a bounded layout width is reached', () => {
    const diagram = `graph LR
      A[Alpha Service] --> B[Beta Service] --> C[Gamma Service] --> D[REAALLLLLY LOOOOOOOOOOOOOOOOOOOOOOOOONG]`
    const at80 = renderMermaidASCII(diagram, {
      useAscii: true,
      colorMode: 'none',
      maxWidth: 80,
    })
    const at70 = renderMermaidASCII(diagram, {
      useAscii: true,
      colorMode: 'none',
      maxWidth: 70,
    })

    expectContent(at80, ['Alpha Service', 'Beta Service', 'Gamma Service', 'REAALLLLLY LOOOOOOOOOOOOOOOOOOOOOOOOONG'])
    expectContent(at70, ['Alpha Service', 'Beta Service', 'Gamma Service', 'REAALLLLLY LOOOOOOOOOOOOOOOOOOOOOOOOONG'])
    expectWidth(at80, 80)
    expectUniformLineWidth(at80)
    expect(maxLineWidth(at80)).toBeGreaterThan(0)

    const fixedPointWidth = maxLineWidth(at80)
    const atFixedPoint = renderMermaidASCII(diagram, {
      useAscii: true,
      colorMode: 'none',
      maxWidth: fixedPointWidth,
    })

    expectWidth(atFixedPoint, fixedPointWidth)
    expectUniformLineWidth(atFixedPoint)
    expect(atFixedPoint).toBe(at80)
  })

  it('does not clip ER relationship labels when the natural gap is too small', () => {
    const diagram = `erDiagram
      ACCOUNT ||--o{ PROJECT : owns
      PROJECT ||--|{ DEPLOYMENT : produces

      ACCOUNT {
        string billing_email
      }

      PROJECT {
        string runtime
      }

      DEPLOYMENT {
        string version
      }`

    const output = renderMermaidASCII(diagram, {
      useAscii: false,
      colorMode: 'none',
    })

    expectContent(output, ['ACCOUNT', 'PROJECT', 'DEPLOYMENT', 'owns', 'produces'])
    expect(output).toContain('produces')
    expect(output.split('\n').some(line => line.trim() === 'produces')).toBe(false)
  })

  it('keeps deep TD flowchart nodes on later rows when maxWidth is applied', () => {
    const diagram = `flowchart TD
      Client[Client Request] --> Gateway{Gateway Policy}
      Gateway -->|allow| Auth[Auth Service]
      Gateway -->|rate limit| Backoff[Retry Later]
      Auth --> Session[(Session Store)]
      Auth --> Profile[Profile Service]
      Profile --> Cache[(User Cache)]
      Profile --> Worker[[Async Worker]]
      Worker --> Queue[(Event Queue)]
      Queue --> Audit[Audit Trail]
      Session --> Renderer[Response Builder]
      Cache --> Renderer
      Audit --> Renderer
      Renderer --> Output([Delivered Response])`

    const output = renderMermaidASCII(diagram, {
      useAscii: true,
      colorMode: 'none',
      maxWidth: 60,
    })

    expectContent(output, [
      'Client Request',
      'Gateway Policy',
      'Auth Service',
      'Retry Later',
      'Session Store',
      'Profile Service',
      'User Cache',
      'Async Worker',
      'Event Queue',
      'Audit Trail',
      'Response Builder',
      'Delivered Response',
    ])
    expectWidth(output, 60)

    const lines = output.split('\n')
    const auditLine = lines.findIndex(line => line.includes('Audit Trail'))
    const rendererLine = lines.findIndex(line => line.includes('Response Builder'))
    expect(auditLine).toBeGreaterThanOrEqual(0)
    expect(rendererLine).toBeGreaterThan(auditLine)
  })

  it('does not shrink the root flowchart sample when maxWidth exceeds its natural visible width', () => {
    const diagram = readDiagramFromScript('bmd-flowchart')
    const baseline = renderMermaidASCII(diagram, {
      useAscii: true,
      colorMode: 'none',
    })
    const naturalWidth = maxVisibleLineWidth(baseline)

    const widenedBound = renderMermaidASCII(diagram, {
      useAscii: true,
      colorMode: 'none',
      maxWidth: naturalWidth + 28,
    })

    expect(maxVisibleLineWidth(widenedBound)).toBe(naturalWidth)
  })

  for (const scriptName of rootSampleScripts) {
    it(`keeps ${scriptName} at the same visible width when maxWidth equals its natural render width`, () => {
      const diagram = readDiagramFromScript(scriptName)
      const baseline = renderMermaidASCII(diagram, {
        useAscii: true,
        colorMode: 'none',
      })
      const naturalWidth = maxVisibleLineWidth(baseline)

      const rerendered = renderMermaidASCII(diagram, {
        useAscii: true,
        colorMode: 'none',
        maxWidth: naturalWidth,
      })

      expect(maxVisibleLineWidth(rerendered)).toBe(naturalWidth)
    })
  }

  for (const diagramCase of flowchartWidthFloorCases) {
    it(`keeps ${diagramCase.name} close to the requested width instead of collapsing to a skinny render`, () => {
      const output = renderMermaidASCII(diagramCase.diagram, {
        useAscii: true,
        colorMode: 'none',
        maxWidth: diagramCase.maxWidth,
      })

      expectContent(output, diagramCase.labels)
      expectWidth(output, diagramCase.maxWidth)
      expectMinWidth(output, diagramCase.minWidth)
    })
  }

  for (const diagramCase of diagrams) {
    describe(diagramCase.name, () => {
      it('has an unconstrained render wider than 120 columns', () => {
        const baseline = renderPlain(diagramCase.diagram)

        expectContent(baseline, diagramCase.labels)
        expect(maxLineWidth(baseline)).toBeGreaterThan(120)
      })

      for (const widthCase of WIDTHS) {
        it(`preserves content and ${widthCase.name === 'unbounded' ? 'matches default width behavior' : `keeps every line within ${widthCase.name}`}`, () => {
          const output = renderPlain(diagramCase.diagram, widthCase.value)

          expectContent(output, diagramCase.labels)

          if (widthCase.value === undefined) {
            const baseline = renderPlain(diagramCase.diagram)
            expect(output).toBe(baseline)
            expect(maxLineWidth(output)).toBe(maxLineWidth(baseline))
            expect(maxLineWidth(output)).toBeGreaterThan(0)
            return
          }

          expectWidth(output, widthCase.value)

          const fixedPointWidth = maxLineWidth(output)
          expect(fixedPointWidth).toBeGreaterThan(0)

          const rerendered = renderPlain(diagramCase.diagram, fixedPointWidth)
          expectContent(rerendered, diagramCase.labels)
          expectWidth(rerendered, fixedPointWidth)
          expect(rerendered).toBe(output)
        })
      }
    })
  }
})
