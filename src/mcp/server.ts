// ============================================================================
// MCP server factory — creates and configures McpServer with all 4 tools
//
// Provides createServer() for programmatic use and startServer()
// for the CLI entry point (stdio transport).
// ============================================================================

import { McpServer, StdioServerTransport } from '@modelcontextprotocol/server'
import { z } from 'zod'

import { handleRenderSVG } from './tools/render-svg.ts'
import { handleRenderAscii } from './tools/render-ascii.ts'
import { handleParseMermaid } from './tools/parse.ts'
import { handleListDiagramTypes } from './tools/list-types.ts'

// ============================================================================
// Server info
// ============================================================================

const SERVER_INFO = {
  name: 'beautiful-mermaid',
  version: '1.1.3',
} as const

// ============================================================================
// Zod schemas for tool inputs
// ============================================================================

const listDiagramTypesSchema = z.object({})

const parseMermaidSchema = z.object({
  mermaid_code: z.string().describe(
    'Mermaid diagram source code to parse into a JSON graph structure.'
  ),
})

const renderSVGSchema = z.object({
  mermaid_code: z.string().describe(
    'Mermaid diagram source code to render as SVG.'
  ),
  theme_name: z.string().optional().describe(
    'Well-known theme name. Supported: tokyo-night, catppuccin-mocha, nord, dracula, github-dark, github-light, zinc-light, zinc-dark, and others. Look up from the THEMES registry.'
  ),
  bg: z.string().optional().describe(
    'Background color as hex (e.g. "#1a1b26"). Overrides theme background.'
  ),
  fg: z.string().optional().describe(
    'Foreground/text color as hex (e.g. "#a9b1d6"). Overrides theme foreground.'
  ),
  transparent: z.boolean().optional().describe(
    'Render with transparent background. Default: false.'
  ),
})

const renderAsciiSchema = z.object({
  mermaid_code: z.string().describe(
    'Mermaid diagram source code to render as ASCII/Unicode art.'
  ),
  use_ascii: z.boolean().optional().describe(
    'Use pure ASCII characters (+, -, |, >) instead of Unicode box-drawing (┌, ─, │, ►). Default: false.'
  ),
  color_mode: z.enum(['none', 'auto', 'ansi16', 'ansi256', 'truecolor', 'html']).optional().describe(
    'Color output mode. "auto" detects terminal capabilities. "none" produces plain text. Default: "auto".'
  ),
  padding: z.number().int().min(0).max(20).optional().describe(
    'Padding around nodes (applied to both X and Y). Default: 5.'
  ),
})

// ============================================================================
// Factory
// ============================================================================

/**
 * Create a configured McpServer with all 4 tools registered.
 * Does not connect to transport — caller must call server.connect().
 */
export function createServer(): McpServer {
  const server = new McpServer(SERVER_INFO)

  // 1. list_diagram_types — no parameters
  server.registerTool(
    'list_diagram_types',
    {
      description: 'List all supported Mermaid diagram types with descriptions and examples.',
      inputSchema: listDiagramTypesSchema,
    },
    () => handleListDiagramTypes(),
  )

  // 2. parse_mermaid — parse to JSON graph
  server.registerTool(
    'parse_mermaid',
    {
      description: 'Parse Mermaid diagram source code into a JSON graph structure representing nodes, edges, subgraphs, and styling.',
      inputSchema: parseMermaidSchema,
    },
    (args) => handleParseMermaid(args),
  )

  // 3. render_mermaid_svg — render to SVG with theme support
  server.registerTool(
    'render_mermaid_svg',
    {
      description: 'Render a Mermaid diagram to a beautiful, themeable SVG string. Supports flowcharts, state diagrams, sequence diagrams, class diagrams, ER diagrams, and XY charts.',
      inputSchema: renderSVGSchema,
    },
    (args) => handleRenderSVG(args),
  )

  // 4. render_mermaid_ascii — render to ASCII/Unicode art
  server.registerTool(
    'render_mermaid_ascii',
    {
      description: 'Render a Mermaid diagram to ASCII or Unicode box-drawing art for terminal display. Detects CJK characters and emits warnings.',
      inputSchema: renderAsciiSchema,
    },
    (args) => handleRenderAscii(args),
  )

  return server
}

// ============================================================================
// Stdio launcher
// ============================================================================

/**
 * Create a server and connect it to the stdio transport.
 * This is the entry point for the `beautiful-mermaid` CLI command.
 *
 * Handles SIGINT/SIGTERM for graceful shutdown.
 */
export async function startServer(): Promise<void> {
  const server = createServer()
  const transport = new StdioServerTransport()

  // Graceful shutdown on signals
  const shutdown = async () => {
    await server.close()
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  await server.connect(transport)
}
