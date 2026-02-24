/**
 * Generates xychart-test.html showcasing xychart-beta Mermaid examples.
 *
 * Usage: bun run xychart-test.ts
 *
 * For each example, renders a 3-column grid:
 *   1. Shiki-highlighted mermaid source
 *   2. Chart.js reference rendering
 *   3. beautiful-mermaid SVG rendering (client-side via bundled renderer)
 */

import { xychartSamples } from './xychart-samples-data.ts'
import { THEMES } from './src/theme.ts'
import { createHighlighter } from 'shiki'

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatDescription(text: string): string {
  return text.replace(/`([^`]+)`/g, '<code>$1</code>')
}

const THEME_LABELS: Record<string, string> = {
  'zinc-dark': 'Zinc Dark',
  'tokyo-night': 'Tokyo Night',
  'tokyo-night-storm': 'Tokyo Storm',
  'tokyo-night-light': 'Tokyo Light',
  'catppuccin-mocha': 'Catppuccin',
  'catppuccin-latte': 'Latte',
  'nord': 'Nord',
  'nord-light': 'Nord Light',
  'dracula': 'Dracula',
  'github-light': 'GitHub',
  'github-dark': 'GitHub Dark',
  'solarized-light': 'Solarized',
  'solarized-dark': 'Solar Dark',
  'one-dark': 'One Dark',
}

async function generateHtml(): Promise<string> {
  const highlighter = await createHighlighter({
    langs: ['mermaid'],
    themes: ['github-light'],
  })

  // Bundle the mermaid renderer for client-side SVG rendering
  const buildResult = await Bun.build({
    entrypoints: [new URL('./src/browser.ts', import.meta.url).pathname],
    target: 'browser',
    format: 'esm',
    minify: true,
  })
  const bundleJs = await buildResult.outputs[0].text()

  // Group samples by category for TOC
  const categories = new Map<string, number[]>()
  xychartSamples.forEach((sample, i) => {
    const cat = sample.category ?? 'Other'
    if (!categories.has(cat)) categories.set(cat, [])
    categories.get(cat)!.push(i)
  })

  const tocSections = [...categories.entries()].map(([cat, indices]) => {
    const items = indices.map(i => {
      const title = xychartSamples[i]!.title
      return `<li><a href="#sample-${i}"><span class="toc-num">${i + 1}.</span> ${escapeHtml(title)}</a></li>`
    }).join('\n            ')
    return `
        <div class="toc-category">
          <h3>${escapeHtml(cat)} (${indices.length})</h3>
          <ol start="${indices[0]! + 1}">
            ${items}
          </ol>
        </div>`
  }).join('\n')

  // Theme pills
  const VISIBLE_THEMES = new Set(['dracula', 'solarized-light'])

  function buildThemePill(key: string, colors: { bg: string; fg: string }, active = false): string {
    const isDark = parseInt(colors.bg.replace('#', '').slice(0, 2), 16) < 0x80
    const shadow = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)'
    const label = key === '' ? 'Default' : (THEME_LABELS[key] ?? key)
    const activeClass = active ? ' active' : ''
    return `<button class="theme-pill shadow-minimal${activeClass}" data-theme="${key}"><span class="theme-swatch" style="background:${colors.bg};box-shadow:inset 0 0 0 1px ${shadow}"></span>${escapeHtml(label)}</button>`
  }

  const themeEntries = Object.entries(THEMES)
  const visiblePills = [
    '<button class="theme-pill shadow-minimal active" data-theme=""><span class="theme-swatch" style="background:#FFFFFF;box-shadow:inset 0 0 0 1px rgba(0,0,0,0.1)"></span>Default</button>',
    ...themeEntries
      .filter(([key]) => VISIBLE_THEMES.has(key))
      .map(([key, colors]) => buildThemePill(key, colors)),
  ]
  const allDropdownPills = [
    buildThemePill('', { bg: '#FFFFFF', fg: '#27272A' }, true),
    ...themeEntries.map(([key, colors]) => buildThemePill(key, colors)),
  ]
  const totalThemes = allDropdownPills.length

  const themePillsHtml = `
    <div class="theme-pills-inline">
      ${visiblePills.join('\n      ')}
    </div>
    <div class="theme-more-wrapper">
      <button class="theme-pill shadow-minimal" id="theme-more-btn">${totalThemes} Themes</button>
      <div class="theme-more-dropdown shadow-modal-small" id="theme-more-dropdown">
        ${allDropdownPills.join('\n        ')}
      </div>
    </div>`

  // Pre-highlight sources with Shiki
  const highlightedSources = xychartSamples.map(sample => {
    const fenced = '```mermaid\n' + sample.source.trim() + '\n```'
    const html = highlighter.codeToHtml(fenced, {
      lang: 'mermaid',
      theme: 'github-light',
    })
    return html.replace(
      /(<code>)<span class="line">.*?<\/span>\n/,
      '$1'
    ).replace(
      /\n<span class="line">.*?<\/span>(<\/code>)/,
      '$1'
    )
  })

  // Build sample cards grouped by category
  let currentCategory = ''
  const sampleCards = xychartSamples.map((sample, i) => {
    const cat = sample.category ?? 'Other'
    let sectionHeader = ''
    if (cat !== currentCategory) {
      currentCategory = cat
      sectionHeader = `\n  <h2 class="section-title" id="cat-${cat.toLowerCase().replace(/[^a-z0-9]+/g, '-')}">${escapeHtml(cat)}</h2>\n`
    }

    return `${sectionHeader}
    <section class="sample" id="sample-${i}">
      <div class="sample-header">
        <h2>${escapeHtml(sample.title)}</h2>
        <p class="description">${formatDescription(sample.description)}</p>
      </div>
      <div class="sample-content">
        <div class="source-panel">
          ${highlightedSources[i]}
        </div>
        <div class="chart-panel" id="chart-panel-${i}">
          <canvas id="chart-${i}"></canvas>
        </div>
        <div class="svg-panel" id="svg-panel-${i}">
          <div class="svg-loading">Rendering&hellip;</div>
        </div>
      </div>
    </section>`
  }).join('\n')

  // Build THEMES JSON for client-side use
  const themesJson = JSON.stringify(THEMES)

  // Build sources JSON for the parser
  const sourcesJson = JSON.stringify(xychartSamples.map(s => s.source))

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="theme-color" id="theme-color-meta" content="#f9f9fa" />
  <title>XY Chart Test — Beautiful Mermaid</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      --t-bg: #FFFFFF;
      --t-fg: #27272A;
      --t-accent: #3b82f6;
      --foreground-rgb: 39, 39, 42;
      --accent-rgb: 59, 130, 246;
      --shadow-border-opacity: 0.08;
      --shadow-blur-opacity: 0.06;
      --theme-bar-bg: #f9f9fa;

      font-family: 'Geist', system-ui, -apple-system, sans-serif;
      background: color-mix(in srgb, var(--t-fg) 4%, var(--t-bg));
      color: var(--t-fg);
      line-height: 1.6;
      margin: 0;
      transition: background 0.2s, color 0.2s;
    }
    .content-wrapper {
      max-width: 1440px;
      margin: 0 auto;
      padding: 2rem;
      padding-top: 0;
    }
    @media (min-width: 1000px) {
      .content-wrapper { padding: 3rem; padding-top: 0; }
    }

    body::before, body::after {
      content: '';
      position: fixed;
      left: 0; right: 0;
      height: 64px;
      pointer-events: none;
      z-index: 1000;
      will-change: transform;
    }
    body::before {
      top: 0;
      background: linear-gradient(to bottom, var(--theme-bar-bg) 0%, transparent 100%);
    }
    body::after {
      bottom: 0;
      background: linear-gradient(to top, var(--theme-bar-bg) 0%, transparent 100%);
    }

    /* Theme bar */
    .theme-bar {
      position: sticky; top: 0; z-index: 1001;
      background: transparent;
      padding: 0.5rem 2rem;
      display: flex; align-items: center; gap: 0.75rem;
      overflow: visible;
    }
    .theme-label {
      font-size: 0.7rem; font-weight: 600;
      text-transform: uppercase; letter-spacing: 0.06em;
      color: color-mix(in srgb, var(--t-fg) 35%, var(--t-bg));
      white-space: nowrap;
    }
    .theme-pills {
      display: flex; gap: 0.3rem; overflow: visible;
      padding: 4px; margin: -4px; margin-left: auto;
      position: relative; z-index: 2;
    }
    .theme-pills-inline { display: flex; gap: 0.3rem; }
    @media (max-width: 1024px) {
      .theme-pills-inline { display: none; }
    }
    .theme-pill {
      display: flex; align-items: center; height: 30px;
      gap: 8px; padding: 0 14px 0 12px; border: none; border-radius: 8px;
      background: color-mix(in srgb, var(--t-bg) 97%, var(--t-fg));
      color: color-mix(in srgb, var(--t-fg) 80%, var(--t-bg));
      font-size: 12px; font-weight: 500; font-family: inherit;
      cursor: pointer; white-space: nowrap;
      transition: color 0.15s, background 0.15s, box-shadow 0.2s, transform 0.1s;
    }
    .theme-pill:hover {
      color: var(--t-fg);
      background: color-mix(in srgb, var(--t-bg) 92%, var(--t-fg));
    }
    .theme-pill.active {
      color: var(--t-fg); background: var(--t-bg); font-weight: 600;
    }
    .theme-pill:active { transform: translateY(0.5px); }
    .theme-swatch {
      display: inline-block; width: 14px; height: 14px;
      border-radius: 50%; flex-shrink: 0;
    }

    .theme-more-wrapper { position: relative; }
    .theme-more-dropdown {
      display: none; position: absolute; top: calc(100% + 6px); right: 0;
      background: var(--t-bg); border-radius: 12px; padding: 6px;
      flex-direction: column; gap: 2px; min-width: 160px; z-index: 1002;
    }
    .theme-more-dropdown.open { display: flex; }
    .theme-more-dropdown .theme-pill {
      width: 100%; justify-content: flex-start;
      background: transparent; box-shadow: none;
    }
    .theme-more-dropdown .theme-pill:hover {
      background: color-mix(in srgb, var(--t-bg) 92%, var(--t-fg));
    }
    .theme-more-dropdown .theme-pill.active,
    .theme-more-dropdown .theme-pill.shadow-tinted {
      background: var(--t-bg);
      box-shadow:
        rgba(0,0,0,0) 0px 0px 0px 0px, rgba(0,0,0,0) 0px 0px 0px 0px,
        rgba(var(--foreground-rgb), 0.06) 0px 0px 0px 1px,
        rgba(0,0,0,var(--shadow-blur-opacity)) 0px 1px 1px -0.5px,
        rgba(0,0,0,var(--shadow-blur-opacity)) 0px 3px 3px -1.5px;
    }

    /* Contents button */
    .contents-btn {
      position: absolute; left: 50%; transform: translateX(-50%);
      display: flex; align-items: center; height: 30px; gap: 6px;
      padding: 0 12px; border: none; border-radius: 8px;
      background: color-mix(in srgb, var(--t-bg) 97%, var(--t-fg));
      color: color-mix(in srgb, var(--t-fg) 80%, var(--t-bg));
      font-size: 12px; font-weight: 500; font-family: inherit;
      cursor: pointer; white-space: nowrap;
      transition: color 0.15s, background 0.15s, box-shadow 0.2s, transform 0.1s;
    }
    .contents-btn:hover {
      color: var(--t-fg);
      background: color-mix(in srgb, var(--t-bg) 92%, var(--t-fg));
    }
    .contents-btn.active { color: var(--t-fg); background: var(--t-bg); }
    .contents-btn:active { transform: translateX(-50%) translateY(0.5px); }
    .contents-btn svg { width: 14px; height: 14px; flex-shrink: 0; }

    /* Shadow utilities */
    .shadow-minimal {
      box-shadow:
        rgba(0,0,0,0) 0px 0px 0px 0px, rgba(0,0,0,0) 0px 0px 0px 0px,
        rgba(var(--foreground-rgb), 0.06) 0px 0px 0px 1px,
        rgba(0,0,0,var(--shadow-blur-opacity)) 0px 1px 1px -0.5px,
        rgba(0,0,0,var(--shadow-blur-opacity)) 0px 3px 3px -1.5px;
    }
    .shadow-modal-small {
      box-shadow:
        rgba(0,0,0,0) 0px 0px 0px 0px, rgba(0,0,0,0) 0px 0px 0px 0px,
        rgba(var(--foreground-rgb), 0.06) 0px 0px 0px 1px,
        rgba(0,0,0,calc(var(--shadow-blur-opacity)*0.67)) 0px 1px 1px -0.5px,
        rgba(0,0,0,calc(var(--shadow-blur-opacity)*0.67)) 0px 3px 3px 0px,
        rgba(0,0,0,calc(var(--shadow-blur-opacity)*0.33)) 0px 6px 6px 0px,
        rgba(0,0,0,calc(var(--shadow-blur-opacity)*0.33)) 0px 12px 12px 0px,
        rgba(0,0,0,calc(var(--shadow-blur-opacity)*0.33)) 0px 24px 24px 0px;
    }
    .shadow-tinted {
      --shadow-color: 0, 0, 0;
      box-shadow:
        rgba(var(--shadow-color),0) 0px 0px 0px 0px, rgba(var(--shadow-color),0) 0px 0px 0px 0px,
        rgba(var(--shadow-color),calc(var(--shadow-border-opacity)*1.5)) 0px 0px 0px 1px,
        rgba(var(--shadow-color),var(--shadow-border-opacity)) 0px 1px 1px -0.5px,
        rgba(var(--shadow-color),var(--shadow-blur-opacity)) 0px 3px 3px -1.5px,
        rgba(var(--shadow-color),calc(var(--shadow-blur-opacity)*0.67)) 0px 6px 6px -3px;
    }

    /* Mega menu */
    .mega-menu {
      display: none; position: absolute; top: calc(100% + 6px);
      left: 50%; transform: translateX(-50%);
      max-width: 1180px; width: max-content;
      background: var(--t-bg); border-radius: 12px;
      padding: 1.5rem 2rem; max-height: 70vh;
      overflow-y: auto; z-index: 998;
    }
    .mega-menu.open { display: block; }
    .toc-grid { columns: 3; column-gap: 2rem; }
    .toc-category {
      display: inline-block; width: 100%;
      margin: 0; padding-bottom: 1rem;
    }
    .toc-category h3 {
      font-size: 0.85rem; font-weight: 600;
      margin: 0 0 0.5rem 0; color: var(--t-fg);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .toc-category ol {
      padding: 0; margin: 0; list-style: none; font-size: 0.8rem;
    }
    .toc-category li {
      margin-bottom: 0.15rem;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .toc-category a { color: var(--t-fg); text-decoration: none; }
    .toc-category a:hover { text-decoration: underline; }
    .toc-num { color: color-mix(in srgb, var(--t-fg) 30%, var(--t-bg)); }

    /* Sample card */
    .sample {
      background: var(--t-bg);
      margin-bottom: 2rem;
      overflow: hidden;
    }
    .sample-header {
      padding: 1.25rem 1.5rem;
      max-width: 48rem;
      border-bottom: 1px solid color-mix(in srgb, var(--t-fg) 5%, var(--t-bg));
    }
    .sample-header h2 {
      font-size: 1.5rem; font-weight: 500; color: var(--t-fg);
    }
    .description {
      color: color-mix(in srgb, var(--t-fg) 50%, var(--t-bg));
      font-size: 1rem; font-weight: 400; margin-top: 0.1rem;
    }
    .description code {
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
      font-size: 0.875em;
      color: color-mix(in srgb, var(--t-fg) 85%, var(--t-bg));
      background: color-mix(in srgb, var(--t-fg) 6%, var(--t-bg));
      padding: 0.15rem 0.4rem; border-radius: 3px;
    }

    .sample-content {
      display: grid;
      grid-template-columns: minmax(180px, 0.8fr) minmax(280px, 1fr) minmax(280px, 1fr);
      min-height: 350px;
    }
    @media (max-width: 900px) {
      .sample-content { grid-template-columns: 1fr; }
      .chart-panel { border-left: none !important; border-top: 1px solid color-mix(in srgb, var(--t-fg) 5%, var(--t-bg)) !important; }
      .svg-panel { border-left: none !important; border-top: 1px solid color-mix(in srgb, var(--t-fg) 5%, var(--t-bg)) !important; }
    }

    /* Source panel */
    .source-panel {
      padding: 0.75rem 1.5rem;
      border-right: 1px solid color-mix(in srgb, var(--t-fg) 5%, var(--t-bg));
      min-width: 0; overflow-y: auto;
      background: color-mix(in srgb, var(--t-fg) 1.5%, var(--t-bg));
    }
    .source-panel .shiki {
      background: transparent !important;
      padding: 0.5rem 0; font-size: 0.8rem; line-height: 1.5;
      overflow-x: auto; white-space: pre-wrap; word-break: break-word; margin: 0;
    }
    .source-panel .shiki code {
      background: transparent;
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
    }
    .source-panel .shiki,
    .source-panel .shiki span[style*="#24292e"],
    .source-panel .shiki span[style*="#24292E"] {
      color: color-mix(in srgb, var(--t-fg) 70%, var(--t-bg)) !important;
    }
    .source-panel .shiki span[style*="#D73A49"],
    .source-panel .shiki span[style*="#d73a49"] {
      color: color-mix(in srgb, var(--t-fg) 90%, var(--t-bg)) !important;
      font-weight: 500;
    }
    .source-panel .shiki span[style*="#6F42C1"],
    .source-panel .shiki span[style*="#6f42c1"] {
      color: color-mix(in srgb, var(--t-fg) 65%, var(--t-bg)) !important;
    }
    .source-panel .shiki span[style*="#E36209"],
    .source-panel .shiki span[style*="#e36209"] {
      color: color-mix(in srgb, var(--t-fg) 75%, var(--t-bg)) !important;
    }
    .source-panel .shiki span[style*="#032F62"],
    .source-panel .shiki span[style*="#032f62"] {
      color: color-mix(in srgb, var(--t-fg) 50%, var(--t-bg)) !important;
    }

    /* Chart panel */
    .chart-panel {
      padding: 1.25rem 1.5rem;
      display: flex; align-items: center; justify-content: center;
      min-width: 0;
      border-right: 1px solid color-mix(in srgb, var(--t-fg) 5%, var(--t-bg));
    }
    .chart-panel canvas {
      max-width: 100%;
      max-height: 320px;
    }

    /* SVG panel */
    .svg-panel {
      padding: 1.25rem 1.5rem;
      display: flex; align-items: center; justify-content: center;
      min-width: 0;
      background: color-mix(in srgb, var(--t-fg) 1.5%, var(--t-bg));
    }
    .svg-panel svg {
      max-width: 100%;
      max-height: 420px;
      height: auto;
    }
    .svg-loading {
      font-size: 0.85rem; font-weight: 400;
      color: color-mix(in srgb, var(--t-fg) 25%, var(--t-bg));
    }

    /* Section title */
    .section-title {
      font-size: 1.875rem; font-weight: 800; line-height: 1.2;
      margin: 0; padding: 2.5rem 0 1.5rem; color: var(--t-fg);
    }

    /* Hero header */
    .hero-header {
      max-width: 1440px; margin: 0 auto;
      padding: 6rem 2rem 2rem; text-align: left;
    }
    @media (min-width: 1000px) {
      .hero-header { padding: 6rem 3rem 2rem; }
    }
    .hero-title {
      font-size: 2.25rem; font-weight: 800; line-height: 1.2;
      margin: 0 0 0.25rem; color: var(--t-fg);
    }
    .hero-tagline {
      font-size: 1rem; font-weight: 500;
      color: color-mix(in srgb, var(--t-fg) 50%, var(--t-bg));
      margin: 0 0 1rem;
    }
    .hero-description {
      font-size: 0.95rem; line-height: 1.6;
      color: color-mix(in srgb, var(--t-fg) 70%, var(--t-bg));
      margin: 0 0 1.5rem; max-width: 680px;
    }
    .hero-meta { margin-top: 1.25rem; }
    .hero-meta .meta {
      font-size: 0.85rem;
      color: color-mix(in srgb, var(--t-fg) 40%, var(--t-bg));
      margin: 0.15rem 0;
    }

    /* Footer */
    .site-footer {
      position: relative; z-index: 10;
      padding: 1.5rem 2rem 2rem;
      display: flex; align-items: center; justify-content: space-between;
      max-width: 1440px; width: 100%; margin: 0 auto;
      font-size: 12px;
      color: color-mix(in srgb, var(--t-fg) 50%, var(--t-bg));
    }
    @media (min-width: 1000px) {
      .site-footer { padding: 1.5rem 3rem 2rem; }
    }
  </style>
</head>
<body>
  <div id="safari-theme-color" style="position:fixed;top:0;left:0;right:0;height:1px;background:var(--theme-bar-bg);z-index:9999;pointer-events:none;"></div>

  <div class="theme-bar" id="theme-bar">
    <div style="font-size:12px;font-weight:600;color:color-mix(in srgb, var(--t-fg) 80%, var(--t-bg));white-space:nowrap;">XY Chart Test</div>
    <button class="contents-btn shadow-minimal" id="contents-btn"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><line x1="3" y1="4" x2="13" y2="4"/><line x1="3" y1="8" x2="13" y2="8"/><line x1="3" y1="12" x2="10" y2="12"/></svg>Contents</button>
    <div class="theme-pills" id="theme-pills">
      ${themePillsHtml}
    </div>
    <div class="mega-menu shadow-modal-small" id="mega-menu">
      <div class="toc-grid">
        ${tocSections}
      </div>
    </div>
  </div>

  <header class="hero-header">
    <h1 class="hero-title">XY Chart Test</h1>
    <p class="hero-tagline">xychart-beta rendering comparison: Chart.js vs beautiful-mermaid</p>
    <p class="hero-description">
      Column 1 shows the Mermaid source, Column 2 renders a Chart.js reference,
      and Column 3 shows the beautiful-mermaid SVG rendering with theme support.
    </p>
    <div class="hero-meta">
      <p class="meta">${xychartSamples.length} xychart-beta examples across ${categories.size} categories</p>
      <p class="meta">Chart.js reference + beautiful-mermaid SVG comparison</p>
    </div>
  </header>

  <div class="content-wrapper">
${sampleCards}
  </div>

  <footer class="site-footer">
    <span>&copy; 2026 Luki Labs. MIT License.</span>
  </footer>

  <script>
  // ============================================================================
  // Theme system
  // ============================================================================
  var THEMES = ${themesJson};
  var chartInstances = [];

  function hexToRgb(hex) {
    if (!hex || typeof hex !== 'string') return null;
    var v = hex.trim();
    if (v[0] === '#') v = v.slice(1);
    if (v.length === 3) v = v[0]+v[0]+v[1]+v[1]+v[2]+v[2];
    if (v.length !== 6) return null;
    var n = parseInt(v, 16);
    if (Number.isNaN(n)) return null;
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function setShadowVars(theme) {
    var body = document.body;
    var fg = theme ? theme.fg : '#27272A';
    var bg = theme ? theme.bg : '#FFFFFF';
    var fgRgb = hexToRgb(fg) || { r: 39, g: 39, b: 42 };
    var bgRgb = hexToRgb(bg) || { r: 255, g: 255, b: 255 };
    var brightness = (bgRgb.r * 299 + bgRgb.g * 587 + bgRgb.b * 114) / 1000;
    var darkMode = brightness < 140;
    body.style.setProperty('--foreground-rgb', fgRgb.r + ', ' + fgRgb.g + ', ' + fgRgb.b);
    body.style.setProperty('--shadow-border-opacity', darkMode ? '0.15' : '0.08');
    body.style.setProperty('--shadow-blur-opacity', darkMode ? '0.12' : '0.06');
  }

  function updateThemeColor(fg, bg) {
    var fgRgb = hexToRgb(fg) || { r: 39, g: 39, b: 42 };
    var bgRgb = hexToRgb(bg) || { r: 255, g: 255, b: 255 };
    var r = Math.round(bgRgb.r * 0.96 + fgRgb.r * 0.04);
    var g = Math.round(bgRgb.g * 0.96 + fgRgb.g * 0.04);
    var b = Math.round(bgRgb.b * 0.96 + fgRgb.b * 0.04);
    var hex = '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    document.getElementById('theme-color-meta').setAttribute('content', hex);
    document.body.style.setProperty('--theme-bar-bg', hex);
    var safariDiv = document.getElementById('safari-theme-color');
    safariDiv.style.background = hex;
    safariDiv.style.display = 'none';
    void safariDiv.offsetHeight;
    safariDiv.style.display = '';
  }

  function getChartColors(theme) {
    var fg = theme ? theme.fg : '#27272A';
    var bg = theme ? theme.bg : '#FFFFFF';
    var fgRgb = hexToRgb(fg) || { r: 39, g: 39, b: 42 };
    var bgRgb = hexToRgb(bg) || { r: 255, g: 255, b: 255 };
    // Grid lines: 12% fg mixed into bg
    var gridR = Math.round(bgRgb.r * 0.88 + fgRgb.r * 0.12);
    var gridG = Math.round(bgRgb.g * 0.88 + fgRgb.g * 0.12);
    var gridB = Math.round(bgRgb.b * 0.88 + fgRgb.b * 0.12);
    // Tick text: 60% fg mixed into bg
    var tickR = Math.round(bgRgb.r * 0.4 + fgRgb.r * 0.6);
    var tickG = Math.round(bgRgb.g * 0.4 + fgRgb.g * 0.6);
    var tickB = Math.round(bgRgb.b * 0.4 + fgRgb.b * 0.6);
    return {
      fg: fg,
      bg: bg,
      grid: 'rgb(' + gridR + ',' + gridG + ',' + gridB + ')',
      tick: 'rgb(' + tickR + ',' + tickG + ',' + tickB + ')',
      accent: theme && theme.accent ? theme.accent : '#3b82f6',
    };
  }

  var BAR_PALETTE = [
    'rgba(59,130,246,0.7)',   // blue
    'rgba(16,185,129,0.7)',   // emerald
    'rgba(245,158,11,0.7)',   // amber
    'rgba(239,68,68,0.7)',    // red
    'rgba(139,92,246,0.7)',   // violet
    'rgba(236,72,153,0.7)',   // pink
    'rgba(6,182,212,0.7)',    // cyan
    'rgba(132,204,22,0.7)',   // lime
  ];

  var LINE_PALETTE = [
    'rgba(239,68,68,0.9)',    // red
    'rgba(16,185,129,0.9)',   // emerald
    'rgba(245,158,11,0.9)',   // amber
    'rgba(139,92,246,0.9)',   // violet
    'rgba(6,182,212,0.9)',    // cyan
    'rgba(236,72,153,0.9)',   // pink
    'rgba(59,130,246,0.9)',   // blue
    'rgba(132,204,22,0.9)',   // lime
  ];

  // ============================================================================
  // XYChart parser
  // ============================================================================
  function parseXYChart(source) {
    var lines = source.split('\\n').map(function(l) { return l.trim(); }).filter(Boolean);
    var result = {
      title: '',
      horizontal: false,
      xLabels: null,
      xRange: null,
      xTitle: '',
      yRange: null,
      yTitle: '',
      bars: [],
      lines: [],
    };

    // Check for horizontal
    if (lines.length > 0 && lines[0].indexOf('horizontal') !== -1) {
      result.horizontal = true;
    }

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];

      // Title
      var titleMatch = line.match(/^title\\s+"([^"]+)"/);
      if (titleMatch) {
        result.title = titleMatch[1];
        continue;
      }

      // x-axis with labels: x-axis "Title" [a, b, c] or x-axis [a, b, c]
      var xLabelMatch = line.match(/^x-axis\\s+(?:"([^"]*)"\\s*)?\\[([^\\]]+)\\]/);
      if (xLabelMatch) {
        if (xLabelMatch[1]) result.xTitle = xLabelMatch[1];
        result.xLabels = xLabelMatch[2].split(',').map(function(s) { return s.trim(); });
        continue;
      }

      // x-axis with range: x-axis "Title" min --> max or x-axis min --> max
      var xRangeMatch = line.match(/^x-axis\\s+(?:"([^"]*)"\\s+)?(\\d+(?:\\.\\d+)?)\\s*-->\\s*(\\d+(?:\\.\\d+)?)/);
      if (xRangeMatch) {
        if (xRangeMatch[1]) result.xTitle = xRangeMatch[1];
        result.xRange = [parseFloat(xRangeMatch[2]), parseFloat(xRangeMatch[3])];
        continue;
      }

      // y-axis: y-axis "Title" min --> max or y-axis min --> max
      var yRangeMatch = line.match(/^y-axis\\s+(?:"([^"]*)"\\s+)?(\\d+(?:\\.\\d+)?)\\s*-->\\s*(\\d+(?:\\.\\d+)?)/);
      if (yRangeMatch) {
        if (yRangeMatch[1]) result.yTitle = yRangeMatch[1];
        result.yRange = [parseFloat(yRangeMatch[2]), parseFloat(yRangeMatch[3])];
        continue;
      }

      // y-axis with just title (no range)
      var yTitleOnly = line.match(/^y-axis\\s+"([^"]+)"$/);
      if (yTitleOnly) {
        result.yTitle = yTitleOnly[1];
        continue;
      }

      // bar [...]
      var barMatch = line.match(/^bar\\s+\\[([^\\]]+)\\]/);
      if (barMatch) {
        result.bars.push(barMatch[1].split(',').map(function(s) { return parseFloat(s.trim()); }));
        continue;
      }

      // line [...]
      var lineMatch = line.match(/^line\\s+\\[([^\\]]+)\\]/);
      if (lineMatch) {
        result.lines.push(lineMatch[1].split(',').map(function(s) { return parseFloat(s.trim()); }));
        continue;
      }
    }

    return result;
  }

  function buildChartConfig(parsed, colors) {
    var datasets = [];
    var labels = parsed.xLabels;

    // If numeric range and no labels, generate labels from range
    if (!labels && parsed.xRange) {
      var dataLen = 0;
      if (parsed.bars.length > 0) dataLen = parsed.bars[0].length;
      else if (parsed.lines.length > 0) dataLen = parsed.lines[0].length;
      if (dataLen > 0) {
        labels = [];
        var step = (parsed.xRange[1] - parsed.xRange[0]) / (dataLen - 1 || 1);
        for (var k = 0; k < dataLen; k++) {
          labels.push(String(Math.round((parsed.xRange[0] + step * k) * 100) / 100));
        }
      }
    }

    // If still no labels, generate numbered labels
    if (!labels) {
      var maxLen = 0;
      parsed.bars.forEach(function(b) { if (b.length > maxLen) maxLen = b.length; });
      parsed.lines.forEach(function(l) { if (l.length > maxLen) maxLen = l.length; });
      labels = [];
      for (var k = 0; k < maxLen; k++) labels.push(String(k + 1));
    }

    // Add bar datasets
    for (var b = 0; b < parsed.bars.length; b++) {
      datasets.push({
        type: 'bar',
        label: 'Bar ' + (b + 1),
        data: parsed.bars[b],
        backgroundColor: BAR_PALETTE[b % BAR_PALETTE.length],
        borderColor: BAR_PALETTE[b % BAR_PALETTE.length].replace('0.7', '1'),
        borderWidth: 1,
        order: 2,
      });
    }

    // Add line datasets
    for (var l = 0; l < parsed.lines.length; l++) {
      datasets.push({
        type: 'line',
        label: 'Line ' + (l + 1),
        data: parsed.lines[l],
        borderColor: LINE_PALETTE[l % LINE_PALETTE.length],
        backgroundColor: LINE_PALETTE[l % LINE_PALETTE.length].replace('0.9', '0.1'),
        borderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 5,
        tension: 0.1,
        fill: false,
        order: 1,
      });
    }

    var scales = {
      x: {
        title: { display: !!parsed.xTitle, text: parsed.xTitle, color: colors.tick },
        ticks: { color: colors.tick },
        grid: { color: colors.grid },
      },
      y: {
        title: { display: !!parsed.yTitle, text: parsed.yTitle, color: colors.tick },
        ticks: { color: colors.tick },
        grid: { color: colors.grid },
      },
    };

    if (parsed.yRange) {
      scales.y.min = parsed.yRange[0];
      scales.y.max = parsed.yRange[1];
    }

    var config = {
      type: datasets.length === 1 ? datasets[0].type : 'bar',
      data: { labels: labels, datasets: datasets },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        indexAxis: parsed.horizontal ? 'y' : 'x',
        plugins: {
          title: {
            display: !!parsed.title,
            text: parsed.title,
            color: colors.fg,
            font: { size: 14, weight: '600', family: "'Geist', system-ui, sans-serif" },
          },
          legend: { display: datasets.length > 1, labels: { color: colors.tick } },
        },
        scales: scales,
      },
    };

    return config;
  }

  function updateChartColors(chart, colors) {
    var opts = chart.options;
    if (opts.plugins.title) opts.plugins.title.color = colors.fg;
    if (opts.plugins.legend && opts.plugins.legend.labels) opts.plugins.legend.labels.color = colors.tick;
    if (opts.scales.x) {
      if (opts.scales.x.title) opts.scales.x.title.color = colors.tick;
      opts.scales.x.ticks.color = colors.tick;
      opts.scales.x.grid.color = colors.grid;
    }
    if (opts.scales.y) {
      if (opts.scales.y.title) opts.scales.y.title.color = colors.tick;
      opts.scales.y.ticks.color = colors.tick;
      opts.scales.y.grid.color = colors.grid;
    }
    chart.update('none');
  }

  // ============================================================================
  // Theme application
  // ============================================================================
  function applyTheme(themeKey) {
    var theme = themeKey ? THEMES[themeKey] : null;
    var body = document.body;

    if (theme) {
      body.style.setProperty('--t-bg', theme.bg);
      body.style.setProperty('--t-fg', theme.fg);
      body.style.setProperty('--t-accent', theme.accent || '#3b82f6');
    } else {
      body.style.setProperty('--t-bg', '#FFFFFF');
      body.style.setProperty('--t-fg', '#27272A');
      body.style.setProperty('--t-accent', '#3b82f6');
    }
    setShadowVars(theme);
    updateThemeColor(theme ? theme.fg : '#27272A', theme ? theme.bg : '#FFFFFF');

    // Update chart panel backgrounds
    for (var j = 0; j < ${xychartSamples.length}; j++) {
      var panel = document.getElementById('chart-panel-' + j);
      if (panel) panel.style.background = theme ? theme.bg : '';
    }

    // Update all Chart.js instances
    var colors = getChartColors(theme);
    for (var j = 0; j < chartInstances.length; j++) {
      updateChartColors(chartInstances[j], colors);
    }

    // Re-render all SVGs with new theme
    renderAllSvgs(themeKey);

    // Update active pill
    var pills = document.querySelectorAll('.theme-pill');
    for (var j = 0; j < pills.length; j++) {
      var isActive = pills[j].getAttribute('data-theme') === themeKey;
      pills[j].classList.toggle('active', isActive);
      pills[j].classList.toggle('shadow-tinted', isActive);
    }

    if (themeKey) localStorage.setItem('xychart-theme', themeKey);
    else localStorage.removeItem('xychart-theme');
  }

  // ============================================================================
  // Event handlers
  // ============================================================================

  // Theme pills
  document.getElementById('theme-pills').addEventListener('click', function(e) {
    var pill = e.target.closest('.theme-pill');
    if (!pill || pill.id === 'theme-more-btn') return;
    applyTheme(pill.getAttribute('data-theme') || '');
    var dd = document.getElementById('theme-more-dropdown');
    if (dd && dd.classList.contains('open')) dd.classList.remove('open');
  });

  // More themes dropdown
  var moreBtn = document.getElementById('theme-more-btn');
  var moreDropdown = document.getElementById('theme-more-dropdown');
  if (moreBtn && moreDropdown) {
    moreBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      moreDropdown.classList.toggle('open');
    });
    document.addEventListener('click', function(e) {
      if (!moreDropdown.classList.contains('open')) return;
      if (!e.target.closest('.theme-more-wrapper')) moreDropdown.classList.remove('open');
    });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && moreDropdown.classList.contains('open')) moreDropdown.classList.remove('open');
    });
  }

  // Contents mega-menu
  var contentsBtn = document.getElementById('contents-btn');
  var megaMenu = document.getElementById('mega-menu');
  contentsBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    var isOpen = megaMenu.classList.toggle('open');
    contentsBtn.classList.toggle('active', isOpen);
    contentsBtn.classList.toggle('shadow-tinted', isOpen);
  });
  megaMenu.addEventListener('click', function(e) {
    var link = e.target.closest('a');
    if (!link) return;
    e.preventDefault();
    megaMenu.classList.remove('open');
    contentsBtn.classList.remove('active');
    contentsBtn.classList.remove('shadow-tinted');
    var target = document.querySelector(link.getAttribute('href'));
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  document.addEventListener('click', function(e) {
    if (!megaMenu.classList.contains('open')) return;
    if (!e.target.closest('.mega-menu') && !e.target.closest('.contents-btn')) {
      megaMenu.classList.remove('open');
      contentsBtn.classList.remove('active');
      contentsBtn.classList.remove('shadow-tinted');
    }
  });
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && megaMenu.classList.contains('open')) {
      megaMenu.classList.remove('open');
      contentsBtn.classList.remove('active');
      contentsBtn.classList.remove('shadow-tinted');
    }
  });

  // ============================================================================
  // Restore saved theme
  // ============================================================================
  var savedTheme = localStorage.getItem('xychart-theme');
  if (savedTheme && THEMES[savedTheme]) {
    document.body.style.setProperty('--t-bg', THEMES[savedTheme].bg);
    document.body.style.setProperty('--t-fg', THEMES[savedTheme].fg);
    document.body.style.setProperty('--t-accent', THEMES[savedTheme].accent || '#3b82f6');
    setShadowVars(THEMES[savedTheme]);
    updateThemeColor(THEMES[savedTheme].fg, THEMES[savedTheme].bg);
    var pills = document.querySelectorAll('.theme-pill');
    for (var j = 0; j < pills.length; j++) {
      var isActive = pills[j].getAttribute('data-theme') === savedTheme;
      pills[j].classList.toggle('active', isActive);
      pills[j].classList.toggle('shadow-tinted', isActive);
    }
  } else {
    setShadowVars(null);
  }

  // ============================================================================
  // Render all charts
  // ============================================================================
  var sources = ${sourcesJson};
  var activeTheme = savedTheme && THEMES[savedTheme] ? THEMES[savedTheme] : null;
  var colors = getChartColors(activeTheme);

  Chart.defaults.font.family = "'Geist', system-ui, sans-serif";

  for (var i = 0; i < sources.length; i++) {
    var canvas = document.getElementById('chart-' + i);
    if (!canvas) continue;
    var parsed = parseXYChart(sources[i]);
    var config = buildChartConfig(parsed, colors);
    try {
      var chart = new Chart(canvas, config);
      chartInstances.push(chart);
    } catch (err) {
      console.error('Chart ' + i + ' failed:', err);
    }

    // Set panel bg if theme is active
    if (activeTheme) {
      var panel = document.getElementById('chart-panel-' + i);
      if (panel) panel.style.background = activeTheme.bg;
    }
  }

  // ============================================================================
  // Render beautiful-mermaid SVGs
  // ============================================================================
  function renderAllSvgs(themeKey) {
    var theme = themeKey ? THEMES[themeKey] : null;
    var opts = theme ? { bg: theme.bg, fg: theme.fg, interactive: true } : { interactive: true };
    if (theme) {
      if (theme.line) opts.line = theme.line;
      if (theme.accent) opts.accent = theme.accent;
      if (theme.muted) opts.muted = theme.muted;
      if (theme.surface) opts.surface = theme.surface;
      if (theme.border) opts.border = theme.border;
    }
    for (var i = 0; i < sources.length; i++) {
      (function(idx) {
        window.__mermaid.renderMermaid(sources[idx], opts).then(function(svg) {
          var panel = document.getElementById('svg-panel-' + idx);
          if (panel) panel.innerHTML = svg;
        }).catch(function(err) {
          console.error('SVG ' + idx + ' failed:', err);
          var panel = document.getElementById('svg-panel-' + idx);
          if (panel) panel.innerHTML = '<div class="svg-loading">Error: ' + err.message + '</div>';
        });
      })(i);
    }
  }

  // Initial SVG render — wait for the module bundle to set window.__mermaid
  window.__renderAllSvgs = renderAllSvgs;
  window.__initThemeKey = savedTheme || '';
  </script>
  <script type="module">
${bundleJs}
// Module has loaded — window.__mermaid is now set. Trigger initial render.
if (window.__renderAllSvgs) window.__renderAllSvgs(window.__initThemeKey);
  </script>
</body>
</html>`
}

const html = await generateHtml()
const outPath = new URL('./xychart-test.html', import.meta.url).pathname
await Bun.write(outPath, html)
console.log(`Written to ${outPath} (${(html.length / 1024).toFixed(1)} KB)`)
