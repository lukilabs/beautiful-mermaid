/**
 * Utilities and types shared between the render scripts and the page
 * builder. Each comparison sample resolves to one `Item` and one slug;
 * the rendering backends and the page assembler agree on those shapes.
 */
import { samples } from '../../samples-data.ts'
import { ALL_SAMPLE_GRAPHS } from '../../src/__tests__/sample-graphs/index.ts'

/** Produces the slug used as the SVG filename and DOM id from a sample title. */
export function slugify(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

/** Escapes a string for safe inclusion in an HTML attribute or element body. */
export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const dimRe = /<svg\b[^>]*\bwidth="([\d.]+)"[^>]*\bheight="([\d.]+)"/

/** Reads the `width` and `height` attributes off the root `<svg>` tag for layout-comparison sizing. */
export function dims(svg: string): { w: number; h: number } {
  const m = svg.match(dimRe)
  return m ? { w: Number(m[1]), h: Number(m[2]) } : { w: 0, h: 0 }
}

/** One row of the `_summary.json` manifest written alongside the SVGs by a render run. */
export interface SummaryEntry {
  title: string
  category: string
  slug: string
  width: number
  height: number
  error?: string
}

/** A sample to render or compare: slug, display metadata, and the mermaid source itself. */
export interface SampleItem {
  slug: string
  title: string
  description?: string
  category: string
  source: string
}

/**
 * Enumerates every comparison sample once: layout-stress scenarios from
 * `sample-graphs/` first (under "Stress Cases"), then the published gallery
 * in `samples-data.ts` under each sample's own category. Both the render
 * scripts and the page builder iterate this list.
 */
export function allSampleItems(): SampleItem[] {
  return [
    ...ALL_SAMPLE_GRAPHS.map(s => ({
      slug: s.slug,
      title: s.title,
      description: s.description,
      category: 'Stress Cases',
      source: s.source,
    })),
    ...samples.map(s => ({
      slug: slugify(s.title),
      title: s.title,
      description: s.description,
      category: s.category ?? 'Other',
      source: s.source,
    })),
  ]
}
