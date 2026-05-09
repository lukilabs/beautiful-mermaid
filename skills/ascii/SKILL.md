# mermaid-ascii

Expert skill for ASCII/Unicode terminal diagram rendering with beautiful-mermaid.

## When to Use

- "ASCII", "terminal", "text diagram", "CLI output"
- User needs diagrams in text-only environments
- Output for terminals, plain text files, or code comments

## Basic Usage

```typescript
import { renderMermaidAscii } from 'beautiful-mermaid'

const ascii = renderMermaidAscii(`graph LR; A --> B --> C`)
```

Output:
```
┌───┐     ┌───┐     ┌───┐
│   │     │   │     │   │
│ A │────►│ B │────►│ C │
│   │     │   │     │   │
└───┘     └───┘     └───┘
```

## Unicode vs ASCII Mode

### Unicode (Default)

Uses box-drawing characters for prettier output:

```typescript
const unicode = renderMermaidAscii(diagram)
// or explicitly:
const unicode = renderMermaidAscii(diagram, { useAscii: false })
```

Output:
```
┌─────┐     ┌─────┐
│     │     │     │
│ Start│────►│ End │
│     │     │     │
└─────┘     └─────┘
```

### Pure ASCII

Maximum compatibility for any terminal:

```typescript
const ascii = renderMermaidAscii(diagram, { useAscii: true })
```

Output:
```
+-----+     +-----+
|     |     |     |
|Start|---->| End |
|     |     |     |
+-----+     +-----+
```

## Character Sets

### Unicode Characters

| Purpose | Character |
|---------|-----------|
| Top-left | `┌` |
| Top-right | `┐` |
| Bottom-left | `└` |
| Bottom-right | `┘` |
| Horizontal | `─` |
| Vertical | `│` |
| Arrow right | `►` |
| Arrow left | `◄` |
| Arrow up | `▲` |
| Arrow down | `▼` |

### ASCII Characters

| Purpose | Character |
|---------|-----------|
| Top-left | `+` |
| Top-right | `+` |
| Bottom-left | `+` |
| Bottom-right | `+` |
| Horizontal | `-` |
| Vertical | `\|` |
| Arrow right | `>` |
| Arrow left | `<` |
| Arrow up | `^` |
| Arrow down | `v` |

## Spacing Options

```typescript
const ascii = renderMermaidAscii(diagram, {
  useAscii: false,
  paddingX: 5,          // Horizontal spacing between nodes
  paddingY: 5,          // Vertical spacing between nodes
  boxBorderPadding: 1,  // Padding inside node boxes
})
```

### Default Values

| Option | Default |
|--------|---------|
| `paddingX` | 5 |
| `paddingY` | 5 |
| `boxBorderPadding` | 1 |

### Compact Layout

```typescript
const compact = renderMermaidAscii(diagram, {
  paddingX: 2,
  paddingY: 2,
  boxBorderPadding: 0,
})
```

### Spacious Layout

```typescript
const spacious = renderMermaidAscii(diagram, {
  paddingX: 8,
  paddingY: 6,
  boxBorderPadding: 2,
})
```

## Supported Diagrams

### Flowcharts

```typescript
const flowchart = `
graph TD
  A[Start] --> B{Check}
  B -->|Yes| C[Process]
  B -->|No| D[Skip]
  C --> E[End]
  D --> E
`
console.log(renderMermaidAscii(flowchart))
```

### Sequence Diagrams

```typescript
const sequence = `
sequenceDiagram
  Alice->>Bob: Hello
  Bob-->>Alice: Hi!
`
console.log(renderMermaidAscii(sequence))
```

### Class Diagrams

```typescript
const classDiagram = `
classDiagram
  Animal <|-- Dog
  Animal <|-- Cat
  Animal: +name
  Animal: +makeSound()
`
console.log(renderMermaidAscii(classDiagram))
```

### ER Diagrams

```typescript
const er = `
erDiagram
  USER ||--o{ ORDER : places
  ORDER ||--|{ ITEM : contains
`
console.log(renderMermaidAscii(er))
```

### State Diagrams

```typescript
const state = `
stateDiagram-v2
  [*] --> Idle
  Idle --> Active: start
  Active --> Idle: stop
  Active --> [*]: done
`
console.log(renderMermaidAscii(state))
```

## Direction Handling

Flowcharts respect direction:

### Top to Bottom (TD/TB)

```typescript
const td = renderMermaidAscii(`graph TD; A --> B --> C`)
```

```
┌───┐
│ A │
└─┬─┘
  │
  ▼
┌───┐
│ B │
└─┬─┘
  │
  ▼
┌───┐
│ C │
└───┘
```

### Left to Right (LR)

```typescript
const lr = renderMermaidAscii(`graph LR; A --> B --> C`)
```

```
┌───┐     ┌───┐     ┌───┐
│ A │────►│ B │────►│ C │
└───┘     └───┘     └───┘
```

## CLI Integration

### Print to Terminal

```typescript
import { renderMermaidAscii } from 'beautiful-mermaid'

const diagram = `
graph LR
  Input --> Process --> Output
`

console.log(renderMermaidAscii(diagram))
```

### Save to File

```typescript
import { writeFileSync } from 'fs'
import { renderMermaidAscii } from 'beautiful-mermaid'

const diagram = `graph LR; A --> B --> C`
const ascii = renderMermaidAscii(diagram)

writeFileSync('diagram.txt', ascii)
```

### Code Comments

```typescript
const diagram = `graph LR; A --> B --> C`
const ascii = renderMermaidAscii(diagram, { useAscii: true })

// Prefix each line with comment syntax
const jsComment = ascii.split('\n').map(line => `// ${line}`).join('\n')
const pyComment = ascii.split('\n').map(line => `# ${line}`).join('\n')
```

## Common Patterns

### CLI Help Output

```typescript
function printHelp() {
  console.log(`
Usage: myapp <command>

Commands:
${renderMermaidAscii(`
graph LR
  init --> build --> test --> deploy
`, { paddingX: 2 })}

Options:
  --help    Show this help
  --version Show version
`)
}
```

### README Diagrams

```typescript
const readme = `
# Architecture

\`\`\`
${renderMermaidAscii(`
graph TD
  Client --> API
  API --> Database
  API --> Cache
`)}
\`\`\`
`
```

### Git Commit Diagrams

```typescript
const diagram = `
graph LR
  main --> feature
  feature --> PR
  PR --> main
`
console.log(renderMermaidAscii(diagram, { useAscii: true }))
```

## Error Handling

```typescript
import { renderMermaidAscii } from 'beautiful-mermaid'

try {
  const ascii = renderMermaidAscii(invalidDiagram)
  console.log(ascii)
} catch (e) {
  console.error('Failed to render ASCII:', e.message)
}
```

## Limitations

1. **Complex layouts**: Very complex diagrams may not render perfectly
2. **Long labels**: Node labels are limited by terminal width
3. **Nested subgraphs**: Deep nesting may overflow
4. **Special characters**: Unicode mode needs terminal support

## Tips

1. **Keep labels short**: ASCII has limited space
2. **Use LR for wide diagrams**: Fits terminal width better
3. **Use TD for tall diagrams**: Scrollable in terminals
4. **Test in target terminal**: Unicode support varies
5. **Use pure ASCII for maximum compatibility**: Works everywhere
6. **Adjust padding**: Smaller padding for compact output
