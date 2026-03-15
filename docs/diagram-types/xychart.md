# XY Chart (xychart / xychart-beta) — Design Notes

## Overview

The xychart implementation follows the same parse -> layout -> render pipeline used elsewhere in Beautiful Mermaid, with Mermaid's stable `xychart` syntax treated as primary and `xychart-beta` preserved for backward compatibility.

Supported chart forms:

- vertical and horizontal charts
- bar, line, and mixed-series plots
- categorical and numeric x-axes
- semicolon-separated Mermaid statements
- Mermaid accessibility directives (`accTitle` / `accDescr`)
- Mermaid YAML frontmatter and `init` / `initialize` directives, including Mermaid-style loose object literals, for the current documented `xyChart` config surface
- SVG and ASCII output routed through the public entry points

## Pipeline

### Source preprocessing

`src/mermaid-source.ts` strips comments, parses Mermaid YAML frontmatter plus `init` / `initialize` directives, and produces trimmed diagram lines before xychart parsing begins.

The preprocessing layer now intentionally lives in one shared place so future Mermaid-surface additions do not have to be reimplemented separately in SVG and ASCII entry points.

### Parser

`src/xychart/parser.ts` accepts:

- `xychart` and `xychart-beta`
- `horizontal` on the header
- semicolon-separated one-line Mermaid statements
- `accTitle` and single-line or block `accDescr`
- quoted or unquoted titles where Mermaid allows them
- categorical labels with quoting preserved and normalized
- optional series labels on `bar` and `line`
- numeric axis ranges
- Mermaid frontmatter/directives for the current chart, responsive sizing, accessibility, and theme overrides

The parser keeps unknown Mermaid config fields out of the typed result instead of trying to guess their meaning.

### Layout

`src/xychart/layout.ts` treats Mermaid `xyChart.width` and `height` as total chart size, then fits title and axis furniture into the remaining reserved space before computing the plot area.

Key layout choices:

- vertical charts use a left numeric axis and bottom categorical or numeric x-axis
- horizontal charts place the numeric axis at the top and category axis on the left, matching Mermaid more closely
- ticks use a simple linear tick generator for readable numeric steps
- plot geometry stays within the declared chart box
- legends are omitted to keep mixed charts visually quiet

### Renderer

`src/xychart/renderer.ts` and `src/ascii/xychart.ts` share the same parsed chart semantics, then render them in each output mode.

Current SVG rendering decisions:

- explicit axis lines and tick marks by default
- subtle grid lines behind the plot area
- straight line segments rather than spline interpolation
- line dots only for interactive output
- `showDataLabel` applies to bars only, matching Mermaid behavior
- `useMaxWidth` / `useWidth` control responsive root SVG sizing
- `themeCSS` is appended to the chart style block instead of being reinterpreted
- series colors come from the shared theme accent unless Mermaid frontmatter provides `plotColorPalette`

## Compatibility Notes

Supported Mermaid compatibility surface is documented in [README.md](./README.md).

Intentional gap today:

- visual parity aims to stay close to Mermaid, but is not byte-for-byte identical

## Verification Expectations

XY chart changes should keep the following layers covered:

- parser tests for stable/beta headers, quoted labels, comments, and frontmatter
- layout tests for chart bounds, axis placement, and visibility rules
- renderer tests for semantic classes, escaping, and theme token usage
- integration tests for full parse -> layout -> render behavior
- ASCII tests for unicode and ASCII-safe rendering
- `samples-data.ts` coverage so the visual samples page exercises the feature
