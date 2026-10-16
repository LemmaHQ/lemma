# Lemma

English | [中文](README.zh.md)

<picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/brand/svg/lockup_workspace_dark.svg">
    <img alt="Lemma" src="assets/brand/svg/lockup_workspace_light.svg" width="440">
</picture>

Lemma runs LLM agents for web, desktop, and Android clients from one Rust core. You configure your own model providers, and the agent reads files, writes files, and runs shell commands in a workspace per conversation.

## Features

- **Three provider kinds.** OpenAI chat completions and compatible APIs, Anthropic, and Gemini, each with your own base URL and API key.
- **Conversations as message trees.** Each message records its parent; a model request carries the path from the root to the active leaf.
- **Agent tools.** `read_file`, `write_file`, and `bash` run in a workspace directory per conversation, in the desktop app and the Android app.
- **Three runtimes.** A server for the browser, a local engine for the desktop app, and an in-process engine for Android run the same Rust core ([architecture](docs/architecture.md#runtimes)).

## Quick start

With [mise](https://mise.jdx.dev/), Rust, and Docker installed:

```sh
mise install
npm ci
just proto-gen
cp .env.example .env
docker compose up -d
just web-build
just rust-dev
```

Set the database password and both secrets in `.env` before `docker compose up -d`. The server then serves the web client at <http://localhost:1025>. [Development](docs/development.md) covers the desktop and Android apps, Windows, and every environment variable.

## Repository

| Path | Contents |
| --- | --- |
| `crates/` | Rust workspace: the core shared by every runtime, and the server |
| `proto/` | Protobuf contracts, package `lemma.v1` |
| `web/` | React web client, also the desktop renderer |
| `desktop/` | Electron shell running the server as a local engine |
| `mobile/` | Android app and Kotlin Multiplatform shared module |
| `assets/` | Brand assets |
| `docs/` | Documentation |

## Documentation

- [Architecture](docs/architecture.md): crate layers, runtimes, and the path of one turn.
- [Glossary](docs/glossary.md): the terms code and docs share.
- [Development](docs/development.md): setup and running each client.
- [Testing](docs/testing.md): test tiers and coverage.
- [AGENTS.md](AGENTS.md): conventions for working in this repository.
