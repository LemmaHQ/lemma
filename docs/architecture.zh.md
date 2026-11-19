# Lemma 架构

[English](architecture.md) | 中文

修改 `crates/` 下的任何内容之前先读本文。本文梳理 crate 分层、三种运行时、传输边界、一次 turn 的完整链路以及持久化不变量。术语以[术语表](glossary.zh.md)为准；单个 crate 的契约直接写在对应 crate 的 `//!` 与 `///` 文档注释中。

## Crate 分层

Lemma 是一个 Rust workspace。每个 crate 只依赖同层或上层的 crate；`lemma-core` 定义各层共用的规范类型。

| 层    | Crate                                                         | 职责                                                                |
| ----- | ------------------------------------------------------------- | ------------------------------------------------------------------- |
| 契约  | `lemma-proto`、`lemma-core`、`lemma-model`                    | 传输层绑定与错误码辅助；规范消息追踪类型；与厂商无关的模型接口      |
| 领域  | `lemma-db`、`lemma-session`、`lemma-provider`、`lemma-crypto` | SQLite 初始化与迁移；会话消息树；provider 与模型目录；API key 加密  |
| 执行  | `lemma-adapter`、`lemma-tool`、`lemma-agent-loop`             | 厂商线上格式与 Web 后端；工具与执行环境；turn 循环                  |
| Agent | `lemma-agent`                                                 | Turn 生命周期（启动、恢复、中止）、会话目录工具装配与可重放事件日志 |
| RPC   | `lemma-rpc`                                                   | 组装到同一路由上的 ConnectRPC 服务处理器                            |
| 引擎  | `lemma-engine`                                                | 基于数据目录的引擎装配与进程内传输                                  |
| 宿主  | `lemma-daemon`、`lemma-napi`、`lemma-uniffi`                  | 守护进程二进制、Electron Node-API addon 与 Android UniFFI 门面      |

执行层与 agent 层只能通过 `lemma-session` 与 `lemma-provider` 访问持久化数据，只能通过 `lemma-model` 的 trait 访问模型。`crates/shared/` 下的 crate 为所有运行时构建（含 Android）；`daemon/`、`napi/` 与 `uniffi/` 下的 crate 只编入各自的宿主（[crates/AGENTS.md](../crates/AGENTS.md#layout)）。

## 运行时

同一套领域服务与 turn 循环运行在三种宿主中；核心并不知道调用方是哪个客户端。

| 运行时   | 宿主                                                                                    | 存储                                  | 工具                       | 已存储的 API key                           |
| -------- | --------------------------------------------------------------------------------------- | ------------------------------------- | -------------------------- | ------------------------------------------ |
| 守护进程 | `lemma-daemon`（默认监听 `127.0.0.1:1025`，托管内嵌 `web/dist`）                        | `<LEMMA_DATA_DIR>/lemma.db` 的 SQLite | 绑定目录或每会话独立工作区 | 使用 `secrets.json` 中的 `secret_key` 加密 |
| 桌面端   | Electron utility process 中的 `lemma-napi`（[desktop/AGENTS.md](../desktop/AGENTS.md)） | `<userData>/lemma.db` 的 SQLite       | 绑定目录或每会话独立工作区 | 使用 `secrets.json` 中的 `secret_key` 加密 |
| Android  | 经 OkHttp 进程内调用的 `lemma-uniffi`（[mobile/AGENTS.md](../mobile/AGENTS.md)）        | `<filesDir>/lemma.db` 的 SQLite       | 每会话独立工作区           | 使用 `secrets.json` 中的 `secret_key` 加密 |

三种宿主共用同一套数据目录布局：`lemma.db`（WAL 模式并开启外键的 SQLite）、`secrets.json`（首次启动时生成，存放用于 AES-256-GCM 加密的 `secret_key`）与 `workspaces/`。备份时必须同时保留 `lemma.db` 与 `secrets.json`，因为数据库中的加密 API key 只能用 `secrets.json` 中的 `secret_key` 解开。

## 传输层契约

`proto/lemma/v1` 是三端唯一的传输层契约（[proto/AGENTS.md](../proto/AGENTS.md)）。

- **业务错误与基础设施错误**：业务错误携带 `errors.proto` 中封闭枚举的 `ErrorReason`（作为 `ErrorInfo` 详情附加），客户端按错误码本地化；基础设施错误（数据库、解密、上游）返回不带错误原因、附原始英文信息的内部 Connect 错误。
- **流打开前与流打开后的 turn 错误**：`AgentService.SendMessage` 在流打开前将校验与准备失败（空内容、会话忙、会话/消息/provider/目录不存在、无效分支点）作为 RPC 错误返回，不写入任何消息。流打开后，turn 中途失败以终止性的 `error` 流事件送出，并将失败 step 的助手占位消息落库为 `error` 状态及失败文本。
- **信任模型**：Lemma 作为单用户本地节点运行，没有用户账号或鉴权层。

## 一次 turn 的完整链路

一次 **turn** 由一条用户消息启动，在模型停止且未请求工具、模型流失败或 turn 被中止时结束。一次 **step** 是一次模型请求；带工具调用的 turn 会运行多个 step。`lemma-agent` 中的 `Agent` 在后台任务里运行 `AgentLoop::run_turn`，`lemma-rpc` 将其 `TurnEvent` 映射为 `AgentEvent`。

```text
AgentService.SendMessage(session, provider, model, content, parent_id?)
  占用会话槽位；解析分支父节点及上方最近助手消息的 API 格式
  ProviderService::bind -> 解封 key，绑定适配器
  打开会话目录并注册工具
  追加用户消息；移动叶子；记录模型选择                                   -> started
  step:
    已中止 -> 结束 turn                                                   -> aborted
    折叠从根到叶子的上下文路径（关闭工具调用时省略工具调用与工具结果）
    追加助手占位消息（状态 streaming）；移动叶子                         -> turn_started
    Adapter::stream(ModelRequest) -> StreamEvent*                         -> delta (text | thinking)
    落定占位消息（内容、停止原因、用量、状态、计时）
    流期间被中止 -> 结束 turn                                             -> aborted
    流失败 -> 结束 turn                                                   -> error
    无工具、停止原因非 tool_use 或无工具调用 -> 结束 turn                -> done
    对每次工具调用：                                                      -> tool_call_started
      在会话目录中执行 Tool::execute                                      -> tool_call_finished
      追加工具结果消息；移动叶子
    下一个 step
```

- **持久化顺序**：用户消息与每个助手占位消息在调用模型之前落库，每条工具结果在下一个 step 之前落库。
- **计时**：每个 `AgentEvent` 携带服务端 `occurred_at`（重放时保持不变）；助手 JSON 持久化思考与工具的 `started_at`/`finished_at` 供历史查看，适配器不会把它们发给 provider。
- **API 格式选择**：支持多种格式的预定义 provider 优先沿用上下文路径上最近一条助手消息的格式，不支持或不存在时使用配置的默认格式。
- **工具与失败**：文件与 shell 工具在以会话目录为根的 `LocalExecEnv` 中运行（路径限制与进程树终止契约见 `lemma-tool`）；Web 工具在 turn 装配时读取后端顺序，因此设置变更对下一次 turn 生效，失败时只携带查询词与条数回退到下一个已启用的后端。未知工具与工具执行失败都会作为错误工具结果交给下一个 step，不会中止 turn。关闭工具调用的模型收不到工具定义和历史工具调用/结果，但存储的消息完整保留。
- **中止与续传**：无论客户端是否持续读取流，turn 都会运行至结束。`Agent` 以 `started` 返回的用户消息 id 为键，维护无界事件日志与取消令牌。`ResumeStream(message_id, offset)` 重放错过的事件并衔接实时流；turn 结束后它返回 `ERROR_REASON_TURN_NOT_RUNNING`，客户端改为读取已落定的消息。`AbortMessage` 触发取消令牌，将流式占位消息落定为 `aborted`，终止运行中的 `bash` 进程树（其他运行中的工具等待完成），并在下一个 step 前结束 turn。

## 持久化

`lemma-db` 在打开连接池时执行 SQLite 迁移（`lemma_db::open`）。只有 `SessionService` 操作 `sessions` 与 `messages`，只有 `ProviderService` 操作 `providers` 与 `web_providers`。

- **只增不改的消息树**：分支在更早的 turn 边界或根节点下追加节点，永不改写历史。模型上下文始终是从根到叶子的路径（省略更早中断 turn 中未获回应的工具调用），兄弟分支互不可见。
- **解耦的 provider 引用**：`messages.provider_id` 故意不建外键，删除 provider 不会破坏历史会话与消息。
- **预定义与 Web 行补齐**：查询 provider 或 Web provider 列表时自动补齐缺失的预定义行。`ProviderService` 用从 `secrets.json` 的 `secret_key` 派生的密钥对每个非空 API key 做 AES-256-GCM 加密。
