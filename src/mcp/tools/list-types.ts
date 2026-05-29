// ============================================================================
// list_diagram_types tool handler
//
// Returns a static list of supported Mermaid diagram types with
// descriptions and examples. No parameters required.
// ============================================================================

/**
 * Supported diagram types with descriptions and examples.
 */
const DIAGRAM_TYPES = [
  {
    name: 'flowchart',
    description: 'Flowchart and graph diagrams (graph TD / flowchart LR)',
    example: 'graph TD\n  A --> B --> C',
  },
  {
    name: 'sequence',
    description: 'Sequence diagrams for message-based interactions',
    example: 'sequenceDiagram\n  A->>B: Hello\n  B->>A: Hi',
  },
  {
    name: 'class',
    description: 'UML class diagrams with inheritance, composition, and cardinality',
    example: 'classDiagram\n  Animal <|-- Duck\n  Animal : +int age',
  },
  {
    name: 'er',
    description: 'Entity-Relationship diagrams for database modeling',
    example: 'erDiagram\n  CUSTOMER ||--o{ ORDER : places',
  },
  {
    name: 'xychart',
    description: 'XY charts and bar charts for data visualization',
    example: 'xychart-beta\n  line [1,2,3,4]',
  },
  {
    name: 'state',
    description: 'State diagrams for finite state machines',
    example: 'stateDiagram-v2\n  [*] --> Active\n  Active --> Inactive',
  },
] as const

/**
 * MCP tool handler for `list_diagram_types`.
 * Returns the static list of supported diagram types.
 */
export function handleListDiagramTypes(): { content: Array<{ type: 'text'; text: string }> } {
  return {
    content: [{ type: 'text', text: JSON.stringify(DIAGRAM_TYPES, null, 2) }],
  }
}
