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
import { join } from 'path'
import { tmpdir } from 'os'
import { samples } from '../../samples-data.ts'
import { ALL_SAMPLE_GRAPHS } from '../../src/__tests__/sample-graphs/index.ts'

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

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>beautiful-mermaid · sample comparison</title>
<style>
  :root {
    --bg: #f6f7f9;
    --fg: #1f2937;
    --muted: #6b7280;
    --border: #d1d5db;
    --accent: #2563eb;
    --bad: #dc2626;
    --good: #15803d;
  }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", system-ui, sans-serif; margin: 0; background: var(--bg); color: var(--fg); }
  .topbar {
    position: sticky; top: 0; z-index: 100;
    background: #fff; border-bottom: 1px solid var(--border);
    padding: 0.75rem 1.25rem; display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;
  }
  .topbar h1 { margin: 0; font-size: 1.05rem; font-weight: 600; }
  .topbar .stats { color: var(--muted); font-size: 0.85rem; }
  .filters { display: flex; gap: 0.4rem; flex-wrap: wrap; }
  .filters button {
    background: #fff; border: 1px solid var(--border); border-radius: 999px;
    padding: 0.25rem 0.7rem; font-size: 0.8rem; cursor: pointer;
  }
  .filters button.active { background: var(--accent); color: #fff; border-color: var(--accent); }
  main { padding: 1rem 1.25rem; max-width: 1900px; margin: 0 auto; }
  section.row {
    background: #fff; border: 1px solid var(--border); border-radius: 10px;
    padding: 0.9rem; margin-bottom: 1rem;
  }
  section.row .row-header { margin-bottom: 0.7rem; }
  section.row h2 { margin: 0 0 0.3rem 0; font-size: 1rem; font-weight: 600; }
  .row-meta { display: flex; gap: 0.4rem; align-items: center; flex-wrap: wrap; margin-bottom: 0.3rem; }
  .row-desc { margin: 0; font-size: 0.85rem; color: var(--muted); }
  .badge {
    display: inline-block; padding: 0.1rem 0.55rem; border-radius: 999px; font-size: 0.7rem; font-weight: 600;
    text-transform: uppercase; letter-spacing: 0.04em;
  }
  .badge.diff { background: #fee2e2; color: var(--bad); }
  .badge.same { background: #f3f4f6; color: var(--muted); }
  .badge.cat { background: #e0e7ff; color: #4338ca; }
  .badge.cat-stress-cases { background: #fef3c7; color: #b45309; }
  .badge.cat-hero { background: #fce7f3; color: #be185d; }
  .grid {
    display: grid; grid-template-columns: ${withMmc ? '1fr 1fr 1fr' : '1fr 1fr'}; gap: 0.7rem;
  }
  @media (max-width: 1100px) { .grid { grid-template-columns: 1fr; } }
  .panel {
    border: 1px solid var(--border); border-radius: 8px; background: #fff; overflow: hidden;
    display: flex; flex-direction: column;
  }
  .panel-differs { border-color: var(--accent); }
  .panel-head {
    padding: 0.45rem 0.7rem; background: #f9fafb; border-bottom: 1px solid var(--border);
    font-size: 0.78rem; display: flex; justify-content: space-between; align-items: center; gap: 0.5rem;
  }
  .panel-head em { color: var(--muted); font-style: italic; font-weight: 400; }
  .panel-differs .panel-head { background: #eff6ff; color: var(--accent); }
  .panel-head .dim { color: var(--muted); font-family: ui-monospace, monospace; font-size: 0.72rem; }
  .panel-body { flex: 1; padding: 0.6rem; min-height: 120px; display: flex; align-items: center; justify-content: center; overflow: auto; }
  .panel-body svg { max-width: 100%; height: auto; display: block; }
  .panel-body .err { color: var(--accent); font-size: 0.8rem; }
  .row[hidden] { display: none; }
</style>
</head>
<body>
<div class="topbar">
  <h1>beautiful-mermaid · sample comparison</h1>
  <span class="stats">${totalCount} samples · ${differCount} differ · ${totalCount - differCount} identical</span>
  <div class="filters" id="filters">
    <button data-filter="all" class="active">All (${totalCount})</button>
    <button data-filter="differs">Differing (${differCount})</button>
    <button data-filter="Stress Cases">Stress Cases</button>
    <button data-filter="Flowchart">Flowchart</button>
    <button data-filter="State">State</button>
    <button data-filter="Sequence">Sequence</button>
    <button data-filter="Class">Class</button>
    <button data-filter="ER">ER</button>
    <button data-filter="XY Chart">XY Chart</button>
    <button data-filter="Hero">Hero</button>
  </div>
</div>
<main>
${rowsHtml}
</main>
<script>
  const filters = document.getElementById('filters');
  filters.addEventListener('click', e => {
    if (!(e.target instanceof HTMLButtonElement)) return;
    const btn = e.target;
    const filter = btn.dataset.filter;
    filters.querySelectorAll('button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('section.row').forEach(row => {
      const cat = row.dataset.category;
      const differs = row.dataset.differs === 'true';
      let show = false;
      if (filter === 'all') show = true;
      else if (filter === 'differs') show = differs;
      else show = cat === filter;
      row.hidden = !show;
    });
  });
</script>
</body>
</html>
`

mkdirSync(compareDir, { recursive: true })
writeFileSync(`${compareDir}/index.html`, html)
console.log(`Wrote ${compareDir}/index.html`)
console.log(`  ${totalCount} samples, ${differCount} differ between before/after${withMmc ? ', mmc reference column included' : ''}`)
