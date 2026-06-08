---
name: beautiful-mermaid
description: Render Mermaid diagrams to beautiful, themeable SVG or ASCII art via the beautiful-mermaid MCP server. Use when asked to create, render, or visualize diagrams — flowcharts, sequence diagrams, class diagrams, ER diagrams, state diagrams, or XY charts. Supports 15 built-in themes (tokyo-night, catppuccin, nord, dracula, etc.), custom hex colors, transparent background, and file output. Also parses Mermaid source into structured JSON. The ASCII renderer works in terminals with box-drawing characters.
license: MIT
compatibility: Requires beautiful-mermaid MCP server (bun run src/mcp/cli.ts or npx beautiful-mermaid)
metadata:
  version: "1.1.3"
  package: beautiful-mermaid
---

# beautiful-mermaid

You have access to `beautiful-mermaid` — an MCP server that renders [Mermaid](https://mermaid.js.org/) diagrams to SVG or ASCII art, and parses them into JSON. Use it whenever you need to create or explain a diagram.

## Quick decision guide

| User asks for… | Use |
|---|---|
| A diagram to display in HTML / a browser | `render_mermaid_svg` |
| A diagram to save as `.svg` file | `render_mermaid_svg` with `output_path` |
| A diagram in the terminal or chat (plain text) | `render_mermaid_ascii` |
| Understanding what's inside a Mermaid diagram | `parse_mermaid` |
| What diagram types are available | `list_diagram_types` |

## Supported diagram types

| Type | Mermaid header | Key syntax |
|---|---|---|
| Flowchart | `graph TD` or `flowchart LR` | `A --> B`, `A[Label]`, `A{Diamond}` |
| Sequence | `sequenceDiagram` | `A->>B: Message` |
| Class | `classDiagram` | `Animal <\|-- Duck` |
| ER | `erDiagram` | `CUSTOMER \|\|--o{ ORDER : places` |
| XY Chart | `xychart-beta` | `line [1,2,3]`, `bar [10,20,30]` |
| State | `stateDiagram-v2` | `[*] --> Active` |

## SVG rendering

Call `render_mermaid_svg` with at minimum `mermaid_code`. All other parameters are optional.

```json
{
  "mermaid_code": "graph TD\n  A[Start] --> B[End]",
  "theme_name": "tokyo-night",
  "bg": "#1a1b26",
  "fg": "#c0caf5",
  "transparent": false,
  "output_path": "/path/to/diagram.svg"
}
```

### Theme resolution

1. `bg` / `fg` if provided
2. `theme_name` (one of the 15 built-in themes) if provided
3. Defaults: `#FFFFFF` / `#27272A`

Available themes: `zinc-light`, `zinc-dark`, `tokyo-night`, `tokyo-night-storm`, `tokyo-night-light`, `catppuccin-mocha`, `catppuccin-latte`, `nord`, `nord-light`, `dracula`, `github-light`, `github-dark`, `solarized-light`, `solarized-dark`, `one-dark`.

### File output

When `output_path` is set, the SVG is written directly to that path and the tool returns `{"saved": "/abs/path.svg", "size": 12345}`. Prefer this over returning SVG text when the user wants a `.svg` file — it avoids large content in the conversation. On write failure, the tool returns a structured error.

### Best-effort rendering

If `render_mermaid_svg` encounters a parse error, it automatically strips trailing lines and retries. On partial success, the error response includes a `partial` field with whatever SVG was generated. This means you may get usable output even from slightly malformed Mermaid — but let the user know the result may be incomplete.

## ASCII rendering

Call `render_mermaid_ascii` for terminal or plain-text output.

```json
{
  "mermaid_code": "graph LR\n  A --> B --> C",
  "use_ascii": true,
  "color_mode": "none",
  "padding": 5
}
```

| Parameter | Default | Options |
|---|---|---|
| `use_ascii` | `false` | `true` = `+ - \| >`, `false` = `┌ ─ │ ►` |
| `color_mode` | `auto` | `none`, `auto`, `ansi16`, `ansi256`, `truecolor`, `html` |
| `padding` | 5 | 0–20 (applied to both X and Y) |

### CJK warnings

The tool detects Chinese, Japanese, and Korean characters and emits a `warnings` field when present — these characters are double-width in terminals and may cause misalignment. The diagram still renders; warn the user if alignment matters.

## Parsing

Call `parse_mermaid` to get a structured JSON representation of a diagram. Useful for inspecting node shapes, edge styles, subgraphs, and styling directives.

```json
{
  "mermaid_code": "graph TD\n  A[Start] --> B{Diamond}\n  B -->|Yes| C(End)"
}
```

Returns: `direction`, `nodes` (id → {label, shape}), `edges` (source, target, label, style), `subgraphs`, `classDefs`, `classAssignments`, `nodeStyles`, `linkStyles`. All internal `Map` objects are serialized to plain JSON.

Only supports flowcharts and state diagrams (`parseMermaid` does not handle sequence/class/ER/xychart — those types are handled internally by the SVG/ASCII renderers but cannot be parsed independently).

## Gotchas

- **No `%%` comments in first line** — comments are stripped after the header. If the entire diagram is comments, parsing fails.
- **Sequence/class/ER/xychart at parse time** — `parse_mermaid` only handles flowchart and state diagrams. Other types must go through `render_mermaid_svg` or `render_mermaid_ascii` directly.
- **CJK alignment** — CJK characters render but may misalign in fixed-width terminals. The tool emits a `warnings` field; relay the warning to the user.
- **Theme lookup is case-sensitive** — `theme_name` must match exactly (e.g., `tokyo-night`, not `Tokyo Night`).
- **`output_path` requires existing parent directory** — the tool does not create intermediate directories.

## Diagram type quick reference

```
flowchart:   graph TD\n  A --> B
sequence:    sequenceDiagram\n  A->>B: Hello
class:       classDiagram\n  Animal <|-- Duck
er:          erDiagram\n  CUSTOMER ||--o{ ORDER : places
xychart:     xychart-beta\n  line [1,2,3,4]
state:       stateDiagram-v2\n  [*] --> Active
```

Use `list_diagram_types` to get names, descriptions, and examples for all supported types at runtime — useful when you need to show the user what's available.
