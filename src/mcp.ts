#!/usr/bin/env node
// ============================================================================
// beautiful-mermaid — MCP (Model Context Protocol) server
//
// Exposes beautiful-mermaid's rendering capabilities as MCP tools,
// allowing AI agents to generate diagrams via structured tool calls.
//
// Usage (in MCP config):
//   { "command": "npx", "args": ["-y", "beautiful-mermaid", "--mcp"] }
//
// Tools:
//   render_svg   — Render Mermaid text to SVG string
//   render_ascii — Render Mermaid text to ASCII/Unicode art
//   list_themes  — List available built-in themes
//   parse        — Parse Mermaid text to structured graph JSON
// ============================================================================

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod/v4'
import { renderMermaidSVG } from './index.ts'
import { renderMermaidASCII } from './ascii/index.ts'
import { parseMermaid } from './parser.ts'
import { THEMES } from './theme.ts'
import type { RenderOptions } from './types.ts'
import { writeFileSync } from 'node:fs'

// ============================================================================
// Server setup
// ============================================================================

const server = new McpServer({
  name: 'beautiful-mermaid',
  version: '1.0.2',
})

// ============================================================================
// Tool: render_svg
// ============================================================================

server.tool(
  'render_svg',
  'Render a Mermaid diagram to an SVG string. Supports flowcharts, state diagrams, sequence diagrams, class diagrams, and ER diagrams. Returns the SVG markup as text.',
  {
    code: z.string().describe('Mermaid diagram source code'),
    theme: z.string().optional().describe('Built-in theme name (e.g. "tokyo-night", "github-dark"). Use list_themes to see all options.'),
    bg: z.string().optional().describe('Background color (hex). Overrides theme.'),
    fg: z.string().optional().describe('Foreground color (hex). Overrides theme.'),
    transparent: z.boolean().optional().describe('Render with transparent background. Default: false'),
    outputPath: z.string().optional().describe('Optional file path to save the SVG to. If provided, saves to file and returns the path.'),
  },
  async (args) => {
    try {
      const options: RenderOptions = {}

      // Apply theme colors first, then let explicit overrides win
      if (args.theme) {
        const themeColors = THEMES[args.theme]
        if (!themeColors) {
          const available = Object.keys(THEMES).join(', ')
          return {
            content: [{ type: 'text', text: `Error: Unknown theme "${args.theme}". Available themes: ${available}` }],
            isError: true,
          }
        }
        Object.assign(options, themeColors)
      }

      if (args.bg) options.bg = args.bg
      if (args.fg) options.fg = args.fg
      if (args.transparent !== undefined) options.transparent = args.transparent

      const svg = renderMermaidSVG(args.code, options)

      if (args.outputPath) {
        writeFileSync(args.outputPath, svg, 'utf-8')
        return { content: [{ type: 'text', text: `SVG saved to ${args.outputPath} (${svg.length} bytes)` }] }
      }

      return { content: [{ type: 'text', text: svg }] }
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      }
    }
  },
)

// ============================================================================
// Tool: render_ascii
// ============================================================================

server.tool(
  'render_ascii',
  'Render a Mermaid diagram to ASCII or Unicode box-drawing art. Ideal for terminal display or embedding in text contexts where AI agents can read the diagram directly.',
  {
    code: z.string().describe('Mermaid diagram source code'),
    useAscii: z.boolean().optional().describe('Use ASCII chars (+,-,|,>) instead of Unicode box-drawing. Default: false (Unicode)'),
  },
  async (args) => {
    try {
      const result = renderMermaidASCII(args.code, {
        useAscii: args.useAscii,
        colorMode: 'none',
      })

      return { content: [{ type: 'text', text: result }] }
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      }
    }
  },
)

// ============================================================================
// Tool: list_themes
// ============================================================================

server.tool(
  'list_themes',
  'List all available built-in themes with their color configurations.',
  {},
  async () => {
    const lines: string[] = []
    for (const [name, colors] of Object.entries(THEMES)) {
      const parts = [`bg: ${colors.bg}`, `fg: ${colors.fg}`]
      if (colors.line) parts.push(`line: ${colors.line}`)
      if (colors.accent) parts.push(`accent: ${colors.accent}`)
      if (colors.muted) parts.push(`muted: ${colors.muted}`)
      lines.push(`${name}: ${parts.join(', ')}`)
    }
    return { content: [{ type: 'text', text: lines.join('\n') }] }
  },
)

// ============================================================================
// Tool: parse
// ============================================================================

server.tool(
  'parse',
  'Parse Mermaid diagram source into a structured graph object. Returns nodes, edges, subgraphs, and metadata as JSON. Only supports flowchart/state diagrams.',
  {
    code: z.string().describe('Mermaid diagram source code (flowchart or state diagram)'),
  },
  async (args) => {
    try {
      const graph = parseMermaid(args.code)
      // Convert Map fields to plain objects for JSON serialization
      const serializable = {
        direction: graph.direction,
        nodes: Object.fromEntries(graph.nodes),
        edges: graph.edges,
        subgraphs: graph.subgraphs,
        classDefs: Object.fromEntries(graph.classDefs),
        classAssignments: Object.fromEntries(graph.classAssignments),
        nodeStyles: Object.fromEntries(graph.nodeStyles),
      }
      return { content: [{ type: 'text', text: JSON.stringify(serializable, null, 2) }] }
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      }
    }
  },
)

// ============================================================================
// Start server
// ============================================================================

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch((error) => {
  process.stderr.write(`Fatal: ${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
})
