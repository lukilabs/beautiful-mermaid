/**
 * Builds the comparison page from rendered SVGs.
 *
 * Reads SVGs from `<compareDir>/before/` and `<compareDir>/after/` (each
 * directory populated by a separate run of compare-render.ts) and emits
 * `<compareDir>/index.html` — a self-contained page with two side-by-side
 * panels per sample.
 *
 * Pass `--with-mmc` to add a third "reference" column populated from
 * `<compareDir>/mmc/` (rendered by `compare-render.ts --backend=mmc`).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { tmpdir } from 'os'
import { allSampleItems, dims, escapeHtml, slugify } from './shared.ts'

const scriptDir = dirname(fileURLToPath(import.meta.url))

const withMmc = process.argv.includes('--with-mmc')

// Output directory; override with $BM_COMPARE_DIR.
const compareDir = process.env.BM_COMPARE_DIR ?? join(tmpdir(), 'sample-comparison')
const beforeDir = `${compareDir}/before`
const afterDir = `${compareDir}/after`
const mmcDir = `${compareDir}/mmc`

/** One row of the comparison page — two or three rendered SVGs plus metadata. */
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

const entries: Entry[] = []
for (const s of allSampleItems()) {
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

/** Substitutes every `{{KEY}}` placeholder in `template` with the matching value from `vars`. Each key replaces all occurrences. */
function render(template: string, vars: Record<string, string>): string {
  let out = template
  for (const [key, value] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value)
  }
  return out
}

const rowTemplate = readFileSync(join(scriptDir, 'template-row.html'), 'utf8')
const mmcPanelTemplate = readFileSync(join(scriptDir, 'template-mmc-panel.html'), 'utf8')

const rowsHtml = entries.map((e, idx) => {
  const differs = e.diffPct > 1
  const diffBadge = differs
    ? `<span class="badge diff">DIFFERS · Δ ${e.diffPct.toFixed(0)}%</span>`
    : '<span class="badge same">identical</span>'
  const descriptionBlock = e.description ? `<p class="row-desc">${escapeHtml(e.description)}</p>` : ''
  const mmcPanel = withMmc
    ? render(mmcPanelTemplate, {
        MMC_W: e.mmcDims.w.toFixed(0),
        MMC_H: e.mmcDims.h.toFixed(0),
        MMC_SVG: e.mmcSvg || '<div class="err">no svg</div>',
      })
    : ''
  return render(rowTemplate, {
    CATEGORY: escapeHtml(e.category),
    CATEGORY_SLUG: slugify(e.category),
    DIFFERS: String(differs),
    INDEX: String(idx),
    TITLE: escapeHtml(e.title),
    DIFF_BADGE: diffBadge,
    DESCRIPTION_BLOCK: descriptionBlock,
    PANEL_DIFFERS_CLASS: differs ? 'panel-differs' : '',
    BEFORE_W: e.beforeDims.w.toFixed(0),
    BEFORE_H: e.beforeDims.h.toFixed(0),
    BEFORE_SVG: e.beforeSvg || '<div class="err">no svg</div>',
    AFTER_W: e.afterDims.w.toFixed(0),
    AFTER_H: e.afterDims.h.toFixed(0),
    AFTER_SVG: e.afterSvg || '<div class="err">no svg</div>',
    MMC_PANEL: mmcPanel,
  })
}).join('\n')

// Page-shell substitution. No escaping pass because every value is either
// a number generated here or per-row HTML escaped during row construction.
const template = readFileSync(join(scriptDir, 'template.html'), 'utf8')
const html = render(template, {
  GRID_COLUMNS: withMmc ? '1fr 1fr 1fr' : '1fr 1fr',
  TOTAL_COUNT: String(totalCount),
  DIFFER_COUNT: String(differCount),
  IDENTICAL_COUNT: String(totalCount - differCount),
  ROWS: rowsHtml,
})

mkdirSync(compareDir, { recursive: true })
writeFileSync(`${compareDir}/index.html`, html)
console.log(`Wrote ${compareDir}/index.html`)
console.log(`  ${totalCount} samples, ${differCount} differ between before/after${withMmc ? ', mmc reference column included' : ''}`)
