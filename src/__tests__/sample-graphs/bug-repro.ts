/**
 * Three sibling root containers — one of them holds a nested cluster — plus
 * many cross-hierarchy edges crossing 1-3 subgraph boundaries. Both the
 * outer and inner subgraphs declare `direction TB` matching the parent.
 * Labels are anonymised.
 */
import type { SampleGraph } from './types.ts'

export const BUG_REPRO_SAMPLES: SampleGraph[] = [
  {
    slug: 'bug-repro',
    title: 'Stress case: three-cluster TB diagram with nested cluster and many cross-hier edges',
    description: 'Sibling clusters at root, one cluster contains a nested cluster; both outer and inner declare `direction TB` matching the root, and many cross-hierarchy edges traverse 1-3 boundaries. A correct TB layout keeps this tall and narrow; broken hierarchy handling spreads it horizontally.',
    source: `graph TB
      subgraph rootA [Group A]
        docs[contract doc]
      end

      ext_in1[Input 1]
      ext_in2[Input 2]

      subgraph rootB [Group B]
        direction TB
        subgraph inner [Inner Common]
          direction TB
          v[validator]
          d[defaults]
          t[tagger]
          v --> d --> t
        end
        rd1[reader 1]
        rd2[reader 2]
        ud[unified data]
        wr1[writer 1]
        wr2[writer 2]
        rd1 --> ud
        rd2 --> ud
        ud --> wr1
        ud --> wr2
      end

      ext_out1[Output 1]
      ext_out2[Output 2]

      ext_in1 --> v
      ext_in2 --> v
      t --> rd1
      t --> rd2
      wr1 --> ext_out1
      wr2 --> ext_out2
      docs -. "schemas" .-> v
      docs -. "defines" .-> ud`,
  },
]
