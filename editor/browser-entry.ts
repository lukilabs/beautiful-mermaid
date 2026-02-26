// ============================================================================
// Browser bundle entry point for the markdown editor.
//
// Mirrors src/browser.ts: exposes the rendering API on window.__mermaid
// then boots the editor UI once the DOM is ready.
//
// Bundled via Bun.build({ target: 'browser' }) in build-editor.ts.
// ============================================================================

import { renderMermaidSVGAsync } from '../src/index.ts'
import { THEMES } from '../src/theme.ts'
import { initEditor } from './editor-ui.ts'

declare const window: unknown

// Expose the mermaid API so editor-ui.ts can access it at runtime.
// Same shape as src/browser.ts so the two entry points stay in sync.
;(window as Record<string, unknown>).__mermaid = {
  renderMermaidSVGAsync,
  THEMES,
}

// Boot the editor after the DOM is parsed
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initEditor)
} else {
  initEditor()
}
