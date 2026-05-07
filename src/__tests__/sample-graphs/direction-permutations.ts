/**
 * Nested subgraphs whose `direction` directives match or differ from their
 * parents in varying combinations. Each scenario stresses a different
 * aspect of SEPARATE_CHILDREN vs INCLUDE_CHILDREN handling and the
 * per-side port placement that follows from each compound's effective
 * direction.
 */
import type { SampleGraph } from './types.ts'

export const DIRECTION_PERMUTATION_SAMPLES: SampleGraph[] = [
  {
    slug: 'perm-lr-with-tb-nested',
    title: 'Permutation: LR root with TB-direction nested subgraph',
    description: 'Outer flow is left-to-right; an inner subgraph declares `direction TB` and so its content stacks vertically, with cross-hierarchy edges entering from the left and leaving on the right of the outer flow.',
    source: `graph LR
      subgraph stack [TB Stack]
        direction TB
        a --> b --> c
      end
      src[Source] --> a
      c --> sink[Sink]`,
  },
  {
    slug: 'perm-mixed-siblings',
    title: 'Permutation: TD root with mixed-direction sibling subgraphs',
    description: 'Two sibling subgraphs side-by-side, each declaring its own non-default direction (LR and BT). Each must preserve its own internal direction independently.',
    source: `graph TD
      subgraph leftSide [LR pipeline]
        direction LR
        l1 --> l2 --> l3
      end
      subgraph rightSide [BT stack]
        direction BT
        r1 --> r2 --> r3
      end
      hub[Hub]
      hub --> l1
      hub --> r1
      l3 --> tail[Tail]
      r3 --> tail`,
  },
  {
    slug: 'perm-3-level-middle-switch',
    title: 'Permutation: 3-level nesting with one direction switch in the middle',
    description: 'Outer and inner declare TB (matching the root); the middle layer declares LR. Only the middle layer needs SEPARATE_CHILDREN — outer and inner inherit cleanly.',
    source: `graph TB
      subgraph outer [TB Outer]
        direction TB
        subgraph middle [LR Middle]
          direction LR
          subgraph inner [LR Inner]
            direction LR
            a --> b --> c
          end
        end
      end
      src[Source] --> a
      c --> sink[Sink]`,
  },
  {
    slug: 'perm-rl-and-bt-siblings',
    title: 'Permutation: sibling subgraphs with RL and BT directions inside a TB parent',
    description: 'Both RL and BT differ from the root TB, so each gets SEPARATE_CHILDREN with FIXED_ORDER ports. Incoming RL ports pin to EAST; incoming BT ports pin to SOUTH (the "start" sides of each direction).',
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
    slug: 'perm-rl-in-lr',
    title: 'Permutation: RL-direction nested subgraph reverses flow inside an LR parent',
    description: 'LR and RL flow along the same horizontal axis but in opposite directions. The subgraph still gets SEPARATE_CHILDREN and lays out its content right-to-left.',
    source: `graph LR
      subgraph reverse [RL Reverse]
        direction RL
        a --> b --> c
      end
      src[Source] --> a
      c --> sink[Sink]`,
  },
  {
    slug: 'perm-4-level-same-direction',
    title: 'Permutation: four-level nesting, all subgraphs matching the root direction',
    description: 'Each subgraph declares the same direction as the root, so none need SEPARATE_CHILDREN — they all flatten via INCLUDE_CHILDREN. A cross-hierarchy edge from the root reaches the deepest leaf naturally without ports.',
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
    slug: 'perm-alt-lr-tb',
    title: 'Permutation: alternating-direction nesting (LR/LR/TB/LR/TB), only innermost has leaves',
    description: 'Direction swaps at every level except the root match. Intermediate subgraphs hold no leaf nodes — they are pure structure. With no cross-hierarchy edges to route through the multiple SEPARATE_CHILDREN boundaries, the layout still nests cleanly and the innermost direction is preserved.',
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
    slug: 'perm-alt-tb-lr',
    title: 'Permutation: alternating-direction nesting (TB/TB/LR/TB/LR), only innermost has leaves',
    description: 'Mirror of the previous case starting from TB. Each level alternates direction; only the innermost holds the chain.',
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
    slug: 'perm-many-cross-hier',
    title: 'Permutation: multiple cross-hierarchy edges into a non-matching direction subgraph',
    description: 'An LR-direction subgraph with two incoming and two outgoing cross-hierarchy edges. With FIXED_ORDER port constraints, all incoming ports pin to the WEST side and all outgoing ports pin to the EAST side.',
    source: `graph TD
      subgraph row [LR Row]
        direction LR
        a --> b --> c
      end
      s1 --> a
      s2 --> a
      c --> t1
      c --> t2`,
  },
]
