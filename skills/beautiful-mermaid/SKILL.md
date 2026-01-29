---
name: beautiful-mermaid
description: Render Mermaid diagrams as themed SVGs or ASCII/Unicode text using the beautiful-mermaid renderer. Use when the user asks for a Mermaid diagram (flowchart, sequence, class, state, or ER), wants a diagram file generated, or needs terminal-friendly ASCII/Unicode output.
---

# Beautiful Mermaid

## Overview

Render Mermaid source into themed SVGs or terminal-friendly ASCII/Unicode using a local script powered by the `beautiful-mermaid` package.

## Quick Start

Install once per machine (from the skill folder) before first use.

1. Install dependencies once per machine:
   `bun install`
2. Render SVG (default):
   `bun run scripts/render-mermaid.ts --format svg --theme tokyo-night --out /tmp/diagram.svg < diagram.mmd`
3. Render Unicode ASCII:
   `bun run scripts/render-mermaid.ts --format ascii < diagram.mmd`
4. Render pure ASCII:
   `bun run scripts/render-mermaid.ts --format ascii --use-ascii < diagram.mmd`

## Workflow

1. Clarify output target if needed (SVG vs ASCII/Unicode, theme, file path).
2. Produce Mermaid source.
3. Run the renderer script.
4. Return both the Mermaid source and the rendered output or file path.

## CLI Options

**Core**
- `--format svg|ascii` (default: `svg`)
- `--input <file>` (else read from stdin)
- `--out <file>` (else write to stdout)
- `--theme <name>` (one of the built-in themes)

**SVG styling**
- `--bg <hex>` `--fg <hex>` `--accent <hex>` `--muted <hex>` `--surface <hex>` `--border <hex>` `--line <hex>`
- `--font <family>`
- `--transparent`

**ASCII styling**
- `--use-ascii` (force `+---+` style)
- `--padding-x <n>` `--padding-y <n>` `--box-border-padding <n>`

## Script

`scripts/render-mermaid.ts` renders Mermaid from stdin or a file into SVG or ASCII/Unicode.
