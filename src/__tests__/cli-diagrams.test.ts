/**
 * Smoke tests: all 6 supported diagram types through the CLI render pipeline.
 *
 * For each diagram type, verifies:
 * - ASCII output is non-empty
 * - SVG file contains proper <svg> wrapper
 *
 * Uses runRender directly (no subprocess) for speed and reliability.
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runRender } from '../cli/render.ts'
import { createMockStdout, renderArgs } from './cli-test-helpers.ts'

// ============================================================================
// Diagram sources — one per supported type
// ============================================================================

const diagrams: Record<string, string> = {
  flowchart: `graph TD
  A[Start] --> B{Decision}
  B -->|Yes| C[Action]
  B -->|No| D[End]
  C --> D`,

  sequence: `sequenceDiagram
  Alice->>Bob: Hello Bob!
  Bob-->>Alice: Hi Alice!
  Alice->>Bob: How are you?`,

  state: `stateDiagram-v2
  [*] --> Idle
  Idle --> Processing: start
  Processing --> Complete: done
  Complete --> [*]`,

  class: `classDiagram
  Animal <|-- Duck
  Animal <|-- Fish
  Animal: +int age
  Animal: +isMammal() bool
  Duck: +String beakColor
  Duck: +swim()`,

  er: `erDiagram
  CUSTOMER ||--o{ ORDER : places
  ORDER ||--|{ LINE_ITEM : contains
  CUSTOMER {
    string name
    int id
  }`,

  xychart: `xychart-beta
  title "Sales Revenue"
  x-axis [jan, feb, mar, apr]
  y-axis "Revenue (k)" 0 --> 120
  bar [50, 60, 75, 90]`,
}

// ============================================================================
// Temp directory lifecycle
// ============================================================================

let tmpDir: string

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'cli-diagrams-test-'))
})

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true })
})

// ============================================================================
// Smoke tests — one per diagram type
// ============================================================================

describe('CLI diagram smoke tests', () => {
  for (const [name, source] of Object.entries(diagrams)) {
    it(`renders ${name} diagram as ASCII + SVG`, async () => {
      // 1. Write source to a temp .mmd file
      const inputPath = join(tmpDir, `${name}.mmd`)
      const outputPath = join(tmpDir, `${name}.svg`)
      await writeFile(inputPath, source)

      // 2. Call runRender with both ascii and svg enabled
      const mockStdout = createMockStdout()
      await runRender(
        renderArgs({ input: inputPath, ascii: true, svg: true, output: outputPath }),
        mockStdout,
      )

      // 3. Assert ASCII output is non-empty
      const asciiOutput = mockStdout.output()
      expect(asciiOutput.length).toBeGreaterThan(0)

      // 4. Assert SVG file is valid
      const svgContent = await readFile(outputPath, 'utf-8')
      expect(svgContent).toContain('<svg')
      expect(svgContent).toContain('</svg>')
    })
  }
})
