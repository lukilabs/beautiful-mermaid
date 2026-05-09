# beautiful-mermaid

Render Mermaid diagrams as beautiful SVGs or ASCII art. Ultra-fast, fully themeable, zero DOM dependencies.

## When to Use

- User mentions "mermaid", "diagram", "flowchart", "sequence diagram", "class diagram", "ER diagram"
- Request involves visualizing code, architecture, processes, or data relationships
- User wants ASCII/terminal diagrams for CLI output
- User needs themed diagrams matching their editor or site

## Quick Start

### SVG Output

```typescript
import { renderMermaid, THEMES } from 'beautiful-mermaid'

const svg = await renderMermaid(`
  graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Action]
    B -->|No| D[End]
`)

// With theme
const themedSvg = await renderMermaid(diagram, THEMES['tokyo-night'])
```

### ASCII Output

```typescript
import { renderMermaidAscii } from 'beautiful-mermaid'

const ascii = renderMermaidAscii(`graph LR; A --> B --> C`)
```

Output:
```
┌───┐     ┌───┐     ┌───┐
│ A │────►│ B │────►│ C │
└───┘     └───┘     └───┘
```

## Supported Diagram Types

| Type | Keyword | Specialized Skill |
|------|---------|-------------------|
| Flowchart | `graph`, `flowchart` | [flowchart](skills/flowchart/SKILL.md) |
| State | `stateDiagram-v2` | [flowchart](skills/flowchart/SKILL.md) |
| Sequence | `sequenceDiagram` | [sequence](skills/sequence/SKILL.md) |
| Class (UML) | `classDiagram` | [class](skills/class/SKILL.md) |
| ER | `erDiagram` | [er](skills/er/SKILL.md) |

## Theming

### Two-Color Foundation (Mono Mode)

Every diagram needs just `bg` (background) and `fg` (foreground). All other colors are derived:

```typescript
const svg = await renderMermaid(diagram, {
  bg: '#1a1b26',
  fg: '#a9b1d6',
})
```

### Enriched Mode

Add optional colors for richer themes:

```typescript
const svg = await renderMermaid(diagram, {
  bg: '#1a1b26',
  fg: '#a9b1d6',
  line: '#3d59a1',    // Edge/connector color
  accent: '#7aa2f7',  // Arrow heads, highlights
  muted: '#565f89',   // Secondary text, labels
  surface: '#292e42', // Node fill tint
  border: '#3d59a1',  // Node stroke
})
```

### 15 Built-in Themes

```typescript
import { THEMES } from 'beautiful-mermaid'

// Dark themes
THEMES['tokyo-night']       // Deep blue with purple accent
THEMES['tokyo-night-storm'] // Lighter tokyo night variant
THEMES['catppuccin-mocha']  // Warm dark with lavender
THEMES['nord']              // Arctic blue-gray
THEMES['dracula']           // Purple-accented dark
THEMES['github-dark']       // GitHub's dark mode
THEMES['solarized-dark']    // Solarized dark palette
THEMES['one-dark']          // Atom One Dark
THEMES['zinc-dark']         // Neutral dark gray

// Light themes
THEMES['tokyo-night-light'] // Light tokyo variant
THEMES['catppuccin-latte']  // Warm light with purple
THEMES['nord-light']        // Arctic light palette
THEMES['github-light']      // GitHub's light mode
THEMES['solarized-light']   // Solarized light palette
THEMES['zinc-light']        // Clean white/gray
```

See [themes skill](skills/themes/SKILL.md) for customization.

### Shiki/VS Code Theme Integration

```typescript
import { getSingletonHighlighter } from 'shiki'
import { renderMermaid, fromShikiTheme } from 'beautiful-mermaid'

const highlighter = await getSingletonHighlighter({
  themes: ['vitesse-dark']
})

const colors = fromShikiTheme(highlighter.getTheme('vitesse-dark'))
const svg = await renderMermaid(diagram, colors)
```

## ASCII Rendering

For terminal/CLI environments:

```typescript
import { renderMermaidAscii } from 'beautiful-mermaid'

// Unicode (default) - prettier box drawing
const unicode = renderMermaidAscii(diagram)

// Pure ASCII - maximum compatibility
const ascii = renderMermaidAscii(diagram, { useAscii: true })

// Custom spacing
const spaced = renderMermaidAscii(diagram, {
  paddingX: 5,          // Horizontal spacing
  paddingY: 5,          // Vertical spacing
  boxBorderPadding: 1,  // Inner box padding
})
```

See [ascii skill](skills/ascii/SKILL.md) for details.

## API Reference

### `renderMermaid(text, options?): Promise<string>`

Render to SVG. Auto-detects diagram type.

**Options:**
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
| `transparent` | `boolean` | `false` | Transparent background |

### `renderMermaidAscii(text, options?): string`

Render to ASCII/Unicode text. Synchronous.

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `useAscii` | `boolean` | `false` | ASCII instead of Unicode |
| `paddingX` | `number` | `5` | Horizontal spacing |
| `paddingY` | `number` | `5` | Vertical spacing |
| `boxBorderPadding` | `number` | `1` | Inner box padding |

### `fromShikiTheme(theme): DiagramColors`

Extract diagram colors from a Shiki theme.

### `THEMES: Record<string, DiagramColors>`

All 15 built-in themes.

### `DEFAULTS: { bg: string, fg: string }`

Default colors (`#FFFFFF` / `#27272A`).

## Specialized Skills

For complex diagrams, use the specialized skills:

- **[flowchart](skills/flowchart/SKILL.md)** - 12 node shapes, subgraphs, all edge styles
- **[sequence](skills/sequence/SKILL.md)** - Actors, messages, loops, alt blocks, notes
- **[class](skills/class/SKILL.md)** - UML classes, relationships, visibility
- **[er](skills/er/SKILL.md)** - Entities, crow's foot cardinality
- **[themes](skills/themes/SKILL.md)** - Theme customization, Shiki integration
- **[ascii](skills/ascii/SKILL.md)** - ASCII/Unicode terminal rendering

## References

- [Syntax Guide](skills/references/syntax-guide.md) - Complete syntax for all diagram types
- [Themes](skills/references/themes.md) - Theme catalog with colors
- [Shapes](skills/references/shapes.md) - Node shape reference
- [API](skills/references/api.md) - Full API documentation

## Installation

```bash
npm install beautiful-mermaid
# or
bun add beautiful-mermaid
# or
pnpm add beautiful-mermaid
```

## Browser Usage

```html
<script src="https://unpkg.com/beautiful-mermaid/dist/beautiful-mermaid.browser.global.js"></script>
<script>
  const { renderMermaid, THEMES } = beautifulMermaid;
  renderMermaid('graph TD; A-->B').then(svg => { ... });
</script>
```

## Links

- [GitHub](https://github.com/lukilabs/beautiful-mermaid)
- [npm](https://www.npmjs.com/package/beautiful-mermaid)
- [Live Demo](https://agents.craft.do/mermaid)
