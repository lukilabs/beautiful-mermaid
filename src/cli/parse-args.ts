// ============================================================================
// Types
// ============================================================================

export interface RenderArgs {
  command: 'render'
  input: string | undefined
  ascii: boolean
  svg: boolean
  output: string | undefined
  theme: string | undefined
}

export interface SimpleCommand {
  command: 'themes' | 'help' | 'version'
}

export type CliArgs = RenderArgs | SimpleCommand

// ============================================================================
// Parser
// ============================================================================

export function parseArgs(argv: string[]): CliArgs {
  // Empty args → help
  if (argv.length === 0) {
    return { command: 'help' }
  }

  const first = argv[0]!

  // Top-level flags (before any command)
  if (first === '--help' || first === '-h') {
    return { command: 'help' }
  }
  if (first === '--version' || first === '-v') {
    return { command: 'version' }
  }

  // Simple commands
  if (first === 'themes') {
    return { command: 'themes' }
  }

  // Render command
  if (first === 'render') {
    return parseRender(argv.slice(1))
  }

  throw new Error(`Unknown command: ${first}`)
}

// ============================================================================
// render sub-parser
// ============================================================================

function parseRender(args: string[]): RenderArgs {
  let input: string | undefined
  let ascii = false
  let svg = false
  let output: string | undefined
  let theme: string | undefined

  let i = 0
  while (i < args.length) {
    const arg = args[i]!

    if (arg === '--ascii') {
      ascii = true
      i++
    } else if (arg === '--svg') {
      svg = true
      i++
    } else if (arg === '-o' || arg === '--output') {
      if (i + 1 >= args.length) throw new Error('-o requires a file path')
      output = args[i + 1]
      i += 2
    } else if (arg === '--theme') {
      if (i + 1 >= args.length) throw new Error('--theme requires a theme name')
      theme = args[i + 1]
      i += 2
    } else if (!arg.startsWith('-')) {
      // Positional argument = input file
      if (input !== undefined) {
        throw new Error(`Unexpected argument: ${arg} (input file already set to "${input}")`)
      }
      input = arg
      i++
    } else {
      throw new Error(`Unknown flag: ${arg}`)
    }
  }

  // Validation
  if (!ascii && !svg) {
    throw new Error('Specify --ascii and/or --svg -o <path>')
  }

  if (svg && output === undefined) {
    throw new Error('--svg requires -o <path>')
  }

  return { command: 'render', input, ascii, svg, output, theme }
}
