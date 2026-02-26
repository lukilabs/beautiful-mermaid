/**
 * Tests for CLI argument parsing.
 *
 * Covers:
 * - render command: file input, stdin, --ascii, --svg, -o, --theme
 * - themes command
 * - help / version flags
 * - validation errors (missing flags, missing -o, unknown command)
 */
import { describe, it, expect } from 'bun:test'
import { parseArgs } from '../cli/parse-args.ts'
import type { RenderArgs, SimpleCommand } from '../cli/parse-args.ts'

// ============================================================================
// render command — happy paths
// ============================================================================

describe('parseArgs – render with --ascii', () => {
  it('parses render <file> --ascii', () => {
    const result = parseArgs(['render', 'diagram.mmd', '--ascii'])
    expect(result).toEqual({
      command: 'render',
      input: 'diagram.mmd',
      ascii: true,
      svg: false,
      output: undefined,
      theme: undefined,
    } satisfies RenderArgs)
  })
})

describe('parseArgs – render with --svg and -o', () => {
  it('parses render <file> --svg -o <path>', () => {
    const result = parseArgs(['render', 'diagram.mmd', '--svg', '-o', 'out.svg'])
    expect(result).toEqual({
      command: 'render',
      input: 'diagram.mmd',
      ascii: false,
      svg: true,
      output: 'out.svg',
      theme: undefined,
    } satisfies RenderArgs)
  })
})

describe('parseArgs – render with both --ascii and --svg', () => {
  it('parses render <file> --ascii --svg -o <path>', () => {
    const result = parseArgs(['render', 'diagram.mmd', '--ascii', '--svg', '-o', 'out.svg'])
    expect(result).toEqual({
      command: 'render',
      input: 'diagram.mmd',
      ascii: true,
      svg: true,
      output: 'out.svg',
      theme: undefined,
    } satisfies RenderArgs)
  })
})

describe('parseArgs – render with --theme', () => {
  it('parses render <file> --svg -o out.svg --theme tokyo-night', () => {
    const result = parseArgs(['render', 'diagram.mmd', '--svg', '-o', 'out.svg', '--theme', 'tokyo-night'])
    expect(result).toEqual({
      command: 'render',
      input: 'diagram.mmd',
      ascii: false,
      svg: true,
      output: 'out.svg',
      theme: 'tokyo-night',
    } satisfies RenderArgs)
  })
})

describe('parseArgs – render from stdin (no file argument)', () => {
  it('parses render --ascii with no file', () => {
    const result = parseArgs(['render', '--ascii'])
    expect(result).toEqual({
      command: 'render',
      input: undefined,
      ascii: true,
      svg: false,
      output: undefined,
      theme: undefined,
    } satisfies RenderArgs)
  })

  it('parses render --svg -o out.svg with no file', () => {
    const result = parseArgs(['render', '--svg', '-o', 'out.svg'])
    expect(result).toEqual({
      command: 'render',
      input: undefined,
      ascii: false,
      svg: true,
      output: 'out.svg',
      theme: undefined,
    } satisfies RenderArgs)
  })
})

// ============================================================================
// simple commands
// ============================================================================

describe('parseArgs – themes command', () => {
  it('parses "themes"', () => {
    const result = parseArgs(['themes'])
    expect(result).toEqual({ command: 'themes' } satisfies SimpleCommand)
  })
})

describe('parseArgs – help', () => {
  it('returns help for --help', () => {
    const result = parseArgs(['--help'])
    expect(result).toEqual({ command: 'help' } satisfies SimpleCommand)
  })

  it('returns help for -h', () => {
    const result = parseArgs(['-h'])
    expect(result).toEqual({ command: 'help' } satisfies SimpleCommand)
  })

  it('returns help for empty args', () => {
    const result = parseArgs([])
    expect(result).toEqual({ command: 'help' } satisfies SimpleCommand)
  })
})

describe('parseArgs – version', () => {
  it('returns version for --version', () => {
    const result = parseArgs(['--version'])
    expect(result).toEqual({ command: 'version' } satisfies SimpleCommand)
  })

  it('returns version for -v', () => {
    const result = parseArgs(['-v'])
    expect(result).toEqual({ command: 'version' } satisfies SimpleCommand)
  })
})

describe('parseArgs – render with --output long form', () => {
  it('parses --output the same as -o', () => {
    const result = parseArgs(['render', 'diagram.mmd', '--svg', '--output', 'out.svg'])
    expect(result).toEqual({
      command: 'render',
      input: 'diagram.mmd',
      ascii: false,
      svg: true,
      output: 'out.svg',
      theme: undefined,
    } satisfies RenderArgs)
  })
})

// ============================================================================
// validation errors
// ============================================================================

describe('parseArgs – errors', () => {
  it('throws when render has --svg but no -o', () => {
    expect(() => parseArgs(['render', 'diagram.mmd', '--svg'])).toThrow('--svg requires -o <path>')
  })

  it('throws when render has no output flags', () => {
    expect(() => parseArgs(['render', 'diagram.mmd'])).toThrow('Specify --ascii and/or --svg -o <path>')
  })

  it('throws on unknown command', () => {
    expect(() => parseArgs(['foobar'])).toThrow('Unknown command: foobar')
  })

  it('throws when -o is last argument with no value', () => {
    expect(() => parseArgs(['render', 'diagram.mmd', '--svg', '-o'])).toThrow('-o requires a file path')
  })

  it('throws when --theme is last argument with no value', () => {
    expect(() => parseArgs(['render', 'diagram.mmd', '--ascii', '--theme'])).toThrow(
      '--theme requires a theme name',
    )
  })

  it('throws on unknown flag in render sub-parser', () => {
    expect(() => parseArgs(['render', 'diagram.mmd', '--ascii', '--bogus'])).toThrow('Unknown flag: --bogus')
  })

  it('throws on duplicate positional argument', () => {
    expect(() => parseArgs(['render', 'diagram1.mmd', '--ascii', 'diagram2.mmd'])).toThrow(
      'Unexpected argument: diagram2.mmd (input file already set to "diagram1.mmd")',
    )
  })
})
