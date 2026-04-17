/**
 * Generates editor.html — a live Mermaid editor similar to mermaid.live.
 *
 * Usage: bun run editor.ts
 *
 * The generated HTML is fully self-contained:
 *   - Bundles the mermaid renderer client-side
 *   - Live rendering on every keystroke (debounced)
 *   - URL hash sharing (base64-encoded source)
 *   - Theme switcher with all built-in themes
 *   - Sample presets by diagram category
 *   - Download SVG / Copy link
 *
 * Source files are organized in editor/:
 *   - editor/css/  — modular CSS components
 *   - editor/js/   — modular JS modules
 *   - editor/html/ — HTML partials (topbar, left-panel, right-panel)
 */

import { THEMES } from './src/theme.ts'

const THEME_LABELS: Record<string, string> = {
  'zinc-dark': 'Zinc Dark',
  'tokyo-night': 'Tokyo Night',
  'tokyo-night-storm': 'Tokyo Storm',
  'tokyo-night-light': 'Tokyo Light',
  'catppuccin-mocha': 'Catppuccin',
  'catppuccin-latte': 'Latte',
  'nord': 'Nord',
  'nord-light': 'Nord Light',
  'dracula': 'Dracula',
  'github-light': 'GitHub',
  'github-dark': 'GitHub Dark',
  'solarized-light': 'Solarized',
  'solarized-dark': 'Solar Dark',
  'one-dark': 'One Dark',
}

const SAMPLES: { category: string; title: string; source: string }[] = [
  {
    category: 'Flowchart',
    title: 'Simple Flow',
    source: `graph TD
  A[Start] --> B{Decision?}
  B -->|Yes| C[Do the thing]
  B -->|No| D[Skip it]
  C --> E[End]
  D --> E`,
  },
  {
    category: 'Flowchart',
    title: 'All Shapes',
    source: `graph LR
  A[Rectangle] --> B(Rounded)
  B --> C{Diamond}
  C --> D([Stadium])
  D --> E((Circle))
  E --> F[[Subroutine]]
  F --> G(((Double Circle)))
  G --> H{{Hexagon}}
  H --> I[(Database)]
  I --> J>Flag]
  J --> K[/Trapezoid\\]
  K --> L[\\Inverse Trap/]`,
  },
  {
    category: 'Flowchart',
    title: 'Subgraphs',
    source: `graph TB
  subgraph Frontend
    A[React App] --> B[API Client]
  end
  subgraph Backend
    C[API Server] --> D[(Database)]
    C --> E[Cache]
  end
  B --> C`,
  },
  {
    category: 'State',
    title: 'Simple State',
    source: `stateDiagram-v2
  [*] --> Idle
  Idle --> Loading: fetch()
  Loading --> Success: 200 OK
  Loading --> Error: 4xx/5xx
  Success --> Idle: reset
  Error --> Idle: retry
  Success --> [*]`,
  },
  {
    category: 'State',
    title: 'Nested States',
    source: `stateDiagram-v2
  [*] --> Active
  state Active {
    [*] --> Editing
    Editing --> Saving: save
    Saving --> Editing: done
  }
  Active --> Inactive: logout
  Inactive --> Active: login`,
  },
  {
    category: 'Sequence',
    title: 'API Call',
    source: `sequenceDiagram
  participant C as Client
  participant A as API
  participant D as Database

  C->>A: GET /users
  A->>D: SELECT * FROM users
  D-->>A: rows[]
  A-->>C: 200 OK { users }`,
  },
  {
    category: 'Sequence',
    title: 'Auth Flow',
    source: `sequenceDiagram
  actor U as User
  participant F as Frontend
  participant A as Auth Service
  participant D as DB

  U->>F: Login(email, password)
  F->>A: POST /auth/login
  A->>D: findUser(email)
  D-->>A: user record
  A->>A: verifyPassword()
  A-->>F: JWT token
  F-->>U: Logged in ✓`,
  },
  {
    category: 'Class',
    title: 'Basic Classes',
    source: `classDiagram
  class Animal {
    +String name
    +int age
    +makeSound() void
  }
  class Dog {
    +String breed
    +fetch() void
  }
  class Cat {
    +bool indoor
    +purr() void
  }
  Animal <|-- Dog
  Animal <|-- Cat`,
  },
  {
    category: 'Class',
    title: 'Repository Pattern',
    source: `classDiagram
  class IRepository~T~ {
    <<interface>>
    +findById(id) T
    +findAll() List~T~
    +save(entity T) T
    +delete(id) void
  }
  class UserRepository {
    -db Database
    +findById(id) User
    +findAll() List~User~
    +findByEmail(email) User
    +save(user User) User
    +delete(id) void
  }
  IRepository <|.. UserRepository`,
  },
  {
    category: 'ER',
    title: 'Blog Schema',
    source: `erDiagram
  USER {
    int id PK
    string email UK
    string name
    datetime created_at
  }
  POST {
    int id PK
    string title
    text content
    int author_id FK
    datetime published_at
  }
  COMMENT {
    int id PK
    text body
    int post_id FK
    int user_id FK
  }
  USER ||--o{ POST : writes
  POST ||--o{ COMMENT : has
  USER ||--o{ COMMENT : writes`,
  },
  {
    category: 'ER',
    title: 'E-Commerce',
    source: `erDiagram
  CUSTOMER ||--o{ ORDER : places
  ORDER ||--|{ ORDER_ITEM : contains
  PRODUCT ||--o{ ORDER_ITEM : "included in"
  CUSTOMER {
    int id PK
    string name
    string email UK
  }
  ORDER {
    int id PK
    int customer_id FK
    datetime placed_at
    string status
  }
  ORDER_ITEM {
    int order_id FK
    int product_id FK
    int quantity
    decimal price
  }
  PRODUCT {
    int id PK
    string name
    decimal price
    int stock
  }`,
  },
  {
    category: 'XY Chart',
    title: 'Monthly Revenue',
    source: `xychart-beta
  title "Monthly Revenue"
  x-axis [Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec]
  y-axis "Revenue ($K)" 0 --> 120
  bar [45, 52, 61, 58, 74, 88, 95, 102, 91, 85, 78, 110]
  line [45, 52, 61, 58, 74, 88, 95, 102, 91, 85, 78, 110]`,
  },
  {
    category: 'XY Chart',
    title: 'Multi-Series',
    source: `xychart-beta
  title "Sales vs Target"
  x-axis [Q1, Q2, Q3, Q4]
  y-axis "Amount" 0 --> 200
  bar [120, 145, 135, 175]
  line [130, 140, 150, 160]`,
  },
]

// ── File helpers ──────────────────────────────────────────────────────────────

const editorDir = new URL('./editor/', import.meta.url).pathname

async function readFile(relativePath: string): Promise<string> {
  const file = Bun.file(editorDir + relativePath)
  return file.text()
}

async function readCssFiles(): Promise<string> {
  const order = [
    'css/variables.css',
    'css/topbar.css',
    'css/panels.css',
    'css/code-editor.css',
    'css/preview.css',
    'css/config-panel.css',
    'css/color-picker.css',
    'css/font-picker.css',
    'css/samples.css',
    'css/export.css',
    'css/misc.css',
  ]
  const parts = await Promise.all(order.map(f => readFile(f)))
  return parts.join('\n\n')
}

async function readJsFiles(samplesJson: string): Promise<string> {
  const order = [
    'js/helpers.js',
    'js/state.js',
    'js/elements.js',
    'js/sharing.js',
    'js/rendering.js',
    'js/zoom.js',
    'js/pan.js',
    'js/editor-helpers.js',
    'js/config-panel.js',
    'js/color-picker.js',
    'js/font-picker.js',
    'js/tabs.js',
    'js/samples.js',
    'js/buttons.js',
    'js/export.js',
    'js/resize.js',
    'js/toast.js',
    'js/dark-mode.js',
    'js/init.js',
  ]
  const parts = await Promise.all(order.map(f => readFile(f)))
  let combined = parts.join('\n\n')
  combined = combined.replace('{{SAMPLES_JSON}}', samplesJson)
  return combined
}

async function readHtmlPartials(themeOptions: string, categoryButtons: string): Promise<{
  topbar: string
  leftPanel: string
  rightPanel: string
}> {
  const [topbar, leftPanel, rightPanel] = await Promise.all([
    readFile('html/topbar.html'),
    readFile('html/left-panel.html'),
    readFile('html/right-panel.html'),
  ])
  return {
    topbar: topbar.replace('{{THEME_OPTIONS}}', themeOptions),
    leftPanel: leftPanel.replace('{{CATEGORY_BUTTONS}}', categoryButtons),
    rightPanel,
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function generateEditorHtml(): Promise<string> {
  const buildResult = await Bun.build({
    entrypoints: [new URL('./src/browser.ts', import.meta.url).pathname],
    target: 'browser',
    format: 'esm',
    minify: true,
  })
  if (!buildResult.success) {
    console.error('Bundle failed:', buildResult.logs)
    process.exit(1)
  }
  const bundleJs = await buildResult.outputs[0]!.text()
  console.log(`Browser bundle: ${(bundleJs.length / 1024).toFixed(1)} KB`)

  const samplesJson = JSON.stringify(SAMPLES)

  const themeOptions = [
    `<option value="">Default</option>`,
    ...Object.keys(THEMES).map(
      key => `<option value="${key}">${THEME_LABELS[key] ?? key}</option>`
    ),
  ].join('\n      ')

  const categories = [...new Set(SAMPLES.map(s => s.category))]
  const categoryButtons = categories
    .map(cat => `<button class="cat-btn" data-cat="${cat}">${cat}</button>`)
    .join('\n          ')

  const [css, appJs, html] = await Promise.all([
    readCssFiles(),
    readJsFiles(samplesJson),
    readHtmlPartials(themeOptions, categoryButtons),
  ])

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Beautiful Mermaid — Live Editor</title>
  <link rel="icon" type="image/svg+xml" href="favicon.svg" />
  <link rel="icon" type="image/x-icon" href="favicon.ico" />
  <link rel="apple-touch-icon" href="apple-touch-icon.png" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
  <style>
${css}
  </style>
</head>
<body>

<!-- Top bar -->
${html.topbar}

<!-- Main -->
<div class="main">

  <!-- Left panel -->
${html.leftPanel}

  <!-- Resize handle -->
  <div class="resize-handle" id="resize-handle"></div>

  <!-- Right panel -->
${html.rightPanel}

</div>

<div class="toast" id="toast"></div>

<!-- Bundled renderer -->
<script type="module">
${bundleJs}

${appJs}

</script>
</body>
</html>`
}

const result = await generateEditorHtml()
const outPath = new URL('./editor.html', import.meta.url).pathname
await Bun.write(outPath, result)
console.log(`Written to ${outPath} (${(result.length / 1024).toFixed(1)} KB)`)
