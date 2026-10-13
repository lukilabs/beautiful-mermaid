# Architecture Design: beautiful-mermaid MCP Server

## Architectural Analysis

### Confirmed Requirements

| ID | Requirement |
|----|------------|
| R1 | Expose 4 MCP tools: `render_mermaid_svg`, `render_mermaid_ascii`, `parse_mermaid`, `list_diagram_types` |
| R2 | Stdio transport only (no HTTP/SSE) |
| R3 | npm package, sub-entry `beautiful-mermaid/mcp` |
| R4 | MCP layer wraps existing core API without modifying public signatures |
| R5 | Structured error + best-effort partial rendering via try-catch |
| R6 | SVG tool exposes 4-5 core params (theme, bg, fg, transparent) |
| R7 | CJK: render as-is, emit `warnings` field in return value |
| R8 | Bun runtime first; fallback to Node if incompatible |
| R9 | Designed for eventual upstream contribution |

### Confirmed Constraints

| Constraint | Detail |
|-----------|--------|
| C1 | Runtime: Bun (primary), Node fallback |
| C2 | MCP SDK: `@modelcontextprotocol/server` + `zod` v4 |
| C3 | Build: reuse existing tsup pipeline |
| C4 | Existing deps: `elkjs`, `entities` untouched |
| C5 | Test: reuse existing `bun test` framework |
| C6 | Package entry: `./mcp` subpath export → `./dist/mcp/index.js` |

### Key Architecture Challenges

1. **MCP SDK + Bun compatibility**: The SDK is designed for Node.js; stdio transport and `process.stdin/stdout` behavior may differ under Bun.
2. **Best-effort partial rendering**: The core API throws on error. Partial rendering requires per-diagram-type error recovery strategies.
3. **Zod schema design for Mermaid code**: Mermaid code is free-form text; schema should be a simple `z.string()` with rich `.describe()` for AI Agent guidance.
4. **Subpath export**: Need `./mcp` export in `package.json` that works with both Bun dev mode and compiled `dist/` for npm consumers.

### Open Questions for Implementation

| ID | Question | Status |
|----|----------|--------|
| Q1 | Bun compatibility with `@modelcontextprotocol/server` stdio transport | Verify at implementation time |
| Q2 | Exact Zod v4 version needed by MCP SDK | Check peer dependencies |

---

## Proposed Architecture

### High-Level Module Structure

```
beautiful-mermaid/
├── src/
│   ├── index.ts                 # [EXISTING] Core API — unchanged
│   ├── ascii/                   # [EXISTING] ASCII renderer — unchanged
│   ├── ...                      # [EXISTING] Other modules — unchanged
│   └── mcp/                     # [NEW] MCP server module
│       ├── index.ts             # Re-exports: createServer, startServer
│       ├── server.ts            # McpServer factory, tool registration
│       ├── cli.ts               # Entry point: stdio server bootstrap
│       ├── tools/
│       │   ├── render-svg.ts    # render_mermaid_svg handler
│       │   ├── render-ascii.ts  # render_mermaid_ascii handler
│       │   ├── parse.ts         # parse_mermaid handler
│       │   └── list-types.ts    # list_diagram_types handler
│       ├── errors.ts            # Structured error formatting
│       └── warnings.ts          # CJK detection and warning generation
├── package.json                 # [MODIFIED] Add deps + exports + bin
├── tsconfig.json                # [EXISTING] May need adjustment for zod
└── tsup.config.ts               # [MODIFIED] Add mcp entry point
```

### Module Boundaries

```
┌─────────────────────────────────────────────────────────────┐
│                    src/mcp/  (NEW)                          │
│                                                             │
│  cli.ts         →  entry point, calls startServer()         │
│  server.ts      →  McpServer factory + tool registration    │
│  tools/*.ts     →  individual tool handlers (try-catch)      │
│  errors.ts      →  error → MCP content formatter            │
│  warnings.ts    →  CJK detection util                       │
│                                                             │
│  ───  depends on (one-way import)  ───                      │
│                                                             │
│  imports:                                                   │
│  • ../../index.ts     → renderMermaidSVG, renderMermaidASCII│
│  • ../../index.ts     → parseMermaid                       │
│  • ../../theme.ts     → THEMES                             │
│  • @modelcontextprotocol/server → McpServer, StdioTransport │
│  • zod               → inputSchema definitions             │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ imports (one-way dependency)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    src/  (EXISTING, UNCHANGED)               │
│                                                             │
│  index.ts         → renderMermaidSVG, renderMermaidASCII     │
│  parser.ts        → parseMermaid                           │
│  theme.ts         → THEMES, DiagramColors                  │
│  ascii/           → ASCII rendering pipeline               │
│  ...                                                        │
│                                                             │
│  ───  does NOT import from src/mcp/  ───                    │
└─────────────────────────────────────────────────────────────┘
```

**Dependency direction**: `src/mcp/` → `src/` (one-way). Core module has zero awareness of MCP.

### Dependency Graph

```
cli.ts
  └─→ server.ts
        ├─→ tools/render-svg.ts ──→ ../../index.ts (renderMermaidSVG)
        ├─→ tools/render-ascii.ts ─→ ../../index.ts (renderMermaidASCII)
        ├─→ tools/parse.ts ───────→ ../../index.ts (parseMermaid)
        └─→ tools/list-types.ts ──→ (self-contained, static data)
```

---

## Interface Contracts

### 1. `render_mermaid_svg`

| Aspect | Detail |
|--------|--------|
| **Input Schema** | `{ mermaid_code: z.string(), theme: z.string().optional(), bg: z.string().optional(), fg: z.string().optional(), transparent: z.boolean().optional() }` |
| **Normal Output** | `{ content: [{ type: 'text', text: svgString }] }` |
| **Error Output** | `{ content: [{ type: 'text', text: formattedError }], isError: true }` |
| **Theme Resolution** | If `theme` matches a key in `THEMES`, merge with user-provided `bg`/`fg` (user values take priority). If no theme, use `DEFAULTS` + user values. |

### 2. `render_mermaid_ascii`

| Aspect | Detail |
|--------|--------|
| **Input Schema** | `{ mermaid_code: z.string(), use_ascii: z.boolean().optional(), color_mode: z.enum(...).optional(), padding_x: z.number().optional(), padding_y: z.number().optional(), box_border_padding: z.number().optional() }` |
| **Normal Output** | `{ content: [{ type: 'text', text: asciiWithAnsi }] }` — output includes `warnings` in the text content as structured JSON suffix |
| **CJK Warning** | After rendering, scan output for CJK chars. If found: append `\n---\nWARNINGS: [...]` |
| **Error Output** | `{ content: [{ type: 'text', text: formattedError + partialAscii? }], isError: true }` |

### 3. `parse_mermaid`

| Aspect | Detail |
|--------|--------|
| **Input Schema** | `{ mermaid_code: z.string() }` |
| **Normal Output** | `{ content: [{ type: 'text', text: JSON.stringify(graph) }] }` |
| **Error Output** | `{ content: [{ type: 'text', text: JSON.stringify({ error, line?, column? }) }], isError: true }` |

### 4. `list_diagram_types`

| Aspect | Detail |
|--------|--------|
| **Input Schema** | `{}` (no params) |
| **Normal Output** | `{ content: [{ type: 'text', text: JSON.stringify(diagramTypes) }] }` |
| **Diagram Types Data** | Static array of 6 types: flowchart, state, sequence, class, er, xychart. Each with `name`, `description`, `example` |

---

## Data Flow

### Happy Path (render_mermaid_svg)

```
MCP Client
   │  JSON-RPC: { method: "tools/call", params: { name: "render_mermaid_svg", arguments: { mermaid_code: "graph TD; A-->B" } } }
   ▼
StdioServerTransport (deserialize)
   │
   ▼
McpServer (dispatch to registered handler)
   │
   ▼
tools/render-svg.ts handler
   │  1. Resolve theme (THEMES[name] ?? DEFAULTS)
   │  2. Merge user bg/fg over theme
   │  3. Try: renderMermaidSVG(mermaid_code, { bg, fg, transparent })
   │  4. Return: { content: [{ type: 'text', text: svg }] }
   │
   ▼
StdioServerTransport (serialize JSON-RPC response)
   │
   ▼
MCP Client (receive SVG string)
```

### Error Path (with best-effort)

```
tools/render-svg.ts handler
   │
   │  try { renderMermaidSVG(...) }
   │  catch (error) {
   │    // Attempt partial rendering by line
   │    const lines = mermaid_code.split('\n')
   │    for (let i = lines.length - 1; i > 0; i--) {
   │      try { 
   │        partial = renderMermaidSVG(lines.slice(0, i).join('\n'))
   │        break
   │      } catch {}
   │    }
   │    return {
   │      content: [{ type: 'text', text: formatError(error, partial) }],
   │      isError: true
   │    }
   │  }
   │
   ▼
MCP Client (receive structured error + possible partial SVG)
```

---

## Design Rationale

### Why This Architecture Satisfies Requirements

1. **One-way dependency**: `src/mcp/` depends on `src/`, never the reverse. This cleanly separates the MCP transport layer from the rendering engine, enabling independent evolution and making upstream contribution trivial (just a new directory + package.json changes).

2. **Subpath entry `./mcp`**: Users who only want the library don't pay the MCP SDK dependency cost. MCP users get a clean import path. Existing library API surface is untouched.

3. **tool-per-file pattern**: Each MCP tool is a single-file handler. Benefits:
   - Easy to test (unit-test one tool at a time)
   - Easy to add/remove tools
   - Each tool can fail independently

4. **Zod v4 schemas**: The MCP SDK uses Standard Schema (Zod v4). Rich `.describe()` annotations help AI Agents understand parameters without reading source code.

5. **Best-effort via line-stripping**: When rendering fails, iteratively remove lines from the end of the Mermaid code and retry. Simple, effective, and requires no changes to the core library.

### Why NOT More Complex

| Rejected Alternative | Why Rejected |
|---------------------|--------------|
| HTTP server transport | Requirements explicitly say stdio only |
| Shared state/cache between tools | No use case, adds complexity |
| Separate npm package | Would require version sync; sub-entry cleaner |
| Modify core API signatures | Breaks upstream compatibility |
| Deep parse error recovery | Complex, flaky; line-stripping covers >80% of cases |
| Event-driven or streaming output | Mermaid rendering is inherently batch (synchronous) |
| Plugin system for tools | Premature; only 4 tools, hardcoded registration is simpler |

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **Bun + MCP SDK incompatibility** | Medium | High — blocks entire project | Built-in fallback: run via Node if Bun fails. `tsup` already produces Node-compatible JS. |
| **Zod v4 version mismatch with MCP SDK** | Low | Medium | Pin version range, test early. MCP SDK migration docs confirm Zod v4 compatibility. |
| **Best-effort partial rendering fails silently** | Medium | Low | Partial rendering is best-effort; if it fails, just return error. No critical path dependency. |
| **Subpath export breaks existing consumers** | Very Low | High | Verify `exports` field doesn't affect existing `"."` entry. All existing imports use `"beautiful-mermaid"` not `"beautiful-mermaid/mcp"`. |
| **CJK warning false positives** | Low | Low | CJK detection regex is straightforward; edge cases (emoji, symbols) produce acceptable false positives. |
| **tsup multi-entry build complexity** | Low | Medium | tsup supports multiple entries natively; minimal config change needed. |

---

## Verification Criteria

### Architecture-Level

| Criterion | How to Verify |
|-----------|---------------|
| MCP tools respond to JSON-RPC calls | Write integration test: start server, send `tools/list` and `tools/call`, verify responses |
| Core API exports unchanged | Run existing test suite (`bun test`) — all must pass without modification |
| No circular imports | `tsc --noEmit` or bundler analysis |
| Subpath `./mcp` resolves correctly | `import { createServer } from 'beautiful-mermaid/mcp'` in a test consumer |

### Implementation-Level

| Criterion | How to Verify |
|-----------|---------------|
| SVG tool returns valid SVG for all 6 diagram types | Test with sample inputs for each type |
| ASCII tool returns valid output | Test with sample inputs; verify no empty output |
| Parse tool returns valid JSON | Test with known-good Mermaid code; verify JSON structure |
| List tool returns correct data | Test returns 6 types with expected shape |
| Error on invalid input returns structured error | Test with garbage input; verify `isError: true` and descriptive message |
| Best-effort: error on multi-line diagram returns partial | Test with valid prefix + invalid suffix; verify partial SVG present |
| CJK warning fires | Test with Chinese characters in node labels; verify warning in output |

---

## Implementation Order

Recommended sequence for the coder:

| Phase | Tasks | Dependency |
|-------|-------|------------|
| **Phase 0** | Install deps: `@modelcontextprotocol/server`, `zod`. Verify Bun compatibility. | None |
| **Phase 1** | Create `src/mcp/tools/list-types.ts` (simplest tool, no core dependency). Test in isolation. | Phase 0 |
| **Phase 2** | Create `src/mcp/server.ts` with McpServer + tool registration. Wire list-types. Test stdio transport. | Phase 1 |
| **Phase 3** | Create `src/mcp/tools/parse.ts` + `src/mcp/errors.ts`. Test error formatting. | Phase 2 |
| **Phase 4** | Create `src/mcp/tools/render-svg.ts`. Test happy path + error + best-effort. | Phase 2 |
| **Phase 5** | Create `src/mcp/tools/render-ascii.ts` + `src/mcp/warnings.ts`. Test CJK warning. | Phase 2 |
| **Phase 6** | Create `src/mcp/cli.ts` entry point. Update `package.json` (exports, bin). Update `tsup.config.ts`. | Phase 2-5 |
| **Phase 7** | Integration test: Claude Desktop or MCP Inspector. Verify all 4 tools end-to-end. | Phase 6 |

---

## Handoff to Coder

### Must-Read Before Implementation

1. `REQUIREMENTS.md` — full requirements with scope boundaries
2. `src/index.ts` — core API exports: `renderMermaidSVG`, `renderMermaidASCII`, `parseMermaid`
3. `src/theme.ts` — `THEMES` object, `DEFAULTS`, `DiagramColors` type
4. `src/ascii/index.ts` — `AsciiRenderOptions` type, `renderMermaidASCII` signature
5. MCP SDK docs: `server.registerTool(name, { description, inputSchema }, handler)` pattern

### Constraints (DO NOT VIOLATE)

- ❌ Do NOT modify any existing file in `src/` outside of `src/mcp/`
- ❌ Do NOT change `src/index.ts` public API signatures
- ❌ Do NOT add circular imports between `src/mcp/` and `src/`
- ❌ Do NOT implement HTTP transport
- ❌ Do NOT implement CJK width correction — only detection + warning
- ❌ Do NOT expose more than 5 params for SVG tool or 6 for ASCII tool

### Package.json Changes (APPROVED)

```jsonc
// ADD to "dependencies":
"@modelcontextprotocol/server": "^1.x",  // exact version TBD
"zod": "^4.x",                           // exact version TBD

// ADD to "exports":
"./mcp": {
  "bun": "./src/mcp/index.ts",
  "import": "./dist/mcp/index.js",
  "types": "./dist/mcp/index.d.ts"
},

// ADD to "bin":
"beautiful-mermaid": "./dist/mcp/cli.js"
```

### tsup.config.ts Changes (required)

Add `src/mcp/cli.ts` as an additional entry point alongside the existing configuration.

### Deferred Decisions

| ID | Question | Who Decides |
|----|----------|-------------|
| D1 | Exact `theme`, `bg`, `fg` interaction semantics (merge strategy) | Coder implements sensible default (user values override theme values) |
| D2 | CJK detection regex (which Unicode ranges to scan) | Coder implements `/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/` |
| D3 | Best-effort partial rendering: how many lines to strip | Coder starts with iterative line-stripping from end |
| D4 | Error message format for MCP content | Coder uses `JSON.stringify({ error, line?, column?, partial? })` |

### Client Configuration Example (for testing)

```json
{
  "mcpServers": {
    "beautiful-mermaid": {
      "command": "bun",
      "args": ["run", "src/mcp/cli.ts"]
    }
  }
}
```
