# Lemma

[English](README.md) | 中文

<picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/brand/svg/lockup_workspace_dark.svg">
    <img alt="Lemma" src="assets/brand/svg/lockup_workspace_light.svg" width="440">
</picture>

Lemma 用同一套 Rust 核心为 Web、桌面与 Android 客户端运行 LLM agent，提供消息树会话、可配置的模型与 Web provider，以及本地文件与 shell 工具。

## 快速开始

安装 [mise](https://mise.jdx.dev/) 与 Rust 后执行：

```sh
mise install
rustup toolchain install
npm ci
just web-build
just rust-dev
```

`lemma-daemon` 默认打开 `./data`，并在 <http://127.0.0.1:1025> 提供 Web 客户端服务。

## 文档

- [架构](docs/architecture.zh.md)：crate 分层、运行时与一次 turn 的完整链路。
- [术语表](docs/glossary.zh.md)：共用的领域术语。
- [开发指南](docs/development.zh.md)：环境搭建、桌面与 Android 构建、Windows 说明与环境变量。
- [测试](docs/testing.zh.md)：测试分层与覆盖率。
- [AGENTS.md](AGENTS.md)：仓库结构与工程约定。
