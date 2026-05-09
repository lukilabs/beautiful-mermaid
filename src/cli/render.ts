import { readFile, writeFile } from 'node:fs/promises'
import { renderMermaidASCII, diagramColorsToAsciiTheme } from '../ascii/index.ts'
import type { AsciiRenderOptions } from '../ascii/index.ts'
import { renderMermaidSVG } from '../index.ts'
import { THEMES } from '../theme.ts'
import type { DiagramColors } from '../theme.ts'
import type { RenderArgs } from './parse-args.ts'

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

  let text: string

  if (args.input !== undefined) {
    text = await readFile(args.input, 'utf-8')
  } else if (stdinContent !== undefined) {
    text = stdinContent
  } else {
    if (process.stdin.isTTY) {
      throw new Error('No input file specified and stdin is a terminal. Pipe a diagram or pass a file path.')
    }
    text = await readStdin()
  }

  text = text.trim()
  if (text.length === 0) {
    throw new Error('Empty input — provide a Mermaid diagram via file or stdin')
  }

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

  if (args.ascii) {
    // Use plain text by default (respects terminal colors on any background).
    // Only apply ANSI colors when the user explicitly passes --theme.
    const asciiOpts: AsciiRenderOptions = themeColors
      ? { colorMode: 'auto', theme: diagramColorsToAsciiTheme(themeColors) }
      : { colorMode: 'none' }
    const ascii = renderMermaidASCII(text, asciiOpts)
    out.write(ascii + '\n')
  }

  if (args.svg && args.output) {
    const svg = renderMermaidSVG(text, themeColors ?? {})
    await writeFile(args.output, svg, 'utf-8')
  }
}

// ============================================================================
// Helpers
// ============================================================================

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
