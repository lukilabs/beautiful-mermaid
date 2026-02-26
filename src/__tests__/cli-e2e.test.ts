/**
 * End-to-end integration tests for the built CLI (dist/cli.js).
 *
 * These tests spawn the actual CLI binary as a subprocess and verify the full
 * pipeline: argument parsing -> input reading -> rendering -> output.
 *
 * Prerequisites: `bun run build` must have been run before these tests.
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// ============================================================================
// Constants
// ============================================================================

const CLI = join(import.meta.dir, '../../dist/cli.js')

const SIMPLE_FLOWCHART = `graph LR
  A[Start] --> B[Middle] --> C[End]`

// ============================================================================
// Helpers
// ============================================================================

interface CliResult {
  stdout: string
  stderr: string
  exitCode: number
}

/**
 * Run the CLI as a subprocess and collect stdout, stderr, and exit code.
 */
async function runCli(args: string[], stdin?: string): Promise<CliResult> {
  const proc = Bun.spawn(['node', CLI, ...args], {
    stdin: stdin !== undefined ? new Blob([stdin]) : undefined,
    stdout: 'pipe',
    stderr: 'pipe',
  })

  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ])

  const exitCode = await proc.exited

  return { stdout, stderr, exitCode }
}

// ============================================================================
// Temp directory lifecycle
// ============================================================================

let tmpDir: string

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'cli-e2e-test-'))
})

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true })
})

// ============================================================================
// help and metadata
// ============================================================================

describe('CLI e2e – help and metadata', () => {
  it('--help prints usage containing "beautiful-mermaid" and "render"', async () => {
    const { stdout, exitCode } = await runCli(['--help'])

    expect(exitCode).toBe(0)
    expect(stdout).toContain('beautiful-mermaid')
    expect(stdout).toContain('render')
  })

  it('themes command lists available themes including tokyo-night and dracula', async () => {
    const { stdout, exitCode } = await runCli(['themes'])

    expect(exitCode).toBe(0)
    expect(stdout).toContain('tokyo-night')
    expect(stdout).toContain('dracula')
  })
})

// ============================================================================
// render
// ============================================================================

describe('CLI e2e – render', () => {
  it('renders ASCII diagram from file to stdout containing node labels', async () => {
    const inputPath = join(tmpDir, 'diagram.mmd')
    await writeFile(inputPath, SIMPLE_FLOWCHART)

    const { stdout, exitCode } = await runCli(['render', inputPath, '--ascii'])

    expect(exitCode).toBe(0)
    expect(stdout).toContain('Start')
    expect(stdout).toContain('Middle')
    expect(stdout).toContain('End')
  })

  it('renders ASCII diagram piped via stdin', async () => {
    const { stdout, exitCode } = await runCli(
      ['render', '--ascii'],
      SIMPLE_FLOWCHART,
    )

    expect(exitCode).toBe(0)
    expect(stdout).toContain('Start')
    expect(stdout).toContain('End')
  })

  it('renders SVG and writes output file containing <svg', async () => {
    const inputPath = join(tmpDir, 'diagram.mmd')
    const outputPath = join(tmpDir, 'output.svg')
    await writeFile(inputPath, SIMPLE_FLOWCHART)

    const { exitCode } = await runCli([
      'render', inputPath, '--svg', '-o', outputPath,
    ])

    expect(exitCode).toBe(0)

    const svg = await readFile(outputPath, 'utf-8')
    expect(svg).toContain('<svg')
    expect(svg).toContain('</svg>')
  })

  it('prints ASCII to stdout AND writes SVG to file', async () => {
    const inputPath = join(tmpDir, 'diagram.mmd')
    const outputPath = join(tmpDir, 'both.svg')
    await writeFile(inputPath, SIMPLE_FLOWCHART)

    const { stdout, exitCode } = await runCli([
      'render', inputPath, '--ascii', '--svg', '-o', outputPath,
    ])

    // ASCII in stdout
    expect(exitCode).toBe(0)
    expect(stdout).toContain('Start')
    expect(stdout).toContain('End')

    // SVG in file
    const svg = await readFile(outputPath, 'utf-8')
    expect(svg).toContain('<svg')
    expect(svg).toContain('</svg>')
  })
})

// ============================================================================
// error handling
// ============================================================================

describe('CLI e2e – error handling', () => {
  it('exits 1 and prints "Error" to stderr on unknown command', async () => {
    const { exitCode, stderr } = await runCli(['badcommand'])

    expect(exitCode).toBe(1)
    expect(stderr).toContain('Error')
  })

  it('exits 1 when given a file with invalid mermaid syntax', async () => {
    const inputPath = join(tmpDir, 'bad.mmd')
    await writeFile(inputPath, 'this is not valid mermaid syntax at all')

    const { exitCode } = await runCli(['render', inputPath, '--ascii'])

    expect(exitCode).toBe(1)
  })
})
