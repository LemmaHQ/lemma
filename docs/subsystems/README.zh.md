# 子系统

[English](README.md) | 中文

Lemma 的每个子系统一页：它是什么、它传递的数据结构，以及它维持的不变量。本目录与 [architecture.zh.md](../architecture.zh.md) 互为补充：后者描述跨子系统的*行为*（crate 分层、服务端与本地两种模式、一次 turn 的完整链路）；这里的每一页是单个子系统的类型与连接方式的参考。

| 页面 | 负责 |
| --- | --- |
| [agent.zh.md](agent.zh.md) | `lemma-agent` 中的 agent 与 `lemma-agent-loop` 中的 turn 循环，及其 `AgentService` 暴露：turn 组装、有序流事件、中止与恢复 |
| [adapter.zh.md](adapter.zh.md) | `lemma-model` 中的模型接口与 `lemma-adapter` 中的适配器：请求组装、connector、传输、模型列表，以及 OpenAI、Anthropic、Gemini 的 SSE 解析 |

这些页面上的类型声明与源码中的声明一致。改动调整了已文档化的类型时，所属页面在同一次改动中更新（[写作规则](../AGENTS.zh.md#写作规则)）。
