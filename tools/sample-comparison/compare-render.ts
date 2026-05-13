/**
 * Renders every comparison sample to SVG using the selected backend.
 *
 * Iterates the canonical sample list once, hands each source to the
 * backend, writes the resulting `<slug>.svg` into the output directory,
 * and emits a `_summary.json` manifest of dimensions and any failures.
 *
 * Usage:
 *   bun run compare-render.ts <out-dir> [--backend=bm|mmc]
 *
 * Backends:
 *   bm   beautiful-mermaid (default) — the code under test
 *   mmc  mermaid-cli (mmdc) — reference renders for the page's optional
 *        third column
 */
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { allSampleItems, dims, type SummaryEntry } from './shared.ts'
import { bmBackend } from './backends/bm.ts'
import { mmcBackend } from './backends/mmc.ts'
import type { RenderBackend } from './backends/types.ts'

const positionals = process.argv.slice(2).filter(a => !a.startsWith('-'))
const outDir = positionals[0]
if (!outDir) {
  console.error('usage: bun run compare-render.ts <out-dir> [--backend=bm|mmc]')
  process.exit(1)
}

const backendName = process.argv.find(a => a.startsWith('--backend='))?.split('=')[1] ?? 'bm'
const backends: Record<string, RenderBackend> = { bm: bmBackend, mmc: mmcBackend }
const backend = backends[backendName]
if (!backend) {
  console.error(`unknown backend: ${backendName} (available: ${Object.keys(backends).join(', ')})`)
  process.exit(1)
}

mkdirSync(outDir, { recursive: true })
backend.init?.()

const items = allSampleItems()
const summary: SummaryEntry[] = []
let rendered = 0
let failed = 0
const startedAt = Date.now()

console.log(`Rendering ${items.length} samples through ${backend.name} into ${outDir}...`)

for (let i = 0; i < items.length; i++) {
  const it = items[i]!
  try {
    const svg = backend.render(it.source)
    const d = dims(svg)
    writeFileSync(join(outDir, `${it.slug}.svg`), svg)
    summary.push({ title: it.title, category: it.category, slug: it.slug, width: d.w, height: d.h })
    rendered++
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    writeFileSync(join(outDir, `${it.slug}.error.txt`), msg)
    summary.push({ title: it.title, category: it.category, slug: it.slug, width: 0, height: 0, error: msg })
    failed++
  }
  // Slow backends (mmdc cold-starts Puppeteer per sample) get a progress line.
  if (backend.name === 'mmc' && (i % 10 === 9 || i === items.length - 1)) {
    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(0)
    process.stdout.write(`  ${i + 1}/${items.length} (${elapsed}s, ${failed} failed)\r`)
  }
}
if (backend.name === 'mmc') process.stdout.write('\n')

backend.cleanup?.()
writeFileSync(join(outDir, '_summary.json'), JSON.stringify(summary, null, 2))

const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1)
console.log(`Rendered ${rendered}/${items.length} samples (${elapsedSec}s${failed > 0 ? `, ${failed} failed` : ''})`)
if (failed > 0) {
  for (const e of summary.filter(s => s.error)) console.log(`  - ${e.slug}: ${e.error}`)
}
