# User Journey (`journey`) Design Note

## Overview

This document captures the design choices behind Beautiful Mermaid's `journey`
implementation. The goal is Mermaid syntax compatibility with output that still
feels native to the rest of the library rather than like a separate embedded
renderer.

The implementation follows the standard Beautiful Mermaid pipeline:

- `src/journey/parser.ts`
- `src/journey/layout.ts`
- `src/journey/renderer.ts`
- `src/ascii/journey.ts`

## Input Model

Supported Mermaid constructs:

- `journey`
- `title ...`
- `section ...`
- scored tasks in the form `Task: 1..5[: Actor, Actor]`
- `accTitle: ...`
- `accDescr: ...`
- multiline `accDescr { ... }`
- Mermaid comments, frontmatter, and init directives before the header

Quoted labels are normalized the same way other Beautiful Mermaid diagram
parsers normalize Mermaid labels. `<br>` is converted to multi-line text for
titles, section labels, tasks, actor labels, and accessibility metadata.

## Layout Strategy

Journey diagrams are rendered as horizontally arranged sections with vertically
stacked task cards:

- each section becomes a fixed column
- named sections get a framed container and header band
- unnamed implicit sections stay unframed so a single unsectioned task list
  does not look artificially boxed
- each task card reserves space for:
  - the task label
  - a five-cell score meter
  - an optional row of actor pills

The layout uses the shared text measurement helpers so card widths and heights
expand from content rather than from hardcoded label assumptions.

## Visual Language

The renderer intentionally borrows existing Beautiful Mermaid cues:

- crisp rectangular section frames, similar to timeline/class/ER grouping
- subtle accent rails instead of full-card fills for task emphasis
- compact metadata presentation so actor labels and score state read quickly
- theme-driven colors via shared CSS custom properties instead of renderer-local
  color constants

This keeps the diagram family distinct from flowcharts while still matching the
library's spacing, contrast, and restraint.

## Accessibility

`accTitle` and `accDescr` are surfaced as root SVG accessibility metadata:

- root SVG gets `role="img"`
- root SVG gets `aria-roledescription="user journey"`
- `accTitle` maps to `<title>` and `aria-labelledby`
- `accDescr` maps to `<desc>` and `aria-describedby`
- when `accTitle` is absent, the visible Mermaid `title` becomes the fallback
  accessible title

Accessibility metadata is intentionally non-visual. It improves assistive
technology output without changing the rendered diagram layout.

## Known Boundaries

- Journey support currently models Mermaid's scored-task syntax, not richer
  swimlane semantics beyond section grouping.
- Accessibility metadata is surfaced in SVG output; ASCII output ignores it,
  because it is not part of the visible terminal rendering model.
