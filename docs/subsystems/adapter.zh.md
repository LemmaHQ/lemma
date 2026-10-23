# 适配器

[English](adapter.md) | 中文

适配器子系统把一次模型请求转换为与厂商无关的流事件序列。`lemma-model` 定义 agent 循环和 provider 领域所依赖的接口；`lemma-adapter` 基于 HTTP 为三种 API 方言实现该接口。循环看不到任何厂商的线上格式，适配器也接触不到存储、用户或加密的密钥。

## 接口：`lemma-model`

`lemma-model` 只包含类型与 trait，不做任何 I/O。

| 类型 | 职责 |
| --- | --- |
| `ProviderKind` | API 方言：`OpenAiCompatible`、`Anthropic` 或 `Gemini`，存储形式为 `openai`、`anthropic` 或 `gemini`。 |
| `Endpoint` | 一个 provider 的类型、base URL、生成路径覆盖、模型列表路径覆盖与明文 API 密钥。 |
| `ModelRequest` | 一次流式调用：模型 id、规范消息、工具定义，以及可选的思考强度。 |
| `Adapter` | `stream(ModelRequest)` 发起上游调用，产出 `Result<StreamEvent, ModelError>` 条目。 |
| `Connector` | `connect(Endpoint)` 返回绑定到该 endpoint 的 connector 自身的 `Adapter` 类型；`list_models(Endpoint)` 获取该 endpoint 报告的模型 id。 |
| `ModelError` | 任何失败，都归结为一条消息。 |

`lemma-provider` 中的 `ProviderService::adapter` 从已存储的 provider 构造 `Endpoint`、解密其密钥，并通过 `Connector::connect` 绑定适配器；provider 服务也调用 `Connector::list_models`。base URL 或路径为空时使用厂商默认值；API 密钥为空时不发送凭据。

## 实现：`lemma-adapter`

`HttpConnector` 按类型把 endpoint 绑定到一个适配器，并以 `ModelAdapter` 变体的形式返回。所有适配器都通过同一个注入的 `HttpTransport` 发送 HTTP；各宿主使用的实现都是 `ReqwestTransport`。

| 类型 | 适配器 | 默认请求 | 凭据 | 思考强度 |
| --- | --- | --- | --- | --- |
| `openai` | `OpenAiCompatible` | `POST https://api.openai.com/v1/chat/completions` | `authorization: Bearer <key>` | 原样作为 `reasoning_effort` 发送 |
| `anthropic` | `AnthropicMessages` | `POST https://api.anthropic.com/v1/messages` | `x-api-key`，附带 `anthropic-version: 2023-06-01` | 换算为 `thinking.budget_tokens` 中的 token 预算 |
| `gemini` | `GeminiGenerate` | `POST https://generativelanguage.googleapis.com/v1beta/models/<model>:streamGenerateContent?alt=sse` | `x-goog-api-key` | 换算为 `generationConfig.thinkingConfig.thinkingBudget` 中的 token 预算 |

token 预算由思考强度换算：数字原样使用，`low` 为 2048，`high` 为 16384，其他值为 8192。Anthropic 请求的 `max_tokens` 为 8192；开启思考时为预算加 8192。Gemini 的路径覆盖可以包含 `{model}`，它会被替换为模型 id。

模型列表在与生成相同的 base URL 下对 `/models` 发送 `GET`，凭据相同，时限 10 秒。Gemini 的 id 会去掉 `models/` 前缀。

## 流不变量

每个适配器把厂商的 server-sent events 解析为 `StreamEvent`，其定义见 [glossary.zh.md](../glossary.zh.md#agent-循环)。共享的 SSE 层保证循环所依赖的事件顺序：

- 流以 `Start` 开始。只解析 `data:` 行。
- 文本增量位于一对 `TextStart`/`TextEnd` 之间。思考块开始、工具调用开始以及 `Done` 之前，打开的文本块会先关闭。
- 任何厂商的思考都以 `ThinkingStart`、若干增量、`ThinkingEnd` 的形式到达；Anthropic 与 Gemini 在 `ThinkingEnd` 上携带厂商签名，供下一次请求回放该块。
- 流以一个 `Done` 结束，携带停止原因与 token 用量；厂商在没有终止分块的情况下关闭响应体时，SSE 层根据解析器已看到的内容补发 `Done`。

## 失败

适配器把所有失败报告为 `ModelError`，从不重试。消息标明来源：

- 连接或读取响应体失败时为 `transport: <error>`；
- 厂商返回非 2xx 状态时为 `upstream <status>: <body>`；
- 响应体不符合厂商格式时为一条解析消息。

agent 循环会以 `error` 状态和这条消息定稿该 step 的占位消息（[architecture.zh.md](../architecture.zh.md#一次-turn-的完整链路)）。
