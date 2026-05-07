/**
 * Render the anonymized stress case and direction-permutation scenarios into
 * the comparison output dir using whichever layout-engine is currently on
 * disk. Used twice: once with main's pre-fix engine, once with the patched
 * post-fix engine (callers do the swap).
 */
import { mkdirSync, writeFileSync } from 'fs'
import { renderMermaidSVG } from '../../src/index.ts'

const outDir = process.argv[2]
if (!outDir) {
  console.error('usage: tsx compare-render-extras.ts <out-dir>')
  process.exit(1)
}
mkdirSync(outDir, { recursive: true })

const stressCase = `flowchart TB
  subgraph specGroup [Spec]
    spec[spec doc]
  end

  in1[Input 1]
  in2[Input 2]

  subgraph pipelineGroup [Pipeline]
    direction TB
    subgraph commonGroup [Shared steps]
      direction TB
      stepA[Validate]
      stepB[Resolve defaults]
      stepC[Apply tags]
      stepA --> stepB
      stepB --> stepC
    end
    readA[Read 1]
    readB[Read 2]
    merged([Merged])
    writeA[Write 1]
    writeB[Write 2]

    readA --> merged
    readB --> merged
    merged --> writeA
    merged --> writeB
  end

  out1[Output 1]
  out2[Output 2]

  in1 --> stepA
  in2 --> stepA
  stepC --> readA
  stepC --> readB
  writeA --> out1
  writeB --> out2

  spec -. "schemas" .-> stepA
  spec -. "defines" .-> merged`

const scenarios: Array<{ slug: string; source: string }> = [
  { slug: 'bug-repro', source: stressCase },
  { slug: 'perm-lr-with-tb-nested', source: `graph LR
  subgraph stack [TB Stack]
    direction TB
    a[a] --> b[b] --> c[c]
  end
  src[Source] --> a
  c --> sink[Sink]` },
  { slug: 'perm-mixed-siblings', source: `graph TD
  subgraph leftSide [LR pipeline]
    direction LR
    l1[l1] --> l2[l2] --> l3[l3]
  end
  subgraph rightSide [BT stack]
    direction BT
    r1[r1] --> r2[r2] --> r3[r3]
  end
  hub[Hub]
  hub --> l1
  hub --> r1
  l3 --> tail[Tail]
  r3 --> tail` },
  { slug: 'perm-3-level-middle-switch', source: `graph TB
  subgraph outer [TB Outer]
    direction TB
    subgraph middle [LR Middle]
      direction LR
      subgraph inner [LR Inner]
        direction LR
        a[a] --> b[b] --> c[c]
      end
    end
  end
  src[Source] --> a
  c --> sink[Sink]` },
  { slug: 'perm-rl-and-bt-siblings', source: `graph TB
  subgraph rlGroup [RL row]
    direction RL
    rlA --> rlB --> rlC
  end
  subgraph btGroup [BT stack]
    direction BT
    btA --> btB --> btC
  end
  hub[Hub]
  tail[Tail]
  hub --> rlA
  hub --> btA
  rlC --> tail
  btC --> tail` },
  { slug: 'perm-rl-in-lr', source: `graph LR
  subgraph reverse [RL Reverse]
    direction RL
    a --> b --> c
  end
  src[Source] --> a
  c --> sink[Sink]` },
  { slug: 'perm-4-level-same-direction', source: `graph TB
  subgraph L1 [Level 1]
    direction TB
    subgraph L2 [Level 2]
      direction TB
      subgraph L3 [Level 3]
        direction TB
        subgraph L4 [Level 4]
          direction TB
          a --> b --> c
        end
      end
    end
  end
  src[Source] --> a
  c --> sink[Sink]` },
  { slug: 'multi-3-level-every-level', source: `graph TB
  subgraph outer [Outer]
    mid_a[mid a]
    subgraph middle [Middle]
      in_a[in a]
      subgraph inner [Inner]
        deep_a[deep a] --> deep_b[deep b]
      end
    end
  end
  ext1[Ext 1]
  ext1 --> mid_a
  ext1 --> in_a
  ext1 --> deep_a
  mid_a --> in_a
  in_a --> mid_a` },
  { slug: 'multi-cousin-cross-hier', source: `graph TB
  subgraph parent [Parent]
    direction LR
    subgraph leftChild [Left]
      l1 --> l2
    end
    subgraph rightChild [Right]
      r1 --> r2
    end
  end
  l2 --> r1
  r2 --> l1` },
  { slug: 'multi-4-level-varied-depths', source: `graph TB
  subgraph L1 [Level 1]
    l1_node[L1]
    subgraph L2 [Level 2]
      l2_node[L2]
      subgraph L3 [Level 3]
        l3_node[L3]
        subgraph L4 [Level 4]
          l4_node[L4]
        end
      end
    end
  end
  root_node[Root]
  root_node --> l4_node
  root_node --> l1_node
  l1_node --> l3_node
  l4_node --> root_node` },
  { slug: 'multi-mixed-direction', source: `graph TB
  subgraph L1 [TB Level 1]
    direction TB
    l1_a[l1 a]
    subgraph L2 [LR Level 2]
      direction LR
      l2_a[l2 a]
      subgraph L3 [TB Level 3]
        direction TB
        l3_a[l3 a] --> l3_b[l3 b]
      end
    end
  end
  ext[Ext]
  ext --> l3_a
  l1_a --> l3_b
  l2_a --> l1_a` },
  { slug: 'perm-alt-lr-tb', source: `graph LR
  subgraph L1 [Outer LR]
    direction LR
    subgraph L2 [Inner TB]
      direction TB
      subgraph L3 [Deeper LR]
        direction LR
        subgraph L4 [Deepest TB]
          direction TB
          a --> b --> c
        end
      end
    end
  end` },
  { slug: 'perm-alt-tb-lr', source: `graph TB
  subgraph L1 [Outer TB]
    direction TB
    subgraph L2 [Inner LR]
      direction LR
      subgraph L3 [Deeper TB]
        direction TB
        subgraph L4 [Deepest LR]
          direction LR
          a --> b --> c
        end
      end
    end
  end` },
  { slug: 'perm-many-cross-hier', source: `graph TD
  subgraph row [LR Row]
    direction LR
    a[a] --> b[b] --> c[c]
  end
  s1[s1] --> a
  s2[s2] --> a
  c --> t1[t1]
  c --> t2[t2]` },
  // Stress suite — eight realistic medium-complexity diagrams that match the
  // describe blocks in src/__tests__/layout-stress.test.ts.
  { slug: 'stress-microservices-stack', source: `graph LR
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
    end` },
  { slug: 'stress-ci-cd-parallel-feedback', source: `graph TD
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
    Gate -->|No| Source` },
  { slug: 'stress-bidirectional-request-response', source: `graph LR
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
    Cache --> UI` },
  { slug: 'stress-hub-and-spoke', source: `graph LR
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
    Scheduler --> Pager` },
  { slug: 'stress-mixed-direction-sandwich', source: `graph LR
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
    b --> a` },
  { slug: 'stress-shared-services-fan-in', source: `graph TD
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
    B2 --> Metrics` },
  { slug: 'stress-error-path-cluster', source: `graph TD
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
    Notify --> Dashboard` },
  { slug: 'stress-dataflow-fan-out-fan-in', source: `graph LR
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
    Combine --> Output` },
]

for (const s of scenarios) {
  try {
    const svg = renderMermaidSVG(s.source, { bg: '#ffffff', fg: '#1f2937' })
    writeFileSync(`${outDir}/${s.slug}.svg`, svg)
    const w = svg.match(/<svg\b[^>]*\bwidth="([\d.]+)"/)?.[1]
    const h = svg.match(/<svg\b[^>]*\bheight="([\d.]+)"/)?.[1]
    console.log(`  ${s.slug}: ${w} x ${h}`)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error(`  ${s.slug}: ERROR — ${msg.split('\n')[0]}`)
    writeFileSync(`${outDir}/${s.slug}.error.txt`, msg)
  }
}
