/**
 * Render every comparison sample to SVG using whichever beautiful-mermaid
 * code is currently on disk. The output dir (argv[2]) is conventionally
 * named after the version being captured — e.g. `before/` and `after/` —
 * but the script doesn't care; it just writes one SVG per sample plus a
 * `_summary.json` manifest. Run it twice (with two different checkouts)
 * to get a pair of directories that compare-build-page.ts can diff.
 *
 * Sources come from two places:
 *   - samples-data.ts (the package's published gallery of canonical demos)
 *   - src/__tests__/sample-graphs/ (the layout-stressing scenarios that the
 *     test suite asserts on — adding a new sample-graphs module makes it
 *     appear here automatically with no further wiring)
 */
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { renderMermaidSVG } from '../../src/index.ts'
import { samples } from '../../samples-data.ts'
import { ALL_SAMPLE_GRAPHS } from '../../src/__tests__/sample-graphs/index.ts'

const outDir = process.argv[2]
if (!outDir) {
  console.error('usage: bun run compare-render.ts <out-dir>')
  process.exit(1)
}
mkdirSync(outDir, { recursive: true })

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

interface SummaryEntry {
  title: string
  category: string
  slug: string
  width: number
  height: number
  error?: string
}

const summary: SummaryEntry[] = []

// Canonical published gallery (samples-data.ts) — slug derived from title.
for (const sample of samples) {
  const slug = slugify(sample.title)
  render(slug, sample.title, sample.category ?? 'Other', sample.source)
}

// Layout-stress scenarios (sample-graphs/*) — slug is canonical, category
// inferred from the slug prefix so the page filter still groups them.
for (const sample of ALL_SAMPLE_GRAPHS) {
  const category = sample.slug === 'bug-repro' || sample.slug.startsWith('perm-') ||
                   sample.slug.startsWith('multi-') || sample.slug.startsWith('stress-')
    ? 'Stress Cases'
    : 'Other'
  render(sample.slug, sample.title, category, sample.source)
}

function render(slug: string, title: string, category: string, source: string): void {
  try {
    const svg = renderMermaidSVG(source, { bg: '#ffffff', fg: '#1f2937' })
    const widthMatch = svg.match(/<svg\b[^>]*\bwidth="([\d.]+)"/)
    const heightMatch = svg.match(/<svg\b[^>]*\bheight="([\d.]+)"/)
    const width = Number(widthMatch?.[1] ?? 0)
    const height = Number(heightMatch?.[1] ?? 0)
    writeFileSync(join(outDir, `${slug}.svg`), svg)
    summary.push({ title, category, slug, width, height })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    writeFileSync(join(outDir, `${slug}.error.txt`), msg)
    summary.push({ title, category, slug, width: 0, height: 0, error: msg })
  }
}

writeFileSync(join(outDir, '_summary.json'), JSON.stringify(summary, null, 2))
console.log(`Rendered ${summary.length} samples to ${outDir}`)
const errors = summary.filter(s => s.error)
if (errors.length > 0) console.log(`  ${errors.length} errors`)
