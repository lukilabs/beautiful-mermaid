/**
 * Beautiful Mermaid Style Presets
 *
 * Style presets and CSS generation for beautiful-mermaid.
 * Single source of truth for style presets — imported by both render.js and preview.html.
 *
 * ─────────────────────────────────────────────
 * Constants synced from upstream src/styles.ts (lukilabs/beautiful-mermaid)
 *   - MONO_FONT / MONO_FONT_STACK        monospace font stack
 *   - FONT_SIZES / FONT_WEIGHTS          font sizes and weights
 *   - NODE_PADDING                       node padding
 *   - STROKE_WIDTHS                      stroke widths
 *   - TEXT_BASELINE_SHIFT                text baseline shift
 *   - ARROW_HEAD                         arrowhead size
 *   - GROUP_HEADER_CONTENT_PAD           subgraph header padding
 * ─────────────────────────────────────────────
 */

// ─────────────────────────────────────────────────────────────────────────────
// §1  Font metrics (from src/styles.ts)
// ─────────────────────────────────────────────────────────────────────────────

/** Primary monospace font (JetBrains Mono) */
const MONO_FONT = "'JetBrains Mono'";

/** Full CSS fallback chain for monospace text */
const MONO_FONT_STACK = `${MONO_FONT}, 'SF Mono', 'Fira Code', ui-monospace, monospace`;

/** Estimated monospace text width (chars × fontSize × 0.6) */
function estimateMonoTextWidth(text, fontSize) {
  return text.length * fontSize * 0.6;
}

// ─────────────────────────────────────────────────────────────────────────────
// §2  Font sizes and weights (from src/styles.ts)
// ─────────────────────────────────────────────────────────────────────────────

const FONT_SIZES = {
  nodeLabel:   13,   // node label
  edgeLabel:   11,   // edge label
  groupHeader: 12,   // subgraph header
};

const FONT_WEIGHTS = {
  nodeLabel:   500,  // node label weight
  edgeLabel:   400,  // edge label weight
  groupHeader: 600,  // subgraph header weight
};

// ─────────────────────────────────────────────────────────────────────────────
// §3  Geometry constants (from src/styles.ts)
// ─────────────────────────────────────────────────────────────────────────────

/** Gap between subgraph header band and content area */
const GROUP_HEADER_CONTENT_PAD = 12;

/** Node shape inner padding */
const NODE_PADDING = {
  horizontal:   20,  // horizontal
  vertical:     10,  // vertical
  diamondExtra: 24,  // diamond extra
};

/** stroke widths */
const STROKE_WIDTHS = {
  outerBox:  1,      // outer box
  innerBox:  0.75,   // inner box
  connector: 1,      // connector
};

/** Text baseline shift for font-agnostic vertical centering */
const TEXT_BASELINE_SHIFT = '0.35em';

/** arrowhead size */
const ARROW_HEAD = {
  width:  8,   // width
  height: 5,   // height
};

// ─────────────────────────────────────────────────────────────────────────────
// §4  Theme definitions (15 built-in themes, from src/theme.ts)
// ─────────────────────────────────────────────────────────────────────────────
// Each theme has 7 fields:
//   bg       background
//   fg       foreground / primary text
//   line     edge / connector color
//   accent   accent (arrows, highlights, subgraph headers)
//   muted    secondary text (edge labels, notes)
//   surface  node fill (one level lighter/darker than bg)
//   border   node stroke color
//
// Usage: THEMES['tokyo-night'] → { bg, fg, line, accent, muted, surface, border }

const THEMES = {
  // ── Zinc (minimal monochrome) ────────────────────────────────────────────────
  'zinc-light': {
    bg:      '#FFFFFF',
    fg:      '#27272A',
    line:    '#A1A1AA',   // zinc-400
    accent:  '#3F3F46',   // zinc-700
    muted:   '#71717A',   // zinc-500
    surface: '#F4F4F5',   // zinc-100
    border:  '#D4D4D8',   // zinc-300
  },
  'zinc-dark': {
    bg:      '#18181B',
    fg:      '#FAFAFA',
    line:    '#52525B',   // zinc-600
    accent:  '#A1A1AA',   // zinc-400
    muted:   '#71717A',   // zinc-500
    surface: '#27272A',   // zinc-800
    border:  '#3F3F46',   // zinc-700
  },

  // ── Tokyo Night (dark code theme) ───────────────────────────────────────────
  'tokyo-night': {
    bg:      '#1a1b26',
    fg:      '#a9b1d6',
    line:    '#3d59a1',
    accent:  '#7aa2f7',
    muted:   '#565f89',
    surface: '#24283b',   // storm bg as node surface
    border:  '#414868',   // muted purple-grey
  },
  'tokyo-night-storm': {
    bg:      '#24283b',
    fg:      '#a9b1d6',
    line:    '#3d59a1',
    accent:  '#7aa2f7',
    muted:   '#565f89',
    surface: '#2f3549',   // slightly lighter than bg
    border:  '#414868',
  },
  'tokyo-night-light': {
    bg:      '#d5d6db',
    fg:      '#343b58',
    line:    '#34548a',
    accent:  '#34548a',
    muted:   '#9699a3',
    surface: '#e9e9ec',   // slightly lighter than bg
    border:  '#b9bac4',
  },

  // ── Catppuccin (soft pastel) ─────────────────────────────────────────────────
  'catppuccin-mocha': {
    bg:      '#1e1e2e',
    fg:      '#cdd6f4',
    line:    '#585b70',
    accent:  '#cba6f7',   // mauve
    muted:   '#6c7086',
    surface: '#313244',   // surface0
    border:  '#45475a',   // surface1
  },
  'catppuccin-latte': {
    bg:      '#eff1f5',
    fg:      '#4c4f69',
    line:    '#9ca0b0',
    accent:  '#8839ef',   // mauve
    muted:   '#9ca0b0',
    surface: '#e6e9ef',   // mantle
    border:  '#ccd0da',   // surface0
  },

  // ── Nord (arctic aurora) ─────────────────────────────────────────────────────
  'nord': {
    bg:      '#2e3440',
    fg:      '#d8dee9',
    line:    '#4c566a',
    accent:  '#88c0d0',   // nord8 (arctic blue)
    muted:   '#616e88',
    surface: '#3b4252',   // nord1
    border:  '#434c5e',   // nord2
  },
  'nord-light': {
    bg:      '#eceff4',
    fg:      '#2e3440',
    line:    '#aab1c0',
    accent:  '#5e81ac',   // nord10 (deep blue)
    muted:   '#7b88a1',
    surface: '#e5e9f0',   // nord5
    border:  '#d8dee9',   // nord4
  },

  // ── Dracula (classic vampire) ────────────────────────────────────────────────
  'dracula': {
    bg:      '#282a36',
    fg:      '#f8f8f2',
    line:    '#6272a4',
    accent:  '#bd93f9',   // purple
    muted:   '#6272a4',
    surface: '#44475a',   // current line / selection
    border:  '#6272a4',   // comment color
  },

  // ── GitHub (official IDE theme) ─────────────────────────────────────────────
  'github-light': {
    bg:      '#ffffff',
    fg:      '#1f2328',
    line:    '#d1d9e0',
    accent:  '#0969da',   // blue-500
    muted:   '#59636e',
    surface: '#f6f8fa',   // neutral-1
    border:  '#d1d9e0',   // border-default
  },
  'github-dark': {
    bg:      '#0d1117',
    fg:      '#e6edf3',
    line:    '#3d444d',
    accent:  '#4493f8',   // blue-400
    muted:   '#9198a1',
    surface: '#161b22',   // canvas-subtle
    border:  '#30363d',   // border-default
  },

  // ── Solarized (precision color calibration) ─────────────────────────────────
  'solarized-light': {
    bg:      '#fdf6e3',
    fg:      '#657b83',
    line:    '#93a1a1',
    accent:  '#268bd2',   // blue
    muted:   '#93a1a1',
    surface: '#eee8d5',   // base2
    border:  '#d3ccb4',   // between base2 and base1
  },
  'solarized-dark': {
    bg:      '#002b36',
    fg:      '#839496',
    line:    '#586e75',
    accent:  '#268bd2',   // blue
    muted:   '#586e75',
    surface: '#073642',   // base02
    border:  '#0a4555',   // slightly lighter than surface
  },

  // ── One Dark (classic Atom editor) ──────────────────────────────────────────
  'one-dark': {
    bg:      '#282c34',
    fg:      '#abb2bf',
    line:    '#4b5263',
    accent:  '#c678dd',   // purple
    muted:   '#5c6370',
    surface: '#2c313a',   // slightly lighter than bg
    border:  '#3e4451',   // background highlight row
  },
  // orange variant
  'orange-dark': {
    bg:      '#1c1410',   // deep brown-black
    fg:      '#f5e6d3',   // warm white
    line:    '#6b4a2e',   // deep orange-brown
    accent:  '#f97316',   // orange-500
    muted:   '#9a6a4a',   // neutral orange-brown
    surface: '#2a1e15',   // slightly lighter than bg
    border:  '#3d2b1c',   // orange-brown border
  },
  'orange-light': {
    bg:      '#fffbf5',   // warm white background
    fg:      '#431407',   // deep orange-brown text
    line:    '#c2a070',   // light orange-brown
    accent:  '#ea580c',   // orange-600
    muted:   '#9a6a4a',   // neutral orange-brown
    surface: '#fff7ed',   // light orange panel
    border:  '#fed7aa',   // orange-200
  },
};

/** Default colors when no theme is specified */
const THEME_DEFAULTS = {
  bg:      '#FFFFFF',
  fg:      '#27272A',
  line:    '#A1A1AA',
  accent:  '#3F3F46',
  muted:   '#71717A',
  surface: '#F4F4F5',
  border:  '#D4D4D8',
};

// ─────────────────────────────────────────────────────────────────────────────
// §4a  Theme metadata (grouping, dark/light, recommended preset)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Theme metadata: dark/light classification, display name, recommended preset
 *
 * recommendedPreset: best matching style preset for this theme
 *   - dark  → glass (great with dark backgrounds) or modern
 *   - light → modern or outline
 */
const THEME_META = {
  'zinc-light':          { dark: false, label: 'Zinc Light',         family: 'zinc',        recommendedPreset: 'outline'  },
  'zinc-dark':           { dark: true,  label: 'Zinc Dark',          family: 'zinc',        recommendedPreset: 'glass'    },
  'tokyo-night':         { dark: true,  label: 'Tokyo Night',        family: 'tokyo-night', recommendedPreset: 'glass'    },
  'tokyo-night-storm':   { dark: true,  label: 'Tokyo Storm',        family: 'tokyo-night', recommendedPreset: 'modern'   },
  'tokyo-night-light':   { dark: false, label: 'Tokyo Light',        family: 'tokyo-night', recommendedPreset: 'modern'   },
  'catppuccin-mocha':    { dark: true,  label: 'Catppuccin Mocha',   family: 'catppuccin',  recommendedPreset: 'glass'    },
  'catppuccin-latte':    { dark: false, label: 'Catppuccin Latte',   family: 'catppuccin',  recommendedPreset: 'modern'   },
  'nord':                { dark: true,  label: 'Nord',               family: 'nord',        recommendedPreset: 'modern'   },
  'nord-light':          { dark: false, label: 'Nord Light',         family: 'nord',        recommendedPreset: 'outline'  },
  'dracula':             { dark: true,  label: 'Dracula',            family: 'dracula',     recommendedPreset: 'gradient' },
  'github-light':        { dark: false, label: 'GitHub Light',       family: 'github',      recommendedPreset: 'default'  },
  'github-dark':         { dark: true,  label: 'GitHub Dark',        family: 'github',      recommendedPreset: 'modern'   },
  'solarized-light':     { dark: false, label: 'Solarized Light',    family: 'solarized',   recommendedPreset: 'outline'  },
  'solarized-dark':      { dark: true,  label: 'Solarized Dark',     family: 'solarized',   recommendedPreset: 'modern'   },
  'one-dark':            { dark: true,  label: 'One Dark',           family: 'one-dark',    recommendedPreset: 'gradient' },
  'orange-dark':         { dark: true,  label: 'Orange Dark',        family: 'orange',      recommendedPreset: 'glass'    },
  'orange-light':        { dark: false, label: 'Orange Light',       family: 'orange',      recommendedPreset: 'modern'   },
};

// ─────────────────────────────────────────────────────────────────────────────
// §5  Visual style presets — 5 variants
// ─────────────────────────────────────────────────────────────────────────────
// Presets control shape geometry (radius, stroke, shadow) and font, orthogonal to theme colors.

const STYLE_PRESETS = {
  // Default
  default: {
    name: 'Default',
    node: {
      borderRadius: 8,
      borderWidth: STROKE_WIDTHS.outerBox * 2,
      shadowBlur: 4,
      shadowColor: 'rgba(0,0,0,0.3)',
    },
    line: {
      width: STROKE_WIDTHS.connector * 2,
      radius: 0,
      arrowSize: ARROW_HEAD.width + ARROW_HEAD.height,   // 13
    },
    font: {
      family: 'system-ui, -apple-system, sans-serif',
      size: FONT_SIZES.nodeLabel,
    },
  },

  // Modern
  modern: {
    name: 'Modern',
    node: {
      borderRadius: 16,
      borderWidth: STROKE_WIDTHS.outerBox,
      shadowBlur: 8,
      shadowColor: 'rgba(0,0,0,0.2)',
    },
    line: {
      width: 1.5,
      radius: 5,
      arrowSize: ARROW_HEAD.width + 2,   // 10
    },
    font: {
      family: "'Inter', 'PingFang SC', sans-serif",
      size: FONT_SIZES.nodeLabel,
    },
  },

  // Gradient
  gradient: {
    name: 'Gradient',
    node: {
      borderRadius: 12,
      borderWidth: 0,
      shadowBlur: 12,
      shadowColor: 'rgba(122,162,247,0.4)',
    },
    line: {
      width: STROKE_WIDTHS.connector * 2,
      radius: 8,
      arrowSize: ARROW_HEAD.width + ARROW_HEAD.height,
    },
    font: {
      family: "'SF Pro Display', sans-serif",
      size: FONT_SIZES.nodeLabel,
    },
  },

  // Outline
  outline: {
    name: 'Outline',
    node: {
      borderRadius: 4,
      borderWidth: STROKE_WIDTHS.outerBox * 2,
      shadowBlur: 0,
      shadowColor: 'transparent',
    },
    line: {
      width: STROKE_WIDTHS.connector * 2,
      radius: 0,
      arrowSize: ARROW_HEAD.width + ARROW_HEAD.height,
    },
    font: {
      family: MONO_FONT_STACK,
      size: FONT_SIZES.edgeLabel + 2,   // 13
    },
  },

  // Frosted glass effect
  glass: {
    name: 'Glass',
    node: {
      borderRadius: 12,
      borderWidth: STROKE_WIDTHS.outerBox,
      shadowBlur: 16,
      shadowColor: 'rgba(255,255,255,0.1)',
    },
    line: {
      width: 1.5,
      radius: 4,
      arrowSize: ARROW_HEAD.width + 2,
    },
    font: {
      family: "'SF Pro Text', sans-serif",
      size: FONT_SIZES.nodeLabel,
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// §6  CSS generation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate CSS style string (Node.js — string concatenation, no DOM required)
 * Used by render.js for SVG style injection.
 *
 * @param {object} theme  - Theme object containing bg / fg / line etc.
 * @param {string} preset - Preset name (default / modern / gradient / outline / glass)
 * @param {string} [svgId] - Unique id of the SVG root element (e.g. 'diagram-flow').
 *                         When provided, all selectors are scoped to #svgId,
 *                         preventing CSS bleed when multiple SVGs are inlined in HTML.
 *                         Omit to use 'svg' as root selector (standalone SVG file).
 */
function generateCSSStyles(theme, preset = 'default', svgId = null) {
  const p = STYLE_PRESETS[preset] || STYLE_PRESETS.default;
  const lineColor = theme.line || theme.fg + '80';
  const borderColor = theme.muted || theme.fg + '40';

  // Root selector: use #id when scoped, otherwise fall back to svg
  const root = svgId ? `#${svgId}` : 'svg';

  return `
${root} {
  /* CSS variable overrides */
  --_text:       ${theme.fg}       !important;
  --_text-sec:   ${theme.muted  || theme.fg + '80'} !important;
  --_line:       ${lineColor}      !important;
  --_arrow:      ${lineColor}      !important;
  --_node-fill:  ${theme.bg}       !important;
  --_node-stroke:${borderColor}    !important;
  --_group-fill: ${theme.accent ? theme.accent + '18' : theme.fg + '0a'} !important;
  --_group-hdr:  ${theme.accent || theme.fg} !important;
}
${root} text {
  font-family: ${p.font.family} !important;
  font-size:   ${p.font.size}px !important;
  dominant-baseline: central;
  dy: ${TEXT_BASELINE_SHIFT};
}
/* Direct element attribute overrides */
${root} rect[fill="var(--_node-fill)"],
${root} circle[fill="var(--_node-fill)"],
${root} ellipse[fill="var(--_node-fill)"],
${root} polygon[fill="var(--_node-fill)"] {
  fill:         ${theme.bg}        !important;
  stroke:       ${borderColor}     !important;
  stroke-width: ${p.node.borderWidth}px !important;
  rx:           ${p.node.borderRadius}px !important;
  ry:           ${p.node.borderRadius}px !important;
  filter: drop-shadow(0 ${p.node.shadowBlur / 2}px ${p.node.shadowBlur}px ${p.node.shadowColor}) !important;
}
/* Node text */
${root} g.node text {
  fill: ${theme.fg} !important;
}
/* Subgraph / cluster header */
${root} .cluster-label text {
  fill:        ${theme.accent || theme.fg} !important;
  font-size:   ${FONT_SIZES.groupHeader}px !important;
  font-weight: ${FONT_WEIGHTS.groupHeader} !important;
}
/* Edges / connectors */
${root} .edge, ${root} .edgePath .path {
  stroke:       ${lineColor}  !important;
  stroke-width: ${p.line.width}px !important;
}
${root} path {
  stroke:       ${lineColor}  !important;
  stroke-width: ${p.line.width}px !important;
}
/* Arrowheads */
${root} .arrowhead polygon,
${root} marker polygon {
  stroke: ${lineColor} !important;
  fill:   ${lineColor} !important;
}
/* Edge labels */
${root} .edgeLabel text {
  fill:      ${theme.muted || theme.fg} !important;
  font-size: ${FONT_SIZES.edgeLabel}px  !important;
}`;
}

// Auto-increment counter for unique SVG ids within a process
let _svgIdCounter = 0;

/**
 * Inject CSS styles into SVG string (Node.js version, no DOMParser)
 * Used by render.js CLI rendering pipeline.
 *
 * In addition to style injection, this function:
 * 1. Injects a unique id on the SVG root to scope CSS selectors (prevents bleed when multiple SVGs are inlined in HTML)
 * 2. Scopes all internal <style> selectors (svg {} → #id {}, text {} → #id text {}, etc.)
 * 3. Inlines --_line / --_arrow CSS variables in the style attribute so colors are visible when the SVG is opened standalone
 * 4. Fixes SVG width/height attributes:
 *    - If width or height is a percentage (e.g. "100%"), derives pixel values from viewBox
 *    - If no viewBox but concrete width/height, synthesises viewBox
 *
 * @param {string}  svgString  - Raw SVG string
 * @param {object}  theme      - Full theme object (bg/fg/line/accent/muted/surface/border)
 * @param {string}  [preset]   - Style preset name, default 'default'
 * @param {string}  [svgId]    - Optional: SVG root element id; auto-generated as bm-diagram-N if omitted
 */
function injectStylesToSVG(svgString, theme, preset = 'default', svgId = null) {
  // Auto-generate unique id if not provided
  const effectiveSvgId = svgId || `bm-diagram-${++_svgIdCounter}`;

  const css = generateCSSStyles(theme, preset, effectiveSvgId);
  const styleTag = `<style>${css}</style>`;

  // ── Step 1: Fix SVG width/height, inject unique id, inline CSS variables ──
  let fixed = svgString;

  // Extract <svg ...> opening tag (with all attributes)
  const svgTagMatch = fixed.match(/<svg([^>]*)>/);
  if (svgTagMatch) {
    let attrs = svgTagMatch[1];

    // Extract current width / height / viewBox / id / style
    const wMatch     = attrs.match(/\bwidth\s*=\s*["']([^"']*)["']/);
    const hMatch     = attrs.match(/\bheight\s*=\s*["']([^"']*)["']/);
    const vbMatch    = attrs.match(/\bviewBox\s*=\s*["']([^"']*)["']/);
    const idMatch    = attrs.match(/\bid\s*=\s*["']([^"']*)["']/);
    const styleMatch = attrs.match(/\bstyle\s*=\s*["']([^"']*)["']/);

    const w  = wMatch  ? wMatch[1].trim()  : null;
    const h  = hMatch  ? hMatch[1].trim()  : null;
    const vb = vbMatch ? vbMatch[1].trim() : null;

    // Check if value is a valid pixel number (digits only, no %, px, em units)
    const isPixel = (v) => v != null && /^\d+(\.\d+)?$/.test(v);

    let newW = w, newH = h;
    let newVb = vb;

    // If width or height is not a valid pixel value, derive from viewBox
    if (vb && (!isPixel(w) || !isPixel(h))) {
      const parts = vb.split(/[\s,]+/).map(Number);
      if (parts.length >= 4 && parts[2] > 0 && parts[3] > 0) {
        if (!isPixel(w)) newW = String(parts[2]);
        if (!isPixel(h)) newH = String(parts[3]);
      }
    }

    // If no viewBox but concrete width/height, synthesise viewBox
    if (!vb && isPixel(newW) && isPixel(newH)) {
      newVb = `0 0 ${newW} ${newH}`;
    }

    // Rebuild the <svg> opening tag
    let newAttrs = attrs;

    // 1a. Fix width/height/viewBox
    const changed = (newW !== w) || (newH !== h) || (newVb !== vb);
    if (changed) {
      if (newW !== w) {
        if (wMatch) newAttrs = newAttrs.replace(wMatch[0], `width="${newW}"`);
        else        newAttrs = newAttrs + ` width="${newW}"`;
      }
      if (newH !== h) {
        if (hMatch) newAttrs = newAttrs.replace(hMatch[0], `height="${newH}"`);
        else        newAttrs = newAttrs + ` height="${newH}"`;
      }
      if (!vb && newVb) {
        newAttrs = newAttrs + ` viewBox="${newVb}"`;
      }
    }

    // 1b. Inject unique id (overwrite existing id, idempotent)
    if (idMatch) {
      newAttrs = newAttrs.replace(idMatch[0], `id="${effectiveSvgId}"`);
    } else {
      newAttrs = newAttrs + ` id="${effectiveSvgId}"`;
    }

    // 1c. Inline --_xxx CSS variables in style attribute (fixes colors when SVG opened standalone)
    //     SVG elements use stroke="var(--_line)" etc; these are normally derived via CSS inheritance
    //     from the <style> block, but may not apply when SVG is opened as a standalone file.
    //     Inlining the resolved color values is the most robust solution.
    const lineColor   = theme.line   || (theme.fg + '80');
    const borderColor = theme.muted  || (theme.fg + '40');
    const accentColor = theme.accent || theme.fg;
    const extraVars = [
      `--_line:${lineColor}`,
      `--_arrow:${lineColor}`,
      `--_text:${theme.fg}`,
      `--_text-sec:${theme.muted || theme.fg + '80'}`,
      `--_text-muted:${theme.muted || theme.fg + '80'}`,
      `--_node-fill:${theme.bg}`,
      `--_node-stroke:${borderColor}`,
      `--_group-fill:${accentColor + '18'}`,
      `--_group-hdr:${accentColor}`,
      `--_inner-stroke:${borderColor}`,
    ].join(';');

    if (styleMatch) {
      // Already has style attribute: append variables (remove duplicates first)
      let existingStyle = styleMatch[1];
      // Remove existing --_xxx: declarations to avoid duplicates
      existingStyle = existingStyle.replace(/--_[a-z-]+:[^;]+;?/g, '');
      // Add background color if not already set
      if (!existingStyle.includes('background')) {
        existingStyle += `;background:${theme.bg}`;
      }
      const newStyle = `${existingStyle};${extraVars}`.replace(/^;+/, '');
      newAttrs = newAttrs.replace(styleMatch[0], `style="${newStyle}"`);
    } else {
      newAttrs = newAttrs + ` style="background:${theme.bg};${extraVars}"`;
    }

    fixed = fixed.replace(svgTagMatch[0], `<svg${newAttrs}>`);
  }

  // ── Step 2: Inject <style> block after <svg> opening tag ──
  const svgOpenEnd = fixed.indexOf('>');
  if (svgOpenEnd === -1) return fixed;

  return fixed.slice(0, svgOpenEnd + 1) + '\n' + styleTag + fixed.slice(svgOpenEnd + 1);
}

/**
 * Apply styles to SVG string (browser version, requires DOMParser / XMLSerializer)
 * Used in browser environments such as preview.html.
 */
function applyStylesToSVG(svgString, theme, preset = 'default', options = {}) {
  const {
    transparentBg = false,
    includeFonts   = true,
    width          = null,
    height         = null,
    fontFamily     = null,
    fontSize       = null,
  } = options;

  const parser = new DOMParser();
  const doc    = parser.parseFromString(svgString, 'image/svg+xml');
  const svgEl  = doc.querySelector('svg');

  if (!svgEl) return svgString;

  const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style');
  const p       = STYLE_PRESETS[preset] || STYLE_PRESETS.default;

  const customFontFamily = fontFamily || p.font.family;
  const customFontSize   = fontSize   || p.font.size;
  const lineColor        = theme.line || theme.fg + '80';
  const borderColor      = theme.muted || theme.fg + '40';

  styleEl.textContent = `
    .node rect,
    .node circle,
    .node ellipse,
    .node polygon {
      fill:         ${theme.bg}         !important;
      stroke:       ${borderColor}      !important;
      stroke-width: ${p.node.borderWidth}px !important;
      rx:           ${p.node.borderRadius}px !important;
      ry:           ${p.node.borderRadius}px !important;
      filter: drop-shadow(0 ${p.node.shadowBlur / 2}px ${p.node.shadowBlur}px ${p.node.shadowColor}) !important;
    }
    .node text {
      fill:        ${theme.fg}          !important;
      font-family: ${customFontFamily}  !important;
      font-size:   ${customFontSize}px  !important;
      dominant-baseline: central;
      dy: ${TEXT_BASELINE_SHIFT};
    }
    .cluster-label text {
      fill:        ${theme.accent || theme.fg} !important;
      font-size:   ${FONT_SIZES.groupHeader}px !important;
      font-weight: ${FONT_WEIGHTS.groupHeader} !important;
    }
    .edgePath .path {
      stroke:       ${lineColor}  !important;
      stroke-width: ${p.line.width}px !important;
    }
    .edgeLabel text {
      fill:      ${theme.muted || theme.fg} !important;
      font-size: ${FONT_SIZES.edgeLabel}px  !important;
    }
    .arrowhead,
    marker polygon {
      stroke: ${lineColor} !important;
      fill:   ${lineColor} !important;
    }
  `;
  svgEl.insertBefore(styleEl, svgEl.firstChild);

  if (includeFonts) {
    svgEl.setAttribute('font-family', customFontFamily);
  }
  if (width)  svgEl.setAttribute('width',  width);
  if (height) svgEl.setAttribute('height', height);

  if (!transparentBg) {
    const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bgRect.setAttribute('width',  '100%');
    bgRect.setAttribute('height', '100%');
    bgRect.setAttribute('fill',   theme.bg);
    svgEl.insertBefore(bgRect, svgEl.firstChild);
  }

  const serializer = new XMLSerializer();
  return serializer.serializeToString(svgEl);
}

// ─────────────────────────────────────────────────────────────────────────────
// §7  Utility functions
// ─────────────────────────────────────────────────────────────────────────────

/** Return list of available preset names */
function getPresetNames() {
  return Object.keys(STYLE_PRESETS);
}

/** Get preset config by name */
function getPreset(presetName) {
  return STYLE_PRESETS[presetName] || null;
}

/** Validate preset name */
function isValidPreset(presetName) {
  return presetName in STYLE_PRESETS;
}

/** Get theme config by name */
function getTheme(themeName) {
  return THEMES[themeName] || null;
}

/** Return all theme names */
function getThemeNames() {
  return Object.keys(THEMES);
}

/** Validate theme name */
function isValidTheme(themeName) {
  return themeName in THEMES;
}

// ─────────────────────────────────────────────────────────────────────────────
// §7a  Theme metadata utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get theme metadata (dark flag, label, family, recommended preset)
 * @param {string} themeName
 * @returns {{ dark: boolean, label: string, family: string, recommendedPreset: string } | null}
 */
function getThemeMeta(themeName) {
  return THEME_META[themeName] || null;
}

/**
 * Return all dark theme names
 * @returns {string[]}
 */
function getDarkThemes() {
  return Object.keys(THEME_META).filter(k => THEME_META[k].dark);
}

/**
 * Return all light theme names
 * @returns {string[]}
 */
function getLightThemes() {
  return Object.keys(THEME_META).filter(k => !THEME_META[k].dark);
}

/**
 * Return theme names grouped by family
 * @returns {{ [family: string]: string[] }}
 */
function getThemesByFamily() {
  const groups = {};
  for (const [name, meta] of Object.entries(THEME_META)) {
    if (!groups[meta.family]) groups[meta.family] = [];
    groups[meta.family].push(name);
  }
  return groups;
}

/**
 * Get the recommended preset for a given theme
 * @param {string} themeName
 * @returns {string}  Preset name; returns 'default' for unknown themes
 */
function getRecommendedPreset(themeName) {
  const meta = THEME_META[themeName];
  return meta ? meta.recommendedPreset : 'default';
}

/**
 * Resolve and fill in full theme object — ensures all 7 color fields are present.
 * Input can be: a theme name string, a partial theme object, or null (returns defaults).
 *
 * @param {string | object | null} themeInput  Theme name or theme object
 * @returns {{ bg, fg, line, accent, muted, surface, border }}
 */
function resolveTheme(themeInput) {
  let base;

  if (typeof themeInput === 'string') {
    base = THEMES[themeInput] || THEME_DEFAULTS;
  } else if (themeInput && typeof themeInput === 'object') {
    base = themeInput;
  } else {
    base = THEME_DEFAULTS;
  }

  // Fill missing fields from THEME_DEFAULTS
  return {
    bg:      base.bg      || THEME_DEFAULTS.bg,
    fg:      base.fg      || THEME_DEFAULTS.fg,
    line:    base.line    || base.fg + '80' || THEME_DEFAULTS.line,
    accent:  base.accent  || base.fg       || THEME_DEFAULTS.accent,
    muted:   base.muted   || base.fg + '80' || THEME_DEFAULTS.muted,
    surface: base.surface || base.bg       || THEME_DEFAULTS.surface,
    border:  base.border  || base.line     || base.fg + '40' || THEME_DEFAULTS.border,
  };
}

/**
 * Check if two colors have sufficient contrast (approximate WCAG AA check)
 * Useful for validating fg/bg readability when recommending themes
 *
 * @param {string} hex1  Hex color (e.g. '#1a1b26')
 * @param {string} hex2  Hex color
 * @returns {number}     Contrast ratio (>= 4.5 passes WCAG AA)
 */
function colorContrast(hex1, hex2) {
  function luminance(hex) {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const channel = c => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  }
  const L1 = luminance(hex1);
  const L2 = luminance(hex2);
  const lighter = Math.max(L1, L2);
  const darker  = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Get readability score for a theme (bg vs fg contrast ratio)
 * @param {string} themeName
 * @returns {{ contrast: number, passAA: boolean, passAAA: boolean }}
 */
function checkThemeReadability(themeName) {
  const theme = THEMES[themeName];
  if (!theme) return null;
  const contrast = colorContrast(theme.bg, theme.fg);
  return {
    contrast: Math.round(contrast * 10) / 10,
    passAA:   contrast >= 4.5,
    passAAA:  contrast >= 7.0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// §8  Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  // Font metrics
  MONO_FONT,
  MONO_FONT_STACK,
  estimateMonoTextWidth,

  // Geometry constants (from src/styles.ts)
  FONT_SIZES,
  FONT_WEIGHTS,
  NODE_PADDING,
  STROKE_WIDTHS,
  TEXT_BASELINE_SHIFT,
  ARROW_HEAD,
  GROUP_HEADER_CONTENT_PAD,

  // Themes (15 built-in, from src/theme.ts, with surface/border filled)
  THEMES,
  THEME_DEFAULTS,
  THEME_META,
  // Theme lookup
  getTheme,
  getThemeNames,
  isValidTheme,
  // Theme metadata utilities
  getThemeMeta,
  getDarkThemes,
  getLightThemes,
  getThemesByFamily,
  getRecommendedPreset,
  resolveTheme,
  // Contrast check
  colorContrast,
  checkThemeReadability,

  // Visual presets (5 variants)
  STYLE_PRESETS,
  getPresetNames,
  getPreset,
  isValidPreset,

  // CSS / SVG generation
  generateCSSStyles,
  injectStylesToSVG,
  applyStylesToSVG,
};
