/**
 * Sample definitions for the beautiful-mermaid visual test suite.
 *
 * Shared by:
 *   - index.ts     — generates the HTML visual test page
 *   - bench.ts     — runs performance benchmarks in Bun (no browser)
 *   - dev.ts       — dev server with live reload
 *
 * Every supported feature, shape, edge type, block construct, and theme
 * variant is exercised by at least one sample.
 */

export interface Sample {
  title: string
  description: string
  source: string
  /** Optional category tag for grouping in the Table of Contents */
  category?: string
  options?: { bg?: string; fg?: string; line?: string; accent?: string; muted?: string; surface?: string; border?: string; font?: string; padding?: number; transparent?: boolean }
}

export const samples: Sample[] = [

  // ══════════════════════════════════════════════════════════════════════════
  //  HERO — Showcase diagram
  // ══════════════════════════════════════════════════════════════════════════

  {
    title: 'Beautiful Mermaid',
    category: 'Hero',
    description: 'Mermaid rendering, made beautiful.',
    source: `stateDiagram-v2
    direction LR
    [*] --> Input
    Input --> Parse: DSL
    Parse --> Layout: AST
    Layout --> SVG: Vector
    Layout --> ASCII: Text
    SVG --> Theme
    ASCII --> Theme
    Theme --> Output
    Output --> [*]`,
    options: { transparent: true },
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  FLOWCHART — Shapes
  // ══════════════════════════════════════════════════════════════════════════

  {
    title: 'Simple Flow',
    category: 'Flowchart',
    description: 'Basic linear flow with three nodes connected by solid arrows.',
    source: `graph TD
  A[Start] --> B[Process] --> C[End]`,
  },
  {
    title: 'Original Node Shapes',
    category: 'Flowchart',
    description: 'Rectangle, rounded, diamond, stadium, and circle.',
    source: `graph LR
  A[Rectangle] --> B(Rounded)
  B --> C{Diamond}
  C --> D([Stadium])
  D --> E((Circle))`,
  },
  {
    title: 'Batch 1 Shapes',
    category: 'Flowchart',
    description: 'Subroutine `[[text]]`, double circle `(((text)))`, and hexagon `{{text}}`.',
    source: `graph LR
  A[[Subroutine]] --> B(((Double Circle)))
  B --> C{{Hexagon}}`,
  },
  {
    title: 'Batch 2 Shapes',
    category: 'Flowchart',
    description: 'Cylinder `[(text)]`, asymmetric `>text]`, trapezoid `[/text\\]`, and inverse trapezoid `[\\text/]`.',
    source: `graph LR
  A[(Database)] --> B>Flag Shape]
  B --> C[/Wider Bottom\\]
  C --> D[\\Wider Top/]`,
  },
  {
    title: 'All 12 Flowchart Shapes',
    category: 'Flowchart',
    description: 'Every supported flowchart shape in a single diagram.',
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

  // ══════════════════════════════════════════════════════════════════════════
  //  FLOWCHART — Edges
  // ══════════════════════════════════════════════════════════════════════════

  {
    title: 'All Edge Styles',
    category: 'Flowchart',
    description: 'Solid, dotted, and thick arrows with labels.',
    source: `graph TD
  A[Source] -->|solid| B[Target 1]
  A -.->|dotted| C[Target 2]
  A ==>|thick| D[Target 3]`,
  },
  {
    title: 'No-Arrow Edges',
    category: 'Flowchart',
    description: 'Lines without arrowheads: solid `---`, dotted `-.-`, thick `===`.',
    source: `graph TD
  A[Node 1] ---|related| B[Node 2]
  B -.- C[Node 3]
  C === D[Node 4]`,
  },
  {
    title: 'Bidirectional Arrows',
    category: 'Flowchart',
    description: 'Arrows in both directions: `<-->`, `<-.->`, `<==>`.',
    source: `graph LR
  A[Client] <-->|sync| B[Server]
  B <-.->|heartbeat| C[Monitor]
  C <==>|data| D[Storage]`,
  },
  {
    title: 'Parallel Links (&)',
    category: 'Flowchart',
    description: 'Using `&` to create multiple edges from/to groups of nodes.',
    source: `graph TD
  A[Input] & B[Config] --> C[Processor]
  C --> D[Output] & E[Log]`,
  },
  {
    title: 'Chained Edges',
    category: 'Flowchart',
    description: 'A long chain of nodes demonstrating edge chaining syntax.',
    source: `graph LR
  A[Step 1] --> B[Step 2] --> C[Step 3] --> D[Step 4] --> E[Step 5]`,
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  FLOWCHART — Directions
  // ══════════════════════════════════════════════════════════════════════════

  {
    title: 'Direction: Left-Right (LR)',
    category: 'Flowchart',
    description: 'Horizontal layout flowing left to right.',
    source: `graph LR
  A[Input] --> B[Transform] --> C[Output]`,
  },
  {
    title: 'Direction: Bottom-Top (BT)',
    category: 'Flowchart',
    description: 'Vertical layout flowing from bottom to top.',
    source: `graph BT
  A[Foundation] --> B[Layer 2] --> C[Top]`,
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  FLOWCHART — Subgraphs
  // ══════════════════════════════════════════════════════════════════════════

  {
    title: 'Subgraphs',
    category: 'Flowchart',
    description: 'Grouped nodes inside labeled subgraph containers.',
    source: `graph TD
  subgraph Frontend
    A[React App] --> B[State Manager]
  end
  subgraph Backend
    C[API Server] --> D[Database]
  end
  B --> C`,
  },
  {
    title: 'Nested Subgraphs',
    category: 'Flowchart',
    description: 'Subgraphs inside subgraphs for hierarchical grouping.',
    source: `graph TD
  subgraph Cloud
    subgraph us-east [US East Region]
      A[Web Server] --> B[App Server]
    end
    subgraph us-west [US West Region]
      C[Web Server] --> D[App Server]
    end
  end
  E[Load Balancer] --> A
  E --> C`,
  },
  {
    title: 'Subgraph Direction Override',
    category: 'Flowchart',
    description: 'Using `direction LR` inside a subgraph while the outer graph flows TD.',
    source: `graph TD
  subgraph pipeline [Processing Pipeline]
    direction LR
    A[Input] --> B[Parse] --> C[Transform] --> D[Output]
  end
  E[Source] --> A
  D --> F[Sink]`,
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  FLOWCHART — Styling
  // ══════════════════════════════════════════════════════════════════════════

  {
    title: '::: Class Shorthand',
    category: 'Flowchart',
    description: 'Assigning classes with `:::` syntax directly on node definitions.',
    source: `graph TD
  A[Normal]:::default --> B[Highlighted]:::highlight --> C[Error]:::error
  classDef default fill:#f4f4f5,stroke:#a1a1aa
  classDef highlight fill:#fbbf24,stroke:#d97706
  classDef error fill:#ef4444,stroke:#dc2626`,
  },
  {
    title: 'Inline Style Overrides',
    category: 'Flowchart',
    description: 'Using `style` statements to override node fill and stroke colors.',
    source: `graph TD
  A[Default] --> B[Custom Colors] --> C[Another Custom]
  style B fill:#3b82f6,stroke:#1d4ed8,color:#ffffff
  style C fill:#10b981,stroke:#059669`,
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  FLOWCHART — Real-World Diagrams
  // ══════════════════════════════════════════════════════════════════════════

  {
    title: 'CI/CD Pipeline',
    category: 'Flowchart',
    description: 'A realistic CI/CD pipeline with decision points, feedback loops, and deployment stages.',
    source: `graph TD
  subgraph ci [CI Pipeline]
    A[Push Code] --> B{Tests Pass?}
    B -->|Yes| C[Build Image]
    B -->|No| D[Fix & Retry]
    D -.-> A
  end
  C --> E([Deploy Staging])
  E --> F{QA Approved?}
  F -->|Yes| G((Production))
  F -->|No| D`,
  },
  {
    title: 'System Architecture',
    category: 'Flowchart',
    description: 'A microservices architecture with multiple services and data stores.',
    source: `graph LR
  subgraph clients [Client Layer]
    A([Web App]) --> B[API Gateway]
    C([Mobile App]) --> B
  end
  subgraph services [Service Layer]
    B --> D[Auth Service]
    B --> E[User Service]
    B --> F[Order Service]
  end
  subgraph data [Data Layer]
    D --> G[(Auth DB)]
    E --> H[(User DB)]
    F --> I[(Order DB)]
    F --> J([Message Queue])
  end`,
  },
  {
    title: 'Decision Tree',
    category: 'Flowchart',
    description: 'A branching decision flowchart with multiple outcomes.',
    source: `graph TD
  A{Is it raining?} -->|Yes| B{Have umbrella?}
  A -->|No| C([Go outside])
  B -->|Yes| D([Go with umbrella])
  B -->|No| E{Is it heavy?}
  E -->|Yes| F([Stay inside])
  E -->|No| G([Run for it])`,
  },
  {
    title: 'Git Branching Workflow',
    category: 'Flowchart',
    description: 'A git flow showing feature branches, PRs, and release cycle.',
    source: `graph LR
  A[main] --> B[develop]
  B --> C[feature/auth]
  B --> D[feature/ui]
  C --> E{PR Review}
  D --> E
  E -->|approved| B
  B --> F[release/1.0]
  F --> G{Tests?}
  G -->|pass| A
  G -->|fail| F`,
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  STATE DIAGRAMS
  // ══════════════════════════════════════════════════════════════════════════

  {
    title: 'Basic State Diagram',
    category: 'State',
    description: 'A simple `stateDiagram-v2` with start/end pseudostates and transitions.',
    source: `stateDiagram-v2
  [*] --> Idle
  Idle --> Active : start
  Active --> Idle : cancel
  Active --> Done : complete
  Done --> [*]`,
  },
  {
    title: 'State: Composite States',
    category: 'State',
    description: 'Nested composite states with inner transitions.',
    source: `stateDiagram-v2
  [*] --> Idle
  Idle --> Processing : submit
  state Processing {
    parse --> validate
    validate --> execute
  }
  Processing --> Complete : done
  Processing --> Error : fail
  Error --> Idle : retry
  Complete --> [*]`,
  },
  {
    title: 'State: Connection Lifecycle',
    category: 'State',
    description: 'TCP-like connection state machine with multiple states.',
    source: `stateDiagram-v2
  [*] --> Closed
  Closed --> Connecting : connect
  Connecting --> Connected : success
  Connecting --> Closed : timeout
  Connected --> Disconnecting : close
  Connected --> Reconnecting : error
  Reconnecting --> Connected : success
  Reconnecting --> Closed : max_retries
  Disconnecting --> Closed : done
  Closed --> [*]`,
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  SEQUENCE DIAGRAMS — Core Features
  // ══════════════════════════════════════════════════════════════════════════

  {
    title: 'Sequence: Basic Messages',
    category: 'Sequence',
    description: 'Simple request/response between two participants.',
    source: `sequenceDiagram
  Alice->>Bob: Hello Bob!
  Bob-->>Alice: Hi Alice!`,
  },
  {
    title: 'Sequence: Participant Aliases',
    category: 'Sequence',
    description: 'Using `participant ... as ...` for compact diagram IDs with readable labels.',
    source: `sequenceDiagram
  participant A as Alice
  participant B as Bob
  participant C as Charlie
  A->>B: Hello
  B->>C: Forward
  C-->>A: Reply`,
  },
  {
    title: 'Sequence: Actor Stick Figures',
    category: 'Sequence',
    description: 'Using `actor` instead of `participant` renders stick figures instead of boxes.',
    source: `sequenceDiagram
  actor U as User
  participant S as System
  participant DB as Database
  U->>S: Click button
  S->>DB: Query
  DB-->>S: Results
  S-->>U: Display`,
  },
  {
    title: 'Sequence: Arrow Types',
    category: 'Sequence',
    description: 'All arrow types: solid `->>` and dashed `-->>` with filled arrowheads, open arrows `-)` .',
    source: `sequenceDiagram
  A->>B: Solid arrow (sync)
  B-->>A: Dashed arrow (return)
  A-)B: Open arrow (async)
  B--)A: Open dashed arrow`,
  },
  {
    title: 'Sequence: Activation Boxes',
    category: 'Sequence',
    description: 'Using `+` and `-` to show when participants are active.',
    source: `sequenceDiagram
  participant C as Client
  participant S as Server
  C->>+S: Request
  S->>+S: Process
  S->>-S: Done
  S-->>-C: Response`,
  },
  {
    title: 'Sequence: Self-Messages',
    category: 'Sequence',
    description: 'A participant sending a message to itself (displayed as a loop arrow).',
    source: `sequenceDiagram
  participant S as Server
  S->>S: Internal process
  S->>S: Validate
  S-->>S: Log`,
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  SEQUENCE DIAGRAMS — Blocks
  // ══════════════════════════════════════════════════════════════════════════

  {
    title: 'Sequence: Loop Block',
    category: 'Sequence',
    description: 'A `loop` construct wrapping repeated message exchanges.',
    source: `sequenceDiagram
  participant C as Client
  participant S as Server
  C->>S: Connect
  loop Every 30s
    C->>S: Heartbeat
    S-->>C: Ack
  end
  C->>S: Disconnect`,
  },
  {
    title: 'Sequence: Alt/Else Block',
    category: 'Sequence',
    description: 'Conditional branching with `alt` (if) and `else` blocks.',
    source: `sequenceDiagram
  participant C as Client
  participant S as Server
  C->>S: Login
  alt Valid credentials
    S-->>C: 200 OK
  else Invalid
    S-->>C: 401 Unauthorized
  else Account locked
    S-->>C: 403 Forbidden
  end`,
  },
  {
    title: 'Sequence: Opt Block',
    category: 'Sequence',
    description: 'Optional block — executes only if condition is met.',
    source: `sequenceDiagram
  participant A as App
  participant C as Cache
  participant DB as Database
  A->>C: Get data
  C-->>A: Cache miss
  opt Cache miss
    A->>DB: Query
    DB-->>A: Results
    A->>C: Store in cache
  end`,
  },
  {
    title: 'Sequence: Par Block',
    category: 'Sequence',
    description: 'Parallel execution with `par`/`and` constructs.',
    source: `sequenceDiagram
  participant C as Client
  participant A as AuthService
  participant U as UserService
  participant O as OrderService
  C->>A: Authenticate
  par Fetch user data
    A->>U: Get profile
  and Fetch orders
    A->>O: Get orders
  end
  A-->>C: Combined response`,
  },
  {
    title: 'Sequence: Critical Block',
    category: 'Sequence',
    description: 'Critical section that must complete atomically.',
    source: `sequenceDiagram
  participant A as App
  participant DB as Database
  A->>DB: BEGIN
  critical Transaction
    A->>DB: UPDATE accounts
    A->>DB: INSERT log
  end
  A->>DB: COMMIT`,
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  SEQUENCE DIAGRAMS — Notes
  // ══════════════════════════════════════════════════════════════════════════

  {
    title: 'Sequence: Notes (Right/Left/Over)',
    category: 'Sequence',
    description: 'Notes positioned to the right, left, or over participants.',
    source: `sequenceDiagram
  participant A as Alice
  participant B as Bob
  Note left of A: Alice prepares
  A->>B: Hello
  Note right of B: Bob thinks
  B-->>A: Reply
  Note over A,B: Conversation complete`,
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  SEQUENCE DIAGRAMS — Complex / Real-World
  // ══════════════════════════════════════════════════════════════════════════

  {
    title: 'Sequence: OAuth 2.0 Flow',
    category: 'Sequence',
    description: 'Full OAuth 2.0 authorization code flow with token exchange.',
    source: `sequenceDiagram
  actor U as User
  participant App as Client App
  participant Auth as Auth Server
  participant API as Resource API
  U->>App: Click Login
  App->>Auth: Authorization request
  Auth->>U: Login page
  U->>Auth: Credentials
  Auth-->>App: Authorization code
  App->>Auth: Exchange code for token
  Auth-->>App: Access token
  App->>API: Request + token
  API-->>App: Protected resource
  App-->>U: Display data`,
  },
  {
    title: 'Sequence: Database Transaction',
    category: 'Sequence',
    description: 'Multi-step database transaction with rollback handling.',
    source: `sequenceDiagram
  participant C as Client
  participant S as Server
  participant DB as Database
  C->>S: POST /transfer
  S->>DB: BEGIN
  S->>DB: Debit account A
  alt Success
    S->>DB: Credit account B
    S->>DB: INSERT audit_log
    S->>DB: COMMIT
    S-->>C: 200 OK
  else Insufficient funds
    S->>DB: ROLLBACK
    S-->>C: 400 Bad Request
  end`,
  },
  {
    title: 'Sequence: Microservice Orchestration',
    category: 'Sequence',
    description: 'Complex multi-service flow with parallel calls and error handling.',
    source: `sequenceDiagram
  participant G as Gateway
  participant A as Auth
  participant U as Users
  participant O as Orders
  participant N as Notify
  G->>A: Validate token
  A-->>G: Valid
  par Fetch data
    G->>U: Get user
    U-->>G: User data
  and
    G->>O: Get orders
    O-->>G: Order list
  end
  G->>N: Send notification
  N-->>G: Queued
  Note over G: Aggregate response`,
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  CLASS DIAGRAMS — Core Features
  // ══════════════════════════════════════════════════════════════════════════

  {
    title: 'Class: Basic Class',
    category: 'Class',
    description: 'A single class with attributes and methods, rendered as a 3-compartment box.',
    source: `classDiagram
  class Animal {
    +String name
    +int age
    +eat() void
    +sleep() void
  }`,
  },
  {
    title: 'Class: Visibility Markers',
    category: 'Class',
    description: 'All four visibility levels: `+` (public), `-` (private), `#` (protected), `~` (package).',
    source: `classDiagram
  class User {
    +String name
    -String password
    #int internalId
    ~String packageField
    +login() bool
    -hashPassword() String
    #validate() void
    ~notify() void
  }`,
  },
  {
    title: 'Class: Interface Annotation',
    category: 'Class',
    description: 'Using `<<interface>>` annotation above the class name.',
    source: `classDiagram
  class Serializable {
    <<interface>>
    +serialize() String
    +deserialize(data) void
  }`,
  },
  {
    title: 'Class: Abstract Annotation',
    category: 'Class',
    description: 'Using `<<abstract>>` annotation for abstract classes.',
    source: `classDiagram
  class Shape {
    <<abstract>>
    +String color
    +area() double
    +draw() void
  }`,
  },
  {
    title: 'Class: Enum Annotation',
    category: 'Class',
    description: 'Using `<<enumeration>>` annotation for enum types.',
    source: `classDiagram
  class Status {
    <<enumeration>>
    ACTIVE
    INACTIVE
    PENDING
    DELETED
  }`,
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  CLASS DIAGRAMS — Relationships
  // ══════════════════════════════════════════════════════════════════════════

  {
    title: 'Class: Inheritance (<|--)',
    category: 'Class',
    description: 'Inheritance relationship rendered with a hollow triangle marker.',
    source: `classDiagram
  class Animal {
    +String name
    +eat() void
  }
  class Dog {
    +String breed
    +bark() void
  }
  class Cat {
    +bool isIndoor
    +meow() void
  }
  Animal <|-- Dog
  Animal <|-- Cat`,
  },
  {
    title: 'Class: Composition (*--)',
    category: 'Class',
    description: 'Composition — "owns" relationship with filled diamond marker.',
    source: `classDiagram
  class Car {
    +String model
    +start() void
  }
  class Engine {
    +int horsepower
    +rev() void
  }
  Car *-- Engine`,
  },
  {
    title: 'Class: Aggregation (o--)',
    category: 'Class',
    description: 'Aggregation — "has" relationship with hollow diamond marker.',
    source: `classDiagram
  class University {
    +String name
  }
  class Department {
    +String faculty
  }
  University o-- Department`,
  },
  {
    title: 'Class: Association (-->)',
    category: 'Class',
    description: 'Basic association — simple directed arrow.',
    source: `classDiagram
  class Customer {
    +String name
  }
  class Order {
    +int orderId
  }
  Customer --> Order`,
  },
  {
    title: 'Class: Dependency (..>)',
    category: 'Class',
    description: 'Dependency — dashed line with open arrow.',
    source: `classDiagram
  class Service {
    +process() void
  }
  class Repository {
    +find() Object
  }
  Service ..> Repository`,
  },
  {
    title: 'Class: Realization (..|>)',
    category: 'Class',
    description: 'Realization — dashed line with hollow triangle (implements interface).',
    source: `classDiagram
  class Flyable {
    <<interface>>
    +fly() void
  }
  class Bird {
    +fly() void
    +sing() void
  }
  Bird ..|> Flyable`,
  },
  {
    title: 'Class: All 6 Relationship Types',
    category: 'Class',
    description: 'Every relationship type in a single diagram for comparison.',
    source: `classDiagram
  A <|-- B : inheritance
  C *-- D : composition
  E o-- F : aggregation
  G --> H : association
  I ..> J : dependency
  K ..|> L : realization`,
  },
  {
    title: 'Class: Relationship Labels',
    category: 'Class',
    description: 'Labeled relationships between classes with descriptive text.',
    source: `classDiagram
  class Teacher {
    +String name
  }
  class Student {
    +String name
  }
  class Course {
    +String title
  }
  Teacher --> Course : teaches
  Student --> Course : enrolled in`,
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  CLASS DIAGRAMS — Complex / Real-World
  // ══════════════════════════════════════════════════════════════════════════

  {
    title: 'Class: Design Pattern — Observer',
    category: 'Class',
    description: 'The Observer (publish-subscribe) design pattern with interface + concrete implementations.',
    source: `classDiagram
  class Subject {
    <<interface>>
    +attach(Observer) void
    +detach(Observer) void
    +notify() void
  }
  class Observer {
    <<interface>>
    +update() void
  }
  class EventEmitter {
    -List~Observer~ observers
    +attach(Observer) void
    +detach(Observer) void
    +notify() void
  }
  class Logger {
    +update() void
  }
  class Alerter {
    +update() void
  }
  Subject <|.. EventEmitter
  Observer <|.. Logger
  Observer <|.. Alerter
  EventEmitter --> Observer`,
  },
  {
    title: 'Class: MVC Architecture',
    category: 'Class',
    description: 'Model-View-Controller pattern showing relationships between layers.',
    source: `classDiagram
  class Model {
    -data Map
    +getData() Map
    +setData(key, val) void
    +notify() void
  }
  class View {
    -model Model
    +render() void
    +update() void
  }
  class Controller {
    -model Model
    -view View
    +handleInput(event) void
    +updateModel(data) void
  }
  Controller --> Model : updates
  Controller --> View : refreshes
  View --> Model : reads
  Model ..> View : notifies`,
  },
  {
    title: 'Class: Full Hierarchy',
    category: 'Class',
    description: 'A complete class hierarchy with abstract base, interfaces, and concrete classes.',
    source: `classDiagram
  class Animal {
    <<abstract>>
    +String name
    +int age
    +eat() void
    +sleep() void
  }
  class Mammal {
    +bool warmBlooded
    +nurse() void
  }
  class Bird {
    +bool canFly
    +layEggs() void
  }
  class Dog {
    +String breed
    +bark() void
  }
  class Cat {
    +bool isIndoor
    +purr() void
  }
  class Parrot {
    +String vocabulary
    +speak() void
  }
  Animal <|-- Mammal
  Animal <|-- Bird
  Mammal <|-- Dog
  Mammal <|-- Cat
  Bird <|-- Parrot`,
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  ER DIAGRAMS — Core Features
  // ══════════════════════════════════════════════════════════════════════════

  {
    title: 'ER: Basic Relationship',
    category: 'ER',
    description: 'A simple one-to-many relationship between two entities.',
    source: `erDiagram
  CUSTOMER ||--o{ ORDER : places`,
  },
  {
    title: 'ER: Entity with Attributes',
    category: 'ER',
    description: 'An entity with typed attributes and `PK`/`FK`/`UK` key badges.',
    source: `erDiagram
  CUSTOMER {
    int id PK
    string name
    string email UK
    date created_at
  }`,
  },
  {
    title: 'ER: Attribute Keys (PK, FK, UK)',
    category: 'ER',
    description: 'All three key constraint types rendered as badges.',
    source: `erDiagram
  ORDER {
    int id PK
    int customer_id FK
    string invoice_number UK
    decimal total
    date order_date
    string status
  }`,
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  ER DIAGRAMS — Cardinality Types
  // ══════════════════════════════════════════════════════════════════════════

  {
    title: 'ER: Exactly One to Exactly One (||--||)',
    category: 'ER',
    description: 'One-to-one mandatory relationship.',
    source: `erDiagram
  PERSON ||--|| PASSPORT : has`,
  },
  {
    title: 'ER: Exactly One to Zero-or-Many (||--o{)',
    category: 'ER',
    description: 'Classic one-to-many optional relationship (crow\'s foot).',
    source: `erDiagram
  CUSTOMER ||--o{ ORDER : places`,
  },
  {
    title: 'ER: Zero-or-One to One-or-Many (|o--|{)',
    category: 'ER',
    description: 'Optional on one side, at-least-one on the other.',
    source: `erDiagram
  SUPERVISOR |o--|{ EMPLOYEE : manages`,
  },
  {
    title: 'ER: One-or-More to Zero-or-Many (}|--o{)',
    category: 'ER',
    description: 'At-least-one to zero-or-many relationship.',
    source: `erDiagram
  TEACHER }|--o{ COURSE : teaches`,
  },
  {
    title: 'ER: All Cardinality Types',
    category: 'ER',
    description: 'Every cardinality combination in one diagram.',
    source: `erDiagram
  A ||--|| B : one-to-one
  C ||--o{ D : one-to-many
  E |o--|{ F : opt-to-many
  G }|--o{ H : many-to-many`,
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  ER DIAGRAMS — Line Styles
  // ══════════════════════════════════════════════════════════════════════════

  {
    title: 'ER: Identifying (Solid) Relationship',
    category: 'ER',
    description: 'Solid line indicating an identifying relationship (child depends on parent for identity).',
    source: `erDiagram
  ORDER ||--|{ LINE_ITEM : contains`,
  },
  {
    title: 'ER: Non-Identifying (Dashed) Relationship',
    category: 'ER',
    description: 'Dashed line indicating a non-identifying relationship.',
    source: `erDiagram
  USER ||..o{ LOG_ENTRY : generates
  USER ||..o{ SESSION : opens`,
  },
  {
    title: 'ER: Mixed Identifying & Non-Identifying',
    category: 'ER',
    description: 'Both solid and dashed lines in the same diagram.',
    source: `erDiagram
  ORDER ||--|{ LINE_ITEM : contains
  ORDER ||..o{ SHIPMENT : ships-via
  PRODUCT ||--o{ LINE_ITEM : includes
  PRODUCT ||..o{ REVIEW : receives`,
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  ER DIAGRAMS — Complex / Real-World
  // ══════════════════════════════════════════════════════════════════════════

  {
    title: 'ER: E-Commerce Schema',
    category: 'ER',
    description: 'Full e-commerce database schema with customers, orders, products, and line items.',
    source: `erDiagram
  CUSTOMER {
    int id PK
    string name
    string email UK
  }
  ORDER {
    int id PK
    date created
    int customer_id FK
  }
  PRODUCT {
    int id PK
    string name
    float price
  }
  LINE_ITEM {
    int id PK
    int order_id FK
    int product_id FK
    int quantity
  }
  CUSTOMER ||--o{ ORDER : places
  ORDER ||--|{ LINE_ITEM : contains
  PRODUCT ||--o{ LINE_ITEM : includes`,
  },
  {
    title: 'ER: Blog Platform Schema',
    category: 'ER',
    description: 'Blog system with users, posts, comments, and tags.',
    source: `erDiagram
  USER {
    int id PK
    string username UK
    string email UK
    date joined
  }
  POST {
    int id PK
    string title
    text content
    int author_id FK
    date published
  }
  COMMENT {
    int id PK
    text body
    int post_id FK
    int user_id FK
    date created
  }
  TAG {
    int id PK
    string name UK
  }
  USER ||--o{ POST : writes
  USER ||--o{ COMMENT : authors
  POST ||--o{ COMMENT : has
  POST }|--o{ TAG : tagged-with`,
  },
  {
    title: 'ER: School Management Schema',
    category: 'ER',
    description: 'School system with students, teachers, courses, and enrollments.',
    source: `erDiagram
  STUDENT {
    int id PK
    string name
    date dob
    string grade
  }
  TEACHER {
    int id PK
    string name
    string department
  }
  COURSE {
    int id PK
    string title
    int teacher_id FK
    int credits
  }
  ENROLLMENT {
    int id PK
    int student_id FK
    int course_id FK
    string semester
    float grade
  }
  TEACHER ||--o{ COURSE : teaches
  STUDENT ||--o{ ENROLLMENT : enrolled
  COURSE ||--o{ ENROLLMENT : has`,
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  C4 — System Context, Container, Component diagrams
  // ══════════════════════════════════════════════════════════════════════════

  {
    title: 'C4: System Context',
    category: 'C4',
    description: 'C4 System Context diagram showing a banking customer interacting with the Internet Banking System.',
    source: `C4Context
  title System Context diagram for Internet Banking System
  Person(customer, "Banking Customer", "A customer of the bank")
  System(bankingSystem, "Internet Banking System", "Allows customers to view information about their bank accounts")
  System_Ext(mailSystem, "E-mail System", "The internal Microsoft Exchange e-mail system")
  Rel(customer, bankingSystem, "Uses")
  Rel(bankingSystem, mailSystem, "Sends e-mails using")`,
  },
  {
    title: 'C4: Container Diagram',
    category: 'C4',
    description: 'C4 Container diagram with system boundary, web app, API, and database containers.',
    source: `C4Container
  title Container diagram for Internet Banking System
  Person(customer, "Customer", "A banking customer")
  System_Boundary(bank, "Internet Banking") {
    Container(web, "Web Application", "Java, Spring MVC", "Delivers static content and the single page app")
    Container(api, "API Application", "Java, Spring Boot", "Provides Internet banking functionality via API")
    ContainerDb(db, "Database", "Oracle 12c", "Stores user registration, authentication, and access logs")
  }
  System_Ext(mail, "E-mail System", "Microsoft Exchange")
  Rel(customer, web, "Uses", "HTTPS")
  Rel(web, api, "Makes API calls to", "JSON/HTTPS")
  Rel(api, db, "Reads from and writes to", "JDBC")
  Rel(api, mail, "Sends e-mails using", "SMTP")`,
  },
  {
    title: 'C4: Component Diagram',
    category: 'C4',
    description: 'C4 Component diagram showing internal structure of the API Application.',
    source: `C4Component
  title Component diagram for API Application
  Container_Boundary(api, "API Application") {
    Component(auth, "Auth Controller", "Spring MVC", "Handles authentication")
    Component(accounts, "Accounts Controller", "Spring MVC", "Provides account information")
    Component(security, "Security Component", "Spring Security", "Authentication and authorization")
    ComponentDb(repo, "Account Repository", "Spring Data", "Accesses account data")
  }
  ContainerDb(db, "Database", "Oracle 12c")
  Rel(auth, security, "Uses")
  Rel(accounts, repo, "Uses")
  Rel(security, db, "Reads from", "JDBC")
  Rel(repo, db, "Reads from and writes to", "JDBC")`,
  },
  {
    title: 'C4: Simple Microservices',
    category: 'C4',
    description: 'A simple C4 Context diagram showing microservice architecture.',
    source: `C4Context
  Person(user, "User", "End user of the platform")
  System(gateway, "API Gateway", "Routes requests to microservices")
  System(auth, "Auth Service", "Handles authentication and authorization")
  System(orders, "Order Service", "Manages customer orders")
  System_Ext(payment, "Payment Provider", "External payment processing")
  Rel(user, gateway, "Sends requests to")
  Rel(gateway, auth, "Authenticates via")
  Rel(gateway, orders, "Routes to")
  Rel(orders, payment, "Processes payments via")`,
  },
  {
    title: 'C4: Deployment Diagram',
    category: 'C4',
    description: 'C4 Deployment diagram showing infrastructure topology.',
    source: `C4Deployment
  title Deployment Diagram for Internet Banking System
  Deployment_Node(aws, "AWS", "Amazon Web Services") {
    Deployment_Node(ec2, "EC2 Instance", "t3.large") {
      Container(web, "Web Application", "Java, Spring MVC")
    }
    Deployment_Node(rds, "Amazon RDS", "db.r5.large") {
      ContainerDb(db, "Database", "Oracle 12c")
    }
  }
  Deployment_Node(client, "Customer Device", "Browser") {
    Container(browser, "Web Browser", "Chrome, Firefox, Safari")
  }
  Rel(browser, web, "Makes requests to", "HTTPS")
  Rel(web, db, "Reads from and writes to", "JDBC")`,
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  ARCHIMATE — Enterprise Architecture diagrams
  // ══════════════════════════════════════════════════════════════════════════

  {
    title: 'ArchiMate: Simple Layered',
    category: 'ArchiMate',
    description: 'Simple ArchiMate layered view with Business, Application, and Technology layers.',
    source: `archimate-layered
  business:
    actor Customer
    service "Online Banking" as OB
  application:
    component "Web App" as WA
    service "Auth Service" as AS
  technology:
    node "AWS EC2" as EC2
  Customer -->|serves| OB
  OB -->|realization| WA
  WA -->|assignment| EC2`,
  },
  {
    title: 'ArchiMate: Business Process',
    category: 'ArchiMate',
    description: 'ArchiMate diagram showing a business process with supporting application components.',
    source: `archimate-layered
  business:
    actor "Sales Rep" as SR
    process "Order Processing" as OP
    service "Order Fulfillment" as OF
    object "Order" as O
  application:
    component "CRM System" as CRM
    component "ERP System" as ERP
    dataObject "Order DB" as ODB
  SR -->|triggering| OP
  OP -->|realization| OF
  OP -->|access| O
  CRM -->|serving| OP
  ERP -->|serving| OF
  ERP -->|access| ODB`,
  },
  {
    title: 'ArchiMate: Full Stack',
    category: 'ArchiMate',
    description: 'A comprehensive ArchiMate diagram spanning Business, Application, and Technology layers.',
    source: `archimate-layered
  business:
    actor Customer
    service "Banking Service" as BS
    process "Payment" as Pay
    process "Account Mgmt" as AM
  application:
    component "Mobile App" as MA
    component "Web Portal" as WP
    component "Core Banking" as CB
    dataObject "Account Data" as AD
  technology:
    node "App Server" as AS
    node "Database Server" as DBS
    artifact "Docker" as D
    device "Load Balancer" as LB
  Customer -->|serves| BS
  BS -->|realization| Pay
  BS -->|realization| AM
  MA -->|serving| Customer
  WP -->|serving| Customer
  CB -->|realization| Pay
  CB -->|realization| AM
  CB -->|access| AD
  AS -->|assignment| CB
  DBS -->|assignment| AD
  D -->|assignment| AS
  LB -->|serving| AS`,
  },
  {
    title: 'ArchiMate: Strategy & Motivation',
    category: 'ArchiMate',
    description: 'ArchiMate diagram with Strategy and Motivation layers.',
    source: `archimate-layered
  strategy:
    capability "Digital Transformation" as DT
    resource "IT Budget" as ITB
    courseOfAction "Cloud Migration" as CM
  motivation:
    goal "Reduce Costs" as RC
    driver "Market Competition" as MC
    principle "Cloud First" as CF
  business:
    process "Service Delivery" as SD
  MC -->|influence| RC
  RC -->|realization| CF
  CF -->|realization| CM
  CM -->|realization| DT
  ITB -->|assignment| DT
  DT -->|realization| SD`,
  },
  {
    title: 'ArchiMate: Implementation',
    category: 'ArchiMate',
    description: 'ArchiMate Implementation & Migration view showing work packages and deliverables.',
    source: `archimate-layered
  implementation:
    workPackage "Phase 1" as P1
    workPackage "Phase 2" as P2
    deliverable "API Gateway" as AG
    deliverable "Microservices" as MS
    plateau "Current State" as CS
    plateau "Target State" as TS
  application:
    component "Legacy System" as LS
    component "New Platform" as NP
  P1 -->|realization| AG
  P2 -->|realization| MS
  AG -->|association| NP
  MS -->|association| NP
  CS -->|triggering| P1
  P1 -->|triggering| P2
  P2 -->|realization| TS
  LS -->|association| CS
  NP -->|association| TS`,
  },
]
