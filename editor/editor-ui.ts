// ============================================================================
// Editor UI — split-pane markdown editor with live Mermaid rendering.
//
// Wires up:
//   - <textarea> with tab/auto-indent keyboard shortcuts
//   - Debounced markdown → HTML rendering via parseMarkdown()
//   - Async SVG injection for each .mermaid-placeholder element
//   - Drag-to-resize split pane divider
//   - Theme selector driving RenderOptions
//   - localStorage persistence of editor content
// ============================================================================

import { parseMarkdown } from './markdown-renderer.ts'

// window.__mermaid is set by browser-entry.ts before initEditor() is called
type MermaidAPI = {
  renderMermaidSVGAsync: (text: string, options?: Record<string, unknown>) => Promise<string>
  THEMES: Record<string, Record<string, string>>
}

const RENDER_DEBOUNCE_MS = 150
const STORAGE_KEY = 'beautiful-mermaid-editor-content'

const DEFAULT_CONTENT = `# Beautiful Mermaid Editor

Write markdown here. Mermaid diagrams in fenced code blocks render live as SVGs.

\`\`\`mermaid
graph TD
  A[Start] --> B{Is it working?}
  B -->|Yes| C[🎉 Great!]
  B -->|No| D[Debug]
  D --> A
\`\`\`

## Sequence Diagram

\`\`\`mermaid
sequenceDiagram
  Alice->>Bob: Hello Bob, how are you?
  Bob-->>Alice: I am good thanks!
  Alice->>Bob: Great, see you around
\`\`\`

## Class Diagram

\`\`\`mermaid
classDiagram
  class Animal {
    +String name
    +makeSound() void
  }
  class Dog {
    +fetch() void
  }
  Animal <|-- Dog
\`\`\`

---

Regular markdown works too — **bold**, *italic*, \`inline code\`, lists, tables, etc.
`

export function initEditor(): void {
  const api = (window as unknown as { __mermaid: MermaidAPI }).__mermaid
  const editorEl = document.getElementById('editor') as HTMLTextAreaElement
  const previewEl = document.getElementById('preview') as HTMLDivElement
  const themeSelect = document.getElementById('theme-select') as HTMLSelectElement

  // Restore saved content or use default
  editorEl.value = localStorage.getItem(STORAGE_KEY) ?? DEFAULT_CONTENT

  // ── Render pipeline ──────────────────────────────────────────────────────

  let renderTimer: ReturnType<typeof setTimeout> | null = null

  async function render(): Promise<void> {
    const source = editorEl.value
    localStorage.setItem(STORAGE_KEY, source)

    // Parse markdown — mermaid fences become placeholder divs
    previewEl.innerHTML = parseMarkdown(source)

    // Resolve theme options from the selector
    const themeKey = themeSelect.value
    const theme = themeKey ? api.THEMES[themeKey] : undefined
    const options: Record<string, unknown> = theme ? { ...theme } : {}

    // Replace each placeholder with a rendered SVG (in parallel)
    const placeholders = Array.from(
      previewEl.querySelectorAll<HTMLDivElement>('.mermaid-placeholder'),
    )

    await Promise.all(
      placeholders.map(async el => {
        const encoded = el.dataset.mermaid ?? ''
        const mermaidSource = decodeURIComponent(escape(atob(encoded)))
        try {
          const svg = await api.renderMermaidSVGAsync(mermaidSource, options)
          const wrapper = document.createElement('div')
          wrapper.className = 'mermaid-render'
          wrapper.innerHTML = svg
          el.replaceWith(wrapper)
        } catch (err) {
          const errDiv = document.createElement('div')
          errDiv.className = 'mermaid-error'
          errDiv.textContent = `Render error: ${err instanceof Error ? err.message : String(err)}`
          el.replaceWith(errDiv)
        }
      }),
    )
  }

  function scheduleRender(): void {
    if (renderTimer !== null) clearTimeout(renderTimer)
    renderTimer = setTimeout(render, RENDER_DEBOUNCE_MS)
  }

  editorEl.addEventListener('input', scheduleRender)
  // Theme change: render immediately (no debounce)
  themeSelect.addEventListener('change', () => void render())

  // ── Keyboard shortcuts ───────────────────────────────────────────────────

  editorEl.addEventListener('keydown', (e: KeyboardEvent) => {
    const start = editorEl.selectionStart
    const end = editorEl.selectionEnd
    const value = editorEl.value

    if (e.key === 'Tab') {
      e.preventDefault()
      // Insert 2 spaces at cursor
      editorEl.value = value.slice(0, start) + '  ' + value.slice(end)
      editorEl.selectionStart = editorEl.selectionEnd = start + 2
      scheduleRender()
      return
    }

    if (e.key === 'Enter') {
      // Auto-indent: match leading whitespace of current line
      const lineStart = value.lastIndexOf('\n', start - 1) + 1
      const line = value.slice(lineStart, start)
      const indent = line.match(/^(\s+)/)?.[1]
      if (indent) {
        e.preventDefault()
        const ins = '\n' + indent
        editorEl.value = value.slice(0, start) + ins + value.slice(end)
        editorEl.selectionStart = editorEl.selectionEnd = start + ins.length
        scheduleRender()
      }
    }
  })

  // ── Resize handle ────────────────────────────────────────────────────────

  const divider = document.getElementById('divider') as HTMLDivElement
  const container = document.getElementById('split-container') as HTMLDivElement
  const editorPane = document.getElementById('editor-pane') as HTMLDivElement

  let dragging = false
  let startX = 0
  let startLeftPx = 0

  divider.addEventListener('mousedown', (e: MouseEvent) => {
    dragging = true
    startX = e.clientX
    startLeftPx = editorPane.offsetWidth
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    e.preventDefault()
  })

  document.addEventListener('mousemove', (e: MouseEvent) => {
    if (!dragging) return
    const totalWidth = container.offsetWidth - divider.offsetWidth
    const newLeft = Math.min(Math.max(startLeftPx + (e.clientX - startX), 200), totalWidth - 200)
    const pct = (newLeft / totalWidth) * 100
    container.style.setProperty('--split-left', `${pct.toFixed(2)}%`)
  })

  document.addEventListener('mouseup', () => {
    if (!dragging) return
    dragging = false
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  })

  // ── Initial render ───────────────────────────────────────────────────────
  void render()
}
