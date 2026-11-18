# Agent

[English](agent.md) | 中文

agent 子系统把一条用户请求变成一个正在运行的 turn，并报告它的进度。`lemma-agent` 通过统一的运行中 turn 注册表启动、恢复与中止 turn；`lemma-agent-loop` 运行各个 step；`lemma-rpc` 与 `lemma-mobile` 把它暴露给客户端。turn 内部的工作顺序见 [architecture.zh.md](../architecture.zh.md#一次-turn-的完整链路)；本页负责类型、事件与保证。

## Turn 启动

`Agent` 持有会话服务、provider 服务、工作区目录，以及可选的 Web `HttpTransport`。`Agent::start(TurnRequest)` 校验请求，在后台派生任务运行 turn 并返回实时 `TurnEvent` 流，否则在写入任何消息之前失败：

| 检查 | 失败 |
| --- | --- |
| 去除首尾空白后内容为空 | `AgentError::ContentRequired` |
| 去除首尾空白后模型 id 为空 | `AgentError::ModelRequired` |
| 该会话已有正在运行的 turn | `AgentError::SessionBusy` |
| 会话不存在 | `AgentError::SessionNotFound` |
| 请求的分支父消息不在该会话中 | `AgentError::MessageNotFound` |
| 请求的分支父消息或当前叶子不是已定稿的 turn 边界 | `AgentError::InvalidBranchPoint` |
| provider 不存在 | `AgentError::ProviderNotFound` |
| 会话绑定的目录已不存在 | `AgentError::DirectoryNotFound` |
| 无法打开 provider 密钥、数据库失败或无法创建工作区 | `Provider`、`Store` 或 `Workspace` |

`ProviderService::bind` 返回适配器、该 turn 使用的 API 格式以及模型的工具调用标志；格式的选取方式见 [architecture.zh.md](../architecture.zh.md#一次-turn-的完整链路)。关闭工具调用的模型不获得工具，它的请求也不包含之前的工具调用与工具结果。

`Agent::start` 成功后，turn 持有该会话的运行槽位（`Agent::active_turn`）并在派生任务中运行到结束；除取消以外的任何中途故障都会向流发出终态 `TurnEvent::TurnFailed`。首条事件（`TurnEvent::UserAppended`）携带用户消息的存储 id 与 `parent_id`；`Agent::abort` 与 `Agent::resume` 都用该消息 id 定位 turn。

## 工具

turn 获得 `read_file`、`write_file` 与 `bash` 工具，它们基于以会话目录为根的 `LocalExecEnv`：会话目录是创建会话时指定的目录，没有指定时是会话的工作区 `<workspaces_dir>/<session id>`，`start` 在找到会话之后才创建它，并在 `Agent` 带有 Web `HttpTransport` 且对应功能的顺序存在已启用后端时另外注册 `web_search` 与 `web_fetch`。该 turn 的每次模型请求都带有一段系统提示词，写明这个目录、操作系统与 shell。

`LocalExecEnv` 把 `read_file` 与 `write_file` 限定在根目录内：

- 相对路径相对根目录解析；绝对路径位于根目录内时接受；含 `..` 组件的路径被拒绝。
- 路径解析会跟随符号链接：先把最近的已存在祖先规范化，再拼回缺失的组件。结果必须位于规范化后的根目录之下，因此指向根外的链接与悬空链接都会被拒绝。在 Windows 上，规范路径同时统一了字母大小写、junction 与 8.3 短名。
- 写入的目标是解析后的路径。

`bash` 在 Windows 上用 `cmd /C`、在其他平台用 `sh -c` 运行命令，从根目录启动，除此之外不受限制。调用的 `timeout` 取 1 到 3600 秒，默认 300。命令超时或所在 turn 被中止时，连同整棵进程树一起停止：在 Unix 上，它的进程组先收到 `SIGTERM`，2 秒后收到 `SIGKILL`；在 Windows 上由 `taskkill /T /F` 结束。每个输出流保留开头和末尾各 16 KB，中间标明省略的字节数。结果包含 `exit_code`、`stdout` 与 `stderr`；命令被停止时还带有 `stopped`（`timed out after N s` 或 `aborted`）。

## Turn 事件

循环按发生顺序向观察者报告带时间戳的 `TurnEvent`；循环因模型流之外的错误退出时，`Agent` 会追加一条终态 `TurnEvent::TurnFailed`。`lemma-rpc` 把每个 `TurnEvent` 映射为 `AgentEvent`：

| 来源 | `AgentEvent`（`lemma-rpc`） | 含义 |
| --- | --- | --- |
| `UserAppended` | `started` | 用户消息已存储；携带它的 id 与可选的 `parent_id`。 |
| `AssistantStarted` | `turn_started` | 某个 step 的占位消息已存储；携带 assistant 消息 id 与 `parent_id`。 |
| `Delta`、`ThinkingDelta` | `delta`（`text` 或 `thinking`） | 模型流的一个分块。 |
| `ToolStarted`、`ToolFinished` | `tool_call_started`、`tool_call_finished` | 一次工具调用：先是参数，然后是输出与错误标志。 |
| `AssistantDone` | `done` | 最后一个 step 结束且不再请求工具。 |
| `TurnAborted` | `aborted` | turn 被中止。 |
| `TurnFailed` | `error` | turn 失败；携带错误文本。 |

每个 `TurnEvent` 都携带服务端时刻 `at`，直接映射为 `AgentEvent.occurred_at`。首个思考增量设置 `thinking_started_at`；之后的首个正文增量、工具调用、`done`、`aborted` 或 `error` 事件设置 `thinking_finished_at`。`tool_call_started` 与 `tool_call_finished` 分别在执行开始与结果到达时设置对应的工具时刻。助手消息的 JSON 正文把这些值保存为思考与工具调用块上可选的 `started_at` 和 `finished_at` 字段，存储的 `Message` proto 再将它们暴露给历史记录。加入计时前写入的行没有这些值。重放会原样返回已记录的事件。

## 中止

每个正在运行的 turn 在后台任务结束之前，以用户消息 id 同时登记 `CancelToken` 与事件日志。`Agent::abort(user_message_id)` 取消该 turn 的令牌；其他 id 会被忽略。取消会立即中断模型流，并以 `aborted` 状态定稿其占位消息；正在运行的 `bash` 命令按[工具](#工具)一节所述停止，其他正在运行的工具调用会先执行完，turn 在下一个 step 之前停止。`AbortMessage` 调用 `Agent::abort`。

## 流与恢复

`Agent::start` 在独立任务中运行每个 turn，因此无论客户端是否读取流，turn 都会运行到结束。`Agent` 为每个正在运行的 turn 保存一份 `TurnEvent` 日志，以用户消息 id 为键：

- `SendMessage` 从事件 `0` 开始读取 `Agent::start` 返回的流。日志不设上限，因此读取较慢的客户端也会收到全部事件。
- `ResumeStream(message_id, offset)` 调用 `Agent::resume(message_id, offset)` 从第 `offset` 个事件开始读取同一份日志，随后跟随实时事件。`offset` 是客户端已收到的事件数。
- turn 结束时，写入端被丢弃，在排空已记录事件后关闭并移除该条目。已打开的流会读完它；之后的 `ResumeStream` 以 `ERROR_REASON_TURN_NOT_RUNNING` 失败。

Web 客户端统计它已应用的事件数，流中断后用这个数恢复，并在收到 `ERROR_REASON_TURN_NOT_RUNNING` 时重新加载会话消息。

## 错误

`AgentService.SendMessage` 在流打开之前以 RPC 错误报告组装失败：`CONTENT_REQUIRED`、`MODEL_REQUIRED`、`SESSION_BUSY`、`SESSION_NOT_FOUND`、`MESSAGE_NOT_FOUND`、`INVALID_BRANCH_POINT`、`PROVIDER_NOT_FOUND` 与 `DIRECTORY_NOT_FOUND` 带有 `ErrorReason`；其他失败是内部错误。流打开之后的失败以 `error` 事件到达，失败 step 的占位消息保持 `error` 状态并带有失败文本。
