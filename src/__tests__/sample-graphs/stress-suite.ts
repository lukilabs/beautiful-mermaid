/**
 * Eight realistic medium-complexity flowcharts. Each maps 1:1 to a `describe`
 * block in `layout-stress.test.ts`. These were the regression-driving
 * scenarios that uncovered the e10/e2 lex-sort tiebreaker, the
 * bare-leaves-collapse-into-one-layer behaviour, and the thoroughness=3
 * default leaving planar layouts on the table.
 */
import type { SampleGraph } from './types.ts'

export const STRESS_SUITE_SAMPLES: SampleGraph[] = [
  {
    slug: 'stress-microservices-stack',
    title: 'Stress: microservices stack — three layers, fan-out from a single API node',
    description: 'Web/Mobile/Desktop fan into a single API node, which fans out to four service nodes, each terminating at its own DB. Tests cross-hier port indexing under double fan-out/fan-in.',
    source: `graph LR
    subgraph clients [Client Layer]
      Web --> API
      Mobile --> API
      Desktop --> API
    end
    subgraph services [Service Layer]
      API --> Auth
      API --> Users
      API --> Orders
      API --> Payments
    end
    subgraph data [Data Layer]
      Auth --> AuthDB
      Users --> UserDB
      Orders --> OrdersDB
      Payments --> PaymentsDB
      Payments --> AuditLog
    end`,
  },
  {
    slug: 'stress-ci-cd-parallel-feedback',
    title: 'Stress: CI/CD pipeline with parallel test stages and a failure feedback edge',
    description: 'Build → 4 parallel Tests → Gate → Deploy, with a Gate `No` back-edge that wraps to Source. Stresses cycle-breaking on a fan-in plus back-edge.',
    source: `graph TD
    subgraph build [Build]
      Source --> Compile --> Artifact
    end
    subgraph TestParallel [Tests]
      direction LR
      Unit
      Integration
      E2E
      Security
    end
    Artifact --> Unit
    Artifact --> Integration
    Artifact --> E2E
    Artifact --> Security
    Unit --> Gate
    Integration --> Gate
    E2E --> Gate
    Security --> Gate
    Gate{All Pass?} -->|Yes| Deploy
    Gate -->|No| Source`,
  },
  {
    slug: 'stress-bidirectional-request-response',
    title: 'Stress: bidirectional request/response between Client and Server',
    description: 'Mirrored cross-hier edge pairs (Client→Server then Server→Client) at multiple layers — should resolve into clean parallel channels with no colinear overlap.',
    source: `graph LR
    subgraph client [Client]
      UI --> Cache
      Cache --> Network
    end
    subgraph server [Server]
      Endpoint --> Handler
      Handler --> DB
    end
    Network --> Endpoint
    DB --> Handler
    Handler --> Endpoint
    Endpoint --> Network
    Network --> Cache
    Cache --> UI`,
  },
  {
    slug: 'stress-hub-and-spoke',
    title: 'Stress: hub-and-spoke orchestrator with bidirectional Compute traffic',
    description: 'Coordinator and Scheduler share an Orchestrator subgraph but participate at opposite ends of a bidirectional flow with Compute. Layered layout cannot make this planar — the residual crossings are the visible cost of the 2-cycle.',
    source: `graph LR
    subgraph hub [Orchestrator]
      Coordinator
      Scheduler
    end
    subgraph north [Ingest]
      direction TB
      IngestSource[Source] --> Validator
    end
    subgraph east [Compute]
      direction TB
      Worker1
      Worker2
    end
    subgraph south [Storage]
      direction TB
      WriteBack
    end
    subgraph west [Notify]
      direction TB
      Pager --> Slack
    end
    Validator --> Coordinator
    Coordinator --> Worker1
    Coordinator --> Worker2
    Worker1 --> Scheduler
    Worker2 --> Scheduler
    Scheduler --> WriteBack
    Scheduler --> Pager`,
  },
  {
    slug: 'stress-mixed-direction-sandwich',
    title: 'Stress: deep mixed-direction sandwich (LR/TB/LR/TB) with fan-out from src',
    description: 'Four levels of alternating direction directives plus three fan-out edges from a root node into nodes at three different nesting depths. Exercises direction inheritance and cross-hier port chains under maximum nesting.',
    source: `graph LR
    subgraph L1 [Outer LR]
      direction LR
      a
      subgraph L2 [Inner TB]
        direction TB
        b
        subgraph L3 [Deep LR]
          direction LR
          c
          subgraph L4 [Deepest TB]
            direction TB
            d --> e --> f
          end
        end
      end
    end
    src --> a
    src --> d
    src --> e
    f --> sink
    c --> b
    b --> a`,
  },
  {
    slug: 'stress-shared-services-fan-in',
    title: 'Stress: shared services fan-in from multiple feature columns',
    description: 'Three feature subgraphs fan into a column of three shared services (Auth/Logging/Metrics). The shared compound has only bare nodes plus a `direction TB` directive — exercises the invisible-chain mechanism.',
    source: `graph TD
    subgraph shared [Shared Services]
      direction TB
      Auth
      Logging
      Metrics
    end
    subgraph featA [Feature A]
      A1 --> A2
    end
    subgraph featB [Feature B]
      B1 --> B2
    end
    subgraph featC [Feature C]
      C1 --> C2
    end
    A2 --> Auth
    B2 --> Auth
    C2 --> Auth
    A1 --> Logging
    B1 --> Logging
    C1 --> Logging
    A2 --> Metrics
    B2 --> Metrics`,
  },
  {
    slug: 'stress-error-path-cluster',
    title: 'Stress: error-path cluster with retry back-edge and Monitoring fan-in',
    description: 'Happy path, error path, and a Monitoring sink subgraph; RetryStep→Login wraps the full graph height. Tests back-edge wraparound plus cross-hier fan-in into a third subgraph.',
    source: `graph TD
    subgraph happy [Happy Path]
      Login --> Verify --> Authorize --> Success
    end
    subgraph errflow [Error Path]
      Reject --> Notify --> RetryStep[Retry]
    end
    subgraph mon [Monitoring]
      Alerts
      Dashboard
    end
    Verify -->|fail| Reject
    Authorize -->|denied| Reject
    RetryStep --> Login
    Success --> Alerts
    Reject --> Alerts
    Notify --> Dashboard`,
  },
  {
    slug: 'stress-dataflow-fan-out-fan-in',
    title: 'Stress: dataflow fan-out / fan-in with bare-node TB stacks',
    description: 'Splitter fans out into a four-element TB Processor stack, which fans in to a two-element TB Reducer stack, which feeds Combine→Output. Each stack relies on direction directives plus invisible chain edges to lay out vertically.',
    source: `graph LR
    Ingest --> Splitter
    subgraph processors [Processors]
      direction TB
      P1
      P2
      P3
      P4
    end
    Splitter --> P1
    Splitter --> P2
    Splitter --> P3
    Splitter --> P4
    subgraph reducers [Reducers]
      direction TB
      R1
      R2
    end
    P1 --> R1
    P2 --> R1
    P3 --> R2
    P4 --> R2
    R1 --> Combine
    R2 --> Combine
    Combine --> Output`,
  },
]
