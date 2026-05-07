/**
 * Renders every comparison sample with mermaid-cli (mmdc) into the directory
 * passed as argv[2]. compare-build-page.ts inlines these SVGs as the
 * `mermaid + ELK (reference)` column when invoked with `--with-mmc`.
 *
 * Each sample is rendered in its own mmdc invocation so a chart that fails
 * to parse doesn't abort the rest of the run. mmdc must be on PATH or
 * available via npx; the script exits with a warning if neither resolves.
 */
import { execFileSync, spawnSync } from 'child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { samples } from '../../samples-data.ts'
import { ALL_SAMPLE_GRAPHS } from '../../src/__tests__/sample-graphs/index.ts'

const outDir = process.argv[2]
if (!outDir) {
  console.error('usage: bun run compare-render-mmc.ts <out-dir>')
  process.exit(1)
}
mkdirSync(outDir, { recursive: true })

/** Lowercase the title and replace any non-alphanumeric run with a single dash. */
function slugify(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

/** A sample that needs to be rendered: a slug for the output filename and the mermaid source. */
interface Item { slug: string; source: string }

const items: Item[] = [
  ...ALL_SAMPLE_GRAPHS.map(s => ({ slug: s.slug, source: s.source })),
  ...samples.map(s => ({ slug: slugify(s.title), source: s.source })),
]

/**
 * How to invoke mmdc on this machine: either the binary directly or
 * via npx. Resolves at startup; the script exits if neither is available.
 */
const mmdcCmd = (() => {
  const probe = spawnSync('mmdc', ['--version'], { stdio: 'ignore' })
  if (probe.status === 0) return { cmd: 'mmdc' as const, viaNpx: false }
  const npx = spawnSync('npx', ['--no-install', '-p', '@mermaid-js/mermaid-cli', 'mmdc', '--version'], { stdio: 'ignore' })
  if (npx.status === 0) return { cmd: 'npx' as const, viaNpx: true }
  console.warn('mmdc not found on PATH and not installed for npx — skipping mmc renders')
  console.warn('install with: npm i -g @mermaid-js/mermaid-cli  (or)  npm i -D @mermaid-js/mermaid-cli')
  process.exit(0)
})()

/**
 * Prepend an `%%{init:...}%%` directive that turns on the ELK renderer for
 * flowchart and stateDiagram sources. Other diagram types are left alone.
 * Sources that already declare a `defaultRenderer` are returned as-is.
 */
function withElk(source: string): string {
  if (source.includes('defaultRenderer')) return source
  const first = source.trim().split('\n')[0]?.toLowerCase() ?? ''
  if (!/^(graph|flowchart|statediagram)/.test(first)) return source
  return `%%{init: {"flowchart": {"defaultRenderer": "elk"}, "stateDiagram": {"defaultRenderer": "elk"}}}%%\n${source}`
}

/**
 * Run mmdc to convert `inputPath` into `outputPath`. Returns whether the
 * invocation succeeded and, on failure, a one-line reason extracted from
 * mmdc's stderr (Puppeteer parse errors have a recognisable first line).
 */
function runMmdc(inputPath: string, outputPath: string): { ok: boolean; reason?: string } {
  const args = mmdcCmd.viaNpx
    ? ['-y', '-p', '@mermaid-js/mermaid-cli', 'mmdc', '-i', inputPath, '-o', outputPath, '-q']
    : ['-i', inputPath, '-o', outputPath, '-q']
  try {
    execFileSync(mmdcCmd.cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] })
    return { ok: true }
  } catch (e: unknown) {
    const stderr = (e as { stderr?: Buffer | string }).stderr
    const msg = typeof stderr === 'string' ? stderr : stderr?.toString('utf8') ?? (e instanceof Error ? e.message : String(e))
    const firstLine = msg.split('\n').find(l => l.includes('Error') || l.includes('Parse'))?.trim() ?? msg.split('\n')[0]?.trim() ?? 'unknown'
    return { ok: false, reason: firstLine.slice(0, 120) }
  }
}

const work = mkdtempSync(join(tmpdir(), 'bm-mmc-'))

console.log(`Rendering ${items.length} samples through mmdc one at a time...`)
const startedAt = Date.now()
let rendered = 0, failed = 0
const failures: Array<{ slug: string; reason: string }> = []

for (let i = 0; i < items.length; i++) {
  const it = items[i]!
  const inputPath = join(work, 'in.mmd')
  writeFileSync(inputPath, withElk(it.source))
  const outputPath = join(outDir, `${it.slug}.svg`)
  const result = runMmdc(inputPath, outputPath)
  if (result.ok) {
    rendered++
  } else {
    failed++
    failures.push({ slug: it.slug, reason: result.reason ?? 'unknown' })
  }
  if (i % 10 === 9 || i === items.length - 1) {
    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(0)
    process.stdout.write(`  ${i + 1}/${items.length} (${elapsed}s, ${failed} failed)\r`)
  }
}
process.stdout.write('\n')
rmSync(work, { recursive: true, force: true })

const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1)
console.log(`  ${rendered} SVGs into ${outDir} (${elapsedSec}s)`)
if (failures.length > 0) {
  console.log(`  ${failures.length} samples failed in mmdc:`)
  for (const f of failures) console.log(`    - ${f.slug}: ${f.reason}`)
}
