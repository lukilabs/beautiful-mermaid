#!/usr/bin/env bun
// ============================================================================
// beautiful-mermaid MCP server — stdio entry point
//
// Starts an MCP server over stdio transport when run as the main module.
// Safe to import (won't auto-start) — use `import.meta.main` guard.
//
// Usage:
//   bun run src/mcp/cli.ts
//   # or: beautiful-mermaid (via npm bin)
// ============================================================================

import { startServer } from './server.ts'

// Auto-start only when executed as the main module (CLI), not when imported.
if (import.meta.main) {
  startServer().catch((error) => {
    console.error('Fatal: Failed to start MCP server:', error)
    process.exit(1)
  })
}
