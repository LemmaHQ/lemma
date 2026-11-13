# 术语表

[English](glossary.md) | 中文

Lemma 中每个概念只用一个术语。每个条目说明该术语在代码中的含义，并指出所属的 crate；跨 crate 的行为见 [architecture.zh.md](architecture.zh.md)，类型定义归 [subsystems/](subsystems/README.zh.md) 中的子系统页面。

## 会话树

- **会话（session）** — 一棵带标题、当前叶子与最近一次模型选择的消息树。删除会话会连同全部消息一起移除。`lemma-session` 负责生命周期与消息树。
- **消息（message）** — 树上的一个节点：一条规范化的 `lemma_core::Message`（`user`、`assistant` 或 `tool_result`），加上父消息 id、状态、provider 与模型。存储形式是 `lemma_session::Message`。
- **叶子（leaf）** — `leaf_id` 指向的消息；下一条用户消息挂在它下面，turn 中的每次追加都会移动它。
- **分支（branch）** — 挂在较早父消息而非叶子下的一条消息。分支只新增节点，从不改写已有节点。
- **上下文路径（context path）** — 从根到叶子按顺序排列的消息，由 `build_context_path` 生成。它是模型请求包含的唯一历史。
- **消息状态（message status）** — `streaming`（生成中的占位消息）、`done`、`aborted` 或 `error`（失败文本在 `error` 字段中）。

## Agent 循环

- **turn** — 由一条用户消息启动的工作：一个或多个 step，在某个 step 不再请求工具、流失败或 turn 被中止时结束。由 `lemma-agent` 中的 `Agent` 组装，由 `lemma-agent-loop` 中的 `AgentLoop::run_turn` 运行。
- **step** — 一次模型请求，以及其响应所请求的工具调用。每个 step 写入一条 assistant 消息，并为每个工具调用写入一条工具结果消息。
- **占位消息（placeholder）** — step 在调用模型前以 `streaming` 状态追加的 assistant 消息，之后用最终内容、状态与用量定稿。
- **流事件（stream event）** — 一个 `StreamEvent`：每个适配器都会产出的、与厂商无关的封闭事件集合（文本、思考与工具调用的开始、增量与结束；`Done`）。
- **turn 事件（turn event）** — 循环报告给观察者的一个 `TurnEvent`。`lemma-agent-rpc` 把它映射为 proto 消息 `AgentEvent`。
- **内容块（content block）** — 消息中的一个 `ContentBlock`：`Text`、`Thinking`（带重放所需的厂商签名）或 `ToolCall`。
- **停止原因（stop reason）** — 一次生成结束的原因：`stop`、`length`、`tool_use` 或 `aborted`。只有带至少一个工具调用的 `tool_use` 会开启下一个 step。

## Provider 与适配器

- **provider** — 由 `lemma-provider` 连同其 API key 与启用标志一起存储的模型服务。provider 分为预定义与自定义两类。
- **预定义 provider（predefined provider）** — 由 `lemma-provider` 在代码中定义的 provider：名称、它提供的 API 格式及每种格式的 base URL、模型及其特性。数据库行保存 API key、启用标志与默认 API 格式。DeepSeek 是预定义 provider。
- **自定义 provider（custom provider）** — 自行配置标识符、显示名称、一种 API 格式、base URL、API key、路径覆盖与模型记录的 provider。
- **Web provider（web provider）** — 存储在 `web_providers` 中的网页搜索或抓取配置：类型（`native`、`exa` 或 `deepseek`）、加密的 API key、启用标志，以及在搜索与抓取顺序中的位置。Native 通过本地 HTTP 抓取，无需 API key。
- **API 格式（API format）** — 模型请求的线上格式：`openai`（OpenAI chat completions 及兼容 API）、`anthropic` 或 `gemini`。`lemma-model` 定义唯一的 `ApiFormat` 枚举。
- **provider 标识符（provider identifier）** — provider 的机器名：非空 ASCII，创建后不可修改，在自定义 provider 中唯一。预定义 provider 的标识符指明其定义，例如 `deepseek`。
- **模型特性（model feature）** — 模型的一项属性，它改变发给该模型的请求。工具调用是唯一的特性：关闭工具调用的模型收不到工具定义，也收不到此前的工具调用与工具结果。
- **端点（endpoint）** — 一个 `Endpoint`：`ProviderService::bind` 在绑定适配器之前打开的一种 API 格式，及其 base URL、路径覆盖与明文 API key。
- **适配器（adapter）** — 绑定到一个端点的 `lemma_model::Adapter` trait 实现：`OpenAiCompatible`、`AnthropicMessages` 或 `GeminiGenerate`。它把 `ModelRequest` 转换为厂商的线路格式，并把厂商的流转换为流事件。`HttpConnector` 把端点绑定到对应 API 格式的适配器，并以 `ModelAdapter` 变体的形式返回。
- **模型列表（model list）** — 自定义 provider 的端点报告的模型 id，由 `Connector::list_models` 实时获取。自定义 provider 行另行保存自己的模型记录：每个模型 id 及其特性。

## 工具

- **工具（tool）** — `lemma_tool::Tool` 的一个实现：提供给模型的 `ToolSpec` 与 `execute` 函数。内置工具是 `read_file`、`write_file`、`bash`、`web_search` 与 `web_fetch`。
- **执行环境（execution environment）** — 一个 `ExecEnv`：工具执行的文件读写、目录列举与 shell 命令。`LocalExecEnv` 把它们限定在一个会话目录内。
- **会话目录（session directory）** — 会话的工具运行所在的目录：创建会话时指定的绝对目录，没有指定时是会话的工作区。
- **工作区（workspace）** — 本地数据目录下的 `workspaces/<session id>` 目录，为不指定目录创建的会话生成。
- **系统提示词（system prompt）** — `ModelRequest` 置于历史之前发送的指令。带工具的 turn 发送一段写明会话目录、操作系统与 shell 的系统提示词。
- **工具运行时（tool runtime）** — 一个 `ToolRuntime`：宿主挂到循环上的注册表与执行环境。没有它的循环不发送工具定义。
- **Web 后端（web backend）** — 一种 Web provider 类型的客户端，在 `lemma-adapter` 的 `web/` 模块中基于注入的 `HttpTransport` 实现。Web 工具按配置的顺序尝试已启用的后端，出错时转移到下一个后端。

## 运行时

- **服务端模式（server mode）** — `lemma-server` 可执行文件：在 `LEMMA_DATA_DIR`（默认 `./data`）上打开 `LocalEngine`，默认监听 `127.0.0.1:1025`（`LEMMA_PORT`），提供 Connect 路由与嵌入的 Web 构建产物。
- **本地模式（local mode）** — 将数据留在应用本地目录中的运行时：桌面端的本地引擎与 Android 的进程内引擎。
- **本地引擎（local engine）** — `lemma-host` 中的 `LocalEngine`：同一数据目录下、基于一个 SQLite 数据库（`lemma.db`）、`secrets.json` 与按会话隔离的 `workspaces/` 运行的 Connect 服务。`lemma-desktop` 在 Electron 引擎进程中基于 `userData` 打开它，`lemma-mobile` 基于 Android 的 `filesDir` 打开它，`lemma-server` 基于 `LEMMA_DATA_DIR` 打开它。
- **引擎端口（engine port）** — 网页与桌面引擎进程之间的 `MessagePort`。请求、响应数据块与取消都经它传递；它不传递会话消息。
- **进程内引擎（in-process engine）** — `lemma-mobile` 中的 `LemmaEngine`，在 Android 应用内提供 Connect 路由；应用通过 UniFFI 绑定访问它。
- **加密 key（sealed key）** — 由 `lemma-crypto` 以 AES-256-GCM、用从 `secrets.json` 中 `secret_key` 派生的密钥加密的 provider API key。更换主密钥后，所有已加密的 key 都无法读取。

## 错误

- **错误原因（error reason）** — `errors.proto` 中封闭枚举 `ErrorReason` 的一个值，作为 `ErrorInfo` detail 附加到 Connect 错误上。客户端翻译原因码；英文信息只是兜底。
- **内部错误（internal error）** — 不带错误原因、携带原始诊断文本的 Connect 错误，用于基础设施故障。
