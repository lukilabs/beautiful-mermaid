#!/usr/bin/env bun

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"
import { renderMermaidSVG, renderMermaidASCII, THEMES } from "beautiful-mermaid"
import type { RenderOptions } from "beautiful-mermaid"
import { writeFile, mkdir } from "node:fs/promises"
import { dirname, resolve, extname } from "node:path"

const themeNames = Object.keys(THEMES)

const server = new McpServer({
  name: "beautiful-mermaid",
  version: "1.0.0",
})

server.tool(
  "render_mermaid",
  "Render a Mermaid diagram as SVG, PNG, or ASCII. Supports flowcharts, sequence diagrams, class diagrams, ER diagrams, state diagrams, and XY charts.",
  {
    source: z
      .string()
      .describe("Mermaid diagram source text (e.g. 'graph TD\\n  A --> B')"),
    format: z
      .enum(["svg", "png", "ascii"])
      .optional()
      .describe("Output format: 'svg' (default), 'png' (base64-encoded), or 'ascii' (text art)"),
    saveTo: z
      .string()
      .optional()
      .describe("Absolute file path to save the output (e.g. '/tmp/diagram.svg'). Extension is auto-appended from format if missing."),
    theme: z
      .enum(themeNames as [string, ...string[]])
      .optional()
      .describe(
        `Built-in theme name. Available: ${themeNames.join(", ")}`
      ),
    config: z
      .object({
        bg: z.string().optional().describe("Background color hex"),
        fg: z.string().optional().describe("Foreground/text color hex"),
        line: z.string().optional().describe("Edge/connector color hex"),
        accent: z.string().optional().describe("Arrow heads, highlights color hex"),
        muted: z.string().optional().describe("Secondary text, edge labels color hex"),
        surface: z.string().optional().describe("Node/box fill tint color hex"),
        border: z.string().optional().describe("Node/group stroke color hex"),
        font: z.string().optional().describe("Font family (default: 'Inter')"),
        padding: z.number().optional().describe("Canvas padding in px (default: 40)"),
        nodeSpacing: z.number().optional().describe("Horizontal spacing between nodes (default: 24)"),
        layerSpacing: z.number().optional().describe("Vertical spacing between layers (default: 40)"),
        componentSpacing: z.number().optional().describe("Spacing between disconnected components"),
        transparent: z.boolean().optional().describe("Transparent background (default: false)"),
        interactive: z.boolean().optional().describe("Hover tooltips on xychart data points (default: false)"),
      })
      .optional()
      .describe("Render config overrides — applied on top of the selected theme"),
  },
  async ({ source, format = "svg", theme, config, saveTo }) => {
    try {
      const options: RenderOptions = {}

      if (theme) {
        const themeColors = THEMES[theme]
        if (themeColors) Object.assign(options, themeColors)
      }

      if (config) Object.assign(options, config)

      const ext = format === "png" ? ".png" : format === "ascii" ? ".txt" : ".svg"

      const filePath = saveTo
        ? extname(saveTo) ? resolve(saveTo) : resolve(saveTo + ext)
        : undefined

      if (format === "ascii") {
        const ascii = renderMermaidASCII(source)
        if (filePath) {
          await mkdir(dirname(filePath), { recursive: true })
          await writeFile(filePath, ascii, "utf-8")
          return { content: [{ type: "text", text: `Saved ASCII diagram to ${filePath}` }] }
        }
        return { content: [{ type: "text", text: ascii }] }
      }

      const svg = renderMermaidSVG(source, options)

      if (format === "png") {
        const { svgToPng } = await import("./png.ts")
        const base64 = await svgToPng(svg)
        if (filePath) {
          await mkdir(dirname(filePath), { recursive: true })
          await writeFile(filePath, Buffer.from(base64, "base64"))
          return { content: [{ type: "text", text: `Saved PNG to ${filePath}` }] }
        }
        return { content: [{ type: "image", data: base64, mimeType: "image/png" }] }
      }

      if (filePath) {
        await mkdir(dirname(filePath), { recursive: true })
        await writeFile(filePath, svg, "utf-8")
        return { content: [{ type: "text", text: `Saved SVG to ${filePath}` }] }
      }

      return { content: [{ type: "text", text: svg }] }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return {
        content: [{ type: "text", text: `Error rendering diagram: ${message}` }],
        isError: true,
      }
    }
  }
)

const transport = new StdioServerTransport()
await server.connect(transport)
