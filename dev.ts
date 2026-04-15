/**
 * Development server with live reload for mermaid samples and live editor.
 *
 * Routes:
 *   /         → index.html (samples showcase)
 *   /editor   → editor.html (live diagram editor)
 *
 * Both pages are rebuilt on any source change and get live-reload via SSE.
 */

import { watch } from 'fs'
import { join } from 'path'

const PORT = 3456
const ROOT = import.meta.dir

// ============================================================================
// Build management
// ============================================================================

let building = false
const sseClients = new Set<ReadableStreamDefaultController>()

async function rebuild(): Promise<void> {
  if (building) return
  building = true
  console.log('\x1b[36m[dev]\x1b[0m Rebuilding...')
  const t0 = performance.now()

  const [samplesProc, editorProc] = await Promise.all([
    (async () => {
      const p = Bun.spawn(['bun', 'run', join(ROOT, 'index.ts')], {
        cwd: ROOT,
        stdout: 'inherit',
        stderr: 'inherit',
      })
      await p.exited
      return p
    })(),
    (async () => {
      const p = Bun.spawn(['bun', 'run', join(ROOT, 'editor.ts')], {
        cwd: ROOT,
        stdout: 'inherit',
        stderr: 'inherit',
      })
      await p.exited
      return p
    })(),
  ])

  const ms = (performance.now() - t0).toFixed(0)
  const ok = samplesProc.exitCode === 0 && editorProc.exitCode === 0
  if (ok) {
    console.log(`\x1b[32m[dev]\x1b[0m Rebuilt in ${ms}ms`)
    for (const client of sseClients) {
      try {
        client.enqueue('data: reload\n\n')
      } catch {
        sseClients.delete(client)
      }
    }
  } else {
    console.error(`\x1b[31m[dev]\x1b[0m Build failed`)
  }
  building = false
}

// ============================================================================
// File watching — debounced to coalesce rapid saves
// ============================================================================

let debounce: Timer | null = null
function onFileChange(_event: string, filename: string | null): void {
  if (filename === 'index.html' || filename === 'editor.html') return
  if (debounce) clearTimeout(debounce)
  debounce = setTimeout(() => {
    console.log(`\x1b[90m[dev]\x1b[0m Change detected${filename ? `: ${filename}` : ''}`)
    rebuild()
  }, 150)
}

watch(ROOT, { recursive: true }, onFileChange)

// ============================================================================
// HTTP server
// ============================================================================

await rebuild()

console.log(`\x1b[36m[dev]\x1b[0m Server running at \x1b[1mhttp://localhost:${PORT}\x1b[0m`)
console.log(`\x1b[36m[dev]\x1b[0m   /         → live editor (main)`)
console.log(`\x1b[36m[dev]\x1b[0m   /samples  → samples showcase\n`)

function injectLiveReload(html: string): string {
  return html.replace(
    '</body>',
    `  <script>
    ;(function() {
      function connect() {
        var es = new EventSource('/__dev_events');
        es.onmessage = function(e) { if (e.data === 'reload') location.reload(); };
        es.onerror = function() { es.close(); setTimeout(connect, 500); };
      }
      connect();
    })();
  </script>
</body>`,
  )
}

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url)

    // SSE endpoint
    if (url.pathname === '/__dev_events') {
      let controller!: ReadableStreamDefaultController
      const stream = new ReadableStream({
        start(c) { controller = c; sseClients.add(controller) },
        cancel() { sseClients.delete(controller) },
      })
      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      })
    }

    // Samples showcase (moved to /samples)
    if (url.pathname === '/samples' || url.pathname === '/samples.html') {
      const file = Bun.file(join(ROOT, 'index.html'))
      if (!(await file.exists())) {
        return new Response('index.html not found — build may have failed', { status: 404 })
      }
      return new Response(injectLiveReload(await file.text()), {
        headers: { 'Content-Type': 'text/html' },
      })
    }

    // Editor (root + /editor)
    const file = Bun.file(join(ROOT, 'editor.html'))
    if (!(await file.exists())) {
      return new Response('editor.html not found — build may have failed', { status: 404 })
    }
    return new Response(injectLiveReload(await file.text()), {
      headers: { 'Content-Type': 'text/html' },
    })
  },
})
