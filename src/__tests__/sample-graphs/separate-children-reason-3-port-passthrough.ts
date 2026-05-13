/**
 * Samples that isolate the third reason a subgraph needs
 * SEPARATE_CHILDREN: it owns at least one boundary port of a
 * cross-subgraph edge that passes *through* it — neither endpoint of
 * the edge is a direct leaf child of this subgraph, and the subgraph
 * has no direction directive of its own. Reasons 1 and 2 don't apply;
 * only the port-owner clause does. Without SEPARATE_CHILDREN, the
 * FIXED_ORDER port-index constraints don't stick (the boundary stops
 * being a real layout boundary), and the cross-subgraph edge's
 * port-to-port hop loses its declared side, breaking the polyline. The
 * assertion is that the edge actually reaches its declared target.
 */
import type { SampleGraph } from './types.ts'

export const SEPARATE_CHILDREN_REASON_3_SAMPLES: SampleGraph[] = [
  {
    slug: 'separate-reason-3-passthrough-undirected-outer',
    title: 'SEPARATE reason 3: cross-subgraph edge passes through an undirected outer subgraph',
    description: 'A two-level nest where only the inner subgraph contains the leaf endpoint. The outer subgraph has no direction directive and contains no leaf endpoint of the edge — its only stake is owning a passthrough port. Reason 3 marks the outer subgraph SEPARATE so the port has a real boundary to sit on and the cross-subgraph polyline reaches the inner leaf.',
    containment: {
      DeepLeaf: 'Inner',
    },
    expectedNesting: [
      ['Outer', 'Inner'],
    ],
    expectedEdgesReachTargets: [
      { source: 'Outside', target: 'DeepLeaf' },
    ],
    source: `graph TB
      Outside
      subgraph outer [Outer]
        subgraph inner [Inner]
          DeepLeaf
        end
      end
      Outside --> DeepLeaf`,
  },
  {
    slug: 'separate-reason-3-passthrough-with-sibling-leaf',
    title: 'SEPARATE reason 3: passthrough outer subgraph also holds an unrelated sibling leaf',
    description: 'Same shape as the simple passthrough case, but the outer subgraph also holds a sibling leaf with no edges. The sibling rules out the trivial "outer has no children but the inner subgraph" excuse — the outer subgraph genuinely needs SEPARATE so its passthrough port keeps its declared side, even though the sibling leaf would otherwise let INCLUDE_CHILDREN flatten the layout.',
    containment: {
      DeepLeaf: 'Inner',
      Sibling: 'Outer',
    },
    expectedNesting: [
      ['Outer', 'Inner'],
    ],
    expectedEdgesReachTargets: [
      { source: 'Outside', target: 'DeepLeaf' },
    ],
    source: `graph TB
      Outside
      subgraph outer [Outer]
        Sibling
        subgraph inner [Inner]
          DeepLeaf
        end
      end
      Outside --> DeepLeaf`,
  },
]
