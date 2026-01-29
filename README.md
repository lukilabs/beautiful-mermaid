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


The ASCII rendering engine is based on [mermaid-ascii](https://github.com/AlexanderGrooff/mermaid-ascii) by Alexander Grooff. We ported it from Go to TypeScript and extended it Thank you Alexander for the excellent foundation! (And inspiration that this was possible.)

## Features

- **5 diagram types** — Flowcharts, State, Sequence, Class, and ER diagrams
- **Dual output** — SVG for rich UIs, ASCII/Unicode for terminals
- **Standalone CLI** — Single binary, no runtime required
- **15 built-in themes** — And dead simple to add your own
- **Full Shiki compatibility** — Use any VS Code theme directly
- **Live theme switching** — CSS custom properties, no re-render needed
- **Mono mode** — Beautiful diagrams from just 2 colors
- **Zero DOM dependencies** — Pure TypeScript, works everywhere
- **Ultra-fast** — Renders 100+ diagrams in under 500ms

## Installation

### As a library

```bash
npm install beautiful-mermaid
# or
bun add beautiful-mermaid
# or
pnpm add beautiful-mermaid
```

### As a CLI

Download the standalone binary for your platform from [GitHub Releases](https://github.com/lukilabs/beautiful-mermaid/releases):

| Platform | Binary |
|----------|--------|
| Linux x64 | `bmmdc-linux-x64` |
| Linux ARM64 | `bmmdc-linux-arm64` |
| macOS Intel | `bmmdc-darwin-x64` |
| macOS Apple Silicon | `bmmdc-darwin-arm64` |
| Windows x64 | `bmmdc-windows-x64.exe` |
| Windows ARM64 | `bmmdc-windows-arm64.exe` |

```bash
# Example: macOS Apple Silicon
curl -L -o bmmdc https://github.com/lukilabs/beautiful-mermaid/releases/latest/download/bmmdc-darwin-arm64
chmod +x bmmdc
./bmmdc --help
```

## CLI Usage

```bash
# Render to ASCII (default)
bmmdc diagram.mmd
echo -e "graph LR\nA --> B" | bmmdc

# Render to SVG
bmmdc --svg diagram.mmd
bmmdc --svg --theme tokyo-night -o output.svg diagram.mmd

# List available themes
bmmdc --themes

# Options
bmmdc --help
```

## Quick Start

### SVG Output

```typescript
import { renderMermaid } from 'beautiful-mermaid'

const svg = await renderMermaid(`
  graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Action]
    B -->|No| D[End]
`)
```

### ASCII Output

```typescript
import { renderMermaidAscii } from 'beautiful-mermaid'

const ascii = renderMermaidAscii(`graph LR; A --> B --> C`)
```

```
┌───┐     ┌───┐     ┌───┐
│   │     │   │     │   │
│ A │────►│ B │────►│ C │
│   │     │   │     │   │
└───┘     └───┘     └───┘
```

---

## Theming

The theming system is the heart of `beautiful-mermaid`. It's designed to be both powerful and dead simple.

### The Two-Color Foundation

Every diagram needs just two colors: **background** (`bg`) and **foreground** (`fg`). That's it. From these two colors, the entire diagram is derived using `color-mix()`:

```typescript
const svg = await renderMermaid(diagram, {
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
| Connectors | `--fg` at 30% into `--bg` |
| Arrow heads | `--fg` at 50% into `--bg` |
| Node fill | `--fg` at 3% into `--bg` |
| Node stroke | `--fg` at 20% into `--bg` |

### Enriched Mode

For richer themes, you can provide optional "enrichment" colors that override specific derivations:

```typescript
const svg = await renderMermaid(diagram, {
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
import { renderMermaid, THEMES } from 'beautiful-mermaid'

const svg = await renderMermaid(diagram, THEMES['tokyo-night'])
```

### Adding Your Own Theme

Creating a theme is trivial. At minimum, just provide `bg` and `fg`:

```typescript
const myTheme = {
  bg: '#0f0f0f',
  fg: '#e0e0e0',
}

const svg = await renderMermaid(diagram, myTheme)
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
import { renderMermaid, fromShikiTheme } from 'beautiful-mermaid'

// Load any theme from Shiki's registry
const highlighter = await getSingletonHighlighter({
  themes: ['vitesse-dark', 'rose-pine', 'material-theme-darker']
})

// Extract diagram colors from the theme
const colors = fromShikiTheme(highlighter.getTheme('vitesse-dark'))

const svg = await renderMermaid(diagram, colors)
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

---

## ASCII Output

For terminal environments, CLI tools, or anywhere you need plain text, render to ASCII or Unicode box-drawing characters:

```typescript
import { renderMermaidAscii } from 'beautiful-mermaid'

// Unicode mode (default) — prettier box drawing
const unicode = renderMermaidAscii(`graph LR; A --> B`)

// Pure ASCII mode — maximum compatibility
const ascii = renderMermaidAscii(`graph LR; A --> B`, { useAscii: true })
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
renderMermaidAscii(diagram, {
  useAscii: false,      // true = ASCII, false = Unicode (default)
  paddingX: 5,          // Horizontal spacing between nodes
  paddingY: 5,          // Vertical spacing between nodes
  boxBorderPadding: 1,  // Padding inside node boxes
})
```

---

## API Reference

### `renderMermaid(text, options?): Promise<string>`

Render a Mermaid diagram to SVG. Auto-detects diagram type.

**Parameters:**
- `text` — Mermaid source code
- `options` — Optional `RenderOptions` object

**RenderOptions:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `bg` | `string` | `#FFFFFF` | Background color |
| `fg` | `string` | `#27272A` | Foreground color |
| `line` | `string?` | — | Edge/connector color |
| `accent` | `string?` | — | Arrow heads, highlights |
| `muted` | `string?` | — | Secondary text, labels |
| `surface` | `string?` | — | Node fill tint |
| `border` | `string?` | — | Node stroke color |
| `font` | `string` | `Inter` | Font family |
| `transparent` | `boolean` | `false` | Render with transparent background |

### `renderMermaidAscii(text, options?): string`

Render a Mermaid diagram to ASCII/Unicode text. Synchronous.

**AsciiRenderOptions:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `useAscii` | `boolean` | `false` | Use ASCII instead of Unicode |
| `paddingX` | `number` | `5` | Horizontal node spacing |
| `paddingY` | `number` | `5` | Vertical node spacing |
| `boxBorderPadding` | `number` | `1` | Inner box padding |

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
