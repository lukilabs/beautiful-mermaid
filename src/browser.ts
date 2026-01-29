// ============================================================================
// Browser entry point for beautiful-mermaid
//
// This file serves two purposes:
//
// 1. CDN bundle (via tsup IIFE build):
//    Exposes `window.beautifulMermaid` with all public APIs for <script> tags.
//    Usage:
//      <script src="https://unpkg.com/beautiful-mermaid/dist/beautiful-mermaid.browser.global.js"></script>
//      <script>
//        const { renderMermaid, THEMES } = beautifulMermaid;
//        renderMermaid('graph TD\n  A --> B').then(svg => { ... });
//      </script>
//
// 2. Internal samples page (via Bun.build in index.ts):
//    Also sets `window.__mermaid` for the dynamically generated samples HTML.
// ============================================================================

import { renderMermaid } from './index.ts'
import { renderMermaidAscii } from './ascii/index.ts'
import { THEMES, DEFAULTS, fromShikiTheme } from './theme.ts'

// Re-export for tsup IIFE bundle (creates window.beautifulMermaid)
export { renderMermaid, renderMermaidAscii, THEMES, DEFAULTS, fromShikiTheme }
export type { RenderOptions } from './types.ts'
export type { AsciiRenderOptions } from './ascii/index.ts'
export type { DiagramColors, ThemeName } from './theme.ts'

// Also set window.__mermaid for internal samples page (Bun.build uses ESM format)
if (typeof window !== 'undefined') {
  ;(window as unknown as Record<string, unknown>).__mermaid = {
    renderMermaid,
    renderMermaidAscii,
    THEMES,
    DEFAULTS,
    fromShikiTheme,
  }
}
