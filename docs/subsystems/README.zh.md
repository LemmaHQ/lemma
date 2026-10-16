# 子系统

[English](README.md) | 中文

Lemma 的每个子系统一页：它是什么、它传递的数据结构，以及它维持的不变量。本目录与 [architecture.zh.md](../architecture.zh.md) 互为补充：后者描述跨子系统的*行为*（crate 分层、服务端与本地两种模式、一次 turn 的完整链路）；这里的每一页是单个子系统的类型与连接方式的参考。

| 页面 | 负责 |
|---|---|
| `core.md` | `lemma-core` 中共享的领域类型：消息、内容块、流事件、工具调用、token 用量 |
| `agent.md` | `lemma-agent` 中共享的 agent 引擎及其 `AgentService` 暴露：turn 循环、有序流事件、中止与恢复 |
| `adapter.md` | `lemma-adapter` 中的 provider 适配器：请求组装、分发、传输，以及 OpenAI、Anthropic、Gemini 的 SSE 解析 |
| `session.md` | `lemma-session` 中的消息树：消息行、叶子指针、分支，以及把路径折叠为 provider 输入 |
| `tools.md` | `lemma-tools` 中的工具注册表：工具定义、执行分级、审批策略、工作区环境、内置工具 |
| `conversation.md` | `lemma-conversation` 中的会话记录与会话服务 |
| `provider.md` | `lemma-provider` 中的 provider 记录、模型目录与已存储的凭据 |
| `auth.md` | `lemma-auth` 与 `lemma-crypto` 中的账户、密码哈希、JWT 签发、本地模式账户与密钥加密 |
| `storage.md` | 存储 trait 及其 SQLite 与 PostgreSQL 后端，位于 `lemma-db-sqlite` 与 `lemma-db-pgsql` |
| `rpc.md` | `proto/lemma/v1` 契约、`crates/server/rpc/` 下的 ConnectRPC 服务，以及 `lemma-proto` 中的错误模型 |
| `server.md` | `lemma-server`：配置、路由、内嵌 Web 资源、服务端与本地两种模式 |
| `web-client.md` | `web/` 中的 React 客户端：RPC 客户端、状态 store、会话视图 |
| `desktop-engine.md` | `desktop/` 中的 Electron 外壳及其 sidecar 引擎生命周期 |
| `mobile-bridge.md` | `lemma-mobile` 中的 UniFFI 绑定与 `mobile/` 中的 Android 客户端 |

这些页面上的类型声明与源码中的声明一致。改动调整了已文档化的类型时，所属页面在同一次改动中更新（[写作规则](../AGENTS.zh.md#写作规则)）。
