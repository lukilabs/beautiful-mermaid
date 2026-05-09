# mermaid-themes

Expert skill for theme customization and Shiki integration with beautiful-mermaid.

## When to Use

- "theme", "colors", "dark mode", "light mode", "shiki"
- User wants to match diagram colors to their editor or site
- Need custom branded diagrams

## Theming Philosophy

beautiful-mermaid uses CSS custom properties with `color-mix()`. This means:

1. All colors derive from just `bg` + `fg`
2. Themes switch instantly without re-rendering
3. SVGs adapt to any color scheme

## Two-Color Foundation (Mono Mode)

Every diagram needs just two colors:

```typescript
import { renderMermaid } from 'beautiful-mermaid'

const svg = await renderMermaid(diagram, {
  bg: '#1a1b26',  // Background
  fg: '#a9b1d6',  // Foreground
})
```

The system derives all other colors:

| Element | Derivation |
|---------|------------|
| Text | `--fg` at 100% |
| Secondary text | `--fg` at 60% into `--bg` |
| Edge labels | `--fg` at 40% into `--bg` |
| Connectors | `--fg` at 30% into `--bg` |
| Arrow heads | `--fg` at 50% into `--bg` |
| Node fill | `--fg` at 3% into `--bg` |
| Node stroke | `--fg` at 20% into `--bg` |

## Enriched Mode

Override specific colors for richer themes:

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

Only specify what you need—unset values use `color-mix()` derivations.

## Built-in Themes

### Dark Themes

```typescript
import { THEMES } from 'beautiful-mermaid'

// Tokyo Night family
THEMES['tokyo-night']       // bg: #1a1b26, accent: #7aa2f7
THEMES['tokyo-night-storm'] // bg: #24283b, accent: #7aa2f7

// Catppuccin
THEMES['catppuccin-mocha']  // bg: #1e1e2e, accent: #cba6f7

// Nordic
THEMES['nord']              // bg: #2e3440, accent: #88c0d0

// Classic
THEMES['dracula']           // bg: #282a36, accent: #bd93f9
THEMES['one-dark']          // bg: #282c34, accent: #c678dd

// Platform
THEMES['github-dark']       // bg: #0d1117, accent: #4493f8
THEMES['solarized-dark']    // bg: #002b36, accent: #268bd2

// Neutral
THEMES['zinc-dark']         // bg: #18181B (derived colors only)
```

### Light Themes

```typescript
THEMES['tokyo-night-light'] // bg: #d5d6db, accent: #34548a
THEMES['catppuccin-latte']  // bg: #eff1f5, accent: #8839ef
THEMES['nord-light']        // bg: #eceff4, accent: #5e81ac
THEMES['github-light']      // bg: #ffffff, accent: #0969da
THEMES['solarized-light']   // bg: #fdf6e3, accent: #268bd2
THEMES['zinc-light']        // bg: #FFFFFF (derived colors only)
```

## Theme Color Values

### Tokyo Night
```typescript
{
  bg: '#1a1b26',
  fg: '#a9b1d6',
  line: '#3d59a1',
  accent: '#7aa2f7',
  muted: '#565f89',
  surface: '#292e42',
  border: '#3d59a1'
}
```

### Catppuccin Mocha
```typescript
{
  bg: '#1e1e2e',
  fg: '#cdd6f4',
  line: '#585b70',
  accent: '#cba6f7',
  muted: '#6c7086',
  surface: '#313244',
  border: '#585b70'
}
```

### Nord
```typescript
{
  bg: '#2e3440',
  fg: '#eceff4',
  line: '#4c566a',
  accent: '#88c0d0',
  muted: '#616e88',
  surface: '#3b4252',
  border: '#4c566a'
}
```

### Dracula
```typescript
{
  bg: '#282a36',
  fg: '#f8f8f2',
  line: '#6272a4',
  accent: '#bd93f9',
  muted: '#6272a4',
  surface: '#44475a',
  border: '#6272a4'
}
```

## Creating Custom Themes

### Minimal (Mono Mode)

```typescript
const myTheme = {
  bg: '#0f0f0f',
  fg: '#e0e0e0',
}

const svg = await renderMermaid(diagram, myTheme)
```

### With Accents

```typescript
const brandTheme = {
  bg: '#ffffff',
  fg: '#1a1a1a',
  accent: '#ff6b35',  // Brand orange for arrows
  muted: '#888888',   // Subdued labels
}
```

### Full Theme

```typescript
const customTheme = {
  bg: '#1a1a2e',
  fg: '#eaeaea',
  line: '#4a4e69',
  accent: '#f72585',
  muted: '#9a8c98',
  surface: '#22223b',
  border: '#4a4e69',
}
```

## Shiki Integration

Use any VS Code theme via Shiki:

```typescript
import { getSingletonHighlighter } from 'shiki'
import { renderMermaid, fromShikiTheme } from 'beautiful-mermaid'

// Load theme
const highlighter = await getSingletonHighlighter({
  themes: ['vitesse-dark', 'rose-pine', 'material-theme-darker']
})

// Extract colors
const colors = fromShikiTheme(highlighter.getTheme('vitesse-dark'))

// Render
const svg = await renderMermaid(diagram, colors)
```

### Color Mapping

`fromShikiTheme()` maps VS Code editor colors:

| VS Code Color | Diagram Role |
|---------------|--------------|
| `editor.background` | `bg` |
| `editor.foreground` | `fg` |
| `editorLineNumber.foreground` | `line` |
| `focusBorder` / keyword token | `accent` |
| comment token | `muted` |
| `editor.selectionBackground` | `surface` |
| `editorWidget.border` | `border` |

### Popular Shiki Themes

```typescript
// Dark
'vitesse-dark'
'rose-pine'
'rose-pine-moon'
'material-theme-darker'
'material-theme-palenight'
'ayu-dark'
'houston'
'night-owl'

// Light
'vitesse-light'
'rose-pine-dawn'
'material-theme-lighter'
'ayu-light'
'slack-ochin'
```

## Live Theme Switching

SVGs use CSS custom properties, so themes switch instantly:

```typescript
// Initial render
const svg = await renderMermaid(diagram, THEMES['tokyo-night'])
document.getElementById('diagram').innerHTML = svg

// Switch theme without re-rendering
const svgEl = document.querySelector('#diagram svg')
const newTheme = THEMES['dracula']

svgEl.style.setProperty('--bg', newTheme.bg)
svgEl.style.setProperty('--fg', newTheme.fg)
if (newTheme.accent) svgEl.style.setProperty('--accent', newTheme.accent)
// ... other properties
```

## Transparent Background

```typescript
const svg = await renderMermaid(diagram, {
  bg: '#1a1b26',
  fg: '#a9b1d6',
  transparent: true,  // No background fill
})
```

## Font Customization

```typescript
const svg = await renderMermaid(diagram, {
  bg: '#ffffff',
  fg: '#1a1a1a',
  font: 'JetBrains Mono',  // Custom font family
})
```

## Dark Mode Detection

```typescript
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
const theme = prefersDark ? THEMES['tokyo-night'] : THEMES['github-light']

const svg = await renderMermaid(diagram, theme)

// Listen for changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
  const newTheme = e.matches ? THEMES['tokyo-night'] : THEMES['github-light']
  // Update SVG CSS variables
})
```

## Tips

1. **Start with mono mode**: Just `bg` and `fg` often looks great
2. **Match your editor**: Use Shiki integration for consistency
3. **Test both modes**: Ensure readability in light and dark
4. **Use accent sparingly**: It draws attention—use for arrows/highlights
5. **Consider contrast**: Ensure text is readable on node backgrounds
6. **Export themes**: Store custom themes as reusable objects
