<div align="center">

# beautiful-mermaid

**Render Mermaid diagrams as beautiful SVGs or ASCII art**

Ultra-fast, fully themeable, zero DOM dependencies. Built for the AI era.

![beautiful-mermaid sequence diagram example](hero.png)

[![npm version](https://img.shields.io/npm/v/beautiful-mermaid.svg)](https://www.npmjs.com/package/beautiful-mermaid)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

[**Live Demo & Samples**](https://agents.craft.do/mermaid)

**[→ Use it live in Craft Agents](https://agents.craft.do)**

</div>

---

## Why We Built This

Diagrams are essential for AI-assisted programming. When you're working with an AI coding assistant, being able to visualize data flows, state machines, and system architecture—directly in your terminal or chat interface—makes complex concepts instantly graspable.

[Mermaid](https://mermaid.js.org/) is the de facto standard for text-based diagrams. It's brilliant. But the default renderer has problems:

- **Aesthetics** — Might be personal preference, but wished they looked more professional
- **Complex theming** — Customizing colors requires wrestling with CSS classes
- **No terminal output** — Can't render to ASCII for CLI tools
- **Heavy dependencies** — Pulls in a lot of code for simple diagrams

We built `beautiful-mermaid` at [Craft](https://craft.do) to power diagrams in [Craft Agents](https://agents.craft.do). It's fast, beautiful, and works everywhere—from rich UIs to plain terminals.


The ASCII rendering engine is based on [mermaid-ascii](https://github.com/AlexanderGrooff/mermaid-ascii) by Alexander Grooff. We ported it from Go to TypeScript and extended it. Thank you Alexander for the excellent foundation! (And inspiration that this was possible.)

## Features

- **6 diagram types** — Flowcharts, State, Sequence, Class, ER, and XY Charts (bar, line, combined)
- **Dual output** — SVG for rich UIs, ASCII/Unicode for terminals
- **Synchronous rendering** — No async, no flash. Works with React `useMemo()`
- **15 built-in themes** — And dead simple to add your own
- **Full Shiki compatibility** — Use any VS Code theme directly
- **Live theme switching** — CSS custom properties, no re-render needed
- **Mono mode** — Beautiful diagrams from just 2 colors
- **Zero DOM dependencies** — Pure TypeScript, works everywhere
- **Ultra-fast** — Renders 100+ diagrams in under 500ms

## Installation

```bash
npm install beautiful-mermaid
# or
bun add beautiful-mermaid
# or
pnpm add beautiful-mermaid
```

## Quick Start

### SVG Output

```typescript
import { renderMermaidSVG } from 'beautiful-mermaid'

const svg = renderMermaidSVG(`
  graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Action]
    B -->|No| D[End]
`)
```

Rendering is **fully synchronous** — no `await`, no promises. The ELK.js layout engine runs synchronously via a FakeWorker bypass, so you get your SVG string instantly.

Need async? Use `renderMermaidSVGAsync()` — same output, returns a `Promise<string>`.

### ASCII Output

```typescript
import { renderMermaidASCII } from 'beautiful-mermaid'

const ascii = renderMermaidASCII(`graph LR; A --> B --> C`)
```

```
┌───┐     ┌───┐     ┌───┐
│   │     │   │     │   │
│ A │────►│ B │────►│ C │
│   │     │   │     │   │
└───┘     └───┘     └───┘
```

---

## React Integration

Because rendering is synchronous, you can use `useMemo()` for zero-flash diagram rendering:

```tsx
import { renderMermaidSVG } from 'beautiful-mermaid'

function MermaidDiagram({ code }: { code: string }) {
  const { svg, error } = React.useMemo(() => {
    try {
      return {
        svg: renderMermaidSVG(code, {
          bg: 'var(--background)',
          fg: 'var(--foreground)',
          transparent: true,
        }),
        error: null,
      }
    } catch (err) {
      return { svg: null, error: err instanceof Error ? err : new Error(String(err)) }
    }
  }, [code])

  if (error) return <pre>{error.message}</pre>
  return <div dangerouslySetInnerHTML={{ __html: svg! }} />
}
```

**Why this works well:**
- **No flash** — SVG is computed synchronously during render, not in a useEffect
- **CSS variables** — Pass `var(--background)` etc. instead of hex colors. The SVG inherits from your app's CSS, so theme switches apply instantly without re-rendering
- **Memoized** — Only re-renders when `code` changes

---

## Theming

The theming system is the heart of `beautiful-mermaid`. It's designed to be both powerful and dead simple.

### The Two-Color Foundation

Every diagram needs just two colors: **background** (`bg`) and **foreground** (`fg`). That's it. From these two colors, the entire diagram is derived using `color-mix()`:

```typescript
const svg = renderMermaidSVG(diagram, {
  bg: '#1a1b26',  // Background
  fg: '#a9b1d6',  // Foreground
})
```

This is **Mono Mode**—a coherent, beautiful diagram from just two colors. The system automatically derives:

| Element | Derivation |
|---------|------------|
| Text | `--fg` at 100% |
| Secondary text | `--fg` at 60% into `--bg` |
| Edge labels | `--fg` at 40% into `--bg` |
| Faint text | `--fg` at 25% into `--bg` |
| Connectors | `--fg` at 50% into `--bg` |
| Arrow heads | `--fg` at 85% into `--bg` |
| Node fill | `--fg` at 3% into `--bg` |
| Group header | `--fg` at 5% into `--bg` |
| Inner strokes | `--fg` at 12% into `--bg` |
| Node stroke | `--fg` at 20% into `--bg` |

### Enriched Mode

For richer themes, you can provide optional "enrichment" colors that override specific derivations:

```typescript
const svg = renderMermaidSVG(diagram, {
  bg: '#1a1b26',
  fg: '#a9b1d6',
  // Optional enrichment:
  line: '#3d59a1',    // Edge/connector color
  accent: '#7aa2f7',  // Arrow heads, highlights
  muted: '#565f89',   // Secondary text, labels
  surface: '#292e42', // Node fill tint
  border: '#3d59a1',  // Node stroke
})
```

If an enrichment color isn't provided, it falls back to the `color-mix()` derivation. This means you can provide just the colors you care about.

### CSS Custom Properties = Live Switching

All colors are CSS custom properties on the `<svg>` element. This means you can switch themes instantly without re-rendering:

```javascript
// Switch theme by updating CSS variables
svg.style.setProperty('--bg', '#282a36')
svg.style.setProperty('--fg', '#f8f8f2')
// The entire diagram updates immediately
```

For React apps, pass CSS variable references instead of hex values:

```typescript
const svg = renderMermaidSVG(diagram, {
  bg: 'var(--background)',
  fg: 'var(--foreground)',
  accent: 'var(--accent)',
  transparent: true,
})
// Theme switches apply automatically via CSS cascade — no re-render needed
```

### Built-in Themes

15 carefully curated themes ship out of the box:

| Theme | Type | Background | Accent |
|-------|------|------------|--------|
| `zinc-light` | Light | `#FFFFFF` | Derived |
| `zinc-dark` | Dark | `#18181B` | Derived |
| `tokyo-night` | Dark | `#1a1b26` | `#7aa2f7` |
| `tokyo-night-storm` | Dark | `#24283b` | `#7aa2f7` |
| `tokyo-night-light` | Light | `#d5d6db` | `#34548a` |
| `catppuccin-mocha` | Dark | `#1e1e2e` | `#cba6f7` |
| `catppuccin-latte` | Light | `#eff1f5` | `#8839ef` |
| `nord` | Dark | `#2e3440` | `#88c0d0` |
| `nord-light` | Light | `#eceff4` | `#5e81ac` |
| `dracula` | Dark | `#282a36` | `#bd93f9` |
| `github-light` | Light | `#ffffff` | `#0969da` |
| `github-dark` | Dark | `#0d1117` | `#4493f8` |
| `solarized-light` | Light | `#fdf6e3` | `#268bd2` |
| `solarized-dark` | Dark | `#002b36` | `#268bd2` |
| `one-dark` | Dark | `#282c34` | `#c678dd` |

```typescript
import { renderMermaidSVG, THEMES } from 'beautiful-mermaid'

const svg = renderMermaidSVG(diagram, THEMES['tokyo-night'])
```

### Adding Your Own Theme

Creating a theme is trivial. At minimum, just provide `bg` and `fg`:

```typescript
const myTheme = {
  bg: '#0f0f0f',
  fg: '#e0e0e0',
}

const svg = renderMermaidSVG(diagram, myTheme)
```

Want richer colors? Add any of the optional enrichments:

```typescript
const myRichTheme = {
  bg: '#0f0f0f',
  fg: '#e0e0e0',
  accent: '#ff6b6b',  // Pop of color for arrows
  muted: '#666666',   // Subdued labels
}
```

### Full Shiki Compatibility

Use **any VS Code theme** directly via Shiki integration. This gives you access to hundreds of community themes:

```typescript
import { getSingletonHighlighter } from 'shiki'
import { renderMermaidSVG, fromShikiTheme } from 'beautiful-mermaid'

// Load any theme from Shiki's registry
const highlighter = await getSingletonHighlighter({
  themes: ['vitesse-dark', 'rose-pine', 'material-theme-darker']
})

// Extract diagram colors from the theme
const colors = fromShikiTheme(highlighter.getTheme('vitesse-dark'))

const svg = renderMermaidSVG(diagram, colors)
```

The `fromShikiTheme()` function intelligently maps VS Code editor colors to diagram roles:

| Editor Color | Diagram Role |
|--------------|--------------|
| `editor.background` | `bg` |
| `editor.foreground` | `fg` |
| `editorLineNumber.foreground` | `line` |
| `focusBorder` / keyword token | `accent` |
| comment token | `muted` |
| `editor.selectionBackground` | `surface` |
| `editorWidget.border` | `border` |

---

## Supported Diagrams

### Flowcharts

```
graph TD
  A[Start] --> B{Decision}
  B -->|Yes| C[Process]
  B -->|No| D[End]
  C --> D
```

All directions supported: `TD` (top-down), `LR` (left-right), `BT` (bottom-top), `RL` (right-left).

### State Diagrams

```
stateDiagram-v2
  [*] --> Idle
  Idle --> Processing: start
  Processing --> Complete: done
  Complete --> [*]
```

### Sequence Diagrams

```
sequenceDiagram
  Alice->>Bob: Hello Bob!
  Bob-->>Alice: Hi Alice!
  Alice->>Bob: How are you?
  Bob-->>Alice: Great, thanks!
```

### Class Diagrams

```
classDiagram
  Animal <|-- Duck
  Animal <|-- Fish
  Animal: +int age
  Animal: +String gender
  Animal: +isMammal() bool
  Duck: +String beakColor
  Duck: +swim()
  Duck: +quack()
```

### ER Diagrams

```
erDiagram
  CUSTOMER ||--o{ ORDER : places
  ORDER ||--|{ LINE_ITEM : contains
  PRODUCT ||--o{ LINE_ITEM : "is in"
```

### Inline Edge Styling

Use `linkStyle` to override edge colors and stroke widths — just like [Mermaid's linkStyle](https://mermaid.js.org/syntax/flowchart.html#styling-links):

```
graph TD
  A --> B --> C
  linkStyle 0 stroke:#ff0000,stroke-width:2px
  linkStyle default stroke:#888888
```

|             Syntax              |                 Effect                 |
| ------------------------------- | -------------------------------------- |
| `linkStyle 0 stroke:#f00`       | Style a single edge by index (0-based) |
| `linkStyle 0,2 stroke:#f00`     | Style multiple edges at once           |
| `linkStyle default stroke:#888` | Default style applied to all edges     |

Index-specific styles override the default. Supported properties: `stroke`, `stroke-width`.

Works in both flowcharts and state diagrams.

### XY Charts

Bar charts, line charts, and combinations — using Mermaid's `xychart-beta` syntax.

**Bar chart:**

```
xychart-beta
    title "Monthly Revenue"
    x-axis [Jan, Feb, Mar, Apr, May, Jun]
    y-axis "Revenue ($K)" 0 --> 500
    bar [180, 250, 310, 280, 350, 420]
```

**Line chart:**

```
xychart-beta
    title "User Growth"
    x-axis [Jan, Feb, Mar, Apr, May, Jun]
    line [1200, 1800, 2500, 3100, 3800, 4500]
```

**Combined bar + line:**

```
xychart-beta
    title "Sales with Trend"
    x-axis [Jan, Feb, Mar, Apr, May, Jun]
    bar [300, 380, 280, 450, 350, 520]
    line [300, 330, 320, 353, 352, 395]
```

**Horizontal orientation:**

```
xychart-beta horizontal
    title "Language Popularity"
    x-axis [Python, JavaScript, Java, Go, Rust]
    bar [30, 25, 20, 12, 8]
```

**Axis configuration:**

- Categorical x-axis: `x-axis [A, B, C]`
- Numeric x-axis range: `x-axis 0 --> 100`
- Axis titles: `x-axis "Category" [A, B, C]`
- Y-axis range: `y-axis "Score" 0 --> 100`

**Multi-series:** Add multiple `bar` and/or `line` declarations. Each series gets a distinct color from a monochromatic palette derived from the theme's accent color.

### XY Chart Styling

The chart renderer follows a clean, minimal design philosophy inspired by Apple and Craft:

- **Dot grid** — A subtle dot pattern fills the plot area instead of traditional solid grid lines
- **Rounded bars** — All bar corners are rounded for a modern, polished look
- **Smooth curves** — Line series use natural cubic spline interpolation, producing mathematically smooth curves through all data points (not straight segments or staircase steps)
- **Floating labels** — No visible axis lines or tick marks; labels float freely for a clutter-free aesthetic
- **Drop-shadow lines** — Each line series has a subtle shadow beneath it for depth
- **Monochromatic palette** — Series 0 uses the theme's accent color; additional series get darker/lighter shades of the same hue with subtle hue drift, adapting automatically to light or dark backgrounds
- **Interactive tooltips** — When rendered with `interactive: true`, hovering over bars or data points shows value tooltips. Multi-line tooltips appear when multiple series share an x-position
- **Sparse line dots** — Lines with 12 or fewer data points show data point dots by default for readability
- **Full theme support** — All 15 built-in themes (and custom themes) apply to charts. The accent color drives the entire series color palette
- **Live theme switching** — Chart series colors are CSS custom properties (`--xychart-color-N`), so theme changes apply instantly without re-rendering

---

## ASCII Output

For terminal environments, CLI tools, or anywhere you need plain text, render to ASCII or Unicode box-drawing characters:

```typescript
import { renderMermaidASCII } from 'beautiful-mermaid'

// Unicode mode (default) — prettier box drawing
const unicode = renderMermaidASCII(`graph LR; A --> B`)

// Pure ASCII mode — maximum compatibility
const ascii = renderMermaidASCII(`graph LR; A --> B`, { useAscii: true })
```

**Unicode output:**
```
┌───┐     ┌───┐
│   │     │   │
│ A │────►│ B │
│   │     │   │
└───┘     └───┘
```

**ASCII output:**
```
+---+     +---+
|   |     |   |
| A |---->| B |
|   |     |   |
+---+     +---+
```

### ASCII Options

```typescript
renderMermaidASCII(diagram, {
  useAscii: false,      // true = ASCII, false = Unicode (default)
  paddingX: 5,          // Horizontal spacing between nodes
  paddingY: 5,          // Vertical spacing between nodes
  boxBorderPadding: 1,  // Padding inside node boxes
  colorMode: 'auto',    // 'none' | 'auto' | 'ansi16' | 'ansi256' | 'truecolor' | 'html'
  theme: { ... },       // Partial<AsciiTheme> — override default colors
})
```

### ASCII XY Charts

XY charts render to ASCII with dedicated chart-drawing characters:

- **Bar charts** — `█` blocks (Unicode) or `#` (ASCII mode)
- **Line charts** — Staircase routing with rounded corners: `╭╮╰╯│─` (Unicode) or `+|-` (ASCII)
- **Multi-series** — Each series gets a distinct ANSI color from the theme's accent palette
- **Legends** — Automatically shown when multiple series are present
- **Horizontal charts** — Fully supported with categories on the y-axis

---

## API Reference

### `renderMermaidSVG(text, options?): string`

Render a Mermaid diagram to SVG. Synchronous. Auto-detects diagram type.

**Parameters:**
- `text` — Mermaid source code
- `options` — Optional `RenderOptions` object

**RenderOptions:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `bg` | `string` | `#FFFFFF` | Background color (or CSS variable) |
| `fg` | `string` | `#27272A` | Foreground color (or CSS variable) |
| `line` | `string?` | — | Edge/connector color |
| `accent` | `string?` | — | Arrow heads, highlights |
| `muted` | `string?` | — | Secondary text, labels |
| `surface` | `string?` | — | Node fill tint |
| `border` | `string?` | — | Node stroke color |
| `font` | `string` | `Inter` | Font family |
| `transparent` | `boolean` | `false` | Render with transparent background |
| `padding` | `number` | `40` | Canvas padding in px |
| `nodeSpacing` | `number` | `24` | Horizontal spacing between sibling nodes |
| `layerSpacing` | `number` | `40` | Vertical spacing between layers |
| `componentSpacing` | `number` | `24` | Spacing between disconnected components |
| `thoroughness` | `number` | `3` | Crossing minimization trials (1-7, higher = better but slower) |
| `interactive` | `boolean` | `false` | Enable hover tooltips on XY chart bars and data points |

**XY Charts:** Diagrams starting with `xychart-beta` are auto-detected — no separate function needed. The `accent` color option drives the chart series color palette.

### `renderMermaidSVGAsync(text, options?): Promise<string>`

Async version of `renderMermaidSVG()`. Same output, returns a `Promise<string>`. Useful in async server handlers or data loaders.

### `renderMermaidASCII(text, options?): string`

Render a Mermaid diagram to ASCII/Unicode text. Synchronous.

**AsciiRenderOptions:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `useAscii` | `boolean` | `false` | Use ASCII instead of Unicode |
| `paddingX` | `number` | `5` | Horizontal node spacing |
| `paddingY` | `number` | `5` | Vertical node spacing |
| `boxBorderPadding` | `number` | `1` | Inner box padding |
| `colorMode` | `string` | `'auto'` | `'none'`, `'auto'`, `'ansi16'`, `'ansi256'`, `'truecolor'`, or `'html'` |
| `theme` | `Partial<AsciiTheme>` | — | Override default colors for ASCII output |

### `parseMermaid(text): MermaidGraph`

Parse Mermaid source into a structured graph object (for custom processing).

### `fromShikiTheme(theme): DiagramColors`

Extract diagram colors from a Shiki theme object.

### `THEMES: Record<string, DiagramColors>`

Object containing all 15 built-in themes.

### `DEFAULTS: { bg: string, fg: string }`

Default colors (`#FFFFFF` / `#27272A`).

---

## Attribution

The ASCII rendering engine is based on [mermaid-ascii](https://github.com/AlexanderGrooff/mermaid-ascii) by Alexander Grooff. We ported it from Go to TypeScript and extended it with:

- Sequence diagram support
- Class diagram support
- ER diagram support
- Unicode box-drawing characters
- Configurable spacing and padding

Thank you Alexander for the excellent foundation!

---

## License

MIT — see [LICENSE](LICENSE) for details.

---

<div align="center">

Built with care by the team at [Craft](https://craft.do)

</div>
