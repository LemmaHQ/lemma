# 术语表

[English](glossary.md) | 中文

Lemma 中每个概念只用一个术语。每个条目说明该术语在代码中的含义，并指出所属的 crate；跨 crate 的行为见 [architecture.zh.md](architecture.zh.md)，类型定义归 [subsystems/](subsystems/README.zh.md) 中规划的子系统页面。

## 会话树

- **会话（conversation）** — 属于某个用户的一棵消息树，带标题、当前叶子与最近一次的模型选择。删除会话会连同全部消息一起移除。`lemma-conversation` 负责生命周期与消息树。
- **消息（message）** — 树上的一个节点：一条规范化的 `lemma_core::Message`（`user`、`assistant` 或 `tool_result`），加上父消息 id、状态、provider 与模型。存储形式是 `lemma_conversation::Message`。
- **叶子（leaf）** — `leaf_id` 指向的消息；下一条用户消息挂在它下面，turn 中的每次追加都会移动它。
- **分支（branch）** — 挂在较早父消息而非叶子下的一条消息。分支只新增节点，从不改写已有节点。
- **上下文路径（context path）** — 从根到叶子按顺序排列的消息，由 `build_context_path` 生成。它是模型请求包含的唯一历史。
- **消息状态（message status）** — `streaming`（生成中的占位消息）、`done`、`aborted` 或 `error`（失败文本在 `error` 字段中）。

## Agent 循环

- **turn** — 由一条用户消息启动的工作：一个或多个 step，在某个 step 不再请求工具、流失败或 turn 被中止时结束。由 `lemma-agent` 中的 `Agent` 组装，由 `lemma-agent-loop` 中的 `AgentLoop::run_turn` 运行。
- **step** — 一次模型请求，以及其响应所请求的工具调用。每个 step 写入一条 assistant 消息，并为每个工具调用写入一条工具结果消息。
- **占位消息（placeholder）** — step 在调用模型前以 `streaming` 状态追加的 assistant 消息，之后用最终内容、状态与用量定稿。
- **流事件（stream event）** — 一个 `StreamEvent`：每个适配器都会产出的、与厂商无关的封闭事件集合（文本、思考与工具调用的开始、增量与结束；`Done`；`Error`）。
- **turn 事件（turn event）** — 循环报告给观察者的一个 `TurnEvent`。`lemma-agent-rpc` 把它映射为 proto 消息 `AgentEvent`；`lemma-mobile` 把它映射为 `MobileAgentEvent`。
- **内容块（content block）** — 消息中的一个 `ContentBlock`：`Text`、`Thinking`（带重放所需的厂商签名）、`ToolCall` 或 `Image`。
- **停止原因（stop reason）** — 一次生成结束的原因：`stop`、`length`、`tool_use`、`error` 或 `aborted`。只有带至少一个工具调用的 `tool_use` 会开启下一个 step。
- **思考强度（thinking effort）** — 转发给厂商思考控制的推理设置（`low`、`medium`、`high` 或数值预算）。`SendMessage` 中为空时沿用会话的上一次设置。

## Provider 与适配器

- **provider** — 由 `lemma-provider` 存储的、用户配置的模型端点：类型、标识符、显示名称、base URL、API key、路径覆盖、缓存的模型 id，以及启用标志。
- **provider 类型（provider kind）** — provider 的 API 方言：`openai`（OpenAI chat completions 及兼容 API）、`anthropic` 或 `gemini`。`lemma-model` 定义唯一的 `ProviderKind` 枚举。
- **provider 标识符（provider identifier）** — provider 的机器名：非空 ASCII，在同一用户下唯一，创建后不可修改。
- **端点（endpoint）** — 一个 `Endpoint`：由 `ProviderService::endpoint` 打开的 provider 类型、base URL、路径覆盖与明文 API key。
- **适配器（adapter）** — 绑定到一个端点的 `lemma_model::Adapter` trait 实现：`OpenAiCompatible`、`AnthropicMessages` 或 `GeminiGenerate`。它把 `ModelRequest` 转换为厂商的线路格式，并把厂商的流转换为流事件。`HttpConnector` 把端点绑定到对应类型的适配器。
- **模型列表（model list）** — provider 端点报告的模型 id，由 `Connector::list_models` 实时获取。provider 行另行保存一份模型 id 列表。

## 工具

- **工具（tool）** — `lemma_tools::Tool` 的一个实现：提供给模型的 `ToolSpec`、一个等级，以及 `execute` 函数。内置工具是 `read_file`、`write_file` 与 `bash`。
- **工具等级（tool tier）** — 工具的能力类别：`Read`、`Write` 或 `Exec`。审批策略在每次调用时收到它。
- **审批策略（approval policy）** — 对每次工具调用返回 `Allow`、`Prompt` 或 `Deny` 的 `ApprovalPolicy`。`Prompt` 与 `Deny` 会把这次调用变成一条错误工具结果。
- **执行环境（execution environment）** — 一个 `ExecEnv`：工具执行的文件读写、目录列举与 shell 命令。`LocalExecEnv` 把它们限定在一个工作区内。
- **工作区（workspace）** — 本地数据目录下的 `workspaces/<conversation id>` 目录，会话的工具在其中运行。
- **工具运行时（tool runtime）** — 一个 `ToolRuntime`：宿主挂到循环上的注册表、执行环境与可选的审批策略。没有它的循环不发送工具定义。

## 运行时与账号

- **服务端模式（server mode）** — 不带 `LEMMA_LOCAL_MODE` 启动的 `lemma-server`：由环境变量或 `.env` 配置，监听 1025 端口，不挂工具。
- **本地模式（local mode）** — 数据留在设备上的运行时：桌面端的本地引擎与 Android 的进程内引擎。
- **本地引擎（local engine）** — 由 Electron 以 `LEMMA_LOCAL_MODE` 与 `LEMMA_DATA_DIR` 启动的 `lemma-server`，以一行 `LEMMA_READY <json>` 宣告就绪。
- **进程内引擎（in-process engine）** — `lemma-mobile` 中的 `LemmaEngine`，由 Android 应用通过 UniFFI 绑定调用。
- **默认本地账号（default local account）** — 本地模式无需注册即可使用的账号，在首次需要时创建，用户名 `lemma`，密码固定且公开（`lemma_auth::local`）。用户自行注册的账号使用各自的密码。
- **跳过登录凭据（skip credentials）** — 默认本地账号的用户名、密码与引擎 URL，由桌面外壳交给 Web 客户端，使其可以跳过登录。
- **访问令牌（access token）** — 用 JWT 密钥签名、有效期 15 分钟的 JWT，`sub` 中携带用户 id。
- **refresh 令牌（refresh token）** — 有效期 30 天的随机令牌；存储中只保留其 SHA-256 哈希，每次刷新都会吊销它并签发新的一对令牌。
- **cookie 模式（cookie mode）** — API 与页面同源时浏览器客户端的认证方式：令牌通过 `lemma_access` 与 `lemma_refresh` cookie 传递，而不是 `Authorization` 头。
- **加密 key（sealed key）** — 由 `lemma-crypto` 以 AES-256-GCM、用从加密密钥派生的密钥加密的 provider API key。更换加密密钥后，所有已加密的 key 都无法读取。

## 错误

- **错误原因（error reason）** — `errors.proto` 中封闭枚举 `ErrorReason` 的一个值，作为 `ErrorInfo` detail 附加到 Connect 错误上。客户端翻译原因码；英文信息只是兜底。
- **内部错误（internal error）** — 不带错误原因、携带原始诊断文本的 Connect 错误，用于基础设施故障。
