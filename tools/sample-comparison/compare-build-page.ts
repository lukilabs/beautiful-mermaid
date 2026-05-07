/**
 * Build the comparison page.
 *
 * Reads SVGs from sample-comparison/{before,after} (each captured by
 * running compare-render.ts against a different checkout — conventionally
 * main vs. the working branch, but the script doesn't care which is which)
 * and emits a self-contained HTML file with two side-by-side panels per
 * sample.
 *
 * Pass `--with-mmc` to also include a third "reference" column populated
 * from sample-comparison/mmc/ (pre-rendered by compare-render-mmc.ts via
 * mermaid-cli with ELK enabled). The default is two-panel because rendering
 * mermaid live in the browser is slow and most reviewers just want the
 * before/after diff.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { tmpdir } from 'os'
import { samples } from '../../samples-data.ts'
import { ALL_SAMPLE_GRAPHS } from '../../src/__tests__/sample-graphs/index.ts'

const scriptDir = dirname(fileURLToPath(import.meta.url))

const withMmc = process.argv.includes('--with-mmc')

// Output (index.html, before/, after/, mmc/) is regenerable artifact —
// keep it outside the repo. Defaults to OS temp; override with
// $BM_COMPARE_DIR if you want to render somewhere else.
const compareDir = process.env.BM_COMPARE_DIR ?? join(tmpdir(), 'sample-comparison')
const beforeDir = `${compareDir}/before`
const afterDir = `${compareDir}/after`
const mmcDir = `${compareDir}/mmc`

const dimRe = /<svg\b[^>]*\bwidth="([\d.]+)"[^>]*\bheight="([\d.]+)"/
function dims(svg: string): { w: number; h: number } {
  const m = svg.match(dimRe)
  return m ? { w: Number(m[1]), h: Number(m[2]) } : { w: 0, h: 0 }
}

function slugify(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

interface Entry {
  title: string
  category: string
  description?: string
  source: string
  beforeSvg: string
  afterSvg: string
  mmcSvg: string
  beforeDims: { w: number; h: number }
  afterDims: { w: number; h: number }
  mmcDims: { w: number; h: number }
  diffPct: number
}

// All comparison samples: layout-stressing scenarios from `sample-graphs/`
// (the test suite's canonical source of truth for these) followed by every
// published sample in `samples-data.ts` (the package's gallery).
const allSamples: Array<{ title: string; category: string; description?: string; source: string; slug: string }> = [
  ...ALL_SAMPLE_GRAPHS.map(s => ({
    title: s.title,
    category: 'Stress Cases',
    description: s.description,
    source: s.source,
    slug: s.slug,
  })),
  ...samples.map(s => ({
    title: s.title,
    category: s.category ?? 'Other',
    description: s.description,
    source: s.source,
    slug: slugify(s.title),
  })),
]

const entries: Entry[] = []
for (const s of allSamples) {
  let beforeSvg = ''
  let afterSvg = ''
  let mmcSvg = ''
  try { beforeSvg = readFileSync(join(beforeDir, `${s.slug}.svg`), 'utf8') } catch {}
  try { afterSvg = readFileSync(join(afterDir, `${s.slug}.svg`), 'utf8') } catch {}
  if (withMmc) {
    try { mmcSvg = readFileSync(join(mmcDir, `${s.slug}.svg`), 'utf8') } catch {}
  }

  const bd = dims(beforeSvg)
  const ad = dims(afterSvg)
  const md = dims(mmcSvg)
  const dw = Math.abs(bd.w - ad.w)
  const dh = Math.abs(bd.h - ad.h)
  const maxDim = Math.max(bd.w, bd.h, ad.w, ad.h, 1)
  const diffPct = ((dw + dh) / maxDim) * 100

  entries.push({
    title: s.title,
    category: s.category,
    description: s.description,
    source: s.source,
    beforeSvg,
    afterSvg,
    mmcSvg,
    beforeDims: bd,
    afterDims: ad,
    mmcDims: md,
    diffPct,
  })
}

// Sort: stress cases first, then differing samples, then by category, then by title
entries.sort((a, b) => {
  if (a.category === 'Stress Cases' && b.category !== 'Stress Cases') return -1
  if (b.category === 'Stress Cases' && a.category !== 'Stress Cases') return 1
  const aDiff = a.diffPct > 1
  const bDiff = b.diffPct > 1
  if (aDiff !== bDiff) return aDiff ? -1 : 1
  if (a.category !== b.category) return a.category.localeCompare(b.category)
  return a.title.localeCompare(b.title)
})

const differCount = entries.filter(e => e.diffPct > 1).length
const totalCount = entries.length

const rowsHtml = entries.map((e, idx) => {
  const diffBadge = e.diffPct > 1
    ? `<span class="badge diff">DIFFERS · Δ ${e.diffPct.toFixed(0)}%</span>`
    : `<span class="badge same">identical</span>`

  const categoryBadge = `<span class="badge cat cat-${slugify(e.category)}">${escapeHtml(e.category)}</span>`

  const mmcPanel = withMmc
    ? `
    <div class="panel">
      <div class="panel-head">mermaid + ELK <em>(reference)</em>
        <span class="dim">${e.mmcDims.w.toFixed(0)} × ${e.mmcDims.h.toFixed(0)}</span>
      </div>
      <div class="panel-body">${e.mmcSvg || '<div class="err">no svg</div>'}</div>
    </div>`
    : ''

  return `
<section class="row" data-category="${escapeHtml(e.category)}" data-differs="${e.diffPct > 1}" data-index="${idx}">
  <header class="row-header">
    <h2>${escapeHtml(e.title)}</h2>
    <div class="row-meta">
      ${categoryBadge}
      ${diffBadge}
    </div>
    ${e.description ? `<p class="row-desc">${escapeHtml(e.description)}</p>` : ''}
  </header>
  <div class="grid">
    <div class="panel ${e.diffPct > 1 ? 'panel-differs' : ''}">
      <div class="panel-head">beautiful-mermaid <em>before</em>
        <span class="dim">${e.beforeDims.w.toFixed(0)} × ${e.beforeDims.h.toFixed(0)}</span>
      </div>
      <div class="panel-body">${e.beforeSvg || '<div class="err">no svg</div>'}</div>
    </div>
    <div class="panel ${e.diffPct > 1 ? 'panel-differs' : ''}">
      <div class="panel-head">beautiful-mermaid <em>after</em>
        <span class="dim">${e.afterDims.w.toFixed(0)} × ${e.afterDims.h.toFixed(0)}</span>
      </div>
      <div class="panel-body">${e.afterSvg || '<div class="err">no svg</div>'}</div>
    </div>${mmcPanel}
  </div>
</section>`
}).join('\n')

// Page shell (HTML/CSS/JS) lives in template.html. We load it once and fill
// in `{{TOKEN}}` placeholders — kept simple on purpose; no escaping pass
// because every substitution value is either a number we control or
// per-row HTML that's already been escaped at row construction time.
const template = readFileSync(join(scriptDir, 'template.html'), 'utf8')
const html = template
  .replace(/\{\{GRID_COLUMNS\}\}/g, withMmc ? '1fr 1fr 1fr' : '1fr 1fr')
  .replace(/\{\{TOTAL_COUNT\}\}/g, String(totalCount))
  .replace(/\{\{DIFFER_COUNT\}\}/g, String(differCount))
  .replace(/\{\{IDENTICAL_COUNT\}\}/g, String(totalCount - differCount))
  .replace(/\{\{ROWS\}\}/g, rowsHtml)

mkdirSync(compareDir, { recursive: true })
writeFileSync(`${compareDir}/index.html`, html)
console.log(`Wrote ${compareDir}/index.html`)
console.log(`  ${totalCount} samples, ${differCount} differ between before/after${withMmc ? ', mmc reference column included' : ''}`)
