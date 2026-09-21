# Rust 核心结构收敛：逐步重构计划

日期：2026-09-21
状态：已全部执行完成
前置：`feat/portable-agent-core` 分支推进，实现端云同构与本地离线 Agent 闭环。

## 目标结构（已落地）

```text
crates/
├── lemma-proto         # ConnectRPC 协议定义与业务错误码（前后端、网关契约）
├── lemma-core          # 跨端规范数据模型与生命周期事件（依赖 lemma-proto，零 I/O 共享核心）
├── lemma-adapter       # 跨端 LLM 网络协议适配驱动（OpenAI/Claude/Gemini 双向转换）
├── lemma-session       # 跨端会话树拓扑、分支管理与上下文组装（纯内存模型 + TraceStore 契约）
├── lemma-agent         # 跨端 Agent 大脑：执行循环与流式观察者（驱动 session + adapter + tools）
├── lemma-tools         # 跨端工具定义、ExecEnv 工作区沙盒抽象与内置工具集
│
├── lemma-db-client     # 客户端专属：纯明文 SQLite WAL + FTS5 存储引擎 + outbox 队列表
├── lemma-db-server     # 服务端专属：Postgres 连接池、迁移脚本与底层实体
│
├── lemma-auth          # 服务端专属：账户体系、密码 Argon2 哈希与 JWT 签发
├── lemma-conversations # 服务端专属：ConversationService RPC 门面 + PgTraceStore 统一存储实现
├── lemma-chat          # 服务端专属：ChatService RPC 纯流式门面（转接 AgentLoop，无私有状态）
├── lemma-providers     # 服务端专属：Provider 配置管理与 API Key 凭证密封
├── lemma-sync          # 服务端/跨端：sync_seq 增量多端同步协议
├── lemma-archive       # 服务端专属：S3 归档与信封打包
│
├── lemma-client        # 客户端唯一门面：ClientEngine trait（组装 Local / Remote 模式，供 UI 绑定）
└── lemma-server        # 服务端统一网关：Axum 启动入口与 ConnectRPC 路由汇聚
```

## 决策记录

- `lemma-proto` 独立存在，`lemma-core` 依赖它：纯数据类型与 RPC 生成物分离。
- `lemma-tools` 独立存在，`lemma-agent` 依赖它：平台沙盒实现可独立注入。
- `lemma-chat` 彻底剔除私有 SQL 占位符、快照中间态与字符断点续传逻辑，对齐 omp 式简洁模型，直接接入 `AgentLoop` 与观察者事件。
- `lemma-conversations` 与 `lemma-chat` 保留作为 ConnectRPC 服务端协议门面，对齐 Web 前端现有客户端调用；底层写操作收口至 `PgTraceStore`。
- `lemma-db-client` 瘦身为纯 SQLite WAL 存储，`LocalClientEngine` 与 `SyncEngine` 移入 `lemma-client`。

## 迁移步骤执行总结

### Step 0：提交已完成的改名（提交 `85b911d`）
- `lemma-db` → `lemma-db-server`、`lemma-store-sqlite` → `lemma-db-client` 全部引用迁移完成。

### Step 1：`lemma-trace` → `lemma-core`（提交 `a26dca8`）
- 完成 crate 改名，建立对 `lemma-proto` 的依赖，替换全仓引用。

### Step 2：抽取 `lemma-session`（提交 `f8bb28a`）
- 将 `SessionTree` 内存拓扑、`build_context_path` 与 `TraceStore` 存储契约抽为独立的 `lemma-session` 纯数据/接口库。

### Step 3：服务端编排收口 `lemma-agent`（提交 `7375ae0`）
- 增加 `20260921100000_add_tree_pointers.up.sql` 迁移，为 Postgres 增加 `leaf_id` 与 `parent_id` 字段；
- 在 `lemma-conversations` 中实现 `PgTraceStore`；
- `AgentLoop` 扩充 `TurnEvent` 观察者机制与流式增量落库；
- 重写 `ChatService`，删除旧的占位符/快照代码与 21 项紧耦合旧测试，通过 `pg_trace_smoke_test.rs` 验证端到端行为。

### Step 4：新建 `lemma-client` 门面（提交 `15df7a8`）
- 定义 `ClientEngine` trait，实现 `LocalClientEngine` 与 `RemoteClientEngine` 骨架；
- 将 `QueryHistoryTool` 迁入门面层，`client_facade_test.rs` 跨重启断电测试全绿。

### Step 5：双向同步闭环（提交 `2e0afd3`）
- `lemma-db-client` 增加 `outbox` 变更队列表与游标追踪方法；
- `lemma-client` 实现 `SyncEngine`（Push 消费 outbox + Pull 原子更新 SQLite 树）；
- `sync_engine_test.rs` 端到端离线产生对话与连网对账测试全绿。

### Step 6：清尾与文档全面更新（当前提交）
- 同步 `AGENTS.md`、`docs/features/local-mode/design.md` 与本计划文档，更新 feature 跟踪状态。
