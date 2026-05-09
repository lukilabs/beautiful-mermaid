# Theme Catalog

Complete reference for all 15 built-in themes in beautiful-mermaid.

## Theme Colors

### Dark Themes

#### Tokyo Night
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
Deep blue background with soft purple accent. Inspired by the VS Code theme.

#### Tokyo Night Storm
```typescript
{
  bg: '#24283b',
  fg: '#a9b1d6',
  line: '#3d59a1',
  accent: '#7aa2f7',
  muted: '#565f89',
  surface: '#292e42',
  border: '#3d59a1'
}
```
Lighter variant of Tokyo Night with gray-blue background.

#### Catppuccin Mocha
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
Warm dark theme with lavender accent. Part of the popular Catppuccin family.

#### Nord
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
Arctic, north-bluish color palette. Clean and professional.

#### Dracula
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
Classic dark theme with vibrant purple accent.

#### GitHub Dark
```typescript
{
  bg: '#0d1117',
  fg: '#e6edf3',
  line: '#30363d',
  accent: '#4493f8',
  muted: '#7d8590',
  surface: '#161b22',
  border: '#30363d'
}
```
GitHub's official dark mode colors.

#### Solarized Dark
```typescript
{
  bg: '#002b36',
  fg: '#839496',
  line: '#073642',
  accent: '#268bd2',
  muted: '#586e75',
  surface: '#073642',
  border: '#073642'
}
```
Ethan Schoonover's precision color scheme, dark variant.

#### One Dark
```typescript
{
  bg: '#282c34',
  fg: '#abb2bf',
  line: '#3e4451',
  accent: '#c678dd',
  muted: '#5c6370',
  surface: '#2c323c',
  border: '#3e4451'
}
```
Atom's iconic One Dark theme colors.

#### Zinc Dark
```typescript
{
  bg: '#18181B',
  fg: '#fafafa'
}
```
Minimal dark theme. All colors derived from bg/fg via color-mix().

---

### Light Themes

#### Tokyo Night Light
```typescript
{
  bg: '#d5d6db',
  fg: '#343b58',
  line: '#9699a3',
  accent: '#34548a',
  muted: '#9699a3',
  surface: '#d5d6db',
  border: '#9699a3'
}
```
Light variant of Tokyo Night for bright environments.

#### Catppuccin Latte
```typescript
{
  bg: '#eff1f5',
  fg: '#4c4f69',
  line: '#bcc0cc',
  accent: '#8839ef',
  muted: '#9ca0b0',
  surface: '#e6e9ef',
  border: '#bcc0cc'
}
```
Warm light theme with vivid purple accent.

#### Nord Light
```typescript
{
  bg: '#eceff4',
  fg: '#2e3440',
  line: '#d8dee9',
  accent: '#5e81ac',
  muted: '#9199a1',
  surface: '#e5e9f0',
  border: '#d8dee9'
}
```
Arctic light palette, clean and minimal.

#### GitHub Light
```typescript
{
  bg: '#ffffff',
  fg: '#1f2328',
  line: '#d0d7de',
  accent: '#0969da',
  muted: '#656d76',
  surface: '#f6f8fa',
  border: '#d0d7de'
}
```
GitHub's official light mode colors.

#### Solarized Light
```typescript
{
  bg: '#fdf6e3',
  fg: '#657b83',
  line: '#eee8d5',
  accent: '#268bd2',
  muted: '#93a1a1',
  surface: '#eee8d5',
  border: '#eee8d5'
}
```
Solarized precision palette, light variant.

#### Zinc Light
```typescript
{
  bg: '#FFFFFF',
  fg: '#27272A'
}
```
Default light theme. All colors derived from bg/fg via color-mix().

---

## Usage

### Import and Use

```typescript
import { renderMermaid, THEMES } from 'beautiful-mermaid'

// Use a theme
const svg = await renderMermaid(diagram, THEMES['tokyo-night'])

// List all themes
console.log(Object.keys(THEMES))
// ['zinc-light', 'zinc-dark', 'tokyo-night', 'tokyo-night-storm', ...]
```

### Apply to Existing SVG

```javascript
const svgEl = document.querySelector('svg')
const theme = THEMES['dracula']

svgEl.style.setProperty('--bg', theme.bg)
svgEl.style.setProperty('--fg', theme.fg)
if (theme.line) svgEl.style.setProperty('--line', theme.line)
if (theme.accent) svgEl.style.setProperty('--accent', theme.accent)
if (theme.muted) svgEl.style.setProperty('--muted', theme.muted)
if (theme.surface) svgEl.style.setProperty('--surface', theme.surface)
if (theme.border) svgEl.style.setProperty('--border', theme.border)
```

---

## Color Roles

| Property | Role | CSS Variable |
|----------|------|--------------|
| `bg` | Background | `--bg` |
| `fg` | Foreground/text | `--fg` |
| `line` | Edges, connectors | `--line` |
| `accent` | Arrow heads, highlights | `--accent` |
| `muted` | Secondary text, labels | `--muted` |
| `surface` | Node fill tint | `--surface` |
| `border` | Node stroke | `--border` |

---

## Derivation Formula

When enrichment colors aren't provided, they're derived:

```css
--line: color-mix(in srgb, var(--fg) 30%, var(--bg));
--accent: color-mix(in srgb, var(--fg) 50%, var(--bg));
--muted: color-mix(in srgb, var(--fg) 40%, var(--bg));
--surface: color-mix(in srgb, var(--fg) 3%, var(--bg));
--border: color-mix(in srgb, var(--fg) 20%, var(--bg));
```

---

## Theme by Category

### Best for Code Documentation
- `github-light` / `github-dark`
- `tokyo-night` / `tokyo-night-light`

### Best for Presentations
- `nord` / `nord-light`
- `catppuccin-mocha` / `catppuccin-latte`

### Best for Terminals
- `dracula`
- `one-dark`
- `solarized-dark`

### Best for Print
- `zinc-light`
- `github-light`
- `solarized-light`

### Best Contrast
- `nord` (dark)
- `github-light` (light)

### Most Colorful
- `dracula` (purple)
- `catppuccin-mocha` (lavender)
- `tokyo-night` (blue)
