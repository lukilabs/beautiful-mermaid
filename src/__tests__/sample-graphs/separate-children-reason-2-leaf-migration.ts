/**
 * Samples that isolate the second reason a subgraph needs
 * SEPARATE_CHILDREN: it directly contains a leaf that's an endpoint of a
 * cross-subgraph edge. Without SEPARATE_CHILDREN, INCLUDE_CHILDREN
 * inheritance lets ELK migrate that leaf across the subgraph boundary
 * when the layered layout prefers a layer near a cross-subgraph
 * neighbour, so the rendered leaf ends up outside its declared
 * subgraph's rectangle. The samples here have **no** direction directive
 * on the affected subgraph (otherwise reason 1 would also trigger and
 * the test would not isolate reason 2). Containment metadata is the
 * assertion: each leaf endpoint of the cross-subgraph edge must end up
 * geometrically inside its declared subgraph.
 */
import type { SampleGraph } from './types.ts'

export const SEPARATE_CHILDREN_REASON_2_SAMPLES: SampleGraph[] = [
  {
    slug: 'separate-reason-2-undirected-subgraph-with-cross-endpoint',
    title: 'SEPARATE reason 2: leaf endpoint of cross-subgraph edge stays inside its undirected subgraph',
    description: 'A subgraph with no direction directive contains a single leaf that is the target of a cross-subgraph edge from a root-level node. Under INCLUDE_CHILDREN the leaf would migrate out of the subgraph rectangle so the parent could place it in a more convenient layer. Reason 2 forces SEPARATE_CHILDREN on the subgraph, locking the leaf inside. Containment assertion catches the regression.',
    containment: {
      Inside: 'Wrapper',
    },
    expectedEdgesReachTargets: [
      { source: 'Outside', target: 'Inside' },
    ],
    source: `graph TB
      Outside
      subgraph wrapper [Wrapper]
        Inside
      end
      Outside --> Inside`,
  },
  {
    slug: 'separate-reason-2-both-endpoints-need-isolation',
    title: 'SEPARATE reason 2: both endpoints of a cross-subgraph edge sit in undirected subgraphs',
    description: 'Two sibling subgraphs at root, neither with a direction directive. A cross-subgraph edge links a leaf in the left subgraph to a leaf in the right subgraph. Reason 2 marks both subgraphs SEPARATE so each leaf stays inside its declared subgraph rectangle, even though neither subgraph has a direction directive of its own.',
    containment: {
      LeftLeaf: 'Left',
      RightLeaf: 'Right',
    },
    expectedEdgesReachTargets: [
      { source: 'LeftLeaf', target: 'RightLeaf' },
    ],
    source: `graph TB
      subgraph leftBox [Left]
        LeftLeaf
      end
      subgraph rightBox [Right]
        RightLeaf
      end
      LeftLeaf --> RightLeaf`,
  },
]
