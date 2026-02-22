# XY Chart (xychart-beta) — Phase 2 Design Document

## Overview

This document specifies the architecture for adding `xychart-beta` / `xychart` support to beautiful-mermaid. The implementation follows the same parse → layout → render pipeline used by all other diagram types (ER, sequence, class, flowchart).

XY charts render bar charts, line charts, or combinations thereof, with categorical or numeric x-axes, numeric y-axes, optional titles, and optional horizontal orientation.

---

## Mermaid Syntax Reference

```
xychart-beta
    title "Sales Revenue"
    x-axis [jan, feb, mar, apr, may, jun]
    y-axis "Revenue (USD)" 4000 --> 11000
    bar [5000, 6000, 7500, 8200, 9800, 10500]
    line [5000, 6000, 7500, 8200, 9800, 10500]
```

Horizontal variant:
```
xychart-beta horizontal
    title "Sales Revenue"
    x-axis [jan, feb, mar, apr, may, jun]
    y-axis "Revenue (USD)" 4000 --> 11000
    bar [5000, 6000, 7500, 8200, 9800, 10500]
```

Numeric x-axis variant:
```
xychart-beta
    x-axis 0 --> 100
    y-axis 0 --> 50
    line [10, 20, 35, 40, 45]
```

---

## Files to Create

### 1. `src/xychart/types.ts`

```typescript
// ============================================================================
// XY Chart types
//
// Models the parsed and positioned representations of a Mermaid xychart-beta
// diagram. Supports bar charts, line charts, and combinations with categorical
// or numeric x-axes.
// ============================================================================

/** Parsed XY chart — logical structure from mermaid text */
export interface XYChart {
  /** Optional chart title */
  title?: string
  /** Chart orientation: vertical (default) or horizontal */
  horizontal: boolean
  /** X-axis configuration */
  xAxis: XYAxis
  /** Y-axis configuration */
  yAxis: XYAxis
  /** Data series (bar and/or line) */
  series: XYChartSeries[]
}

/** Axis configuration — categorical (labels) or numeric (range) */
export interface XYAxis {
  /** Optional axis title/label */
  title?: string
  /** Categorical labels (e.g., ["jan", "feb", "mar"]) — mutually exclusive with range */
  categories?: string[]
  /** Numeric range — mutually exclusive with categories */
  range?: { min: number; max: number }
}

/** A single data series (bar or line) */
export interface XYChartSeries {
  /** Series type */
  type: 'bar' | 'line'
  /** Data values — one per category, or evenly spaced across numeric range */
  data: number[]
}

// ============================================================================
// Positioned XY chart — ready for SVG rendering
// ============================================================================

export interface PositionedXYChart {
  width: number
  height: number
  /** Title text and position (if present) */
  title?: PositionedTitle
  /** Positioned x-axis with tick marks and labels */
  xAxis: PositionedAxis
  /** Positioned y-axis with tick marks and labels */
  yAxis: PositionedAxis
  /** The plot area bounds (inside axes) */
  plotArea: PlotArea
  /** Positioned bar groups */
  bars: PositionedBar[]
  /** Positioned line polylines */
  lines: PositionedLine[]
  /** Horizontal grid lines for readability */
  gridLines: GridLine[]
}

export interface PositionedTitle {
  text: string
  x: number
  y: number
}

export interface PositionedAxis {
  /** Optional axis title text and position */
  title?: { text: string; x: number; y: number; rotate?: number }
  /** Tick positions along the axis */
  ticks: AxisTick[]
  /** Axis line: start and end coordinates */
  line: { x1: number; y1: number; x2: number; y2: number }
}

export interface AxisTick {
  /** Label text for this tick */
  label: string
  /** Position of the tick mark on the axis */
  x: number
  y: number
  /** End of the tick mark (short perpendicular line) */
  tx: number
  ty: number
  /** Label anchor position */
  labelX: number
  labelY: number
  /** Text anchor for label ("middle", "end", "start") */
  textAnchor: 'start' | 'middle' | 'end'
}

export interface PlotArea {
  x: number
  y: number
  width: number
  height: number
}

export interface PositionedBar {
  /** Bar rectangle in SVG coordinates */
  x: number
  y: number
  width: number
  height: number
  /** Original data value (for tooltips/labels if needed) */
  value: number
  /** Series index (for coloring multiple bar series) */
  seriesIndex: number
}

export interface PositionedLine {
  /** Polyline points */
  points: Array<{ x: number; y: number }>
  /** Series index (for coloring multiple line series) */
  seriesIndex: number
}

export interface GridLine {
  x1: number
  y1: number
  x2: number
  y2: number
}
```

### 2. `src/xychart/parser.ts`

```typescript
import type { XYChart, XYAxis, XYChartSeries } from './types.ts'

/**
 * Parse a Mermaid xychart-beta diagram.
 * Expects the first line to be "xychart-beta" (optionally followed by "horizontal").
 *
 * Supported directives (order-independent after header):
 *   title "Chart Title"
 *   x-axis [label1, label2, ...]          — categorical
 *   x-axis min --> max                     — numeric range
 *   x-axis "Axis Title" [label1, ...]      — with title
 *   y-axis min --> max                     — numeric range
 *   y-axis "Axis Title" min --> max        — with title
 *   bar [val1, val2, ...]
 *   line [val1, val2, ...]
 */
export function parseXYChart(lines: string[]): XYChart
```

**Parsing strategy:**

1. First line: detect `horizontal` flag from `xychart-beta horizontal`
2. Iterate remaining lines, match each directive:
   - `title "..."` → extract quoted string
   - `x-axis [...]` → parse as categorical labels (split by comma, trim quotes)
   - `x-axis <num> --> <num>` → parse as numeric range
   - `x-axis "Title" [...]` or `x-axis "Title" <num> --> <num>` → title + data
   - `y-axis` — same patterns as x-axis
   - `bar [...]` → parse numeric array, push `{ type: 'bar', data }`
   - `line [...]` → parse numeric array, push `{ type: 'line', data }`
3. If no y-axis range is specified, auto-derive from min/max of all series data (with padding)

**Internal helpers:**
- `parseNumericArray(str: string): number[]` — parse `[1, 2, 3]` to `[1, 2, 3]`
- `parseCategoryArray(str: string): string[]` — parse `[jan, feb, "mar apr"]` with optional quoting
- `parseRange(str: string): { min: number; max: number } | null`

### 3. `src/xychart/layout.ts`

```typescript
import type { XYChart, PositionedXYChart } from './types.ts'
import type { RenderOptions } from '../types.ts'

/**
 * Lay out a parsed XY chart by computing pixel coordinates.
 * No dagre needed — direct coordinate-space mapping.
 *
 * Layout is synchronous but kept async for API consistency.
 */
export async function layoutXYChart(
  chart: XYChart,
  options: RenderOptions = {}
): Promise<PositionedXYChart>
```

**Layout algorithm:**

1. **Canvas sizing:**
   - Default plot area: 600 x 400px (tunable via constants)
   - Padding: `options.padding ?? 40`
   - Reserve space for title (if present): ~30px top
   - Reserve space for axis labels: ~50px bottom (x-axis), ~60px left (y-axis)
   - Reserve space for axis titles: ~20px each side if present

2. **Scale computation:**
   - X-scale: Maps data indices (categorical) or numeric range to `plotArea.x .. plotArea.x + plotArea.width`
   - Y-scale: Maps `yAxis.range.min .. yAxis.range.max` to `plotArea.y + plotArea.height .. plotArea.y` (inverted for SVG)
   - For categorical x-axis: even spacing with `bandWidth = plotArea.width / categories.length`

3. **Y-axis auto-range** (when not specified):
   - Collect all data values across all series
   - `min = Math.min(...allValues)`, `max = Math.max(...allValues)`
   - Add 10% padding: `min - 0.1 * range`, `max + 0.1 * range`
   - Round to nice tick values

4. **Tick generation:**
   - X-axis categorical: one tick per category, centered in band
   - X-axis numeric: 5-10 ticks at "nice" intervals (1, 2, 5, 10, 20, 50, ...)
   - Y-axis: 5-8 ticks at nice intervals

5. **Bar rectangles:**
   - `barWidth = bandWidth * 0.6` (60% of band, leaving gaps)
   - Multiple bar series: subdivide band width equally
   - Each bar: `{ x, y: scale(value), width: barWidth, height: plotBottom - scale(value) }`

6. **Line polylines:**
   - For each line series: one point per data value at `(xCenter, scale(value))`

7. **Grid lines:**
   - Horizontal lines at each y-axis tick, spanning the plot width

8. **Horizontal mode:**
   - Swap x and y throughout: categories go on y-axis (top-to-bottom), values on x-axis (left-to-right)
   - Bars become horizontal rectangles
   - Line polylines have swapped coordinates

**Layout constants:**
```typescript
const XY = {
  padding: 40,
  plotWidth: 600,
  plotHeight: 400,
  titleFontSize: 16,
  titleHeight: 30,
  axisLabelFontSize: 11,
  axisTitleFontSize: 12,
  xLabelHeight: 50,
  yLabelWidth: 60,
  axisTitlePad: 20,
  tickLength: 5,
  barPadRatio: 0.2,     // gap between bars as fraction of band
  barGroupPadRatio: 0.1, // gap between bars within a group
  gridDash: '3 3',
} as const
```

**Text width estimation:**
Uses `estimateTextWidth()` from `../styles.ts` for:
- Chart title width (to center it)
- Y-axis label widths (to determine left margin)
- X-axis label widths (to check for overlap / rotation)

### 4. `src/xychart/renderer.ts`

```typescript
import type { PositionedXYChart } from './types.ts'
import type { DiagramColors } from '../theme.ts'

/**
 * Render a positioned XY chart as an SVG string.
 */
export function renderXYChartSvg(
  chart: PositionedXYChart,
  colors: DiagramColors,
  font?: string,
  transparent?: boolean
): string
```

**SVG structure and render order:**

1. `svgOpenTag()` — sets CSS variables on the root `<svg>` element
2. `buildStyleBlock(font, false)` — no mono font needed for charts
3. Additional `<style>` rules for chart-specific elements:
   - `.xychart-bar { fill: var(--_accent); }` (or series-indexed colors)
   - `.xychart-line { stroke: var(--_accent); fill: none; stroke-width: 2; }`
   - `.xychart-grid { stroke: var(--_inner-stroke); stroke-dasharray: 3 3; }`
   - `.xychart-axis { stroke: var(--_line); }`
   - `.xychart-dot { fill: var(--_accent); }` (data points on lines)
4. Grid lines (behind data, using `var(--_inner-stroke)`)
5. Bar rectangles (using `var(--_accent)` or series color palette)
6. Line polylines with data point circles
7. Axis lines and tick marks (using `var(--_line)`)
8. Axis labels (using `var(--_text-muted)`)
9. Axis titles (using `var(--_text-sec)`)
10. Chart title (using `var(--_text)`, centered, bold)

**Theming integration:**

The chart uses the same CSS custom property system as all other diagram types. Mapping to chart elements:

| CSS Variable | Chart Element |
|---|---|
| `var(--_text)` | Chart title |
| `var(--_text-sec)` | Axis titles |
| `var(--_text-muted)` | Axis tick labels |
| `var(--_line)` | Axis lines, tick marks |
| `var(--_inner-stroke)` | Grid lines |
| `var(--_accent)` | Bars (primary), line strokes |
| `var(--_node-fill)` | Bar fill (alternative — lighter) |
| `var(--_node-stroke)` | Bar stroke |
| `var(--bg)` | Background / label backgrounds |

**Multi-series coloring:**

For charts with multiple series, generate palette colors using `color-mix()`:
```css
.xychart-series-0 { --_series: var(--_accent); }
.xychart-series-1 { --_series: color-mix(in srgb, var(--_accent) 60%, var(--fg)); }
.xychart-series-2 { --_series: color-mix(in srgb, var(--_accent) 40%, var(--fg)); }
```

---

## Files to Modify

### 1. `src/index.ts`

Add xychart detection in `detectDiagramType()` and import the pipeline:

```typescript
// Add to imports:
import { parseXYChart } from './xychart/parser.ts'
import { layoutXYChart } from './xychart/layout.ts'
import { renderXYChartSvg } from './xychart/renderer.ts'

// Update return type:
function detectDiagramType(text: string): 'flowchart' | 'sequence' | 'class' | 'er' | 'xychart' {
  const firstLine = text.trim().split(/[\n;]/)[0]?.trim().toLowerCase() ?? ''

  if (/^xychart-beta\b/.test(firstLine)) return 'xychart'
  if (/^xychart\b/.test(firstLine)) return 'xychart'
  if (/^sequencediagram\s*$/.test(firstLine)) return 'sequence'
  if (/^classdiagram\s*$/.test(firstLine)) return 'class'
  if (/^erdiagram\s*$/.test(firstLine)) return 'er'

  return 'flowchart'
}

// Add case in renderMermaid switch:
case 'xychart': {
  const chart = parseXYChart(lines)
  const positioned = await layoutXYChart(chart, options)
  return renderXYChartSvg(positioned, colors, font, transparent)
}
```

Note: `xychart-beta` detection must use `\b` (word boundary) rather than `\s*$` because the first line may contain `horizontal` after the keyword.

### 2. `samples-data.ts`

Add xychart samples in a new `'XY Chart'` category section. Examples should cover:
- Basic bar chart (categorical x-axis)
- Basic line chart
- Combined bar + line
- Horizontal orientation
- Numeric x-axis with range
- Axis titles
- Chart title
- Large data sets
- Single data point
- Negative values
- Theme variants

### 3. `src/browser.ts`

No changes needed — the browser bundle imports from `src/index.ts` which re-exports `renderMermaid`. Since xychart is handled inside `renderMermaid`, the browser bundle will automatically support xychart diagrams.

---

## Key Patterns (from existing pipelines)

### Parse → Layout → Render Pipeline

Every diagram type follows the same three-stage pipeline:

1. **Parser** (`parser.ts`): Takes `string[]` (preprocessed lines, comments stripped, semicolons split). Returns a typed AST (e.g., `ErDiagram`, `SequenceDiagram`). Pure function, no side effects.

2. **Layout** (`layout.ts`): Takes the parsed AST + `RenderOptions`. Returns a positioned structure with pixel coordinates. Async (for API consistency even when synchronous internally). Uses `estimateTextWidth()` for sizing. ER/class/flowchart use dagre; sequence uses direct coordinate computation.

3. **Renderer** (`renderer.ts`): Takes the positioned structure + `DiagramColors` + font + transparent flag. Returns an SVG string. Uses `svgOpenTag()` and `buildStyleBlock()` from `theme.ts`. All colors via CSS custom properties (`var(--_xxx)`).

### Theming via CSS Custom Properties

- Two required variables: `--bg`, `--fg` — set as inline styles on the `<svg>` tag
- Five optional enrichment variables: `--line`, `--accent`, `--muted`, `--surface`, `--border`
- Derived internal variables (`--_text`, `--_line`, `--_node-fill`, etc.) computed in `<style>` using `color-mix()` fallbacks
- Renderers never hardcode colors — always reference `var(--_xxx)`

### Text Width Estimation

- `estimateTextWidth(text, fontSize, fontWeight)` — proportional fonts (Inter)
- `estimateMonoTextWidth(text, fontSize)` — monospace fonts
- Used in layout to size boxes, compute margins, center labels
- Constants in `styles.ts`: `FONT_SIZES`, `FONT_WEIGHTS`, `STROKE_WIDTHS`, `TEXT_BASELINE_SHIFT`

### SVG Structure Pattern

```
<svg ...style="--bg:...;--fg:...">
  <style>
    @import url(...)
    text { font-family: ... }
    svg { --_text: ...; --_line: ...; ... }
  </style>
  <defs>...</defs>
  <!-- background elements (grid, relationship lines) -->
  <!-- primary elements (bars, boxes, nodes) -->
  <!-- foreground elements (labels, markers) -->
</svg>
```

All SVG is generated as string concatenation (no DOM). Parts are pushed to an array and joined with `\n`.

### Integration Checklist

- [ ] `src/xychart/types.ts` — type definitions
- [ ] `src/xychart/parser.ts` — parse xychart-beta text
- [ ] `src/xychart/layout.ts` — compute positions
- [ ] `src/xychart/renderer.ts` — render SVG
- [ ] `src/index.ts` — add detection + routing
- [ ] `samples-data.ts` — add xychart samples
- [ ] Tests — parser unit tests for each syntax variant

---

## Design Decisions

### No dagre dependency
XY charts use a fixed coordinate-space layout. Unlike ER/class/flowchart diagrams that need graph layout algorithms, charts have a predetermined structure: axes form a fixed frame, data maps linearly to pixel coordinates. Direct computation is simpler, faster, and avoids the dagre dependency.

### Categorical vs numeric x-axis
The parser detects which variant is used: `[label1, label2, ...]` → categorical, `min --> max` → numeric range. The layout handles both via a unified scale function that maps data indices or numeric values to pixel positions.

### Series palette via color-mix
Rather than hardcoding a palette, multi-series charts derive colors from the theme's `--accent` using `color-mix()`. This ensures the chart looks correct in any theme without maintaining separate palettes.

### Horizontal mode as coordinate swap
Horizontal orientation is handled by swapping x/y coordinates during layout rather than having a separate rendering path. The renderer draws the same SVG elements regardless of orientation — only the positions differ.
