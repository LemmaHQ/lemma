# Agent

[English](agent.md) | 中文

agent 子系统把一条用户请求变成一个正在运行的 turn，并报告它的进度。`lemma-agent` 组装 turn 并跟踪正在运行的 turn 以便中止；`lemma-agent-loop` 运行各个 step；`lemma-agent-rpc` 与 `lemma-mobile` 把它暴露给客户端。turn 内部的工作顺序见 [architecture.zh.md](../architecture.zh.md#一次-turn-的完整链路)；本页负责类型、事件与保证。

## Turn 组装

`Agent` 持有会话存储、provider 服务、模型 connector，以及可选的工作区目录。`Agent::prepare(TurnRequest)` 校验请求并返回一个 `Turn`，否则在写入任何消息之前失败：

| 检查 | 失败 |
| --- | --- |
| 去除首尾空白后内容为空 | `AgentError::ContentRequired` |
| 去除首尾空白后模型 id 为空 | `AgentError::ModelRequired` |
| provider 不属于该用户 | `AgentError::ProviderNotFound` |
| 无法打开 provider 密钥、存储失败或无法创建工作区 | `Provider`、`Store` 或 `Workspace` |

思考强度为空时，沿用会话最近一次模型选择中的思考强度。有工作区目录时，turn 获得以 `<workspaces_dir>/<conversation id>` 为根的 `read_file`、`write_file` 与 `bash` 工具；没有时，调用模型不带工具。

`Turn::run(observer)` 把 turn 运行到结束，返回 `TurnEnd::Done` 或 `TurnEnd::Aborted`；模型流或存储失败时返回 `AgentError::Loop`。`Turn::user_message_id` 是用户消息的存储 id；中止与恢复都用它定位 turn。

## Turn 事件

循环按发生顺序向观察者报告 `TurnEvent`。每个宿主把它们映射为自己的事件类型，并根据运行结果追加一个终止事件：

| 来源 | `AgentEvent`（`lemma-agent-rpc`） | 含义 |
| --- | --- | --- |
| `UserAppended` | `started` | 用户消息已存储；携带它的 id 与客户端的 `client_msg_id`。 |
| `AssistantStarted` | `turn_started` | 某个 step 的占位消息已存储；携带 assistant 消息 id。 |
| `Delta`、`ThinkingDelta` | `delta`（`text` 或 `thinking`） | 模型流的一个分块。 |
| `ToolStarted`、`ToolFinished` | `tool_call_started`、`tool_call_finished` | 一次工具调用：先是参数，然后是输出与错误标志。 |
| `AssistantDone` | `done` | 最后一个 step 结束且不再请求工具；携带 token 用量。 |
| `TurnEnd::Aborted` | `aborted` | turn 被中止。 |
| `Err(AgentError)` | `error` | turn 失败；携带错误文本。 |

`lemma-mobile` 把相同的来源映射为 `MobileAgentEvent`，交给 `AgentEventListener`。

## 中止

每个已组装的 turn 在其 `Turn` 被丢弃之前，以用户消息 id 登记一个 `CancelToken`。`Agent::abort(user_id, user_message_id)` 只在该用户拥有这个 turn 时取消令牌；其他 id 会被忽略。取消会立即中断模型流，并以 `aborted` 状态定稿其占位消息；正在运行的工具调用会先执行完，turn 在下一个 step 之前停止。`AbortMessage` 与 `LemmaEngine::abort_message` 都调用 `Agent::abort`。

## 流与恢复

`lemma-agent-rpc` 在独立的任务中运行每个 turn，因此无论客户端是否读取流，turn 都会运行到结束。它的 `LiveTurns` 为每个正在运行的 turn 保存一份事件日志，以用户消息 id 为键：

- `SendMessage` 从头读取日志。日志不设上限，因此读取较慢的客户端也会收到全部事件。
- `ResumeStream(message_id, offset)` 从第 `offset` 个事件开始读取同一份日志，随后跟随实时事件。`offset` 是客户端已收到的事件数。
- turn 结束时，日志关闭并被移除。已打开的流会读完它；之后的 `ResumeStream`，或来自其他用户的 `ResumeStream`，以 `ERROR_REASON_TURN_NOT_RUNNING` 失败。

Web 客户端统计它已应用的事件数，流中断后用这个数恢复，并在收到 `ERROR_REASON_TURN_NOT_RUNNING` 时重新加载会话消息。

## 错误

`AgentService.SendMessage` 在流打开之前以 RPC 错误报告组装失败：`CONTENT_REQUIRED`、`MODEL_REQUIRED` 与 `PROVIDER_NOT_FOUND` 带有 `ErrorReason`；其他失败是内部错误。流打开之后的失败以 `error` 事件到达，失败 step 的占位消息保持 `error` 状态并带有失败文本。
