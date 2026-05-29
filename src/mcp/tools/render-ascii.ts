// ============================================================================
// render_mermaid_ascii tool handler
//
// Wraps renderMermaidASCII() with CJK detection and warning emission.
// Supports best-effort partial rendering on errors.
// ============================================================================

import { renderMermaidASCII } from '../../index.ts'
import type { AsciiRenderOptions } from '../../index.ts'
import { formatError } from '../errors.ts'
import { checkCJK } from '../warnings.ts'

// ============================================================================
// Best-effort partial rendering
// ============================================================================

/**
 * Attempt best-effort partial ASCII rendering by stripping lines from the end.
 */
function attemptPartialAscii(mermaidCode: string, options: AsciiRenderOptions): string | undefined {
  const lines = mermaidCode.split('\n')
  for (let i = lines.length - 1; i > 0; i--) {
    try {
      const partial = lines.slice(0, i).join('\n')
      return renderMermaidASCII(partial, options)
    } catch {
      // Continue stripping lines
    }
  }
  return undefined
}

// ============================================================================
// Tool handler
// ============================================================================

/**
 * MCP tool handler for `render_mermaid_ascii`.
 * Renders Mermaid code to ASCII/Unicode art with optional CJK warnings.
 */
export function handleRenderAscii(args: {
  mermaid_code: string
  use_ascii?: boolean
  color_mode?: string
  padding?: number
}): {
  content: Array<{ type: 'text'; text: string }>
  isError?: boolean
  warnings?: string[]
} {
  // Map MCP params to AsciiRenderOptions
  const options: AsciiRenderOptions = {
    useAscii: args.use_ascii,
    colorMode: (args.color_mode as AsciiRenderOptions['colorMode']) ?? 'auto',
  }

  if (args.padding !== undefined) {
    options.paddingX = args.padding
    options.paddingY = args.padding
  }

  try {
    const ascii = renderMermaidASCII(args.mermaid_code, options)
    const warnings = checkCJK(ascii)

    const result: {
      content: Array<{ type: 'text'; text: string }>
      isError?: boolean
      warnings?: string[]
    } = {
      content: [{ type: 'text', text: ascii }],
    }

    if (warnings.length > 0) {
      result.warnings = warnings
    }

    return result
  } catch (error) {
    const partial = attemptPartialAscii(args.mermaid_code, options)
    return {
      content: [{ type: 'text', text: formatError(error, partial) }],
      isError: true,
    }
  }
}
