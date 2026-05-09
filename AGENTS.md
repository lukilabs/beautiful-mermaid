# AGENTS.md — beautiful-mermaid for AI Assistants

This file helps AI coding assistants (GitHub Copilot, Cursor, Claude, etc.)
understand how to use the **beautiful-mermaid** library correctly.

## Quick Start

```typescript
import { renderMermaidSVG, THEMES } from 'beautiful-mermaid'

// Render with a built-in theme
const svg = renderMermaidSVG('graph TD\n  A[Start] --> B[End]', {
  theme: THEMES['tokyo-night'],
})

// Render with a custom color pair (auto-derives all 7 fields)
const svg2 = renderMermaidSVG('graph TD\n  A --> B', {
  theme: { bg: '#1e1e2e', fg: '#cdd6f4' },
})
```

## Supported Diagram Types

| Type       | Mermaid keyword                    |
|------------|------------------------------------|
| Flowchart  | `graph TD`, `graph LR`, etc.       |
| Sequence   | `sequenceDiagram`                  |
| State      | `stateDiagram-v2`                  |
| Class      | `classDiagram`                     |
| ER         | `erDiagram`                        |
| XY Chart   | `xychart-beta`                     |

## Built-in Themes (15)

**Dark:** `zinc-dark`, `tokyo-night`, `tokyo-night-storm`, `catppuccin-mocha`,
`nord`, `dracula`, `github-dark`, `solarized-dark`, `one-dark`

**Light:** `zinc-light`, `tokyo-night-light`, `catppuccin-latte`, `nord-light`,
`github-light`, `solarized-light`

```typescript
import { THEMES } from 'beautiful-mermaid'

const svg = renderMermaidSVG(code, { theme: THEMES['dracula'] })
```

## RenderOptions

```typescript
interface RenderOptions {
  theme?: {
    bg: string       // background color (required)
    fg: string       // foreground / text color (required)
    line?: string    // edge / connector color
    accent?: string  // accent (arrowheads, highlights)
    muted?: string   // secondary text
    surface?: string // node fill
    border?: string  // node stroke
  }
  font?: string        // font family, default 'Inter'
  transparent?: boolean // omit background, default false
  interactive?: boolean // XY charts only — enable hover tooltips
}
```

## Scoped CSS (inline SVG in HTML)

When rendering multiple diagrams into a single HTML page, pass a unique `svgId`
to prevent CSS variable bleed between diagrams:

```typescript
// Both buildStyleBlock and svgOpenTag accept an optional svgId
import { buildStyleBlock, svgOpenTag } from 'beautiful-mermaid/theme'

const id = `bm-${Math.random().toString(36).slice(2)}`
// svgOpenTag(..., transparent, id) adds id="${id}" to the <svg> tag
// buildStyleBlock(font, mono, id) scopes all selectors to #id { … }
```

## Node.js CLI (`scripts/render.js`)

A standalone CLI wrapper is included for shell / CI usage:

```bash
# Render SVG
node scripts/render.js diagram.mmd -t tokyo-night -o out.svg

# Render PNG (requires sharp)
node scripts/render.js diagram.mmd -f png -t dracula -o out.png

# Render ASCII (terminal-friendly)
node scripts/render.js diagram.mmd -f ascii

# Batch render a directory
node scripts/render.js --batch ./diagrams/ -t github-dark -f svg

# Pass diagram code inline
node scripts/render.js -c "graph TD\n  A --> B" -t nord

# Show all options
node scripts/render.js --help
```

## Interactive Playground

Open `assets/preview.html` directly in any browser — no build step, no server.
Lets you explore all themes, style presets, and diagram types with live preview.

## Common Patterns for AI Agents

```typescript
// ✅ Correct: use THEMES to get a full theme object
renderMermaidSVG(code, { theme: THEMES['github-dark'] })

// ✅ Correct: minimal custom theme (other fields auto-derived)
renderMermaidSVG(code, { theme: { bg: '#0d1117', fg: '#e6edf3' } })

// ✅ Correct: fully custom theme
renderMermaidSVG(code, {
  theme: { bg: '#fff', fg: '#222', line: '#888', accent: '#0969da' }
})

// ❌ Wrong: theme is not a string name — use THEMES['name'] instead
renderMermaidSVG(code, { theme: 'tokyo-night' as any })
```
