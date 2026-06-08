// ============================================================================
// MCP error formatting — best-effort error handling utilities
//
// Provides structured error message formatting for MCP tool responses.
// Supports optional partial output inclusion for best-effort rendering.
// ============================================================================

/**
 * Format an error into a structured JSON string for MCP tool responses.
 * Includes optional partial output when best-effort rendering succeeds.
 */
export function formatError(
  error: unknown,
  partial?: string
): string {
  const message = error instanceof Error ? error.message : String(error)

  const payload: Record<string, unknown> = {
    error: message,
  }

  if (partial) {
    payload.partial = partial
  }

  return JSON.stringify(payload, null, 2)
}
