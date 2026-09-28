# 消息存储结构重设计（含同步系统切除）

日期：2026-09-27
状态：已完成（2026-09-28，Phase 0 + Phase 1 全步骤验收通过）
前置：契约盘点、Rust 核心盘点、oh-my-pi / deepseek-harness 参考对照均已完成；项目无生产数据，允许 breaking change；中间状态允许不可运行。

## 背景

- 服务器（PostgreSQL）将规范消息压扁为纯文本存储，思考、工具调用、工具结果全部丢失；客户端（SQLite）反而整存规范消息 JSON，两端倒挂。
- messages 表的 `provider_id` / `model` / `token_usage` 列建表即存在但从未写入；`status` 恒为 `'done'`，占位行与已完成消息无法区分。
- 同步系统（SyncService Pull/Watch、sync_seq、outbox）与树状消息结构的关系从未设计，成为演进阻碍。

## 目标

以 lemma-core 规范消息为唯一存储真相，服务器向客户端看齐实现两端保真对齐；消息记录完整档案信息；同步系统整体切除，未来以原生理解树分支的方案重新设计。

## 决策记录（本次讨论定稿）

1. 存储真相 = lemma-core 规范消息的 serde JSON（超集格式）；厂商线缆格式只存在于 adapter 边界，出站转换只做减法。
2. thinking 块连同 `signature` 作为一等内容块存储（Anthropic 系工具调用回放所需）。
3. 消息档案字段：`id` / `conversation_id` / `parent_id` / `status` / `model` / `token_usage` / `started_at` / `first_token_at` / `finished_at` / `content_json` / `created_at` / `updated_at`；删除 `seq` 列（排序由 `(created_at, id)` 与树链承担）与全部 `sync_seq` 机制。
4. token 用量存 4 个原始数：`input`（净输入）/ `output` / `cache_read` / `cache_write`，口径归一化在 adapter 完成；前端展示按"输入 / 缓存命中 / 缓存写入 / 输出"呈现。消息级自身 token 估算推迟到上下文管理特性。
5. 会话档案新增 `last_model`（`{provider_id, model, thinking_effort?}`，发消息时刷新，进旧会话时还原）；新会话默认模型属于全局配置体系，不进会话表。
6. 性能三时刻（`started_at` / `first_token_at` / `finished_at`）由 AgentLoop 在消费 provider 流时记录，server / local 同一代码路径；客户端体感时刻由客户端本地另记，不参与同步。
7. 写入时机：保留"先占位后完结"（多端可见性需要），但状态诚实——占位插入为 `streaming`，收尾改为 `done` / `aborted` / `error`。
8. 树结构不动（`parent_id` + `leaf_id`）；两个 TraceStore 实现以共享合规测试套件锁定语义一致。
9. 同步系统全部切除（Phase 0 清单），`sync_seq` 序列与列一并删除；未来新同步方案的设计约束：原生理解树状分支，不给线性日志打补丁。
10. 迁移：旧迁移文件全删，单一 init 重建 PostgreSQL 结构；SQLite 以 `user_version` 检查 + 删库重建过渡，版本化迁移在正式发布前补。
11. 过程纪律：允许中间提交不可运行；web 仅做过渡性最小接线；mobile（KMP）一律不动，已知破坏留待后续。

## Phase 0：同步系统切除

- 删除 `crates/lemma-sync` 整个 crate，解除 workspace 注册与 `lemma-server` 的路由、状态装配。
- 删除 `proto/lemma/v1/sync.proto`，重新执行 buf lint / build / codegen 四连，清理生成物引用。
- `lemma-client` 删除 SyncEngine；`lemma-db-client` 删除 outbox 表、sync_state 表及相关 API。
- web：`src/data/sync/` 移除，对话列表与归档列表最小改动切到 `ListConversations` / `ListArchived` RPC 直读（过渡接线，不做重构）。
- KMP 不动：SyncCoordinator 残留为已知不可运行状态。
- 验收：`cargo build` / `cargo test --workspace` 全绿（不含 mobile）；web 对话列表可用。

## Phase 1：消息存储重设计

### Step 1：迁移与实体

- 清空 `crates/lemma-db-server/migrations/`，编写单一 init 迁移：users / refresh_tokens / providers / s3_configs 维持现状语义；conversations 新增 `last_model` JSONB、移除 `sync_seq`；messages 按决策 3 重建档案列、移除 `seq` 与 `sync_seq`。
- 同步更新 `DbMessage` / `DbConversation` 实体结构。
- 时间列默认值统一 `clock_timestamp()`，避免同事务插入行时间戳并列，保证 `(created_at, id)` 排序语义。
- `ArchiveEnvelope` version bump 至 2，`deserialize_envelope` 解析时校验版本。
- Phase 0 收尾（审核补发现）：清除 `lemma-conversations/src/store.rs` 中 `sync_seq = nextval('sync_seq')` 的 SQL 残留与 `tests/store.rs` 的 `sync_seq` 断言；测试按决策先删除不迁移。

### Step 2：TraceStore 契约演进

- `lemma-session`：StoredMessage 扩展档案元数据（status / model / usage / 三时刻），ConversationMeta 增加 `last_model`。
- 建立两端共享的合规测试套件：写入 - 读取保真往返、状态生命周期、树链完整性、last_model 刷新。
- 定死三时刻写回签名（`update_message` 扩参或新方法，本步决定），保证 `first_token_at` / `finished_at` 可落库。

### Step 3：PgTraceStore 保真化

- `content_json` 整存整取，废除文本压扁与 ToolResult 降级。
- 写入档案元数据；status 按决策 7 流转。
- `list_messages` 游标由 `seq` 自连接改为 `(created_at, id)` keyset；`trace_store` 的 `ORDER BY seq` 同改。
- `message_to_proto` 过渡映射：`content_json` 抽 text 块拼接为 proto `content`（有损、契约不动）；proto `seq` 填 0 视为 deprecated，随契约计划删除。
- 检查点：本步结束 `cargo check --workspace` 与 `cargo test --workspace` 回绿。

### Step 4：SqliteTraceStore 对齐

- 建表语句补齐档案列；conversations 增加 `last_model`。
- 引入 `user_version` 检查，版本不符删库重建。
- 实现与 PG 侧同一契约，接入同一套合规测试。

### Step 5：AgentLoop 写入路径

- 消费 provider 流时记录三时刻；收尾写入真实 `stop_reason`（来自 Done 事件）与 usage。
- provider_id / model 经 AgentConfig 落入消息档案（ChatService 传入）。
- 占位消息插入为 `streaming` 状态，收尾转终态；工具结果消息（未来）父指针指向发起调用的助手消息。
- 顺带修复：`ChatStarted` 回显 `client_msg_id`（契约盘点发现的一行遗漏）。

### Step 6：验收

- 合规测试套件在 PG 与 SQLite 两侧全绿。
- `cargo test --workspace` 全绿。
- handler 级测试覆盖：thinking+signature / tool_call / tool_result 经写入 - 读取往返不丢失；状态流转正确；`last_model` 随发消息刷新。

## 明确不做（范围外，各自另有计划）

- adapter 工具调用与思考事件解析、PTC（后续 adapter 特性计划）。
- proto `Message` 结构化与契约演进（紧随本计划的契约计划，与 web/KMP 客户端升级同行）。
- 特性系统（thinking_effort 参数、strict 模式、内置搜索、service_tier 等）。
- 消息级自身 token 估算（上下文管理特性）。
- 新同步方案、mobile 端修复、所有 SQL 向两个 DB 模块收口的激进方案（均留待后续评估）。

## 风险与开口

- Phase 0 之后多端实时互通暂时消失，web 以 RPC 直读过渡，可接受。
- 树 × 同步的配合是本计划刻意留下的开口，未来新同步设计的第一约束已记录（决策 9）。
