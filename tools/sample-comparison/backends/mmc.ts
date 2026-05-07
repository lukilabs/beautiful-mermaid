/**
 * Renders comparison samples through the official mermaid-cli (mmdc),
 * with the ELK renderer enabled for flowcharts and stateDiagrams.
 * Provides the third "reference" column that compare-build-page.ts
 * inlines when invoked with `--with-mmc`.
 *
 * mmdc must be on PATH or available via npx. `init()` exits the process
 * with an install hint if neither resolves. Each `render()` call shells
 * out to a fresh mmdc invocation — chart parse failures throw rather
 * than aborting the surrounding render run.
 */
import { execFileSync, spawnSync } from 'child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import type { RenderBackend } from './types.ts'

let mmdc: { cmd: string; viaNpx: boolean } | null = null
let workDir: string | null = null

/**
 * Prepends the `%%{init:...}%%` directive that turns on ELK for flowchart
 * and stateDiagram sources. Other diagram types and sources that already
 * declare a `defaultRenderer` are returned unchanged.
 */
function withElk(source: string): string {
  if (source.includes('defaultRenderer')) return source
  const first = source.trim().split('\n')[0]?.toLowerCase() ?? ''
  if (!/^(graph|flowchart|statediagram)/.test(first)) return source
  return `%%{init: {"flowchart": {"defaultRenderer": "elk"}, "stateDiagram": {"defaultRenderer": "elk"}}}%%\n${source}`
}

export const mmcBackend: RenderBackend = {
  name: 'mmc',
  init() {
    const probe = spawnSync('mmdc', ['--version'], { stdio: 'ignore' })
    if (probe.status === 0) {
      mmdc = { cmd: 'mmdc', viaNpx: false }
    } else {
      const npx = spawnSync('npx', ['--no-install', '-p', '@mermaid-js/mermaid-cli', 'mmdc', '--version'], { stdio: 'ignore' })
      if (npx.status !== 0) {
        console.warn('mmdc not found on PATH and not installed for npx — mmc backend unavailable')
        console.warn('install with: npm i -g @mermaid-js/mermaid-cli  (or)  npm i -D @mermaid-js/mermaid-cli')
        process.exit(1)
      }
      mmdc = { cmd: 'npx', viaNpx: true }
    }
    workDir = mkdtempSync(join(tmpdir(), 'bm-mmc-'))
  },
  render(source) {
    if (!mmdc || !workDir) throw new Error('mmcBackend.init() not called')
    const inputPath = join(workDir, 'in.mmd')
    const outputPath = join(workDir, 'out.svg')
    writeFileSync(inputPath, withElk(source))
    const args = mmdc.viaNpx
      ? ['-y', '-p', '@mermaid-js/mermaid-cli', 'mmdc', '-i', inputPath, '-o', outputPath, '-q']
      : ['-i', inputPath, '-o', outputPath, '-q']
    try {
      execFileSync(mmdc.cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] })
    } catch (e: unknown) {
      const stderr = (e as { stderr?: Buffer | string }).stderr
      const msg = typeof stderr === 'string' ? stderr : stderr?.toString('utf8') ?? (e instanceof Error ? e.message : String(e))
      const firstLine = msg.split('\n').find(l => l.includes('Error') || l.includes('Parse'))?.trim() ?? msg.split('\n')[0]?.trim() ?? 'unknown'
      throw new Error(firstLine.slice(0, 120))
    }
    return readFileSync(outputPath, 'utf8')
  },
  cleanup() {
    if (workDir) rmSync(workDir, { recursive: true, force: true })
    workDir = null
    mmdc = null
  },
}
