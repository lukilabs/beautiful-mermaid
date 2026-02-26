// ============================================================================
// Markdown renderer with Mermaid fence interception.
//
// Uses `marked` to convert markdown text to HTML.
// ```mermaid fences are replaced with placeholder divs (base64-encoded source)
// so that editor-ui.ts can render them asynchronously via renderMermaidSVGAsync.
//
// The placeholder approach is necessary because marked's Renderer.code() is
// synchronous — there is no async renderer API in marked v15.
// ============================================================================

import { marked } from 'marked'

// marked v15: only plain-object renderers passed to marked.use() are honoured.
// Class-based Renderer subclass instances are silently ignored by marked.use().
marked.use({
  renderer: {
    code({ text, lang }: { text: string; lang?: string | null }): string {
      if (lang === 'mermaid') {
        // btoa requires latin1; encodeURIComponent+unescape handles arbitrary Unicode
        const encoded = btoa(unescape(encodeURIComponent(text)))
        return `<div class="mermaid-placeholder" data-mermaid="${encoded}"></div>`
      }
      const escaped = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
      const cls = lang ? ` class="language-${lang}"` : ''
      return `<pre><code${cls}>${escaped}</code></pre>`
    },
  },
})

/**
 * Parse markdown source to an HTML string.
 * ```mermaid fences become <div class="mermaid-placeholder" data-mermaid="...">
 * which editor-ui.ts replaces with rendered SVGs.
 */
export function parseMarkdown(source: string): string {
  return marked.parse(source) as string
}
