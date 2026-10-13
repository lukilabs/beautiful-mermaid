# 原始需求文档：beautiful-mermaid MCP Server

## 1. 项目概述

### 背景

`beautiful-mermaid` 是一个 TypeScript 库，支持将 Mermaid 图表代码渲染为 SVG 或 ASCII/Unicode 终端图（6 种图类型：流程图、状态图、序列图、类图、ER 图、XY 图表）。当前项目是一个 fork，目标是在此基础上增加 MCP（Model Context Protocol）服务层，使 AI Agent 可以通过标准化 MCP 协议调用图表渲染能力。

### 核心价值主张

让 AI 编程助手（Claude Desktop、Cursor、Craft Agents 等）能够直接在对话中生成和渲染 Mermaid 图表——Web 环境输出 SVG，终端环境输出 ASCII/Unicode 图——无需 AI Agent 自己实现渲染逻辑。

---

## 2. 利益相关方与用户角色

| 角色 | 描述 | 核心诉求 |
|------|------|---------|
| **AI Agent** | 通过 MCP 调用工具的 LLM 客户端 | 简单的工具调用接口、结构化的错误反馈、自我修正能力 |
| **开发者用户** | 通过 AI 助手间接使用 | 在对话中看到漂亮的图表 |
| **库维护者（upstream）** | beautiful-mermaid 原维护者（Craft） | 代码质量、兼容性、不破坏现有 API |
| **本 fork 维护者** | 你本人 | 功能完整、可维护、有潜力合入上游 |

---

## 3. MCP 工具定义

### 3.1 `render_mermaid_svg`

| 属性 | 值 |
|------|-----|
| **功能** | 渲染 Mermaid 源码为 SVG 字符串 |
| **输入** | `mermaid_code: string`（必填）+ 核心主题选项（`theme_name`, `bg`, `fg`, `transparent` 等约 4-5 个可选参数） |
| **输出** | `{ svg: string }` 或错误时返回 `{ error: { message, line?, column? }, partial_svg?: string }` |

**具体暴露的参数待架构设计阶段确定**，范围约束为 4-5 个核心参数，不全量暴露 15 个 RenderOptions。

### 3.2 `render_mermaid_ascii`

| 属性 | 值 |
|-----|-----|
| **功能** | 渲染 Mermaid 源码为 ASCII/Unicode 终端图 |
| **输入** | `mermaid_code: string`（必填）+ ASCII 选项（`use_ascii: boolean`, `padding_x`, `padding_y`, `box_border_padding`, `color_mode` 等可选参数） |
| **输出** | `{ ascii: string, warnings?: string[] }` 或错误时 `{ error, partial_ascii? }` |

**关于中文**：MCP 工具描述中提示 AI Agent 使用全英文标签。若仍传入中文，照常渲染但在 `warnings` 字段提示可能出现对齐问题。不实现中文显示宽度的自动修正。

### 3.3 `parse_mermaid`

| 属性 | 值 |
|-----|-----|
| **功能** | 解析 Mermaid 源码为结构化 AST（MermaidGraph），不渲染 |
| **输入** | `mermaid_code: string` |
| **输出** | `{ graph: MermaidGraph }` 或结构化错误 |

### 3.4 `list_diagram_types`

| 属性 | 值 |
|-----|-----|
| **功能** | 列出支持的图类型及示例语法 |
| **输入** | 无 |
| **输出** | `{ diagram_types: Array<{ name, description, example }> }` |

---

## 4. 非功能性需求

| 质量属性 | 要求 | 说明 |
|---------|------|------|
| **性能** | 先做出来，延迟尽量小 | 不做硬性指标约束，后续优化 |
| **传输协议** | stdio only | 暂不支持 HTTP/SSE |
| **错误处理** | 结构化错误 + best-effort 部分渲染 | MCP 层 try-catch 包裹，不改原库 API（选项 B） |
| **中文处理** | 不实现宽度自动修正 | 工具提示要求英文，传入中文时仅警告 |
| **运行时** | Bun 优先 | 先试 Bun + MCP SDK 兼容性，不兼容则回退 |
| **分发方式** | npm 包 | 同一包子入口 `beautiful-mermaid/mcp` |
| **上游兼容性** | 不改原库公开 API | MCP 层作为包装层，方便未来合入上游 |

---

## 5. 技术约束

| 约束 | 详情 |
|------|------|
| **MCP SDK** | `@modelcontextprotocol/sdk`（TypeScript 官方） |
| **运行时** | Bun（优先尝试） |
| **构建工具** | 复用现有 tsup 构建管线 |
| **现有依赖** | `elkjs`, `entities` 保持不变 |
| **测试** | 复用现有 `bun test` 框架 |

---

## 6. 外部集成与依赖

- `@modelcontextprotocol/sdk` —— MCP TypeScript 官方 SDK
- `elkjs` —— 图布局引擎（已有依赖）
- `entities` —— XML 实体解码（已有依赖）
- 无其他外部系统依赖

---

## 7. 已识别的冲突与权衡决策

| 冲突 | 决策 | 理由 |
|------|------|------|
| **Best-effort vs API 稳定性** | MCP 层 try-catch（选项 B），不改原库 | 保护上游兼容性，方便未来合入 |
| **中文宽度 vs 实现复杂度** | 完全放弃中文自动修正 | 通过工具提示约束规避，大幅降低改动范围 |
| **Bun vs MCP SDK 兼容性** | 先用 Bun 试，不兼容则换方案 | 风险可控，交付时间不敏感 |

---

## 8. 演进路线

- **短期**：MCP 能力在 fork 上跑通、稳定
- **中期**：向上游 beautiful-mermaid 提 PR，推动 MCP 成为官方特性
- **长期**：无具体规划

---

## 9. 假设与未决问题

| 编号 | 问题 | 状态 |
|------|------|------|
| Q1 | `render_mermaid_svg` 具体暴露哪 4-5 个核心参数 | 待架构设计阶段确定 |
| Q2 | Bun 与 `@modelcontextprotocol/sdk` 的兼容性 | 待开发阶段验证 |
| Q3 | MCP 工具输入 JSON Schema 的具体定义 | 待架构设计阶段确定 |
| Q4 | 是否需要 `tsup` 构建 Node-compatible 产物作为 fallback | 取决于 Q2 结果 |

---

## 10. 不做的事（防止需求膨胀）

- ❌ 不支持 HTTP/SSE 传输
- ❌ 不实现中文显示宽度自动修正
- ❌ 不改动原库 `renderMermaidSVG`/`renderMermaidASCII` 的公开 API 签名
- ❌ 不集成外部验证服务
- ❌ 不添加新的图类型
- ❌ 不实现 PNG 或其他格式导出
- ❌ 不设硬性性能指标
