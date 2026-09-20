# 2026-09-20 可移植 Agent 核心与 Rust 工作区重构计划

## 0. 背景与目标

客户端需要 Local Mode：desktop 成为完整的 Work Agent（对标并超越 Codex CLI），android 支持全量工作能力（沙盒 + 工作区 + 工具链，非主力平台但能力不阉割）。
架构参考 oh-my-pi（`pi-ai` / `pi-agent`）的分层：格式无关的规范 Trace 类型为一等公民，Provider 适配器是唯一认识厂商协议的层，编排循环与宿主解耦。
本计划覆盖 Rust 工作区重构（P1–P4）与 Local Mode 能力落地（P5–P6）；后者对应 feature 目录 `docs/features/local-mode/`。

## 1. 目标 Crate 划分

```
lemma-trace       规范类型：Message / ContentBlock(Text|Thinking|ToolCall|Image) /
                  ToolCall / ToolResult / StreamEvent / StopReason / Usage
                  零 I/O，仅 serde；三端唯一通用语言
lemma-provider    Provider trait + openai/anthropic/gemini 适配器 + SSE 解析
                  + 跨厂商上下文转换（handoff 时 Thinking 块降级为标记文本）
                  HTTP 经 Transport trait 注入，默认实现 reqwest
lemma-tools       Tool 定义/注册/审批策略 + ExecEnv trait（工作区沙盒抽象）
                  + 内建工具（read/write/shell/query_history）+ MCP 客户端（rmcp）+ Skill 加载
lemma-agent       编排循环：Context 组装 → Provider 流 → 工具调度 → 轨迹追加
                  依赖 TraceStore trait，不感知具体数据库与宿主
lemma-db-client   本地存储实现：rusqlite + WAL + FTS5，desktop/android 共用
lemma-server      ConnectRPC 门面 + auth + 密钥密封 + S3 归档（纯装配层）
```

现有 crate 去向：

- `lemma-chat` 拆分消解：adapter/* + registry → `lemma-provider`；service 编排 → `lemma-agent`；ConnectRPC handler → `lemma-server`。
- `lemma-providers` 保留为 provider 配置管理（CRUD、密钥密封），不含协议适配。
- `lemma-conversations` / `lemma-sync` 成为 TraceStore 的 Postgres 实现。
- `lemma-proto` / `lemma-crypto` / `lemma-db` / `lemma-archive` 不变。

依赖方向铁律：`lemma-trace` 不依赖任何上层；只有 `lemma-provider` 允许出现厂商 wire 结构；`lemma-agent` 不依赖 sqlx/reqwest/axum/connectrpc。

## 2. 关键决策（已与需求方定稿）

1. **规范 Trace 模型**：`ContentBlock = Text | Thinking | ToolCall | Image`，Thinking 与正文同级；`StreamEvent` 细粒度（text/thinking/toolcall 各 start/delta/end + done/error），toolcall_delta 支持参数 JSON 增量。
2. **跨厂商 handoff**：轨迹本体格式不变；会话中途换模型时由 Provider 出站侧做上下文转换。
3. **本地存储纯 SQLite**：单文件、WAL、明文不加密；JSONL 仅作导出格式（决策理由见 `docs/features/local-mode/decisions/0001-local-storage-sqlite.md`）。
4. **会话树**：`messages` 增加 `parent_id`，会话持有 `leaf_id` 指针；分支 = 在历史节点下追加子条目，永不改写历史；上下文 = root→leaf 路径重放（照搬 omp session tree 语义）。
5. **local-only 会话**：`conversations.sync_mode ∈ {synced, local_only}`；local_only 会话消息不进 outbox，仅向服务端注册 stub（标题 + 元数据）；开关切换零迁移。
6. **blob 外置**：图片与大工具输出存 content-addressed 文件，库内只存引用；同步走归档通道（与 lemma-archive envelope 同构）。
7. **Agent 自查询**：内建 `query_history` 工具，只读连接 + FTS5 全文索引。
8. **Android 存储统一走 Rust 核心**（rusqlite 经 UniFFI 暴露），SQLDelight 退出会话域。
9. **同步协议扩展**：pull 按 sync_seq 游标；push 走 outbox 表；回显按消息 id upsert；stub 会话参与元数据同步。

## 3. 分期实施

| 阶段 | 内容 | 验收 |
| --- | --- | --- |
| P1 | 新建 `lemma-trace`，定义规范类型 | 编译通过 + serde roundtrip 单测 |
| P2 | 新建 `lemma-provider`，迁移 adapter/registry，接口升级为 StreamEvent；`lemma-chat` 改调新接口 | 现有 chat 集成测试（直调 handler）全绿 |
| P3 | 新建 `lemma-agent`，剥离编排循环；抽 TraceStore trait，Postgres 实现落 lemma-conversations/lemma-sync；server 退化为门面 | 全量测试绿 + 手工完成一次完整对话 |
| P4 | 新建 `lemma-tools`：ExecEnv trait + 最小内建工具 + 审批策略骨架 | server 态工具调用闭环测试 |
| P5 | `lemma-db-client` + desktop sidecar 嵌入核心 + query_history；feature `local-mode` 转 in-progress | 无服务端完成带工具的完整对话；杀进程重进历史完好 |
| P6 | android 经 UniFFI 嵌入核心 + 平台沙盒 ExecEnv（SAF 作用域工作区） | 真机离线跑通 agent 会话 |

schema 变更集中在 P3–P5：`messages.parent_id`、`conversations.leaf_id`、`conversations.sync_mode`、本地库 outbox/FTS5 建表。

## 4. 验证门禁

- 每阶段 `cargo fmt --all` + clippy + test 全绿后原子提交（未获许可不提交）。
- P2/P3 动现有行为，以现有集成测试为回归网。
- P5 起增加真实渲染/运行验收：desktop sidecar 与 android 真机各跑一次端到端。
- 覆盖率门禁维持 CI 现状（Rust 85%）。
