# Node Shapes Reference

Visual reference for all 12+ node shapes in beautiful-mermaid flowcharts.

## Shape Syntax

| Shape | Syntax | Visual |
|-------|--------|--------|
| Rectangle | `A[Text]` | `┌────┐` |
| Rounded | `A(Text)` | `╭────╮` |
| Stadium | `A([Text])` | `(════)` |
| Diamond | `A{Text}` | `◇` |
| Hexagon | `A{{Text}}` | `⬡` |
| Parallelogram | `A[/Text/]` | `/═══/` |
| Trapezoid | `A[/Text\]` | `/═══\` |
| Inv. Trapezoid | `A[\Text/]` | `\═══/` |
| Circle | `A((Text))` | `○` |
| Double Circle | `A(((Text)))` | `◎` |
| Cylinder | `A[(Text)]` | `⌸` |
| Subroutine | `A[[Text]]` | `║═══║` |
| Flag | `A>Text]` | `▷═══│` |

## Detailed Examples

### Rectangle (Default)
Standard rectangular node. Best for general processes.

```mermaid
graph TD
  A[Process Step]
```

```
┌──────────────┐
│ Process Step │
└──────────────┘
```

### Rounded Rectangle
Softer appearance. Good for start/end or user-facing steps.

```mermaid
graph TD
  A(Start Process)
```

```
╭────────────────╮
│ Start Process  │
╰────────────────╯
```

### Stadium / Pill
Pill-shaped node. Great for labels, tags, or categories.

```mermaid
graph TD
  A([Label])
```

```
(═══════)
( Label )
(═══════)
```

### Diamond (Decision)
Classic decision/branching node.

```mermaid
graph TD
  A{Is Valid?}
```

```
    ◇
   / \
  /   \
 │Valid?│
  \   /
   \ /
    ◇
```

### Hexagon
Six-sided node. Good for preparation or setup steps.

```mermaid
graph TD
  A{{Prepare Data}}
```

```
  ╱──────────╲
 /            \
│ Prepare Data │
 \            /
  ╲──────────╱
```

### Parallelogram
Input/Output operations (traditional flowchart symbol).

```mermaid
graph TD
  A[/Input Data/]
```

```
  ╱──────────╱
 / Input Data /
╱──────────╱
```

### Trapezoid
Manual operation or wider-at-top process.

```mermaid
graph TD
  A[/Manual Step\]
```

```
╱────────────────╲
│   Manual Step   │
╲────────────────╱
```

### Inverse Trapezoid
Narrower at top, good for funneling or filtering.

```mermaid
graph TD
  A[\Filter\]
```

```
╲────────────────╱
│     Filter     │
╱────────────────╲
```

### Circle
Simple circular node. Good for events or states.

```mermaid
graph TD
  A((Event))
```

```
  ╭─────╮
 (       )
 ( Event )
 (       )
  ╰─────╯
```

### Double Circle
Terminal/final state (from state machine notation).

```mermaid
graph TD
  A(((End)))
```

```
  ╭──────╮
 (( ╭──╮ ))
 (( │End│ ))
 (( ╰──╯ ))
  ╰──────╯
```

### Cylinder
Database or storage. Traditional data store symbol.

```mermaid
graph TD
  A[(Database)]
```

```
  ╭────────╮
  ╰────────╯
  │        │
  │Database│
  │        │
  ╰────────╯
```

### Subroutine
Predefined process or function call.

```mermaid
graph TD
  A[[Process Function]]
```

```
║═══════════════════║
║ Process Function  ║
║═══════════════════║
```

### Flag / Asymmetric
Asymmetric shape. Good for events or signals.

```mermaid
graph TD
  A>Signal]
```

```
▷═══════════│
│   Signal  │
▷═══════════│
```

## Shape Usage Guidelines

| Use Case | Recommended Shape |
|----------|-------------------|
| Process step | Rectangle `[]` |
| Start/End | Rounded `()` or Stadium `([])` |
| Decision | Diamond `{}` |
| Input/Output | Parallelogram `[/ /]` |
| Database | Cylinder `[()]` |
| Function call | Subroutine `[[]]` |
| Event/State | Circle `(())` |
| Terminal state | Double Circle `((()))` |
| Preparation | Hexagon `{{}}` |
| Manual process | Trapezoid `[/ \]` |

## Combining Shapes

```mermaid
graph TD
  Start([Start]) --> Input[/User Input/]
  Input --> Check{Valid?}
  Check -->|Yes| Process[Process Data]
  Check -->|No| Error>Error Event]
  Process --> Store[(Save to DB)]
  Store --> End(((Done)))
  Error --> End
```

## ASCII Rendering

Shapes render with box-drawing characters:

```
┌──────┐     ╭──────╮     ┌──────┐
│Rect  │     │Round │     │◇Dec │
└──────┘     ╰──────╯     └──────┘
```

Note: Complex shapes (hexagon, trapezoid) render as rectangles in ASCII mode.

## Tips

1. **Be consistent**: Use the same shape for the same type of step
2. **Don't overuse**: 3-4 different shapes per diagram max
3. **Follow conventions**: Diamond for decisions, cylinder for databases
4. **Consider ASCII**: Not all shapes render in terminal output
5. **Label clearly**: Shape + clear text = easy understanding
