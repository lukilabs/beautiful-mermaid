/**
 * Real-world reproductions distilled from reported issues. Every entry
 * must link to its motivating issue or PR by number, both in the slug
 * and somewhere in the title or description, so the connection between
 * the test scenario and the underlying bug stays discoverable.
 */
import type { SampleGraph } from './types.ts'

export const REAL_SAMPLES: SampleGraph[] = [
  {
    slug: 'pr-98-nested-tb-cross-hier',
    title: 'PR #98: nested TB subgraphs with many cross-hierarchy edges',
    description: 'Motivating reproduction for lukilabs/beautiful-mermaid#98. Three sibling root subgraphs (one with a nested subgraph), `direction TB` on outer and inner, many cross-hierarchy edges crossing 1-3 boundaries. Pre-fix renders this roughly square because broken hierarchy handling spreads cross-hier routing horizontally; the post-fix layout keeps it tall and narrow. Labels are anonymised.',
    expectedAxisOrder: [
      { axis: 'y', items: ['v', 'd', 't'] },
    ],
    expectedSubgraphAspect: [
      { subgraph: 'Group B', taller: true },
      { subgraph: 'Inner Common', taller: true },
    ],
    expectedNesting: [
      ['Group B', 'Inner Common', 'v'],
      ['Inner Common', 'd'],
      ['Inner Common', 't'],
    ],
    minGraphHeightOverWidth: 1.5,
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
  {
    slug: 'issue-83-td-flowchart-with-back-edges',
    title: 'Issue #83: TD flowchart with many backward edges flips to horizontal',
    description: 'Verbatim source from lukilabs/beautiful-mermaid#83 — a long `flowchart TD` with retry/feedback edges between modules (e.g. `C3 -->|校验不通过| C1`). The reporter saw a 5.6:1 horizontal sprawl despite TD; expected vertical orientation. **This PR does not fix the symptom** — the sample currently lays out at ~3.1:1 horizontal with ~22 right-angle crossings. Once the layout engine handles this case, tighten `maxCrossings` to 0 and uncomment `minGraphHeightOverWidth: 1.5`.',
    // Permissive thresholds reflect the current (unfixed) layout. Tighten
    // when the layout engine is updated to handle this case.
    maxCrossings: 30,
    // minGraphHeightOverWidth: 1.5,
    source: `flowchart TD
    A[用户输入任务指令] --> B[目标深度解构：穿透商业本质，拆解可量化核心指标]
    B --> C[模块1：前置市场与用户洞察]
    C --> C1[自主细化调研维度：商圈/客群/竞品/商户全维度调研]
    C1 --> C2[数据填充与洞察结论输出]
    C2 --> C3[洞察报告合规性与有效性校验]
    C3 -->|校验通过| D[模块2：非遗IP与内容策划]
    C3 -->|校验不通过| C1
    D --> D1[基于洞察结论筛选适配非遗项目]
    D1 --> D2[IP打造、年轻化表达与商业化路径设计]
    D2 --> D3[非遗内容合规性校验与授权规范确认]
    D3 -->|校验通过| E[模块3：全案活动策划与执行]
    D3 -->|校验不通过| D1
    E --> E1[基于IP内容与客群洞察，拆分8周4阶段执行节奏]
    E1 --> E2[线下场景、线上玩法、分层客群活动细化]
    E2 --> E3[执行节点、落地标准与人员架构明确]
    E3 --> E4[活动方案与IP内容、预算约束交叉适配校验]
    E4 -->|校验通过| F[模块4：商业运营与成本管控]
    E4 -->|校验不通过| E1
    F --> F1[商户合作体系、招商方案设计]
    F1 --> F2[全周期成本明细拆分、营收预估与ROI测算]
    F2 --> F3[预算管控机制设计，总预算锁定780万内]
    F3 --> F4[成本方案与活动策划方案双向适配校验]
    F4 -->|校验通过| G[模块5：全渠道传播与舆情管理]
    F4 -->|校验不通过| F1
    G --> G1[匹配活动节奏，制定全周期传播策略与话题矩阵]
    G1 --> G2[分层KOL/KOC投放矩阵设计与效果管控]
    G2 --> G3[7*24h舆情监测体系与三级危机预案制定]
    G3 --> G4[传播方案与IP合规要求、活动节点双向对齐校验]
    G4 -->|校验通过| H[模块6：全案合规与风险防控]
    G4 -->|校验不通过| G1
    H --> H1[全案全模块合规性终审，设置一票否决权]
    H1 --> H2[全场景风险点识别、分级与应对预案制定]
    H2 --> H3[问题内容识别与退回修改]
    H3 -->|修改闭环| I[模块7：全案整合与定稿]
    H3 -->|校验不通过| C & D & E & F & G
    I --> I1[全模块内容整合，解决冲突与矛盾]
    I1 --> I2[全周期执行timeline与落地标准表制定]
    I2 --> I3[全案与核心目标、硬性约束最终校验]
    I3 -->|校验通过| J[最终可落地完整全案交付]
    I3 -->|校验不通过| I1`,
  },
]
