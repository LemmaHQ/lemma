# Lemma 架构

[English](architecture.md) | 中文

修改 `crates/` 下的任何内容之前先读本文。本文梳理 crate 分层、承载它们的三种运行时、一次 turn 的完整链路，以及新行为的接入点。术语以[术语表](glossary.zh.md)为准；类型定义放在 [subsystems/](subsystems/README.zh.md) 列出的子系统页面上。

## Crate 分层

Lemma 是一个 Rust workspace。每个 crate 只依赖本层或表中位于其上方的层；`lemma-core` 是各层共用的语言。

| 层    | Crate                                                           | 负责                                                                                                                                                                                                                    |
| ----- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 契约  | `lemma-proto`、`lemma-core`、`lemma-model`                      | `proto/lemma/v1` 的 Rust 绑定与带错误码的错误辅助函数；规范化的 trace 类型：`Message`、`ContentBlock`、`StreamEvent`、`ToolSpec`、`Usage`；模型接口：`Adapter`、`Connector`、`ModelRequest`、`Endpoint`、`ApiFormat`    |
| 领域  | `lemma-auth`、`lemma-session`、`lemma-provider`、`lemma-crypto` | 账号、令牌，以及认证相关的表；会话、消息树，以及 `sessions` 与 `messages` 表；预定义、自定义与 Web provider、模型列表与相关表；这些表的迁移；API key 加密                                                               |
| 引擎  | `lemma-adapter`、`lemma-tool`、`lemma-agent-loop`               | 厂商协议格式、模型列表与 Web 后端客户端；工具注册表、执行环境与 Web 工具；turn 循环及其取消                                                                                                                             |
| Agent | `lemma-agent`                                                   | 根据请求组装一个 turn（provider 端点、适配器、会话、会话目录中的工具）并运行它，以及中止正在运行的 turn                                                                                                                 |
| RPC   | `crates/rpc/*`，包括 `lemma-host`                               | 每个 proto service 对应一个 ConnectRPC 服务；`lemma-host` 在一个数据库之上把它们组装成一个路由，连接并迁移它，从数据目录打开本地引擎，并通过 `InProcessTransport` 在进程内提供这个路由                                  |
| 宿主  | `lemma-server`、`lemma-desktop`、`lemma-mobile`                 | 服务端可执行文件；桌面引擎的 Node-API addon；面向 Android 的 UniFFI 门面                                                                                                                                                |

`lemma-auth`、`lemma-session` 与 `lemma-provider` 用 SeaORM 定义自己的表与迁移，通过同一个 `DatabaseConnection` 同样运行在 SQLite 与 PostgreSQL 上；引擎层与 agent 层只通过它们的服务访问数据。`lemma-agent-loop` 与 `lemma-provider` 只通过 `lemma-model` 的 trait 访问模型；`lemma-adapter` 中的 `HttpConnector` 实现这些 trait，并通过可注入的 `HttpTransport` trait 发送 HTTP，默认实现是 `ReqwestTransport`。

`crates/shared/` 下的 crate 为所有运行时构建，包括 Android；`crates/rpc/` 存放 Connect 服务；`crates/server/`、`crates/desktop/` 与 `crates/mobile/` 下的 crate 只编入各自的宿主；`crates/test/` 下的 crate 只供测试使用（[crates/AGENTS.zh.md](../crates/AGENTS.zh.md#布局)）。

## 运行时

同一套领域服务与 turn 循环运行在三种宿主中。客户端选择宿主；核心不感知调用方是哪个客户端。

| 运行时     | 宿主                                                         | 存储                                                | 工具                           | 已存储的 API key           |
| ---------- | ------------------------------------------------------------ | --------------------------------------------------- | ------------------------------ | -------------------------- |
| 服务端模式 | `lemma-server`，端口 1025                                    | PostgreSQL；`DATABASE_URL` 为 `sqlite:` 时用 SQLite | 无                             | 用 `LEMMA_SECRET_KEY` 加密 |
| 本地引擎   | Electron 引擎进程中的 `lemma-desktop`，经 `MessagePort` 访问 | `<userData>/lemma.db` 中的 SQLite                   | 绑定的目录或每个会话一个工作区 | 用引擎生成的密钥加密       |
| 进程内     | Android 应用进程中的 `lemma-mobile`                          | `<filesDir>/lemma.db` 中的 SQLite                   | 每个会话一个工作区             | 用引擎生成的密钥加密       |

**服务端模式**从环境变量读取 `DATABASE_URL`、`LEMMA_JWT_SECRET` 与 `LEMMA_SECRET_KEY`，启动时运行迁移，对外提供 ConnectRPC 服务，以及编译时从 `web/dist` 嵌入的 Web 构建产物。浏览器客户端通过 HTTP 访问它；当 API 与页面同源时，浏览器用 `lemma_access` 与 `lemma_refresh` cookie 认证，而不是 bearer 令牌。

**本地引擎**是桌面端的运行时。Electron 在 utility process 中运行 `lemma-desktop` addon；addon 在 Electron 的 `userData` 目录上打开引擎，引擎把 JWT 密钥与主密钥保存在其中的 `secrets.json` 里。用户自行注册账号；桌面端没有默认账号。渲染层是同一个 Web 客户端；它的请求经 `MessagePort` 送到引擎进程，由引擎在进程内交给 Connect 路由处理，不监听网络端口（[desktop/AGENTS.zh.md](../desktop/AGENTS.zh.md#引擎与渲染层)）。

**进程内**是 Android 的本地模式。Kotlin 通过生成的 UniFFI 绑定打开 `lemma-mobile` 中的 `LemmaEngine`；它与桌面 addon 一样，在数据目录（应用的 `filesDir`）上打开引擎，并在进程内提供 Connect 路由。应用访问它时使用与远程模式访问服务端相同的 Connect Kotlin 客户端：一个 OkHttp 拦截器把每个请求交给引擎，而不是发到网络（[mobile/AGENTS.zh.md](../mobile/AGENTS.zh.md#模块与生成代码)）。用户自行注册账号；没有默认账号。

Web 客户端在每次查看时从宿主获取会话与消息。Android 客户端把显示过的消息完整缓存在 SQLDelight 中；删除会话时删去该会话的消息，客户端每次退出登录时清空整个缓存；缓存归客户端所有，宿主的存储才是记录本身。Android 客户端用 Android Keystore 中的密钥加密保存访问令牌和刷新令牌，所在文件不进入设备备份。备份会把引擎的 `lemma.db` 和 `secrets.json` 一起保留，因为数据库中的加密 key 只有用 `secrets.json` 里的密钥才能解开。

## 跨线路的契约

`proto/lemma/v1` 是所有远程客户端的唯一契约：`AuthService`、`ProviderService`、`SessionService`、`AgentService`、`SystemService`，以及 `errors.proto`。`ProviderService` 同时涵盖模型 provider 与 Web provider：列出 Web provider、更新其密钥与启用状态，以及设置搜索与抓取后端的顺序。Rust 在 `lemma-proto/build.rs` 中编译它，Web 的 npm 脚本生成 Web 的 TypeScript，Gradle 构建生成 Android 的 Kotlin（[proto/AGENTS.zh.md](../proto/AGENTS.zh.md)）。

业务错误携带 `errors.proto` 中封闭枚举里的一个 `ErrorReason`，由 `lemma_proto::app_error` 作为 `ErrorInfo` detail 附加；客户端按原因码本地化。基础设施故障（数据库、解密、上游）返回 internal 级别的 Connect 错误，带原始英文信息，不带原因码。

`AuthService.Me` 与 `ProviderService`、`SessionService`、`AgentService` 的每个 RPC 都用 `require_user` 解析调用者：优先取 `Bearer` 访问令牌，否则取 `lemma_access` cookie。之后每个请求只操作该用户 id 名下的行。`AuthService` 的其余 RPC 与 `SystemService` 无需认证即可调用。

## 一次 turn 的完整链路

一次 **turn** 从一条用户消息开始，在模型停止且不再请求工具、模型流失败或 turn 被中止时结束。一个 **step** 是一次模型请求；带工具调用的 turn 会运行多个 step。`lemma-agent` 中的 `Agent` 组装每个 turn，`lemma-agent-rpc` 只调用它；循环是 `lemma-agent-loop` 中的 `AgentLoop::run_turn`。`lemma-agent-rpc` 把它的 `TurnEvent` 映射为 `AgentEvent` 消息。

```text
AgentService.SendMessage(session, provider, model, content)
  require_user -> user id
  Agent::prepare reads the user's session and the API format of the nearest assistant message on the path from root to leaf
  ProviderService::bind picks the API format, opens the API key, and binds the adapter
  open the session directory and register its tools
  append the user message under the active leaf; move the leaf            -> started
  record the model selection on the session
  step:
    aborted -> end the turn                                               -> aborted
    fold the path from root to leaf into Vec<Message>
    tool calling off -> leave tool calls and tool results out of the request
    append an assistant placeholder, status streaming; move the leaf      -> turn_started
    Adapter::stream(ModelRequest) -> StreamEvent*                         -> delta (text | thinking)
    settle the placeholder: content, stop reason, usage, status, timings
    aborted during the stream -> end the turn                             -> aborted
    stream failed -> end the turn                                         -> error
    no tools, stop reason not tool_use, or no tool calls -> end the turn  -> done
    for each tool call:                                                   -> tool_call_started
      Tool::execute in the session directory                              -> tool_call_finished
      append the tool result message; move the leaf
    next step
```

消息随过程持久化：用户消息与每个占位消息在调用模型之前写入，每条工具结果在下一个 step 之前写入。流失败时，占位消息保留 `error` 状态与失败文本。

每个 `AgentEvent` 都带有服务端 `occurred_at` 时刻，重放时保持不变。助手消息的 JSON 正文持久化思考与工具的开始、结束时刻供历史记录使用；旧行不包含这些字段，适配器也不会把这些服务端字段写入 provider 请求。计时时点由 [agent 事件](subsystems/agent.zh.md#turn-事件)定义。

适配器层把每个厂商的流规范化为 `StreamEvent`：`HttpConnector` 按 `ApiFormat` 把每个 provider 端点绑定到 `OpenAiCompatible`、`AnthropicMessages` 或 `GeminiGenerate`，各适配器解析厂商的 server-sent events，首个内容增量的耗时也在适配器中测量。任何厂商的思考内容都成为与正文并列的 `Thinking` 内容块。

自定义 provider 只有一种 API 格式。预定义 provider 提供多种，`ProviderService::bind` 为整个 turn 选定一种：上下文路径上最近一条助手消息记录的格式，前提是该 provider 提供这种格式；否则使用该 provider 的默认格式。

只有循环带有 `ToolRuntime` 时工具才会运行。宿主给 `Agent` 提供工作区目录时，`Agent` 会挂上它：本地引擎与 Android 引擎以会话目录为根，基于 `LocalExecEnv` 注册 `read_file`、`write_file` 与 `bash`，会话目录是创建会话时指定的目录，没有指定时是数据目录下的 `workspaces/<session id>`；同时用系统提示词告诉模型这个目录、操作系统与 shell。服务端模式不挂工具，并拒绝创建带目录的会话。路径限制与命令限制见[工具](subsystems/agent.zh.md#工具)。宿主同时提供 Web 传输层时，搜索顺序中有已启用的 provider 才注册 `web_search`，抓取顺序中有已启用的 provider 才注册 `web_fetch`。它们的后端在回合装配时从用户的 Web provider 顺序中解析，因此设置变更对下一个回合生效。`web_search` 暴露搜索顺序中第一个后端的完整参数集；后端调用失败时转移到顺序中的下一个 provider，只携带查询与结果条数，规范化后的结果记录实际作答的后端。未知工具与工具执行失败都会成为一条错误工具结果，模型在下一个 step 中看到它；这两种情况都不会结束 turn。关闭工具调用的模型收不到工具定义，发给它的请求也不包含此前各 step 的工具调用与工具结果；已存储的消息保留这些内容。

`AbortMessage` 接收 `started` 事件中的用户消息 id，取消该用户正在运行的 turn。正在流式生成的占位消息以 `aborted` 状态与 `aborted` 停止原因定稿；正在运行的 `bash` 命令连同进程树一起停止，其他正在运行的工具调用会先执行完，turn 在下一个 step 之前停止；流以 `aborted` 结束。

无论客户端是否读取它的流，turn 都会运行到结束。`lemma-agent-rpc` 记录每个正在运行的 turn 的 `AgentEvent`；`SendMessage` 与 `ResumeStream` 都读取这份记录，因此读取较慢的客户端不会漏掉事件。丢失流的客户端用用户消息 id 和已收到的事件数调用 `ResumeStream`，先收到其余事件，再接着收到实时事件。turn 结束后，`ResumeStream` 以 `ERROR_REASON_TURN_NOT_RUNNING` 失败，客户端改为读取已定稿的消息。

## 持久化

认证表 `users`、`auth_credentials` 与 `refresh_tokens` 属于 `lemma-auth`，`providers` 属于 `lemma-provider`，`sessions` 与 `messages` 属于 `lemma-session`；每个 crate 用 SeaORM 定义自己的表并拥有它们的迁移，宿主打开数据库时，`lemma-host` 按名称顺序合并这些迁移，并在 SQLite 与 PostgreSQL 上同样执行（[crates/AGENTS.zh.md](../crates/AGENTS.zh.md#布局)）。

一个会话是一棵消息树。每条消息行保存它的 `parent_id`、以 JSON 正文保存的带 token 用量的规范化消息、状态（`streaming`、`done`、`aborted`、`error`），以及产生它的 provider、模型与 API 格式；provider id 只是一个普通 id，没有外键，因此删除 provider 不会改动任何消息或会话。会话行保存当前 `leaf_id` 与最近一次的模型选择。`lemma-session` 中的 `SessionService` 是这些表上唯一的读写代码：turn 循环通过它追加、定稿消息并移动叶子，它同时负责创建、重命名、删除会话并分页读取消息。每个针对会话的操作都带有调用者的用户 id，只触及该用户的行。

分支是挂在较早父消息下的一条新消息；已有消息从不改写。每个 turn 都从当前叶子继续。模型上下文始终是从根到叶子的路径，因此兄弟分支永远不会进入模型。

`providers` 表的一行是预定义 provider 或自定义 provider。自定义行保存完整的配置。预定义行保存 API key、启用标志与默认 API 格式；`lemma-provider` 从代码中的定义读取名称、base URL 与模型，列出 provider 时会插入该用户缺少的预定义行。`web_providers` 表的一行是一个 Web 服务账户：类型（`native`、`exa` 或 `deepseek`）、加密的 API key、启用标志，以及在搜索与抓取顺序中的位置；Native 不需要密钥，列出时同样会插入缺少的行。`ProviderService` 用由配置的主密钥派生的密钥，以 AES-256-GCM 加密每个非空的 provider API key。刷新令牌以 SHA-256 哈希存储；密码以 Argon2 哈希存储。

## 新行为放在哪里

新行为接入以下某个接入点。修改 turn 循环本身时，同步更新这张表。

| 目标                           | 机制                                                                                                                              |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| 新增厂商协议                   | 在 `lemma-model` 中加一个 `ApiFormat` 变体，在 `lemma-adapter` 中实现 `Adapter` 及其模型列表，并在 `HttpConnector` 中绑定         |
| 新增预定义 provider            | 在 `lemma-provider` 的预定义 provider 中加入它的定义                                                                              |
| 新增 Web 后端                  | 在 `lemma-provider` 的 Web 目录中加入类型，并在 `lemma-adapter` 的 `web/` 模块中加入客户端                                        |
| 新增面向模型的工具             | 在 `lemma-tool` 中实现 `Tool`，并在 `Agent` 构建 `ToolRegistry` 处注册（`lemma-agent`）                                           |
| 在别处运行工具                 | 实现 `ExecEnv`                                                                                                                    |
| 让 provider 流量走另一套网络栈 | 实现 `HttpTransport`，并用它构造 `HttpConnector`                                                                                  |
| 新增 RPC                       | 修改 `.proto`，在对应的 `crates/rpc/` crate 中实现，并重新生成客户端代码                                                          |
| 新增 RPC 服务                  | 新增 `.proto` 与 `crates/rpc/` 下的新 crate，在 `lemma-proto/build.rs` 中列出该文件，并在 `lemma-host` 中路由                     |
| 新增面向用户的错误             | 新增 `ErrorReason`，在 `lemma-proto/src/error.rs` 中映射，并在 `web/src/i18n/error-text.ts` 与两个语言文件中加入对应的 locale key |
| 修改 schema                    | 在所属 crate 的 `src/migration/` 中新增一个 SeaORM 迁移，并列入该 crate 的 `migrations()`；由 `lemma-host` 运行                   |
| 新增数据库后端                 | 在连接它的宿主中启用对应的 `sea-orm` 驱动 feature                                                                                 |
| 让 Web 客户端使用桌面能力      | 扩展 preload 桥与 `web/src/platform/` 中的适配器（[web/AGENTS.zh.md](../web/AGENTS.zh.md#布局)）                                  |
