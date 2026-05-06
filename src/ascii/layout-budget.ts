// ============================================================================
// ASCII renderer — layout budget utilities
//
// Shared helpers for width-constrained rendering. These utilities treat
// maxWidth as a visible rendering budget, not as a post-render cleanup step.
// ============================================================================

const ANSI_ESCAPE_RE = /\x1B\[[0-9;]*m/g

/** Strip ANSI color escape sequences so width checks use visible characters. */
export function stripAnsi(text: string): string {
  return text.replaceAll(ANSI_ESCAPE_RE, '')
}

/** Measure the visible width of a rendered line. */
export function visibleWidth(line: string): number {
  return stripAnsi(line).length
}

/** Measure the maximum visible width of a multi-line render. */
export function maxVisibleWidth(output: string): number {
  return Math.max(...output.split('\n').map(visibleWidth), 0)
}

/** Wrap a single line to the requested width, preserving existing words when possible. */
function wrapSingleLine(line: string, width: number): string[] {
  if (width <= 0 || line.length <= width) return [line]

  const words = line.split(/(\s+)/).filter(part => part.length > 0)
  const wrapped: string[] = []
  let current = ''

  function flushCurrent(): void {
    if (current.length > 0) {
      wrapped.push(current.trimEnd())
      current = ''
    }
  }

  for (const word of words) {
    const isWhitespace = /^\s+$/.test(word)
    if (isWhitespace) {
      if (current.length > 0) current += word
      continue
    }

    if (word.length > width) {
      flushCurrent()
      for (let start = 0; start < word.length; start += width) {
        wrapped.push(word.slice(start, start + width))
      }
      continue
    }

    const candidate = current.length === 0 ? word : current + word
    if (candidate.trimEnd().length <= width) {
      current = candidate
    } else {
      flushCurrent()
      current = word
    }
  }

  flushCurrent()
  return wrapped.length > 0 ? wrapped : ['']
}

/**
 * Wrap text to the requested width while preserving explicit line breaks.
 * Each logical line is wrapped independently.
 */
export function wrapText(text: string, width: number): string {
  if (width <= 0) return text
  return text
    .split('\n')
    .flatMap(line => wrapSingleLine(line, width))
    .join('\n')
}
