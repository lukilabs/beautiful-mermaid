/**
 * Development server for the markdown editor with live reload.
 *
 * Usage: bun run dev-editor.ts
 *
 * - Runs build-editor.ts to generate dist/editor.html on startup
 * - Watches editor/ and src/ for file changes
 * - On change, rebuilds dist/editor.html and notifies browsers via SSE
 * - Serves dist/editor.html with an injected live-reload script
 *
 * Mirrors dev.ts exactly but targets the editor build.
 * Runs on port 3457 (dev.ts uses 3456).
 */

import { watch } from 'fs'
import { join } from 'path'

const PORT = 3457
const ROOT = import.meta.dir

// ── Build management ──────────────────────────────────────────────────────

let building = false
const sseClients = new Set<ReadableStreamDefaultController>()

async function rebuild(): Promise<void> {
  if (building) return
  building = true
  console.log('\x1b[36m[dev-editor]\x1b[0m Rebuilding editor...')
  const t0 = performance.now()

  const proc = Bun.spawn(['bun', 'run', join(ROOT, 'build-editor.ts')], {
    cwd: ROOT,
    stdout: 'inherit',
    stderr: 'inherit',
  })
  await proc.exited

  const ms = (performance.now() - t0).toFixed(0)
  if (proc.exitCode === 0) {
    console.log(`\x1b[32m[dev-editor]\x1b[0m Rebuilt in ${ms}ms`)
    for (const client of sseClients) {
      try {
        client.enqueue('data: reload\n\n')
      } catch {
        sseClients.delete(client)
      }
    }
  } else {
    console.error(`\x1b[31m[dev-editor]\x1b[0m Build failed (exit ${proc.exitCode})`)
  }
  building = false
}

// ── File watching — debounced to coalesce rapid saves ─────────────────────

let debounce: Timer | null = null
function onFileChange(_event: string, filename: string | null): void {
  // Ignore dist/ output files — they are generated, not source
  if (filename?.startsWith('dist')) return
  if (debounce) clearTimeout(debounce)
  debounce = setTimeout(() => {
    console.log(`\x1b[90m[dev-editor]\x1b[0m Change detected${filename ? `: ${filename}` : ''}`)
    void rebuild()
  }, 150)
}

// Watch editor source and the library source (changes to renderer affect editor)
watch(join(ROOT, 'editor'), { recursive: true }, onFileChange)
watch(join(ROOT, 'src'), { recursive: true }, onFileChange)
watch(join(ROOT, 'build-editor.ts'), {}, onFileChange)

// ── HTTP server ───────────────────────────────────────────────────────────

// Initial build before starting the server
await rebuild()

console.log(`\x1b[36m[dev-editor]\x1b[0m Server running at \x1b[1mhttp://localhost:${PORT}\x1b[0m`)
console.log(`\x1b[36m[dev-editor]\x1b[0m Watching for changes in editor/ and src/\n`)

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url)

    // SSE endpoint — browsers connect here to receive reload signals
    if (url.pathname === '/__dev_events') {
      let controller!: ReadableStreamDefaultController
      const stream = new ReadableStream({
        start(c) {
          controller = c
          sseClients.add(controller)
        },
        cancel() {
          sseClients.delete(controller)
        },
      })
      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      })
    }

    // Serve dist/editor.html with injected live-reload script
    const file = Bun.file(join(ROOT, 'dist', 'editor.html'))
    if (!(await file.exists())) {
      return new Response('dist/editor.html not found — build may have failed', { status: 404 })
    }

    let html = await file.text()

    // Inject live-reload client before </body> — same pattern as dev.ts
    html = html.replace(
      '</body>',
      `  <script>
    // Live reload — SSE connection to dev server.
    // When the server signals a rebuild, the page reloads automatically.
    // If the connection drops (server restarting), it reconnects with backoff.
    ;(function() {
      function connect() {
        var es = new EventSource('/__dev_events');
        es.onmessage = function(e) {
          if (e.data === 'reload') location.reload();
        };
        es.onerror = function() {
          es.close();
          setTimeout(connect, 500);
        };
      }
      connect();
    })();
  </script>
</body>`,
    )

    return new Response(html, {
      headers: { 'Content-Type': 'text/html' },
    })
  },
})
