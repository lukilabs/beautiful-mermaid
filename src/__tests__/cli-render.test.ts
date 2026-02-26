import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runRender } from '../cli/render.ts'
import { createMockStdout, renderArgs } from './cli-test-helpers.ts'

// ============================================================================
// Constants
// ============================================================================

const SIMPLE_FLOWCHART = `graph LR
  A --> B --> C`

// ============================================================================
// Temp directory lifecycle
// ============================================================================

let tmpDir: string

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'cli-render-test-'))
})

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true })
})

// ============================================================================
// ASCII output
// ============================================================================

describe('runRender – ASCII from file', () => {
  it('renders ASCII to stdout from a file and output contains node labels', async () => {
    const inputPath = join(tmpDir, 'diagram.mmd')
    await writeFile(inputPath, SIMPLE_FLOWCHART)

    const mockStdout = createMockStdout()
    await runRender(renderArgs({ input: inputPath, ascii: true }), mockStdout)

    const output = mockStdout.output()
    expect(output).toContain('A')
    expect(output).toContain('B')
    expect(output).toContain('C')
  })
})

describe('runRender – ASCII from stdin', () => {
  it('reads from stdinContent and renders ASCII output', async () => {
    const mockStdout = createMockStdout()
    await runRender(
      renderArgs({ ascii: true }),
      mockStdout,
      SIMPLE_FLOWCHART,
    )

    const output = mockStdout.output()
    expect(output).toContain('A')
    expect(output).toContain('B')
    expect(output).toContain('C')
  })
})

// ============================================================================
// SVG output
// ============================================================================

describe('runRender – SVG to file', () => {
  it('renders SVG and writes to the output file', async () => {
    const inputPath = join(tmpDir, 'diagram.mmd')
    const outputPath = join(tmpDir, 'out.svg')
    await writeFile(inputPath, SIMPLE_FLOWCHART)

    await runRender(renderArgs({ input: inputPath, svg: true, output: outputPath }))

    const svg = await readFile(outputPath, 'utf-8')
    expect(svg).toContain('<svg')
    expect(svg).toContain('</svg>')
  })
})

// ============================================================================
// Both ASCII + SVG
// ============================================================================

describe('runRender – both ASCII and SVG', () => {
  it('renders both ASCII to stdout and SVG to file', async () => {
    const inputPath = join(tmpDir, 'diagram.mmd')
    const outputPath = join(tmpDir, 'out.svg')
    await writeFile(inputPath, SIMPLE_FLOWCHART)

    const mockStdout = createMockStdout()
    await runRender(
      renderArgs({ input: inputPath, ascii: true, svg: true, output: outputPath }),
      mockStdout,
    )

    // ASCII went to stdout
    const asciiOutput = mockStdout.output()
    expect(asciiOutput).toContain('A')
    expect(asciiOutput).toContain('B')

    // SVG went to file
    const svg = await readFile(outputPath, 'utf-8')
    expect(svg).toContain('<svg')
    expect(svg).toContain('</svg>')
  })
})

// ============================================================================
// Theme application
// ============================================================================

describe('runRender – theme application', () => {
  it('applies tokyo-night theme and SVG contains --bg:#1a1b26', async () => {
    const inputPath = join(tmpDir, 'diagram.mmd')
    const outputPath = join(tmpDir, 'themed.svg')
    await writeFile(inputPath, SIMPLE_FLOWCHART)

    await runRender(
      renderArgs({ input: inputPath, svg: true, output: outputPath, theme: 'tokyo-night' }),
    )

    const svg = await readFile(outputPath, 'utf-8')
    expect(svg).toContain('--bg:#1a1b26')
  })
})

// ============================================================================
// Error cases
// ============================================================================

describe('runRender – errors', () => {
  it('throws on empty input', async () => {
    const mockStdout = createMockStdout()
    await expect(
      runRender(renderArgs({ ascii: true }), mockStdout, '   '),
    ).rejects.toThrow('Empty input')
  })

  it('throws on unknown theme with name, "Available themes", and known theme listed', async () => {
    const inputPath = join(tmpDir, 'diagram.mmd')
    await writeFile(inputPath, SIMPLE_FLOWCHART)

    await expect(
      runRender(renderArgs({ input: inputPath, svg: true, output: join(tmpDir, 'out.svg'), theme: 'nope' })),
    ).rejects.toThrow(/Unknown theme.*"nope".*Available themes:.*tokyo-night/)
  })

  it('throws on invalid mermaid syntax', async () => {
    const mockStdout = createMockStdout()
    await expect(
      runRender(renderArgs({ ascii: true }), mockStdout, 'this is not valid mermaid'),
    ).rejects.toThrow()
  })
})
