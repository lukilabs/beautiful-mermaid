/**
 * Render every sample in samples-data.ts to SVG with the current
 * beautiful-mermaid code, into the directory passed as argv[2].
 * Used twice: once with the pre-fix layout-engine, once with the post-fix one.
 */
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { renderMermaidSVG } from '../../src/index.ts'
import { samples } from '../../samples-data.ts'

const outDir = process.argv[2]
if (!outDir) {
  console.error('usage: tsx compare-render.ts <out-dir>')
  process.exit(1)
}
mkdirSync(outDir, { recursive: true })

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const summary: Array<{ title: string; category: string; slug: string; width: number; height: number; error?: string }> = []

for (const sample of samples) {
  const slug = slugify(sample.title)
  try {
    const svg = renderMermaidSVG(sample.source, { bg: '#ffffff', fg: '#1f2937' })
    const widthMatch = svg.match(/<svg\b[^>]*\bwidth="([\d.]+)"/)
    const heightMatch = svg.match(/<svg\b[^>]*\bheight="([\d.]+)"/)
    const width = Number(widthMatch?.[1] ?? 0)
    const height = Number(heightMatch?.[1] ?? 0)
    writeFileSync(join(outDir, `${slug}.svg`), svg)
    summary.push({ title: sample.title, category: sample.category ?? 'Other', slug, width, height })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    writeFileSync(join(outDir, `${slug}.error.txt`), msg)
    summary.push({ title: sample.title, category: sample.category ?? 'Other', slug, width: 0, height: 0, error: msg })
  }
}

writeFileSync(join(outDir, '_summary.json'), JSON.stringify(summary, null, 2))
console.log(`Rendered ${summary.length} samples to ${outDir}`)
const errors = summary.filter(s => s.error)
if (errors.length > 0) console.log(`  ${errors.length} errors`)
