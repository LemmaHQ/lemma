# Rust 核心结构收敛：逐步重构计划

日期：2026-09-21
状态：待批准
前置：`feat/portable-agent-core` 分支已完成 P1–P5（trace/adapter/agent/tools/db-client 五块核心已抽出并测试全绿）。

## 目标结构

```text
crates/
├── lemma-proto       # RPC 契约：proto 生成绑定 + 业务错误码（独立存在）
├── lemma-core        # 规范数据类型：Message / ContentBlock / StreamEvent / Usage（依赖 lemma-proto，零 I/O）
├── lemma-adapter     # LLM 协议适配（双端对等，已完成）
├── lemma-tools       # 工具契约 + ExecEnv 沙盒 + 审批策略（独立存在，已完成）
├── lemma-agent       # 对话循环、工具调用（依赖 lemma-tools，已完成主体）
├── lemma-session     # 会话树、分支管理、上下文组装（双端对等，新增抽取）
├── lemma-sync        # 增量同步算法（双端对等，补客户端侧）
├── lemma-db-client   # SQLite 本地持久化（已完成，已改名）
├── lemma-db-server   # Postgres 服务端持久化（已改名）
├── lemma-auth        # 账户系统（仅 Server，保持现状）
├── lemma-server      # 服务端网关总装（瘦身：编排上收，保留路由/归档/密钥托管）
└── lemma-client      # 客户端引擎门面（新建薄壳：LocalEngine + RemoteEngine）
```

## 决策记录

- `lemma-proto` 独立存在，`lemma-core` 依赖它：纯数据类型与 RPC 生成物分离。
- `lemma-tools` 独立存在，`lemma-agent` 依赖它：平台沙盒实现可独立注入。
- `lemma-crypto` 与 `lemma-archive` 作为服务端杂务保留小 crate 现状，不进主结构讨论。

## 迁移步骤（每步原子提交，全绿后进入下一步）

### Step 0：提交已完成的改名（当前工作区）

- `lemma-db` → `lemma-db-server`、`lemma-store-sqlite` → `lemma-db-client` 的全部引用迁移已验证通过，先原子提交固化。

### Step 1：`lemma-trace` → `lemma-core`

- 纯改名：crate 目录、包名、workspace 注册、全部 `use lemma_trace` 引用。
- `lemma-core` 新增对 `lemma-proto` 的依赖声明（后续统一类型时再逐步消费）。
- 风险最低，用于演练改名流程。

### Step 2：抽取 `lemma-session`

- 将 `lemma-agent::SessionTree` / `build_context_path` 迁入新 crate `lemma-session`。
- 将 `lemma-chat` 中的会话状态职责（StreamRegistry 广播、leaf 推进语义）收进 `lemma-session`。
- `lemma-agent` 改为依赖 `lemma-session`，只保留 Turn 执行循环。

### Step 3：服务端编排收口 `lemma-agent`

- `lemma-chat` 的对话编排（消费 adapter 流、写库、推进会话）改为调用同一个 `AgentLoop`。
- Postgres 版 `TraceStore` 实现落在 `lemma-conversations`（后续并入 `lemma-db-server`）。
- `lemma-chat` 瘦身为 RPC 门面 + 流广播，全部 21 项集成测试保持全绿。

### Step 4：新建 `lemma-client` 门面

- 定义 `ClientEngine` trait（UI 唯一依赖面）：会话 CRUD、发送消息、流式事件订阅、模式查询。
- `LocalEngine` 从 `lemma-db-client` 迁入并作为 trait 的本地实现。
- `RemoteEngine` 基于 ConnectRPC 客户端实现（可先留接口，随移动端接入补全）。

### Step 5：`lemma-sync` 补客户端侧

- `lemma-db-client` 增加 outbox 表与同步引擎：本地变更入队、断线重连后推送 + 拉取合并。
- 服务端 `lemma-sync` 现有 pull 端点保持不变。

### Step 6：清尾

- `lemma-conversations`、`lemma-chat` 残余能力并入 `lemma-db-server` / `lemma-server` 后删除空壳 crate。
- 更新 `AGENTS.md` 代码约定中的 crate 名录、`docs/features/local-mode/` 状态、根 README 结构说明。

## 验收标准

- 每一步：`cargo check --workspace --tests`、`cargo clippy --all-targets`、`cargo fmt --check` 全绿。
- 涉及服务端行为的步骤（Step 3、5）：既有集成测试全绿，无行为回归。
- Step 4：`lemma-client` 的 LocalEngine 端到端测试（断电重启恢复）迁移后仍通过。
