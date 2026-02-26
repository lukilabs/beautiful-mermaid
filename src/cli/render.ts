// ============================================================================
// CLI render command — reads Mermaid input, renders ASCII and/or SVG.
//
// Orchestrates:
//   1. Input reading (file, stdin, or test string)
//   2. Theme resolution (lookup in THEMES, error on unknown)
//   3. ASCII rendering → stdout
//   4. SVG rendering → output file
// ============================================================================

import { readFile, writeFile } from 'node:fs/promises'
import { renderMermaidASCII } from '../ascii/index.ts'
import { renderMermaidSVG } from '../index.ts'
import { THEMES } from '../theme.ts'
import type { RenderArgs } from './parse-args.ts'
import type { DiagramColors } from '../theme.ts'

// ============================================================================
// Types
// ============================================================================

export interface Writable {
  write: (s: string) => void
}

// ============================================================================
// Main entry point
// ============================================================================

/**
 * Execute the `render` command.
 *
 * @param args - Parsed CLI arguments (command === 'render')
 * @param stdout - Writable stream for ASCII output (defaults to process.stdout)
 * @param stdinContent - Pre-read stdin content for testing; if undefined and
 *   no file input, reads from process.stdin at runtime
 */
export async function runRender(
  args: RenderArgs,
  stdout?: Writable,
  stdinContent?: string,
): Promise<void> {
  const out = stdout ?? process.stdout

  // --------------------------------------------------------------------------
  // 1. Read input
  // --------------------------------------------------------------------------
  let text: string

  if (args.input !== undefined) {
    text = await readFile(args.input, 'utf-8')
  } else if (stdinContent !== undefined) {
    text = stdinContent
  } else {
    text = await readStdin()
  }

  // --------------------------------------------------------------------------
  // 2. Validate — reject empty input
  // --------------------------------------------------------------------------
  text = text.trim()
  if (text.length === 0) {
    throw new Error('Empty input — provide a Mermaid diagram via file or stdin')
  }

  // --------------------------------------------------------------------------
  // 3. Resolve theme
  // --------------------------------------------------------------------------
  let themeColors: DiagramColors | undefined

  if (args.theme !== undefined) {
    themeColors = THEMES[args.theme]
    if (themeColors === undefined) {
      const available = Object.keys(THEMES).join(', ')
      throw new Error(
        `Unknown theme: "${args.theme}". Available themes: ${available}`,
      )
    }
  }

  // --------------------------------------------------------------------------
  // 4. Render ASCII → stdout
  // --------------------------------------------------------------------------
  if (args.ascii) {
    const ascii = renderMermaidASCII(text, { colorMode: 'none' })
    out.write(ascii)
  }

  // --------------------------------------------------------------------------
  // 5. Render SVG → output file
  // --------------------------------------------------------------------------
  if (args.svg && args.output) {
    const svg = renderMermaidSVG(text, themeColors ?? {})
    await writeFile(args.output, svg, 'utf-8')
  }
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Read all of stdin as a UTF-8 string.
 * Collects chunks until the stream ends.
 */
async function readStdin(): Promise<string> {
  const chunks: string[] = []
  const stdin = process.stdin
  stdin.setEncoding('utf-8')

  return new Promise((resolve, reject) => {
    stdin.on('data', (chunk: string) => chunks.push(chunk))
    stdin.on('end', () => resolve(chunks.join('')))
    stdin.on('error', reject)
  })
}
