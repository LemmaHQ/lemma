# Lemma 架构

[English](architecture.md) | 中文

修改 `crates/` 下的任何内容之前先读本文。本文梳理 crate 分层、承载它们的三种运行时、一次 turn 的完整链路，以及新行为的接入点。术语以[术语表](glossary.zh.md)为准；类型定义放在 [subsystems/](subsystems/README.zh.md) 列出的规划中的子系统页面上。

## Crate 分层

Lemma 是一个 Rust workspace。每个 crate 只依赖本层或表中位于其上方的层；`lemma-core` 是各层共用的语言。

| 层 | Crate | 负责 |
| --- | --- | --- |
| 契约 | `lemma-proto`、`lemma-core`、`lemma-model` | `proto/lemma/v1` 的 Rust 绑定与带错误码的错误辅助函数；规范化的 trace 类型：`Message`、`ContentBlock`、`StreamEvent`、`ToolSpec`、`Usage`；模型接口：`Adapter`、`Connector`、`ModelRequest`、`Endpoint`、`ProviderKind` |
| 领域 | `lemma-auth`、`lemma-conversation`、`lemma-provider`、`lemma-crypto` | 账号与令牌；会话、消息树及其 `ConversationStore` trait；provider 配置与模型列表；API key 加密 |
| 引擎 | `lemma-adapter`、`lemma-tools`、`lemma-agent-loop` | 厂商协议格式与模型列表；工具注册表、审批策略与执行环境；turn 循环及其取消 |
| Agent | `lemma-agent` | 根据请求组装一个 turn（provider 端点、适配器、会话存储、工作区工具）并运行它，以及中止正在运行的 turn |
| 存储 | `lemma-db-sqlite`、`lemma-db-pgsql` | 迁移、SQL，以及每个后端对每个存储 trait 的一份实现 |
| RPC | `crates/rpc/*` | 每个 proto service 对应一个 ConnectRPC 服务 |
| 宿主 | `lemma-server`、`lemma-mobile` | 服务端可执行文件；面向 Android 的 UniFFI 门面 |

领域层、引擎层与 agent 层不含 SQL。它们定义存储 trait（`ConversationStore`、`ProviderStore`、`AuthStore`），由各宿主传入 SQLite 或 PostgreSQL 实现。`lemma-agent-loop` 与 `lemma-provider` 只通过 `lemma-model` 的 trait 访问模型；`lemma-adapter` 中的 `HttpConnector` 实现这些 trait，并通过可注入的 `HttpTransport` trait 发送 HTTP，默认实现是 `ReqwestTransport`。

`crates/shared/` 下的 crate 为所有运行时构建，包括 Android；`crates/rpc/` 存放 Connect 服务；`crates/server/` 与 `crates/mobile/` 下的 crate 只编入各自的宿主（[crates/AGENTS.zh.md](../crates/AGENTS.zh.md#布局)）。

## 运行时

同一套领域服务与 turn 循环运行在三种宿主中。客户端选择宿主；核心不感知调用方是哪个客户端。

| 运行时 | 宿主 | 存储 | 工具 | 已存储的 API key |
| --- | --- | --- | --- | --- |
| 服务端模式 | `lemma-server`，端口 1025 | PostgreSQL；`DATABASE_URL` 为 `sqlite:` 时用 SQLite | 无 | 用 `LEMMA_SECRET_KEY` 加密 |
| 本地引擎 | 设置了 `LEMMA_LOCAL_MODE` 的 `lemma-server`，回环地址上由操作系统分配端口 | `<LEMMA_DATA_DIR>/lemma.db` 中的 SQLite | 每个会话一个工作区 | 用引擎生成的密钥加密 |
| 进程内 | `lemma-mobile` 中的 `LemmaEngine`，加载进 Android 应用 | `<filesDir>/lemma.db` 中的 SQLite | 每个会话一个工作区 | 明文 |

**服务端模式**从环境变量读取 `DATABASE_URL`、`LEMMA_JWT_SECRET` 与 `LEMMA_SECRET_KEY`，启动时运行对应后端的迁移，对外提供四个 ConnectRPC 服务，以及编译时从 `web/dist` 嵌入的 Web 构建产物。浏览器客户端通过 HTTP 访问它；当 API 与页面同源时，浏览器用 `lemma_access` 与 `lemma_refresh` cookie 认证，而不是 bearer 令牌。

**本地引擎**是桌面端的运行时。Electron 以子进程方式启动 `lemma-server`；引擎把 JWT 密钥与加密密钥保存在数据目录下的 `secrets.json` 中，创建默认本地账号，并打印一行 `LEMMA_READY <json>`，携带端口与该账号的凭据。stdin 关闭时引擎退出。渲染层是同一个 Web 客户端，指向引擎的回环地址（[desktop/AGENTS.zh.md](../desktop/AGENTS.zh.md#引擎与渲染层)）。

**进程内**是 Android 的本地模式。Kotlin 通过生成的 UniFFI 绑定打开 `LemmaEngine`，直接调用领域服务，不经过 RPC；turn 事件经 `AgentEventListener` 回调送达。同一个 Android 应用还有远程模式，通过 Connect Kotlin 访问服务端。两种模式都实现 Kotlin 的 `LemmaClient` 接口（`RemoteLemmaClient`、`LocalLemmaClient`）。

Web 客户端在每次查看时从宿主获取会话与消息。Android 客户端把显示过的消息缓存在 SQLDelight 中；缓存归客户端所有，宿主的存储才是记录本身。

## 跨线路的契约

`proto/lemma/v1` 是所有远程客户端的唯一契约：`AuthService`、`ProviderService`、`ConversationService`、`AgentService`，以及 `errors.proto`。Rust 在 `lemma-proto/build.rs` 中编译它，Web 的 npm 脚本生成 Web 的 TypeScript，Gradle 构建生成 Android 的 Kotlin（[proto/AGENTS.zh.md](../proto/AGENTS.zh.md)）。

业务错误携带 `errors.proto` 中封闭枚举里的一个 `ErrorReason`，由 `lemma_proto::app_error` 作为 `ErrorInfo` detail 附加；客户端按原因码本地化。基础设施故障（数据库、解密、上游）返回 internal 级别的 Connect 错误，带原始英文信息，不带原因码。

`AuthService.Me` 与其他三个服务的每个 RPC 都用 `require_user` 解析调用者：优先取 `Bearer` 访问令牌，否则取 `lemma_access` cookie。之后每个请求只操作该用户 id 名下的行。

## 一次 turn 的完整链路

一次 **turn** 从一条用户消息开始，在模型停止且不再请求工具、模型流失败或 turn 被中止时结束。一个 **step** 是一次模型请求；带工具调用的 turn 会运行多个 step。`lemma-agent` 中的 `Agent` 组装每个 turn，两个宿主都只调用它；循环是 `lemma-agent-loop` 中的 `AgentLoop::run_turn`。RPC 宿主把它的 `TurnEvent` 映射为 `AgentEvent` 消息，移动端宿主把它们映射为 `MobileAgentEvent`。

```text
AgentService.SendMessage(conversation, provider, model, content, thinking_effort)
  require_user -> user id
  ProviderService::adapter opens the provider's API key and binds the adapter for its kind
  thinking_effort: the request's value, else the conversation's last model
  append the user message under the active leaf; move the leaf            -> started
  record the model selection on the conversation
  step:
    aborted -> end the turn                                               -> aborted
    fold the path from root to leaf into Vec<Message>
    append an assistant placeholder, status streaming; move the leaf      -> turn_started
    Adapter::stream(ModelRequest) -> StreamEvent*                         -> delta (text | thinking)
    settle the placeholder: content, stop reason, usage, status, timings
    aborted during the stream -> end the turn                             -> aborted
    stream failed -> end the turn                                         -> error
    no tools, stop reason not tool_use, or no tool calls -> end the turn  -> done
    for each tool call:                                                   -> tool_call_started
      approval policy -> Tool::execute in the workspace                   -> tool_call_finished
      append the tool result message; move the leaf
    next step
```

消息随过程持久化：用户消息与每个占位消息在调用模型之前写入，每条工具结果在下一个 step 之前写入。流失败时，占位消息保留 `error` 状态与失败文本。

适配器层把每个厂商的流规范化为 `StreamEvent`：`HttpConnector` 按 `ProviderKind` 把每个 provider 端点绑定到 `OpenAiCompatible`、`AnthropicMessages` 或 `GeminiGenerate`，各适配器解析厂商的 server-sent events，首个内容增量的耗时也在适配器中测量。任何厂商的思考内容都成为与正文并列的 `Thinking` 内容块。

只有循环带有 `ToolRuntime` 时工具才会运行。宿主给 `Agent` 提供工作区目录时，`Agent` 会挂上它：本地引擎与 Android 引擎在数据目录下的 `workspaces/<conversation id>` 中，以 `LocalExecEnv` 为根注册 `read_file`、`write_file` 与 `bash`；服务端模式不挂工具。未知工具、审批结果为 `Prompt` 或 `Deny`、工具执行失败，都会成为一条错误工具结果，模型在下一个 step 中看到它；这些情况都不会结束 turn。

`AbortMessage` 接收 `started` 事件中的用户消息 id，取消该用户正在运行的 turn。正在流式生成的占位消息以 `aborted` 状态与 `aborted` 停止原因定稿；正在运行的工具调用会先执行完，turn 在下一个 step 之前停止；流以 `aborted` 结束。`LemmaEngine::abort_message` 以同样的方式中止 Android 引擎中的 turn。

无论客户端是否读取它的流，turn 都会运行到结束。`lemma-agent-rpc` 记录每个正在运行的 turn 的 `AgentEvent`；`SendMessage` 与 `ResumeStream` 都读取这份记录，因此读取较慢的客户端不会漏掉事件。丢失流的客户端用用户消息 id 和已收到的事件数调用 `ResumeStream`，先收到其余事件，再接着收到实时事件。turn 结束后，`ResumeStream` 以 `ERROR_REASON_TURN_NOT_RUNNING` 失败，客户端改为读取已定稿的消息。

## 持久化

两个后端共用同一逻辑 schema：`users`、`auth_credentials`、`refresh_tokens`、`providers`、`conversations` 与 `messages`。每个后端各有一个由可回滚迁移对组成的 `migrations/` 目录，schema 改动要在两边各加一个迁移（[crates/AGENTS.zh.md](../crates/AGENTS.zh.md#布局)）。每个宿主打开连接池时都会运行迁移。

一个会话是一棵消息树。每条消息行保存它的 `parent_id`、带 token 用量的序列化规范化消息、状态（`streaming`、`done`、`aborted`、`error`），以及产生它的 provider 与模型。会话行保存当前 `leaf_id` 与最近一次的模型选择。`lemma-conversation` 中的 `ConversationStore` 是这些表上唯一的 trait：turn 循环通过它追加、定稿消息并移动叶子，会话服务通过它创建、重命名、删除会话并分页读取消息。每个针对会话的操作都带有调用者的用户 id，只触及该用户的行。

分支是挂在较早父消息下的一条新消息；已有消息从不改写。每个 turn 都从当前叶子继续。模型上下文始终是从根到叶子的路径，因此兄弟分支永远不会进入模型。

provider 的 API key 经过 `ProviderService`：配置了密钥时，用由它派生的密钥以 AES-256-GCM 加密；没有密钥时（Android 引擎）以明文存储。refresh 令牌以 SHA-256 哈希存储；密码以 Argon2 哈希存储。

## 新行为放在哪里

新行为接入以下某个接入点。修改 turn 循环本身时，同步更新这张表。

| 目标 | 机制 |
| --- | --- |
| 新增厂商协议 | 在 `lemma-model` 中加一个 `ProviderKind` 变体，在 `lemma-adapter` 中实现 `Adapter` 及其模型列表，并在 `HttpConnector` 中绑定 |
| 新增面向模型的工具 | 在 `lemma-tools` 中实现 `Tool`，并在 `Agent` 构建 `ToolRegistry` 处注册（`lemma-agent`） |
| 管控工具调用 | 实现 `ApprovalPolicy` 并设置到 `ToolRuntime` 上 |
| 在别处运行工具 | 实现 `ExecEnv` |
| 让 provider 流量走另一套网络栈 | 实现 `HttpTransport`，并用它构造 `HttpConnector` |
| 新增 RPC | 修改 `.proto`，在对应的 `crates/rpc/` crate 中实现，并重新生成客户端代码 |
| 新增 RPC 服务 | 新增 `.proto` 与 `crates/rpc/` 下的新 crate，在 `lemma-proto/build.rs` 中列出该文件，并在 `lemma-server` 中路由 |
| 新增面向用户的错误 | 新增 `ErrorReason`，在 `lemma-proto/src/error.rs` 中映射，并在 `web/src/data/rpc/errors.ts` 与两个语言文件中加入对应的 locale key |
| 修改 schema | 在 `lemma-db-sqlite` 与 `lemma-db-pgsql` 中各加一个迁移对，再更新存储实现 |
| 新增存储后端 | 实现三个存储 trait，并在每个宿主中接入 |
| 向 Android 本地模式暴露能力 | 给 `LemmaEngine` 加方法；它的签名就是 Kotlin API（[mobile/AGENTS.zh.md](../mobile/AGENTS.zh.md#模块与生成代码)） |
| 让 Web 客户端使用桌面能力 | 扩展 preload 桥与 `web/src/platform/` 中的适配器（[web/AGENTS.zh.md](../web/AGENTS.zh.md#布局)） |
