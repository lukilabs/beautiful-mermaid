# mermaid-er

Expert skill for Entity-Relationship diagrams with beautiful-mermaid.

## When to Use

- "ER diagram", "database schema", "entity relationship", "data model"
- Visualizing database tables, foreign keys, relationships
- Documenting data architecture, schema design

## Basic Syntax

```mermaid
erDiagram
  CUSTOMER ||--o{ ORDER : places
  ORDER ||--|{ LINE_ITEM : contains
  PRODUCT ||--o{ LINE_ITEM : "is in"
```

## Entities

### Simple Entity

```mermaid
erDiagram
  USER
```

### Entity with Attributes

```mermaid
erDiagram
  USER {
    int id PK
    string username UK
    string email UK
    string password_hash
    timestamp created_at
    timestamp updated_at
  }
```

### Attribute Types

Common types (any string works):

| Type | Description |
|------|-------------|
| `int` | Integer |
| `bigint` | Large integer |
| `string` | Text/varchar |
| `text` | Long text |
| `float` | Decimal number |
| `boolean` | True/false |
| `date` | Date only |
| `timestamp` | Date and time |
| `json` | JSON data |
| `uuid` | UUID |

### Attribute Keys

| Key | Meaning |
|-----|---------|
| `PK` | Primary Key |
| `FK` | Foreign Key |
| `UK` | Unique Key |

```mermaid
erDiagram
  ORDER {
    int id PK
    int customer_id FK
    string order_number UK
    float total
    string status
  }
```

## Relationships

### Cardinality Notation (Crow's Foot)

| Left | Right | Meaning |
|------|-------|---------|
| `\|o` | `o\|` | Zero or one |
| `\|\|` | `\|\|` | Exactly one |
| `}o` | `o{` | Zero or more |
| `}\|` | `\|{` | One or more |

### Relationship Syntax

```
ENTITY1 <left><right> ENTITY2 : "label"
```

### One-to-One

```mermaid
erDiagram
  USER ||--|| PROFILE : has
```

### One-to-Many

```mermaid
erDiagram
  CUSTOMER ||--o{ ORDER : places
```

### Many-to-Many (via junction table)

```mermaid
erDiagram
  STUDENT }|--|{ COURSE : enrolls
```

Or explicitly with junction:

```mermaid
erDiagram
  STUDENT ||--o{ ENROLLMENT : has
  COURSE ||--o{ ENROLLMENT : has

  ENROLLMENT {
    int student_id FK
    int course_id FK
    date enrolled_at
    string grade
  }
```

### Optional vs Required

```mermaid
erDiagram
  USER ||--o| PROFILE : "may have"
  USER ||--|{ POST : "must have"
```

- `o` = Optional (zero)
- `|` = Required (one)

## Relationship Labels

Labels describe the relationship:

```mermaid
erDiagram
  AUTHOR ||--o{ BOOK : writes
  PUBLISHER ||--o{ BOOK : publishes
  BOOK ||--|{ REVIEW : "is reviewed in"
```

## Common Patterns

### E-Commerce Schema

```mermaid
erDiagram
  CUSTOMER {
    int id PK
    string email UK
    string name
    string phone
    timestamp created_at
  }

  ADDRESS {
    int id PK
    int customer_id FK
    string street
    string city
    string state
    string zip
    string country
    boolean is_default
  }

  ORDER {
    int id PK
    int customer_id FK
    int shipping_address_id FK
    string order_number UK
    float subtotal
    float tax
    float shipping
    float total
    string status
    timestamp created_at
  }

  ORDER_ITEM {
    int id PK
    int order_id FK
    int product_id FK
    int quantity
    float unit_price
    float subtotal
  }

  PRODUCT {
    int id PK
    string sku UK
    string name
    text description
    float price
    int stock_quantity
    boolean is_active
  }

  CATEGORY {
    int id PK
    string name UK
    string slug UK
    int parent_id FK
  }

  PRODUCT_CATEGORY {
    int product_id FK
    int category_id FK
  }

  CUSTOMER ||--o{ ADDRESS : has
  CUSTOMER ||--o{ ORDER : places
  ORDER ||--|{ ORDER_ITEM : contains
  PRODUCT ||--o{ ORDER_ITEM : "is in"
  CATEGORY ||--o{ PRODUCT_CATEGORY : has
  PRODUCT ||--o{ PRODUCT_CATEGORY : "belongs to"
  CATEGORY ||--o| CATEGORY : "parent of"
```

### Blog/CMS Schema

```mermaid
erDiagram
  USER {
    int id PK
    string email UK
    string username UK
    string password_hash
    string role
    timestamp created_at
  }

  POST {
    int id PK
    int author_id FK
    string title
    string slug UK
    text content
    string status
    timestamp published_at
    timestamp created_at
    timestamp updated_at
  }

  CATEGORY {
    int id PK
    string name UK
    string slug UK
    text description
  }

  TAG {
    int id PK
    string name UK
    string slug UK
  }

  POST_TAG {
    int post_id FK
    int tag_id FK
  }

  COMMENT {
    int id PK
    int post_id FK
    int user_id FK
    int parent_id FK
    text content
    boolean is_approved
    timestamp created_at
  }

  USER ||--o{ POST : writes
  USER ||--o{ COMMENT : writes
  POST ||--o{ COMMENT : has
  COMMENT ||--o{ COMMENT : "replies to"
  CATEGORY ||--o{ POST : contains
  POST ||--o{ POST_TAG : has
  TAG ||--o{ POST_TAG : has
```

### SaaS Multi-tenant

```mermaid
erDiagram
  ORGANIZATION {
    int id PK
    string name
    string slug UK
    string plan
    timestamp created_at
  }

  USER {
    int id PK
    int organization_id FK
    string email UK
    string name
    string role
    timestamp created_at
  }

  TEAM {
    int id PK
    int organization_id FK
    string name
    text description
  }

  TEAM_MEMBER {
    int team_id FK
    int user_id FK
    string role
  }

  PROJECT {
    int id PK
    int organization_id FK
    int team_id FK
    string name
    text description
    string status
  }

  TASK {
    int id PK
    int project_id FK
    int assignee_id FK
    string title
    text description
    string priority
    string status
    date due_date
  }

  ORGANIZATION ||--o{ USER : has
  ORGANIZATION ||--o{ TEAM : has
  ORGANIZATION ||--o{ PROJECT : owns
  TEAM ||--o{ TEAM_MEMBER : has
  USER ||--o{ TEAM_MEMBER : "member of"
  TEAM ||--o{ PROJECT : manages
  PROJECT ||--o{ TASK : contains
  USER ||--o{ TASK : "assigned to"
```

### Auth/Permissions

```mermaid
erDiagram
  USER {
    int id PK
    string email UK
    string password_hash
    boolean is_active
    timestamp last_login
  }

  ROLE {
    int id PK
    string name UK
    text description
  }

  PERMISSION {
    int id PK
    string name UK
    string resource
    string action
  }

  USER_ROLE {
    int user_id FK
    int role_id FK
  }

  ROLE_PERMISSION {
    int role_id FK
    int permission_id FK
  }

  SESSION {
    int id PK
    int user_id FK
    string token UK
    timestamp expires_at
    timestamp created_at
  }

  USER ||--o{ USER_ROLE : has
  ROLE ||--o{ USER_ROLE : "assigned to"
  ROLE ||--o{ ROLE_PERMISSION : has
  PERMISSION ||--o{ ROLE_PERMISSION : "granted by"
  USER ||--o{ SESSION : has
```

## Rendering

```typescript
import { renderMermaid, THEMES } from 'beautiful-mermaid'

const erDiagram = `
erDiagram
  CUSTOMER ||--o{ ORDER : places
  ORDER ||--|{ LINE_ITEM : contains
  PRODUCT ||--o{ LINE_ITEM : "is in"
`

// SVG output
const svg = await renderMermaid(erDiagram, THEMES['nord'])

// ASCII output
import { renderMermaidAscii } from 'beautiful-mermaid'
const ascii = renderMermaidAscii(erDiagram)
```

## Best Practices

1. **Use singular names**: `USER` not `USERS`
2. **Include key types**: Mark PK, FK, UK explicitly
3. **Show data types**: Helps communicate constraints
4. **Label relationships**: Verbs describe the connection
5. **Group related entities**: Keep the diagram readable
6. **Show junction tables**: Make many-to-many explicit
7. **Include timestamps**: `created_at`, `updated_at` are common

## Cardinality Quick Reference

| Symbol | Meaning |
|--------|---------|
| `\|\|` | Exactly one (required) |
| `\|o` | Zero or one (optional) |
| `\|{` | One or more (required many) |
| `o{` | Zero or more (optional many) |
