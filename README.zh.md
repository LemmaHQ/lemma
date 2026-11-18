# Lemma

[English](README.md) | 中文

<picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/brand/svg/lockup_workspace_dark.svg">
    <img alt="Lemma" src="assets/brand/svg/lockup_workspace_light.svg" width="440">
</picture>

Lemma 用一个 Rust 核心为 Web、桌面与 Android 客户端运行 LLM agent。你自行配置模型 provider，agent 在每个会话各自的工作区中读文件、写文件、运行 shell 命令。

## 功能

- **预定义与自定义 provider。** DeepSeek 是预定义 provider，只需填入你的 API key。自定义 provider 使用三种 API 格式之一（OpenAI chat completions 及兼容 API、Anthropic 或 Gemini），并使用你自己的 base URL 与 API key。
- **会话是一棵消息树。** 每条消息记录其父消息；模型请求携带从根到当前叶子的路径。
- **Agent 工具。** `read_file`、`write_file`、`bash`、`web_search` 与 `web_fetch` 可在三种运行时中运行；文件与 shell 工具在会话绑定的目录或每个会话各自的工作区中运行。
- **三种运行时。** 面向浏览器的服务端、面向桌面应用的本地引擎、面向 Android 的进程内引擎运行同一个 Rust 核心（[架构](docs/architecture.zh.md#运行时)）。

## 快速开始

安装好 [mise](https://mise.jdx.dev/) 与 Rust 后：

```sh
mise install
npm ci
just web-build
just rust-dev
```

`lemma-daemon` 在本地数据目录（默认 `./data`）上运行，并在 <http://127.0.0.1:1025> 提供 Web 客户端。[开发指南](docs/development.zh.md)涵盖桌面与 Android 应用、Windows 以及环境变量。

## 仓库结构

| 路径 | 内容 |
| --- | --- |
| `crates/` | Rust workspace：各运行时共用的核心，以及守护进程 |
| `proto/` | Protobuf 契约，包名 `lemma.v1` |
| `web/` | React Web 客户端，同时是桌面端的渲染层 |
| `desktop/` | Electron 外壳，在 utility process 中运行本地引擎 |
| `mobile/` | Android 应用与 Kotlin Multiplatform 共享模块 |
| `assets/` | 品牌素材 |
| `docs/` | 文档 |

## 文档

- [架构](docs/architecture.zh.md)：crate 分层、运行时与一次 turn 的路径。
- [术语表](docs/glossary.zh.md)：代码与文档共用的术语。
- [开发指南](docs/development.zh.md)：环境搭建与各客户端的运行。
- [测试](docs/testing.zh.md)：测试分层与覆盖率。
- [AGENTS.md](AGENTS.zh.md)：在本仓库中工作的约定。
