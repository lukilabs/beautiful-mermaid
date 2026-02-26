/**
 * Builds the standalone markdown editor app as dist/editor.html.
 *
 * Follows the same pattern as index.ts:
 *   1. Bundle editor/browser-entry.ts for the browser via Bun.build()
 *   2. Generate theme selector options at build time (static HTML)
 *   3. Assemble a self-contained editor.html with inline JS bundle + CSS
 *   4. Write to dist/editor.html
 *
 * Usage: bun run build-editor.ts
 */

import { THEMES } from './src/theme.ts'
import { mkdir } from 'fs/promises'

// ── Step 1: Bundle the editor for the browser ─────────────────────────────

const buildResult = await Bun.build({
  entrypoints: [new URL('./editor/browser-entry.ts', import.meta.url).pathname],
  target: 'browser',
  format: 'esm',
  minify: true,
})

if (!buildResult.success) {
  console.error('Editor bundle build failed:', buildResult.logs)
  process.exit(1)
}

const bundleJs = await buildResult.outputs[0]!.text()
console.log(`Editor bundle: ${(bundleJs.length / 1024).toFixed(1)} KB`)

// ── Step 2: Build theme <select> options at build time ────────────────────

function escapeAttr(s: string): string {
  return s.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const themeOptions = [
  '<option value="">Default (zinc light)</option>',
  ...Object.entries(THEMES).map(([key]) => {
    const label = key
      .split('-')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
    return `<option value="${escapeAttr(key)}">${escapeAttr(label)}</option>`
  }),
].join('\n          ')

// ── Step 3: Assemble the HTML ─────────────────────────────────────────────

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Markdown Editor — Beautiful Mermaid</title>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
  <style>
    /* ── Reset ─────────────────────────────────────────────────────────── */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    /* ── Layout root ───────────────────────────────────────────────────── */
    body {
      --t-bg: #FFFFFF;
      --t-fg: #27272A;
      --split-left: 50%;
      font-family: 'Geist', system-ui, -apple-system, sans-serif;
      background: var(--t-bg);
      color: var(--t-fg);
      height: 100dvh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      -webkit-font-smoothing: antialiased;
    }

    /* ── Toolbar ───────────────────────────────────────────────────────── */
    .toolbar {
      height: 44px;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0 1rem;
      border-bottom: 1px solid color-mix(in srgb, var(--t-fg) 8%, var(--t-bg));
      background: color-mix(in srgb, var(--t-fg) 2%, var(--t-bg));
    }
    .toolbar-title {
      font-size: 0.8rem;
      font-weight: 600;
      color: color-mix(in srgb, var(--t-fg) 60%, var(--t-bg));
      white-space: nowrap;
    }
    .toolbar-spacer { flex: 1; }

    .theme-select {
      height: 28px;
      padding: 0 0.5rem;
      border: 1px solid color-mix(in srgb, var(--t-fg) 14%, var(--t-bg));
      border-radius: 6px;
      background: var(--t-bg);
      color: var(--t-fg);
      font-family: inherit;
      font-size: 0.75rem;
      cursor: pointer;
      outline: none;
    }
    .theme-select:focus {
      border-color: color-mix(in srgb, var(--t-fg) 35%, var(--t-bg));
    }

    /* ── Split container ───────────────────────────────────────────────── */
    #split-container {
      flex: 1;
      display: grid;
      grid-template-columns: var(--split-left) 5px 1fr;
      min-height: 0;
      overflow: hidden;
    }

    /* ── Shared pane styles ────────────────────────────────────────────── */
    .pane-header {
      height: 30px;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      padding: 0 1rem;
      font-size: 0.68rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: color-mix(in srgb, var(--t-fg) 35%, var(--t-bg));
      border-bottom: 1px solid color-mix(in srgb, var(--t-fg) 6%, var(--t-bg));
      background: color-mix(in srgb, var(--t-fg) 2%, var(--t-bg));
    }

    /* ── Editor pane ───────────────────────────────────────────────────── */
    #editor-pane {
      display: flex;
      flex-direction: column;
      overflow: hidden;
      border-right: 1px solid color-mix(in srgb, var(--t-fg) 8%, var(--t-bg));
    }
    #editor {
      flex: 1;
      resize: none;
      border: none;
      outline: none;
      padding: 1rem 1.25rem;
      font-family: 'JetBrains Mono', 'Fira Code', ui-monospace, monospace;
      font-size: 0.84rem;
      line-height: 1.65;
      background: color-mix(in srgb, var(--t-fg) 1.5%, var(--t-bg));
      color: var(--t-fg);
      tab-size: 2;
      white-space: pre;
      overflow: auto;
      caret-color: color-mix(in srgb, var(--t-fg) 70%, var(--t-bg));
    }
    #editor::placeholder {
      color: color-mix(in srgb, var(--t-fg) 22%, var(--t-bg));
    }

    /* ── Resize divider ────────────────────────────────────────────────── */
    #divider {
      background: color-mix(in srgb, var(--t-fg) 8%, var(--t-bg));
      cursor: col-resize;
      transition: background 0.12s;
      position: relative;
    }
    #divider:hover,
    #divider:active {
      background: color-mix(in srgb, var(--t-fg) 22%, var(--t-bg));
    }

    /* ── Preview pane ──────────────────────────────────────────────────── */
    #preview-pane {
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    #preview {
      flex: 1;
      overflow-y: auto;
      padding: 1.5rem 2rem 3rem;
      line-height: 1.75;
    }

    /* ── Markdown typography ───────────────────────────────────────────── */
    #preview h1 { font-size: 1.7rem; font-weight: 700; margin: 0 0 0.6rem; line-height: 1.2; }
    #preview h2 { font-size: 1.3rem; font-weight: 600; margin: 1.75rem 0 0.5rem; line-height: 1.3; }
    #preview h3 { font-size: 1.05rem; font-weight: 600; margin: 1.4rem 0 0.35rem; }
    #preview h4 { font-size: 0.95rem; font-weight: 600; margin: 1.2rem 0 0.3rem; }
    #preview p  { margin: 0.55rem 0; color: color-mix(in srgb, var(--t-fg) 88%, var(--t-bg)); }
    #preview a  {
      color: color-mix(in srgb, #3b82f6 80%, var(--t-fg));
      text-decoration: underline;
      text-underline-offset: 2px;
    }
    #preview strong { font-weight: 600; }
    #preview em { font-style: italic; }
    #preview hr {
      border: none;
      border-top: 1px solid color-mix(in srgb, var(--t-fg) 10%, var(--t-bg));
      margin: 1.5rem 0;
    }
    #preview ul, #preview ol { padding-left: 1.5rem; margin: 0.5rem 0; }
    #preview li { margin: 0.25rem 0; }
    #preview li > ul, #preview li > ol { margin: 0.15rem 0; }
    #preview blockquote {
      border-left: 3px solid color-mix(in srgb, var(--t-fg) 18%, var(--t-bg));
      padding: 0.1rem 0 0.1rem 1rem;
      margin: 0.75rem 0;
      color: color-mix(in srgb, var(--t-fg) 55%, var(--t-bg));
    }
    #preview pre {
      background: color-mix(in srgb, var(--t-fg) 4%, var(--t-bg));
      border: 1px solid color-mix(in srgb, var(--t-fg) 7%, var(--t-bg));
      border-radius: 6px;
      padding: 0.9rem 1rem;
      overflow-x: auto;
      margin: 0.75rem 0;
    }
    #preview code {
      font-family: 'JetBrains Mono', 'Fira Code', ui-monospace, monospace;
      font-size: 0.82rem;
    }
    #preview :not(pre) > code {
      background: color-mix(in srgb, var(--t-fg) 6%, var(--t-bg));
      padding: 0.15em 0.4em;
      border-radius: 3px;
    }
    #preview table {
      border-collapse: collapse;
      width: 100%;
      margin: 0.75rem 0;
      font-size: 0.9rem;
    }
    #preview th, #preview td {
      border: 1px solid color-mix(in srgb, var(--t-fg) 10%, var(--t-bg));
      padding: 0.45rem 0.8rem;
      text-align: left;
    }
    #preview th {
      background: color-mix(in srgb, var(--t-fg) 4%, var(--t-bg));
      font-weight: 600;
    }
    #preview img { max-width: 100%; height: auto; border-radius: 4px; }

    /* ── Mermaid diagram area ──────────────────────────────────────────── */
    .mermaid-render {
      margin: 1rem 0;
      display: flex;
      justify-content: flex-start;
      overflow-x: auto;
    }
    .mermaid-render svg {
      max-width: 100%;
      height: auto;
      display: block;
    }
    /* Show a subtle loading hint while placeholder is visible */
    .mermaid-placeholder {
      margin: 1rem 0;
      min-height: 60px;
      border-radius: 6px;
      background: color-mix(in srgb, var(--t-fg) 2%, var(--t-bg));
      border: 1px dashed color-mix(in srgb, var(--t-fg) 10%, var(--t-bg));
    }
    .mermaid-error {
      margin: 1rem 0;
      padding: 0.75rem 1rem;
      background: color-mix(in srgb, #dc2626 8%, var(--t-bg));
      border: 1px solid color-mix(in srgb, #dc2626 30%, var(--t-bg));
      border-radius: 6px;
      color: #dc2626;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.78rem;
      white-space: pre-wrap;
    }

    /* ── Mobile: stack panes vertically ───────────────────────────────── */
    @media (max-width: 768px) {
      #split-container {
        grid-template-columns: 1fr;
        grid-template-rows: 45dvh 5px 1fr;
      }
      #editor-pane { border-right: none; border-bottom: 1px solid color-mix(in srgb, var(--t-fg) 8%, var(--t-bg)); }
      #divider { cursor: row-resize; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <span class="toolbar-title">Beautiful Mermaid — Markdown Editor</span>
    <div class="toolbar-spacer"></div>
    <select id="theme-select" class="theme-select" aria-label="Diagram theme">
          ${themeOptions}
    </select>
  </div>

  <div id="split-container">
    <div id="editor-pane">
      <div class="pane-header">Markdown</div>
      <textarea
        id="editor"
        spellcheck="false"
        autocorrect="off"
        autocapitalize="off"
        placeholder="Write markdown here…"
        aria-label="Markdown source editor"
      ></textarea>
    </div>

    <div id="divider" role="separator" aria-label="Resize handle"></div>

    <div id="preview-pane">
      <div class="pane-header">Preview</div>
      <div id="preview" aria-live="polite"></div>
    </div>
  </div>

  <script type="module">
${bundleJs}
  </script>
</body>
</html>`

// ── Step 4: Write output ──────────────────────────────────────────────────

const distDir = new URL('./dist', import.meta.url).pathname
await mkdir(distDir, { recursive: true })

const outPath = `${distDir}/editor.html`
await Bun.write(outPath, html)

console.log(`\x1b[32m[build-editor]\x1b[0m dist/editor.html written (${(html.length / 1024).toFixed(1)} KB)`)
