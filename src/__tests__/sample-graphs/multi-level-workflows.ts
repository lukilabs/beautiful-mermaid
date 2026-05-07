/**
 * Subgraphs nested 3+ levels deep with leaf nodes at every level and
 * cross-hierarchy edges that cross varying numbers of subgraph boundaries
 * (1, 2, 3, n). Stresses port-chain decomposition at depth and the
 * edge-synthesis path that completes a polyline when ELK leaves the
 * port-to-leaf section empty (the case where a leaf is buried inside an
 * INCLUDE_CHILDREN descendant of a SEPARATE_CHILDREN ancestor).
 */
import type { SampleGraph } from './types.ts'

export const MULTI_LEVEL_WORKFLOW_SAMPLES: SampleGraph[] = [
  {
    slug: 'multi-3-level-every-level',
    title: 'Multi-level workflow: 3-level nesting, nodes at every level, edges cross 1/2/3 boundaries',
    description: 'A 3-level nest with leaf nodes at every level. Cross-hierarchy edges from a root-level node reach (a) a level-1 node, (b) a level-2 node, and (c) a level-3 node — three different cross-hierarchy depths in the same diagram. Edge synthesis must complete each polyline to its target regardless of how many subgraph boundaries it crosses.',
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
    slug: 'multi-cousin-cross-hier',
    title: 'Multi-level workflow: cousin nodes — cross-hier edges between siblings sharing a parent',
    description: 'Two child subgraphs nested inside a shared parent, each with their own interior chain. Cross-hierarchy edges connect a node in the left child to a node in the right child — exiting one subgraph, traversing the parent\'s interior, and entering the other.',
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
    slug: 'multi-4-level-varied-depths',
    title: 'Multi-level workflow: 4-level deep with edges spanning every depth combination',
    description: 'A 4-level nest. Cross-hierarchy edges connect a root-level node to leaves at level 1, level 4, and back; plus a level-1 → level-3 edge. Each edge\'s synthesized internal segment must terminate on its target.',
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
    slug: 'multi-mixed-direction',
    title: 'Multi-level workflow: direction switches at every level + nodes at varying levels',
    description: 'TB → LR → TB direction switches at every level, with leaf nodes at every level. Cross-hierarchy edges at varying depths interact with the SEPARATE_CHILDREN handling and FIXED_ORDER port placement on the alternating compounds.',
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
]
