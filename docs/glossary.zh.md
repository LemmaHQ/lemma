# 术语表

[English](glossary.md) | 中文

Lemma 在代码、传输契约与文档中对每个概念只用一个术语。跨 crate 行为见 [architecture.zh.md](architecture.zh.md)；Rust 类型细节见对应 crate 的文档注释。

## 会话树

- **会话（session）** — 带标题、当前叶子与上次模型选择的消息树，由 `lemma-session` 管理。删除会话会一并删除其全部消息。
- **叶子（leaf）** — `leaf_id` 指向的活动节点；下一条用户消息追加在其下，turn 中每次追加都会移动它。
- **分支（branch）** — 追加在更早的 turn 边界（或根节点）而非当前叶子下的消息；分支永不改写已有节点。
- **上下文路径（context path）** — 发送给模型请求的从根到叶子的消息序列，不含兄弟分支及更早中断 turn 中未获回应的工具调用。
- **消息状态（message status）** — `streaming`、`done`、`aborted` 或 `error`。

## Agent 循环

- **turn** — 由一条用户消息启动的工作：包含一个或多个 step，在模型不再请求工具、流失败或被中止时结束（`lemma-agent` / `lemma-agent-loop`）。
- **step** — 一次模型请求及其触发的工具调用。
- **占位消息（placeholder）** — 调用模型前以 `streaming` 状态追加、并在之后以最终内容、状态、用量与计时落定的助手消息。
- **停止原因（stop reason）** — 生成结束的原因（`stop`、`length`、`tool_use` 或 `aborted`）；仅当为 `tool_use` 且存在至少一次工具调用时才进入下一个 step。

## Provider 与适配器

- **预定义 provider（predefined provider）** — 元数据与模型定义写在 `lemma-provider` 代码中、数据库行仅存 API key、启用状态与默认 API 格式的模型 provider。
- **自定义 provider（custom provider）** — 用户自建的 provider 行，自行保存标识符、显示名称、单一 API 格式、base URL、API key、路径覆盖与模型记录。
- **Web provider** — Web 搜索或抓取后端配置（`native`、`exa` 或 `deepseek`），包含启用状态、可选加密 key 以及在搜索/抓取回退链中的顺序。
- **API 格式（API format）** — 模型请求的线上协议（`openai`、`anthropic` 或 `gemini`），由 `lemma_model::ApiFormat` 定义。
- **模型特性（model feature）** — 会改变发往该模型请求内容的模型能力标记（如工具调用）。
- **适配器（adapter）** — `lemma-adapter` 中的 `lemma_model::Adapter` 实现，负责规范请求/事件与特定厂商线上格式之间的转换。

## 工具

- **会话目录（session directory）** — 会话中文件与 shell 工具运行的根目录：创建会话时绑定的绝对路径，或其独立工作区。
- **工作区（workspace）** — 未绑定目录的会话在本地数据目录下生成的 `workspaces/<session id>` 目录。
- **Web 后端（web backend）** — `lemma-adapter` 中单个 Web provider 的 HTTP 客户端；Web 工具按配置顺序依次尝试已启用的后端，出错即回退。

## 运行时与错误

- **引擎（engine）** — `lemma-engine` 中的 `Engine`：基于单个数据目录（`lemma.db`、`secrets.json`、`workspaces/`）组装的 Connect 服务。
- **进程内引擎（in-process engine）** — `lemma-engine` 中的 `InProcessEngine`：经 `InProcessTransport` 直接进程内调用、不监听网络端口的引擎（桌面端与 Android 使用）。
- **引擎端口（engine port）** — 将 Electron 渲染层直连到桌面引擎 utility process 的 `MessagePort`。
- **加密 key（sealed key）** — 由 `lemma-crypto` 用 `secrets.json` 中 `secret_key` 派生出的密钥做 AES-256-GCM 加密的 provider API key。
- **错误原因（error reason）** — `errors.proto` 中封闭枚举 `ErrorReason` 的取值，作为 `ErrorInfo` 详情附加用于本地化业务错误；基础设施失败不带此项（内部错误）。
