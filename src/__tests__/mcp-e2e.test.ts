// ============================================================================
// End-to-end MCP server test — launches actual server process over stdio
// and exercises the full JSON-RPC 2.0 protocol lifecycle.
//
// Tests real MCP protocol messages: initialize, tools/list, tools/call for
// all 4 tools, with both success and error cases.
// ============================================================================

import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { spawn } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import { join } from 'node:path'

// ============================================================================
// MCP JSON-RPC client helper
// ============================================================================

interface JsonRpcRequest {
  jsonrpc: '2.0'
  method: string
  params?: Record<string, unknown>
  id?: number
}

interface JsonRpcResponse {
  jsonrpc: '2.0'
  id?: number
  result?: unknown
  error?: { code: number; message: string }
}

class McpClient {
  private proc: ChildProcess
  private nextId = 1
  private pending: Map<number, {
    resolve: (r: JsonRpcResponse) => void
    reject: (e: Error) => void
  }> = new Map()
  private buffer = ''
  private ready = false

  constructor(command: string, args: string[], cwd: string) {
    this.proc = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd,
      env: { ...process.env, FORCE_COLOR: '0' },
    })
  }

  async start(): Promise<McpClient> {
    // Wait for server to be ready by sending initialize
    const resp = await this.request('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'e2e-test', version: '1.0.0' },
    })
    if ('error' in resp && resp.error) {
      throw new Error(`Initialize failed: ${resp.error.message}`)
    }
    // Send initialized notification
    this.notify('notifications/initialized')
    this.ready = true
    return this
  }

  private handleData(data: string): void {
    this.buffer += data
    const lines = this.buffer.split('\n')
    this.buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const msg = JSON.parse(line) as JsonRpcResponse
        if (msg.id !== undefined && this.pending.has(msg.id)) {
          this.pending.get(msg.id)!.resolve(msg)
          this.pending.delete(msg.id)
        }
      } catch {
        // Skip non-JSON lines (stderr output, etc.)
      }
    }
  }

  async request(method: string, params?: Record<string, unknown>): Promise<JsonRpcResponse> {
    const id = this.nextId++
    const request: JsonRpcRequest = { jsonrpc: '2.0', method, id }
    if (params) request.params = params

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`Request ${method} (id=${id}) timed out after 15s`))
      }, 15000)

      this.pending.set(id, {
        resolve: (r) => { clearTimeout(timeout); resolve(r) },
        reject: (e) => { clearTimeout(timeout); reject(e) },
      })

      // Set up data handler on first request
      if (!this.hasHandler) {
        this.proc.stdout!.on('data', (d: Buffer) => this.handleData(d.toString()))
        this.hasHandler = true
      }

      this.proc.stdin!.write(JSON.stringify(request) + '\n')
    })
  }

  notify(method: string, params?: Record<string, unknown>): void {
    const msg: JsonRpcRequest = { jsonrpc: '2.0', method }
    if (params) msg.params = params
    this.proc.stdin!.write(JSON.stringify(msg) + '\n')
  }

  async close(): Promise<void> {
    this.proc.kill()
    // Wait up to 3s for graceful shutdown
    await new Promise<void>((resolve) => {
      this.proc.on('close', () => resolve())
      setTimeout(() => resolve(), 3000)
    })
  }

  private hasHandler = false
}

// ============================================================================
// Helper: call a tool and extract content text
// ============================================================================

async function callTool(
  client: McpClient,
  name: string,
  args: Record<string, unknown>,
): Promise<{ text: string; isError?: boolean }> {
  const resp = await client.request('tools/call', { name, arguments: args })
  if ('error' in resp && resp.error) {
    throw new Error(`MCP error: ${resp.error.message}`)
  }
  const result = resp.result as {
    content: Array<{ type: string; text: string }>
    isError?: boolean
    warnings?: string[]
  }
  return {
    text: result.content[0]?.text ?? '',
    isError: result.isError,
  }
}

// ============================================================================
// Test lifecycle
// ============================================================================

const PROJECT_ROOT = join(import.meta.dir, '..', '..')

let client: McpClient

beforeAll(async () => {
  client = new McpClient(
    'bun',
    ['run', 'src/mcp/cli.ts'],
    PROJECT_ROOT,
  )
  await client.start()
}, 30000)

afterAll(async () => {
  await client?.close()
})

// ============================================================================
// E2E Tests
// ============================================================================

describe('MCP E2E – tools/list', () => {
  it('returns all 4 tools with correct schema', async () => {
    const resp = await client.request('tools/list')
    expect(resp.result).toBeDefined()

    const result = resp.result as { tools: Array<{ name: string; description: string; inputSchema: unknown }> }
    expect(result.tools).toHaveLength(4)

    const names = result.tools.map(t => t.name).sort()
    expect(names).toEqual([
      'list_diagram_types',
      'parse_mermaid',
      'render_mermaid_ascii',
      'render_mermaid_svg',
    ])

    // Each tool has a description and schema
    for (const tool of result.tools) {
      expect(tool.description).toBeTruthy()
      expect(tool.inputSchema).toBeDefined()
    }
  })
})

describe('MCP E2E – list_diagram_types', () => {
  it('returns 6 diagram types via MCP protocol', async () => {
    const result = await callTool(client, 'list_diagram_types', {})
    expect(result.isError).toBeUndefined()

    const types = JSON.parse(result.text) as Array<{ name: string; description: string; example: string }>
    expect(types).toHaveLength(6)
    expect(types.map(t => t.name)).toEqual([
      'flowchart', 'sequence', 'class', 'er', 'xychart', 'state',
    ])
  })
})

describe('MCP E2E – parse_mermaid', () => {
  it('parses a flowchart and returns valid JSON graph', async () => {
    const result = await callTool(client, 'parse_mermaid', {
      mermaid_code: 'graph TD\n  A[Start] --> B{Diamond}\n  B -->|Yes| C(End)',
    })
    expect(result.isError).toBeUndefined()

    const graph = JSON.parse(result.text)
    expect(graph.direction).toBe('TD')
    expect(Object.keys(graph.nodes)).toHaveLength(3)
    expect(graph.nodes.A.label).toBe('Start')
    expect(graph.nodes.A.shape).toBe('rectangle')
    expect(graph.nodes.B.label).toBe('Diamond')
    expect(graph.nodes.B.shape).toBe('diamond')
    expect(graph.nodes.C.label).toBe('End')
    expect(graph.nodes.C.shape).toBe('rounded')
    expect(graph.edges).toHaveLength(2)
    expect(graph.edges[1].label).toBe('Yes')
    expect(graph.edges[1].style).toBe('solid')
  })

  it('parses a state diagram', async () => {
    const result = await callTool(client, 'parse_mermaid', {
      mermaid_code: 'stateDiagram-v2\n  [*] --> Idle\n  Idle --> Active\n  Active --> [*]',
    })
    const graph = JSON.parse(result.text)
    expect(graph.direction).toBe('TD')
    expect(Object.keys(graph.nodes).length).toBeGreaterThanOrEqual(3)
    expect(graph.edges.length).toBeGreaterThanOrEqual(2)
  })

  it('returns error for empty input', async () => {
    const result = await callTool(client, 'parse_mermaid', {
      mermaid_code: '',
    })
    expect(result.isError).toBe(true)
    const payload = JSON.parse(result.text)
    expect(payload.error).toContain('Empty')
  })
})

describe('MCP E2E – render_mermaid_svg', () => {
  it('renders a flowchart to valid SVG', async () => {
    const result = await callTool(client, 'render_mermaid_svg', {
      mermaid_code: 'graph TD\n  A[Hello] --> B[World]',
    })
    expect(result.isError).toBeUndefined()

    const svg = result.text
    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"')
    expect(svg).toContain('</svg>')
    expect(svg).toContain('>Hello</text>')
    expect(svg).toContain('>World</text>')
    expect(svg).toContain('<defs>')
    expect(svg).toContain('<marker id="arrowhead"')
  })

  it('renders with tokyo-night theme', async () => {
    const result = await callTool(client, 'render_mermaid_svg', {
      mermaid_code: 'graph TD\n  A --> B',
      theme_name: 'tokyo-night',
    })
    expect(result.isError).toBeUndefined()

    const svg = result.text
    expect(svg).toContain('--bg:#1a1b26')
    expect(svg).toContain('--fg:#a9b1d6')
    // Theme enrichment colors
    expect(svg).toContain('--line:#3d59a1')
    expect(svg).toContain('--accent:#7aa2f7')
  })

  it('user bg/fg override theme', async () => {
    const result = await callTool(client, 'render_mermaid_svg', {
      mermaid_code: 'graph TD\n  A --> B',
      theme_name: 'tokyo-night',
      bg: '#000000',
      fg: '#ffffff',
    })
    const svg = result.text
    expect(svg).toContain('--bg:#000000')
    expect(svg).toContain('--fg:#ffffff')
  })

  it('renders with transparent background', async () => {
    const result = await callTool(client, 'render_mermaid_svg', {
      mermaid_code: 'graph TD\n  A --> B',
      transparent: true,
    })
    const svg = result.text
    expect(svg).not.toContain('background:var(--bg)')
    expect(svg).toContain('--bg:')
  })

  it('renders all 6 diagram types successfully', async () => {
    const diagrams: Record<string, string> = {
      flowchart: 'graph TD\n  A --> B',
      sequence: 'sequenceDiagram\n  A->>B: Hello',
      class: 'classDiagram\n  Animal <|-- Duck',
      er: 'erDiagram\n  CUSTOMER ||--o{ ORDER : places',
      xychart: 'xychart-beta\n  line [1,2,3]',
      state: 'stateDiagram-v2\n  [*] --> Active',
    }

    for (const [kind, code] of Object.entries(diagrams)) {
      const result = await callTool(client, 'render_mermaid_svg', { mermaid_code: code })
      expect(result.isError).toBeUndefined()
      expect(result.text).toContain('<svg')
      expect(result.text).toContain('</svg>')
    }
  })

  it('returns error for invalid mermaid', async () => {
    const result = await callTool(client, 'render_mermaid_svg', {
      mermaid_code: 'not a valid diagram',
    })
    expect(result.isError).toBe(true)
    const payload = JSON.parse(result.text)
    expect(payload.error).toBeDefined()
  })
})

describe('MCP E2E – render_mermaid_ascii', () => {
  it('renders a flowchart to ASCII art', async () => {
    const result = await callTool(client, 'render_mermaid_ascii', {
      mermaid_code: 'graph LR\n  A --> B --> C',
      use_ascii: true,
    })
    expect(result.isError).toBeUndefined()

    const text = result.text
    expect(text.length).toBeGreaterThan(50)
    expect(text).toContain('+')
    expect(text).toContain('-')
    expect(text).toContain('>')
  })

  it('renders with Unicode box-drawing', async () => {
    const result = await callTool(client, 'render_mermaid_ascii', {
      mermaid_code: 'graph LR\n  A --> B --> C',
      use_ascii: false,
    })
    expect(result.isError).toBeUndefined()
    expect(result.text.length).toBeGreaterThan(0)
  })

  it('renders with color_mode=none', async () => {
    const result = await callTool(client, 'render_mermaid_ascii', {
      mermaid_code: 'graph LR\n  A --> B',
      use_ascii: true,
      color_mode: 'none',
    })
    expect(result.isError).toBeUndefined()
    expect(result.text).toContain('+')
    expect(result.text).toContain('-')
  })

  it('renders sequence diagram in ASCII', async () => {
    const result = await callTool(client, 'render_mermaid_ascii', {
      mermaid_code: `sequenceDiagram
        Alice->>Bob: Hello
        Bob->>Alice: Hi`,
      use_ascii: true,
    })
    expect(result.isError).toBeUndefined()
    expect(result.text.length).toBeGreaterThan(0)
  })

  it('renders class diagram in ASCII', async () => {
    const result = await callTool(client, 'render_mermaid_ascii', {
      mermaid_code: `classDiagram
        Animal <|-- Duck
        Duck : +String name`,
      use_ascii: true,
    })
    expect(result.isError).toBeUndefined()
    expect(result.text.length).toBeGreaterThan(0)
  })

  it('renders ER diagram in ASCII', async () => {
    const result = await callTool(client, 'render_mermaid_ascii', {
      mermaid_code: `erDiagram
        CUSTOMER ||--o{ ORDER : places`,
      use_ascii: true,
    })
    expect(result.isError).toBeUndefined()
    expect(result.text.length).toBeGreaterThan(0)
  })

  it('handles CJK characters without crashing (warnings expected)', async () => {
    const result = await callTool(client, 'render_mermaid_ascii', {
      mermaid_code: 'graph TD\n  A[中文] --> B',
      use_ascii: true,
    })
    expect(result.isError).toBeUndefined()
    expect(result.text.length).toBeGreaterThan(0)
  })

  it('handles padding option', async () => {
    const result = await callTool(client, 'render_mermaid_ascii', {
      mermaid_code: 'graph LR\n  A --> B',
      use_ascii: true,
      padding: 10,
    })
    expect(result.isError).toBeUndefined()
    expect(result.text.length).toBeGreaterThan(0)
  })

  it('returns error for invalid mermaid', async () => {
    const result = await callTool(client, 'render_mermaid_ascii', {
      mermaid_code: 'invalid diagram',
    })
    expect(result.isError).toBe(true)
    const payload = JSON.parse(result.text)
    expect(payload.error).toBeDefined()
  })
})

describe('MCP E2E – error isolation', () => {
  it('one tool error does not corrupt server state', async () => {
    // Cause an error in parse_mermaid
    const errResult = await callTool(client, 'parse_mermaid', {
      mermaid_code: 'invalid',
    })
    expect(errResult.isError).toBe(true)

    // Next request should still work
    const okResult = await callTool(client, 'list_diagram_types', {})
    expect(okResult.isError).toBeUndefined()
    const types = JSON.parse(okResult.text)
    expect(types).toHaveLength(6)
  })
})

describe('MCP E2E – concurrency', () => {
  it('handles sequential rapid requests', async () => {
    const codes = [
      'graph TD\n  A --> B',
      'graph LR\n  X --> Y',
      'graph TD\n  P --> Q',
      'graph LR\n  1 --> 2',
      'graph TD\n  Up --> Down',
    ]

    for (const code of codes) {
      const result = await callTool(client, 'render_mermaid_svg', {
        mermaid_code: code,
      })
      expect(result.isError).toBeUndefined()
      expect(result.text).toContain('<svg xmlns="http://www.w3.org/2000/svg"')
      expect(result.text).toContain('</svg>')
    }
  })
})
