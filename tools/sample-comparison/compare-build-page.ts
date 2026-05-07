/**
 * Build the comparison page.
 *
 * Reads pre-fix and post-fix SVGs from sample-comparison/{before,after} and
 * the original mermaid sources from samples-data.ts, then emits a single
 * self-contained HTML file with 3-column rows: pre-fix beautiful-mermaid /
 * post-fix beautiful-mermaid / mermaid-cli (ELK) rendered live in the
 * browser.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { samples } from '../../samples-data.ts'

// Output (index.html, before/, after/) is regenerable artifact — keep it
// outside the repo. Defaults to OS temp; override with $BM_COMPARE_DIR if you
// want to render somewhere else.
const compareDir = process.env.BM_COMPARE_DIR ?? join(tmpdir(), 'sample-comparison')
const beforeDir = `${compareDir}/before`
const afterDir = `${compareDir}/after`

const dimRe = /<svg\b[^>]*\bwidth="([\d.]+)"[^>]*\bheight="([\d.]+)"/
function dims(svg: string): { w: number; h: number } {
  const m = svg.match(dimRe)
  return m ? { w: Number(m[1]), h: Number(m[2]) } : { w: 0, h: 0 }
}

function slugify(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

interface Entry {
  title: string
  category: string
  description?: string
  source: string
  beforeSvg: string
  afterSvg: string
  beforeDims: { w: number; h: number }
  afterDims: { w: number; h: number }
  diffPct: number
  isFlowchart: boolean
  isStateOrFlowchart: boolean
}

// Anonymized stress case mirroring the original failure-mode reported by a
// user. Three sibling root containers, one with a nested subgraph, both outer
// and inner declaring `direction TB`, and many cross-hierarchy edges. The
// labels are generic so this file can be attached publicly.
const stressCaseSource = `flowchart TB
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

// Synthetic direction-permutation scenarios. Each exercises a different shape
// of nested-subgraph + direction directive + cross-hierarchy edges. They live
// alongside the canonical samples so the visual comparison can show that the
// fix preserves direction overrides cleanly across the permutation space.
const permutationScenarios: Array<{ title: string; description: string; source: string; slug: string }> = [
  {
    title: 'Permutation: LR root with TB-direction nested subgraph',
    description: 'Outer flow is left-to-right; an inner subgraph declares `direction TB` and so its content stacks vertically, with cross-hierarchy edges entering from the left and leaving on the right of the outer flow.',
    slug: 'perm-lr-with-tb-nested',
    source: `graph LR
  subgraph stack [TB Stack]
    direction TB
    a[a] --> b[b] --> c[c]
  end
  src[Source] --> a
  c --> sink[Sink]`,
  },
  {
    title: 'Permutation: TD root with mixed-direction sibling subgraphs',
    description: 'Two sibling subgraphs side-by-side, each declaring its own non-default direction (LR and BT). Each must preserve its own internal direction independently.',
    slug: 'perm-mixed-siblings',
    source: `graph TD
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
  r3 --> tail`,
  },
  {
    title: 'Permutation: 3-level nesting with one direction switch in the middle',
    description: 'Outer and inner declare TB (matching the root); the middle layer declares LR. Only the middle layer needs SEPARATE_CHILDREN — outer and inner inherit cleanly.',
    slug: 'perm-3-level-middle-switch',
    source: `graph TB
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
  c --> sink[Sink]`,
  },
  {
    title: 'Permutation: sibling subgraphs with RL and BT directions inside a TB parent',
    description: 'Both RL and BT differ from the root TB, so each gets SEPARATE_CHILDREN with FIXED_SIDE ports. Incoming RL ports pin to EAST; incoming BT ports pin to SOUTH (the "start" sides of each direction).',
    slug: 'perm-rl-and-bt-siblings',
    source: `graph TB
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
  btC --> tail`,
  },
  {
    title: 'Permutation: RL-direction nested subgraph reverses flow inside an LR parent',
    description: 'LR and RL flow along the same horizontal axis but in opposite directions. The subgraph still gets SEPARATE_CHILDREN and lays out its content right-to-left.',
    slug: 'perm-rl-in-lr',
    source: `graph LR
  subgraph reverse [RL Reverse]
    direction RL
    a --> b --> c
  end
  src[Source] --> a
  c --> sink[Sink]`,
  },
  {
    title: 'Permutation: four-level nesting, all subgraphs matching the root direction',
    description: 'Each subgraph declares the same direction as the root, so none need SEPARATE_CHILDREN — they all flatten via INCLUDE_CHILDREN. A cross-hierarchy edge from the root reaches the deepest leaf naturally without ports.',
    slug: 'perm-4-level-same-direction',
    source: `graph TB
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
  c --> sink[Sink]`,
  },
  {
    title: 'Multi-level workflow: 3-level nesting, nodes at every level, edges cross 1/2/3 boundaries',
    description: 'A 3-level nest with leaf nodes at every level. Cross-hierarchy edges from a root-level node reach (a) a level-1 node, (b) a level-2 node, and (c) a level-3 node — three different cross-hierarchy depths in the same diagram. Edge synthesis must complete each polyline to its target regardless of how many subgraph boundaries it crosses.',
    slug: 'multi-3-level-every-level',
    source: `graph TB
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
  in_a --> mid_a`,
  },
  {
    title: 'Multi-level workflow: cousin nodes — cross-hier edges between siblings sharing a parent',
    description: 'Two child subgraphs nested inside a shared parent, each with their own interior chain. Cross-hierarchy edges connect a node in the left child to a node in the right child — exiting one subgraph, traversing the parent\'s interior, and entering the other.',
    slug: 'multi-cousin-cross-hier',
    source: `graph TB
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
  r2 --> l1`,
  },
  {
    title: 'Multi-level workflow: 4-level deep with edges spanning every depth combination',
    description: 'A 4-level nest. Cross-hierarchy edges connect a root-level node to leaves at level 1, level 4, and back; plus a level-1 → level-3 edge. Each edge\'s synthesized internal segment must terminate on its target.',
    slug: 'multi-4-level-varied-depths',
    source: `graph TB
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
  l4_node --> root_node`,
  },
  {
    title: 'Multi-level workflow: direction switches at every level + nodes at varying levels',
    description: 'TB → LR → TB direction switches at every level, with leaf nodes at every level. Cross-hierarchy edges at varying depths interact with the SEPARATE_CHILDREN handling and FIXED_SIDE port placement on the alternating compounds.',
    slug: 'multi-mixed-direction',
    source: `graph TB
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
  l2_a --> l1_a`,
  },
  {
    title: 'Permutation: alternating-direction nesting (LR/LR/TB/LR/TB), only innermost has leaves',
    description: 'Direction swaps at every level except the root match. Intermediate subgraphs hold no leaf nodes — they are pure structure. With no cross-hierarchy edges to route through the multiple SEPARATE_CHILDREN boundaries, the layout still nests cleanly and the innermost direction is preserved.',
    slug: 'perm-alt-lr-tb',
    source: `graph LR
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
  end`,
  },
  {
    title: 'Permutation: alternating-direction nesting (TB/TB/LR/TB/LR), only innermost has leaves',
    description: 'Mirror of the previous case starting from TB. Each level alternates direction; only the innermost holds the chain.',
    slug: 'perm-alt-tb-lr',
    source: `graph TB
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
  end`,
  },
  {
    title: 'Permutation: multiple cross-hierarchy edges into a non-matching direction subgraph',
    description: 'An LR-direction subgraph with two incoming and two outgoing cross-hierarchy edges. With FIXED_SIDE port constraints, all incoming ports pin to the WEST side and all outgoing ports pin to the EAST side.',
    slug: 'perm-many-cross-hier',
    source: `graph TD
  subgraph row [LR Row]
    direction LR
    a[a] --> b[b] --> c[c]
  end
  s1[s1] --> a
  s2[s2] --> a
  c --> t1[t1]
  c --> t2[t2]`,
  },
]

// Stress suite — eight realistic medium-complexity diagrams. Each maps 1:1 to
// a `describe` block in src/__tests__/layout-stress.test.ts. Sources are
// duplicated here so the comparison page is a self-contained build artifact
// (the test file isn't a stable import target outside `src/`).
const stressScenarios: Array<{ title: string; description: string; source: string; slug: string }> = [
  {
    title: 'Stress: microservices stack — three layers, fan-out from a single API node',
    description: 'Web/Mobile/Desktop fan into a single API node, which fans out to four service nodes, each terminating at its own DB. Tests cross-hier port indexing under double fan-out/fan-in.',
    slug: 'stress-microservices-stack',
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
    title: 'Stress: CI/CD pipeline with parallel test stages and a failure feedback edge',
    description: 'Build → 4 parallel Tests → Gate → Deploy, with a Gate `No` back-edge that wraps to Source. Stresses cycle-breaking on a fan-in plus back-edge.',
    slug: 'stress-ci-cd-parallel-feedback',
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
    title: 'Stress: bidirectional request/response between Client and Server',
    description: 'Mirrored cross-hier edge pairs (Client→Server then Server→Client) at multiple layers — should resolve into clean parallel channels with no colinear overlap.',
    slug: 'stress-bidirectional-request-response',
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
    title: 'Stress: hub-and-spoke orchestrator with bidirectional Compute traffic',
    description: 'Coordinator and Scheduler share an Orchestrator subgraph but participate at opposite ends of a bidirectional flow with Compute. Layered layout cannot make this planar — the residual crossings are the visible cost of the 2-cycle.',
    slug: 'stress-hub-and-spoke',
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
    title: 'Stress: deep mixed-direction sandwich (LR/TB/LR/TB) with fan-out from src',
    description: 'Four levels of alternating direction directives plus three fan-out edges from a root node into nodes at three different nesting depths. Exercises direction inheritance and cross-hier port chains under maximum nesting.',
    slug: 'stress-mixed-direction-sandwich',
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
    title: 'Stress: shared services fan-in from multiple feature columns',
    description: 'Three feature subgraphs fan into a column of three shared services (Auth/Logging/Metrics). The shared compound has only bare nodes plus a `direction TB` directive — exercises the invisible-chain mechanism.',
    slug: 'stress-shared-services-fan-in',
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
    title: 'Stress: error-path cluster with retry back-edge and Monitoring fan-in',
    description: 'Happy path, error path, and a Monitoring sink subgraph; RetryStep→Login wraps the full graph height. Tests back-edge wraparound plus cross-hier fan-in into a third subgraph.',
    slug: 'stress-error-path-cluster',
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
    title: 'Stress: dataflow fan-out / fan-in with bare-node TB stacks',
    description: 'Splitter fans out into a four-element TB Processor stack, which fans in to a two-element TB Reducer stack, which feeds Combine→Output. Each stack relies on direction directives plus invisible chain edges to lay out vertically.',
    slug: 'stress-dataflow-fan-out-fan-in',
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

const allSamples: Array<{ title: string; category: string; description?: string; source: string; slug: string }> = [
  {
    title: 'Stress case: nested subgraphs with redundant `direction` directives',
    category: 'Stress Cases',
    description: 'A 3-cluster TB flowchart with one nested subgraph; both outer and inner declare `direction TB` matching the root, and many cross-hierarchy edges traverse 1–3 boundaries. This was the originally-reported failure mode.',
    source: stressCaseSource,
    slug: 'bug-repro',
  },
  ...permutationScenarios.map(p => ({
    title: p.title,
    category: 'Stress Cases',
    description: p.description,
    source: p.source,
    slug: p.slug,
  })),
  ...stressScenarios.map(p => ({
    title: p.title,
    category: 'Stress Cases',
    description: p.description,
    source: p.source,
    slug: p.slug,
  })),
  ...samples.map(s => ({
    title: s.title,
    category: s.category ?? 'Other',
    description: s.description,
    source: s.source,
    slug: slugify(s.title),
  })),
]

const entries: Entry[] = []
for (const s of allSamples) {
  let beforeSvg = ''
  let afterSvg = ''
  try { beforeSvg = readFileSync(join(beforeDir, `${s.slug}.svg`), 'utf8') } catch {}
  try { afterSvg = readFileSync(join(afterDir, `${s.slug}.svg`), 'utf8') } catch {}

  const bd = dims(beforeSvg)
  const ad = dims(afterSvg)
  const dw = Math.abs(bd.w - ad.w)
  const dh = Math.abs(bd.h - ad.h)
  const maxDim = Math.max(bd.w, bd.h, ad.w, ad.h, 1)
  const diffPct = ((dw + dh) / maxDim) * 100

  const firstLine = s.source.trim().split('\n')[0]?.trim().toLowerCase() ?? ''
  const isFlowchart = /^(graph|flowchart)\b/.test(firstLine)
  const isStateOrFlowchart = isFlowchart || /^statediagram/i.test(firstLine)

  entries.push({
    title: s.title,
    category: s.category,
    description: s.description,
    source: s.source,
    beforeSvg,
    afterSvg,
    beforeDims: bd,
    afterDims: ad,
    diffPct,
    isFlowchart,
    isStateOrFlowchart,
  })
}

// Sort: stress cases first, then changed samples, then by category, then by title
entries.sort((a, b) => {
  if (a.category === 'Stress Cases' && b.category !== 'Stress Cases') return -1
  if (b.category === 'Stress Cases' && a.category !== 'Stress Cases') return 1
  const aDiff = a.diffPct > 1
  const bDiff = b.diffPct > 1
  if (aDiff !== bDiff) return aDiff ? -1 : 1
  if (a.category !== b.category) return a.category.localeCompare(b.category)
  return a.title.localeCompare(b.title)
})

const differCount = entries.filter(e => e.diffPct > 1).length
const totalCount = entries.length

// Inject `defaultRenderer: elk` into each flowchart source for the live mermaid column.
function withElk(source: string): string {
  if (source.includes('defaultRenderer')) return source
  return `%%{init: {"flowchart": {"defaultRenderer": "elk"}, "stateDiagram": {"defaultRenderer": "elk"}}}%%\n${source}`
}

const rowsHtml = entries.map((e, idx) => {
  const diffBadge = e.diffPct > 1
    ? `<span class="badge diff">CHANGED · Δ ${e.diffPct.toFixed(0)}%</span>`
    : `<span class="badge same">unchanged</span>`

  const categoryBadge = `<span class="badge cat cat-${slugify(e.category)}">${escapeHtml(e.category)}</span>`

  const elkSource = e.isStateOrFlowchart ? withElk(e.source) : e.source

  return `
<section class="row" data-category="${escapeHtml(e.category)}" data-differs="${e.diffPct > 1}" data-index="${idx}">
  <header class="row-header">
    <h2>${escapeHtml(e.title)}</h2>
    <div class="row-meta">
      ${categoryBadge}
      ${diffBadge}
    </div>
    ${e.description ? `<p class="row-desc">${escapeHtml(e.description)}</p>` : ''}
  </header>
  <div class="grid">
    <div class="panel ${e.diffPct > 1 ? 'panel-bad' : ''}">
      <div class="panel-head">beautiful-mermaid <em>before</em>
        <span class="dim">${e.beforeDims.w.toFixed(0)} × ${e.beforeDims.h.toFixed(0)}</span>
      </div>
      <div class="panel-body">${e.beforeSvg || '<div class="err">no svg</div>'}</div>
    </div>
    <div class="panel ${e.diffPct > 1 ? 'panel-good' : ''}">
      <div class="panel-head">beautiful-mermaid <em>after</em>
        <span class="dim">${e.afterDims.w.toFixed(0)} × ${e.afterDims.h.toFixed(0)}</span>
      </div>
      <div class="panel-body">${e.afterSvg || '<div class="err">no svg</div>'}</div>
    </div>
    <div class="panel">
      <div class="panel-head">mermaid + ELK <em>(reference)</em></div>
      <div class="panel-body">
        <pre class="mermaid">${escapeHtml(elkSource)}</pre>
      </div>
    </div>
  </div>
</section>`
}).join('\n')

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>beautiful-mermaid layout fix · sample comparison</title>
<style>
  :root {
    --bg: #f6f7f9;
    --fg: #1f2937;
    --muted: #6b7280;
    --border: #d1d5db;
    --accent: #2563eb;
    --bad: #dc2626;
    --good: #15803d;
  }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", system-ui, sans-serif; margin: 0; background: var(--bg); color: var(--fg); }
  .topbar {
    position: sticky; top: 0; z-index: 100;
    background: #fff; border-bottom: 1px solid var(--border);
    padding: 0.75rem 1.25rem; display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;
  }
  .topbar h1 { margin: 0; font-size: 1.05rem; font-weight: 600; }
  .topbar .stats { color: var(--muted); font-size: 0.85rem; }
  .filters { display: flex; gap: 0.4rem; flex-wrap: wrap; }
  .filters button {
    background: #fff; border: 1px solid var(--border); border-radius: 999px;
    padding: 0.25rem 0.7rem; font-size: 0.8rem; cursor: pointer;
  }
  .filters button.active { background: var(--accent); color: #fff; border-color: var(--accent); }
  main { padding: 1rem 1.25rem; max-width: 1900px; margin: 0 auto; }
  section.row {
    background: #fff; border: 1px solid var(--border); border-radius: 10px;
    padding: 0.9rem; margin-bottom: 1rem;
  }
  section.row .row-header { margin-bottom: 0.7rem; }
  section.row h2 { margin: 0 0 0.3rem 0; font-size: 1rem; font-weight: 600; }
  .row-meta { display: flex; gap: 0.4rem; align-items: center; flex-wrap: wrap; margin-bottom: 0.3rem; }
  .row-desc { margin: 0; font-size: 0.85rem; color: var(--muted); }
  .badge {
    display: inline-block; padding: 0.1rem 0.55rem; border-radius: 999px; font-size: 0.7rem; font-weight: 600;
    text-transform: uppercase; letter-spacing: 0.04em;
  }
  .badge.diff { background: #fee2e2; color: var(--bad); }
  .badge.same { background: #f3f4f6; color: var(--muted); }
  .badge.cat { background: #e0e7ff; color: #4338ca; }
  .badge.cat-stress-cases { background: #fef3c7; color: #b45309; }
  .badge.cat-hero { background: #fce7f3; color: #be185d; }
  .grid {
    display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.7rem;
  }
  @media (max-width: 1100px) { .grid { grid-template-columns: 1fr; } }
  .panel {
    border: 1px solid var(--border); border-radius: 8px; background: #fff; overflow: hidden;
    display: flex; flex-direction: column;
  }
  .panel-bad { border-color: var(--bad); }
  .panel-good { border-color: var(--good); }
  .panel-head {
    padding: 0.45rem 0.7rem; background: #f9fafb; border-bottom: 1px solid var(--border);
    font-size: 0.78rem; display: flex; justify-content: space-between; align-items: center; gap: 0.5rem;
  }
  .panel-head em { color: var(--muted); font-style: italic; font-weight: 400; }
  .panel-bad .panel-head { background: #fef2f2; color: var(--bad); }
  .panel-good .panel-head { background: #f0fdf4; color: var(--good); }
  .panel-head .dim { color: var(--muted); font-family: ui-monospace, monospace; font-size: 0.72rem; }
  .panel-body { flex: 1; padding: 0.6rem; min-height: 120px; display: flex; align-items: center; justify-content: center; overflow: auto; }
  .panel-body svg { max-width: 100%; height: auto; display: block; }
  .panel-body .err { color: var(--bad); font-size: 0.8rem; }
  pre.mermaid { font-size: 0.75rem; max-width: 100%; }
  .row[hidden] { display: none; }
</style>
</head>
<body>
<div class="topbar">
  <h1>beautiful-mermaid layout fix</h1>
  <span class="stats">${totalCount} samples · ${differCount} changed by the fix · ${totalCount - differCount} unchanged</span>
  <div class="filters" id="filters">
    <button data-filter="all" class="active">All (${totalCount})</button>
    <button data-filter="differs">Changed (${differCount})</button>
    <button data-filter="Stress Cases">Stress Cases</button>
    <button data-filter="Flowchart">Flowchart</button>
    <button data-filter="State">State</button>
    <button data-filter="Sequence">Sequence</button>
    <button data-filter="Class">Class</button>
    <button data-filter="ER">ER</button>
    <button data-filter="XY Chart">XY Chart</button>
    <button data-filter="Hero">Hero</button>
  </div>
</div>
<main>
${rowsHtml}
</main>
<script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>
<script>
  mermaid.initialize({ startOnLoad: false, securityLevel: 'loose', flowchart: { defaultRenderer: 'elk' } });
  mermaid.run({ querySelector: 'pre.mermaid' });

  const filters = document.getElementById('filters');
  filters.addEventListener('click', e => {
    if (!(e.target instanceof HTMLButtonElement)) return;
    const btn = e.target;
    const filter = btn.dataset.filter;
    filters.querySelectorAll('button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('section.row').forEach(row => {
      const cat = row.dataset.category;
      const differs = row.dataset.differs === 'true';
      let show = false;
      if (filter === 'all') show = true;
      else if (filter === 'differs') show = differs;
      else show = cat === filter;
      row.hidden = !show;
    });
  });
</script>
</body>
</html>
`

mkdirSync(compareDir, { recursive: true })
writeFileSync(`${compareDir}/index.html`, html)
console.log(`Wrote ${compareDir}/index.html`)
console.log(`  ${totalCount} samples, ${differCount} changed by the fix`)
