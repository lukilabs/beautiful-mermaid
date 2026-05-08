/**
 * Real-world reproductions distilled from reported issues. Every entry
 * must link to its motivating issue or PR by number, both in the slug
 * and somewhere in the title or description, so the connection between
 * the test scenario and the underlying bug stays discoverable.
 */
import type { SampleGraph } from './types.ts'

export const REAL_SAMPLES: SampleGraph[] = [
  {
    slug: 'issue-83-tb-flowchart-flips-horizontal',
    title: 'Issue #83: TD/TB flowchart with cross-hier edges flips to horizontal layout',
    description: 'Three sibling root subgraphs (one with a nested subgraph), `direction TB` on outer and inner, many cross-hierarchy edges crossing 1-3 boundaries. Reproduces the symptom in lukilabs/beautiful-mermaid#83 — a TB-declared graph rendered roughly square because cross-hier routing pushed nodes horizontally. A correct TB layout keeps this tall and narrow. Labels are anonymised from the original report.',
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
