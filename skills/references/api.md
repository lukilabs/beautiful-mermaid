# API Reference

Complete API documentation for beautiful-mermaid.

## Installation

```bash
npm install beautiful-mermaid
# or
bun add beautiful-mermaid
# or
pnpm add beautiful-mermaid
```

## Exports

```typescript
import {
  renderMermaid,       // Render to SVG
  renderMermaidAscii,  // Render to ASCII/Unicode
  fromShikiTheme,      // Convert Shiki theme to colors
  THEMES,              // Built-in themes
  DEFAULTS,            // Default colors
} from 'beautiful-mermaid'
```

---

## `renderMermaid(text, options?): Promise<string>`

Render a Mermaid diagram to SVG string. Async function.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `text` | `string` | Yes | Mermaid source code |
| `options` | `RenderOptions` | No | Rendering options |

### RenderOptions

```typescript
interface RenderOptions {
  bg?: string         // Background color (default: '#FFFFFF')
  fg?: string         // Foreground color (default: '#27272A')
  line?: string       // Edge/connector color
  accent?: string     // Arrow heads, highlights
  muted?: string      // Secondary text, labels
  surface?: string    // Node fill tint
  border?: string     // Node stroke color
  font?: string       // Font family (default: 'Inter')
  transparent?: boolean  // Transparent background (default: false)
}
```

### Returns

`Promise<string>` - SVG markup as a string.

### Example

```typescript
import { renderMermaid } from 'beautiful-mermaid'

const svg = await renderMermaid(`
  graph TD
    A[Start] --> B{Check}
    B -->|Yes| C[Process]
    B -->|No| D[End]
`, {
  bg: '#1a1b26',
  fg: '#a9b1d6',
  accent: '#7aa2f7'
})

// Insert into DOM
document.getElementById('diagram').innerHTML = svg
```

### Error Handling

```typescript
try {
  const svg = await renderMermaid(source)
} catch (error) {
  console.error('Render failed:', error.message)
}
```

---

## `renderMermaidAscii(text, options?): string`

Render a Mermaid diagram to ASCII/Unicode text. Synchronous function.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `text` | `string` | Yes | Mermaid source code |
| `options` | `AsciiRenderOptions` | No | ASCII rendering options |

### AsciiRenderOptions

```typescript
interface AsciiRenderOptions {
  useAscii?: boolean       // Use ASCII instead of Unicode (default: false)
  paddingX?: number        // Horizontal spacing (default: 5)
  paddingY?: number        // Vertical spacing (default: 5)
  boxBorderPadding?: number  // Inner box padding (default: 1)
}
```

### Returns

`string` - ASCII/Unicode diagram as plain text.

### Example

```typescript
import { renderMermaidAscii } from 'beautiful-mermaid'

// Unicode (default)
const unicode = renderMermaidAscii(`graph LR; A --> B --> C`)
console.log(unicode)
// ┌───┐     ┌───┐     ┌───┐
// │ A │────►│ B │────►│ C │
// └───┘     └───┘     └───┘

// Pure ASCII
const ascii = renderMermaidAscii(`graph LR; A --> B`, { useAscii: true })
console.log(ascii)
// +---+     +---+
// | A |---->| B |
// +---+     +---+
```

---

## `fromShikiTheme(theme): DiagramColors`

Extract diagram colors from a Shiki theme object.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `theme` | `ThemeRegistration` | Yes | Shiki theme object |

### Returns

```typescript
interface DiagramColors {
  bg: string
  fg: string
  line?: string
  accent?: string
  muted?: string
  surface?: string
  border?: string
}
```

### Example

```typescript
import { getSingletonHighlighter } from 'shiki'
import { renderMermaid, fromShikiTheme } from 'beautiful-mermaid'

const highlighter = await getSingletonHighlighter({
  themes: ['vitesse-dark']
})

const theme = highlighter.getTheme('vitesse-dark')
const colors = fromShikiTheme(theme)

const svg = await renderMermaid(diagram, colors)
```

### Color Mapping

| VS Code Color | Diagram Role |
|---------------|--------------|
| `editor.background` | `bg` |
| `editor.foreground` | `fg` |
| `editorLineNumber.foreground` | `line` |
| `focusBorder` / keyword token | `accent` |
| comment token | `muted` |
| `editor.selectionBackground` | `surface` |
| `editorWidget.border` | `border` |

---

## `THEMES`

Object containing all 15 built-in themes.

### Type

```typescript
const THEMES: Record<string, DiagramColors>
```

### Available Themes

```typescript
// Dark themes
THEMES['tokyo-night']
THEMES['tokyo-night-storm']
THEMES['catppuccin-mocha']
THEMES['nord']
THEMES['dracula']
THEMES['github-dark']
THEMES['solarized-dark']
THEMES['one-dark']
THEMES['zinc-dark']

// Light themes
THEMES['tokyo-night-light']
THEMES['catppuccin-latte']
THEMES['nord-light']
THEMES['github-light']
THEMES['solarized-light']
THEMES['zinc-light']
```

### Example

```typescript
import { renderMermaid, THEMES } from 'beautiful-mermaid'

// Use built-in theme
const svg = await renderMermaid(diagram, THEMES['dracula'])

// List all themes
console.log(Object.keys(THEMES))
```

---

## `DEFAULTS`

Default color values.

### Type

```typescript
const DEFAULTS: {
  bg: '#FFFFFF'
  fg: '#27272A'
}
```

### Example

```typescript
import { DEFAULTS } from 'beautiful-mermaid'

const myTheme = {
  ...DEFAULTS,
  accent: '#ff6b35'  // Add custom accent
}
```

---

## Browser Usage

### CDN

```html
<script src="https://unpkg.com/beautiful-mermaid/dist/beautiful-mermaid.browser.global.js"></script>
```

Also available via jsDelivr:
```html
<script src="https://cdn.jsdelivr.net/npm/beautiful-mermaid/dist/beautiful-mermaid.browser.global.js"></script>
```

### Global Object

```javascript
const { renderMermaid, renderMermaidAscii, THEMES, DEFAULTS, fromShikiTheme } = beautifulMermaid

renderMermaid('graph TD; A-->B').then(svg => {
  document.getElementById('diagram').innerHTML = svg
})
```

---

## TypeScript Types

```typescript
import type {
  RenderOptions,
  AsciiRenderOptions,
  DiagramColors,
} from 'beautiful-mermaid'
```

### RenderOptions

```typescript
interface RenderOptions {
  bg?: string
  fg?: string
  line?: string
  accent?: string
  muted?: string
  surface?: string
  border?: string
  font?: string
  transparent?: boolean
}
```

### AsciiRenderOptions

```typescript
interface AsciiRenderOptions {
  useAscii?: boolean
  paddingX?: number
  paddingY?: number
  boxBorderPadding?: number
}
```

### DiagramColors

```typescript
interface DiagramColors {
  bg: string
  fg: string
  line?: string
  accent?: string
  muted?: string
  surface?: string
  border?: string
}
```

---

## CSS Custom Properties

SVGs use CSS custom properties for colors:

```css
svg {
  --bg: #1a1b26;
  --fg: #a9b1d6;
  --line: #3d59a1;
  --accent: #7aa2f7;
  --muted: #565f89;
  --surface: #292e42;
  --border: #3d59a1;
}
```

### Live Theme Switching

```javascript
const svgEl = document.querySelector('svg')

// Switch to dark theme
svgEl.style.setProperty('--bg', '#282a36')
svgEl.style.setProperty('--fg', '#f8f8f2')
svgEl.style.setProperty('--accent', '#bd93f9')
```

---

## Supported Diagram Types

| Type | Keyword | Auto-detected |
|------|---------|---------------|
| Flowchart | `graph`, `flowchart` | Yes |
| State | `stateDiagram-v2` | Yes |
| Sequence | `sequenceDiagram` | Yes |
| Class | `classDiagram` | Yes |
| ER | `erDiagram` | Yes |

Diagram type is auto-detected from the first line of source.
