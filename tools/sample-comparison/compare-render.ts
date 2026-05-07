/**
 * Renders every comparison sample to SVG using the beautiful-mermaid build
 * currently on disk. argv[2] is the output directory; one SVG is written
 * per sample plus a `_summary.json` manifest of dimensions and errors.
 *
 * Samples are read from samples-data.ts (the published gallery) and from
 * src/__tests__/sample-graphs/ (the layout-stress scenarios shared with
 * the test suite).
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

/** Lowercase the title and replace any non-alphanumeric run with a single dash. */
function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** One row of the `_summary.json` manifest emitted alongside the SVGs. */
interface SummaryEntry {
  title: string
  category: string
  slug: string
  width: number
  height: number
  error?: string
}

const summary: SummaryEntry[] = []

// Published-gallery samples use a slug derived from the title; the category
// comes from the source manifest.
for (const sample of samples) {
  const slug = slugify(sample.title)
  render(slug, sample.title, sample.category ?? 'Other', sample.source)
}

// Layout-stress scenarios already carry a canonical slug; the category is
// "Stress Cases" for the four prefixes the page filter groups together.
for (const sample of ALL_SAMPLE_GRAPHS) {
  const category = sample.slug === 'bug-repro' || sample.slug.startsWith('perm-') ||
                   sample.slug.startsWith('multi-') || sample.slug.startsWith('stress-')
    ? 'Stress Cases'
    : 'Other'
  render(sample.slug, sample.title, category, sample.source)
}

/**
 * Render `source` and write `<slug>.svg` into the output directory. On
 * failure, write `<slug>.error.txt` with the error message and record the
 * failure in the summary so the comparison page can flag it.
 */
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
