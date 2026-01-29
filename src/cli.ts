// ============================================================================
// beautiful-mermaid CLI
//
// Render Mermaid diagrams to ASCII or SVG from the command line.
// Designed for AI agents working in terminals.
//
// Usage:
//   bmmdc diagram.mmd              # ASCII output
//   echo "graph TD; A-->B" | bmmdc # Pipe input
//   bmmdc --svg < diagram.mmd      # SVG output
// ============================================================================

import { renderMermaid, renderMermaidAscii, THEMES } from './index.ts'
import type { ThemeName } from './theme.ts'

const VERSION = '0.1.2'

// ============================================================================
// Argument parsing
// ============================================================================

interface CliArgs {
  file?: string
  svg: boolean
  output?: string
  asciiOnly: boolean
  paddingX: number
  paddingY: number
  theme?: string
  bg?: string
  fg?: string
  transparent: boolean
  showThemes: boolean
  help: boolean
  version: boolean
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    svg: false,
    asciiOnly: false,
    paddingX: 5,
    paddingY: 5,
    transparent: false,
    showThemes: false,
    help: false,
    version: false,
  }

  let i = 0
  while (i < argv.length) {
    const arg = argv[i]!

    switch (arg) {
      case '-h':
      case '--help':
        args.help = true
        break

      case '-v':
      case '--version':
        args.version = true
        break

      case '-s':
      case '--svg':
        args.svg = true
        break

      case '-o':
      case '--output':
        args.output = argv[++i]
        if (!args.output) {
          console.error('Error: --output requires a file path')
          process.exit(1)
        }
        break

      case '-t':
      case '--theme':
        args.theme = argv[++i]
        if (!args.theme) {
          console.error('Error: --theme requires a theme name')
          process.exit(1)
        }
        break

      case '--bg':
        args.bg = argv[++i]
        if (!args.bg) {
          console.error('Error: --bg requires a color value')
          process.exit(1)
        }
        break

      case '--fg':
        args.fg = argv[++i]
        if (!args.fg) {
          console.error('Error: --fg requires a color value')
          process.exit(1)
        }
        break

      case '--transparent':
        args.transparent = true
        break

      case '--ascii-only':
        args.asciiOnly = true
        break

      case '--padding-x':
        args.paddingX = parseInt(argv[++i] ?? '5', 10)
        break

      case '--padding-y':
        args.paddingY = parseInt(argv[++i] ?? '5', 10)
        break

      case '--themes':
        args.showThemes = true
        break

      default:
        if (arg.startsWith('-')) {
          console.error(`Error: Unknown option: ${arg}`)
          console.error('Run "bmmdc --help" for usage information')
          process.exit(1)
        }
        args.file = arg
        break
    }
    i++
  }

  return args
}

// ============================================================================
// Help and info
// ============================================================================

function showHelp(): void {
  console.log(`
bmmdc - Render Mermaid diagrams to ASCII or SVG

Usage:
  bmmdc [options] [file]

Arguments:
  file                    Input file path (reads from stdin if omitted)

Output Options:
  -s, --svg               Output SVG instead of ASCII
  -o, --output <file>     Write output to file instead of stdout

ASCII Options:
  --ascii-only            Use pure ASCII characters (+,-,|) instead of Unicode
  --padding-x <n>         Horizontal spacing between nodes (default: 5)
  --padding-y <n>         Vertical spacing between nodes (default: 5)

SVG Options:
  -t, --theme <name>      Use a built-in theme (default: none)
  --bg <color>            Background color (hex, e.g. #1a1b26)
  --fg <color>            Foreground color (hex, e.g. #a9b1d6)
  --transparent           Render with transparent background

Info:
  --themes                List available themes
  -h, --help              Show this help message
  -v, --version           Show version number

Examples:
  bmmdc diagram.mmd                      Render file to ASCII
  echo "graph TD; A-->B" | bmmdc         Render piped input to ASCII
  bmmdc --svg -o out.svg < in.mmd        Render to SVG file
  bmmdc --theme tokyo-night --svg        Render with theme to SVG
  bmmdc --themes                         List available themes
`.trim())
}

function showThemes(): void {
  console.log('Available themes:\n')
  for (const [name, theme] of Object.entries(THEMES)) {
    console.log(`  ${name.padEnd(20)} bg: ${theme.bg}  fg: ${theme.fg}`)
  }
  console.log(`\nUsage: bmmdc --theme <name> --svg < diagram.mmd`)
}

// ============================================================================
// Input/Output
// ============================================================================

async function readInput(filePath?: string): Promise<string> {
  if (filePath) {
    const file = Bun.file(filePath)
    if (!await file.exists()) {
      console.error(`Error: File not found: ${filePath}`)
      process.exit(3)
    }
    return await file.text()
  }

  // Check if stdin is a TTY (no piped input)
  if (process.stdin.isTTY) {
    showHelp()
    process.exit(1)
  }

  // Read from stdin using Bun
  return await Bun.stdin.text()
}

async function writeOutput(outputPath: string | undefined, content: string): Promise<void> {
  if (outputPath) {
    await Bun.write(outputPath, content)
  } else {
    await Bun.write(Bun.stdout, content)
    if (!content.endsWith('\n')) {
      await Bun.write(Bun.stdout, '\n')
    }
  }
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))

  if (args.help) {
    showHelp()
    process.exit(0)
  }

  if (args.version) {
    console.log(VERSION)
    process.exit(0)
  }

  if (args.showThemes) {
    showThemes()
    process.exit(0)
  }

  const input = await readInput(args.file)

  if (!input.trim()) {
    console.error('Error: Empty input')
    process.exit(1)
  }

  try {
    if (args.svg) {
      const themeColors = args.theme ? THEMES[args.theme as ThemeName] : undefined
      if (args.theme && !themeColors) {
        console.error(`Error: Unknown theme "${args.theme}"`)
        console.error('Run "bmmdc --themes" to see available themes')
        process.exit(1)
      }

      const svg = await renderMermaid(input, {
        bg: args.bg ?? themeColors?.bg,
        fg: args.fg ?? themeColors?.fg,
        line: themeColors?.line,
        accent: themeColors?.accent,
        muted: themeColors?.muted,
        surface: themeColors?.surface,
        border: themeColors?.border,
        transparent: args.transparent,
      })

      await writeOutput(args.output, svg)
    } else {
      const ascii = renderMermaidAscii(input, {
        useAscii: args.asciiOnly,
        paddingX: args.paddingX,
        paddingY: args.paddingY,
      })

      await writeOutput(args.output, ascii)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`Error: ${message}`)
    process.exit(2)
  }
}

main()
