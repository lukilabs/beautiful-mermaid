# sample-comparison

Tools for visually comparing two versions of beautiful-mermaid's layout
output, side-by-side, across the published gallery (`samples-data.ts`)
and the layout-stress sample set (`src/__tests__/sample-graphs/`).

## Workflow

Three Bun scripts. Run the renderer twice — once against each version
you want to compare — then build the page.

```sh
# (1) Render version A into `before/` (typically run from main)
bun run tools/sample-comparison/compare-render.ts $TEMP/sample-comparison/before

# (2) Render version B into `after/` (typically run from your branch)
bun run tools/sample-comparison/compare-render.ts $TEMP/sample-comparison/after

# (3) Build the page
bun run tools/sample-comparison/compare-build-page.ts
```

Open the resulting `index.html` in a browser. Each row shows the same
sample rendered by both versions side-by-side, with a delta-percentage
badge indicating how much the rendered SVG width and height differ.

## Backends

`compare-render.ts` selects which renderer to use via `--backend`:

| Backend | Default | Renders through                                       |
|---------|---------|-------------------------------------------------------|
| `bm`    | yes     | beautiful-mermaid (the code on disk; ELK-based)       |
| `mmc`   |         | mermaid-cli (`mmdc`) with its default dagre renderer  |

```sh
# Capture mermaid-cli reference renders for the third column
bun run tools/sample-comparison/compare-render.ts $TEMP/sample-comparison/mmc --backend=mmc
```

The `mmc` backend requires `mmdc` on PATH or available via `npx`. It
exits with an install hint if neither resolves.

## The `--with-mmc` flag

By default `compare-build-page.ts` produces a two-panel page (before /
after). Pass `--with-mmc` to add a third "mermaid (reference)" column
populated from `<compareDir>/mmc/` (rendered with mmdc's default dagre
layout):

```sh
bun run tools/sample-comparison/compare-build-page.ts --with-mmc
```

Without the flag, only the before/after columns are emitted.

## Output location

By default everything writes to `${tmpdir()}/sample-comparison/`. Override
with `$BM_COMPARE_DIR`. The output (SVGs, HTML, summary JSON) is
regenerable artifact and is gitignored by `.gitignore` in this directory.

## File map

```
tools/sample-comparison/
├── README.md                 — this file
├── shared.ts                 — slugify, escapeHtml, dims, Item / SummaryEntry types,
│                               allSampleItems() (samples-data + sample-graphs)
├── compare-render.ts         — render entry point; picks a backend and writes SVGs
├── compare-build-page.ts     — reads SVGs from before/after/mmc and emits index.html
├── template.html             — page-shell template with {{TOKEN}} placeholders
├── template-row.html         — per-sample row template
├── template-mmc-panel.html   — third-column template (used when --with-mmc is set)
└── backends/
    ├── types.ts              — RenderBackend interface
    ├── bm.ts                 — beautiful-mermaid backend
    └── mmc.ts                — mermaid-cli backend (probes mmdc, shells out per sample)
```

## Adding a new sample

The render scripts iterate `allSampleItems()` from `shared.ts`, which
itself reads from `samples-data.ts` and `src/__tests__/sample-graphs/`.
Adding a new entry to either source surfaces it in the comparison page
on the next render — no wiring changes needed.
