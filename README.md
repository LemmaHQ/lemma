# Lemma

English | [中文](README.zh.md)

<picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/brand/svg/lockup_workspace_dark.svg">
    <img alt="Lemma" src="assets/brand/svg/lockup_workspace_light.svg" width="440">
</picture>

Lemma runs LLM agents for web, desktop, and Android clients from one Rust core, with message-tree sessions, configurable model and web providers, and local file/shell tools.

## Quick start

With [mise](https://mise.jdx.dev/) and Rust installed:

```sh
mise install
rustup toolchain install
npm ci
just web-build
just rust-dev
```

`lemma-daemon` opens `./data` by default and serves the web client at <http://127.0.0.1:1025>.

## Documentation

- [Architecture](docs/architecture.md): crate layers, runtimes, and the path of one turn.
- [Glossary](docs/glossary.md): shared domain terms.
- [Development](docs/development.md): setup, desktop and Android builds, Windows notes, and environment variables.
- [Testing](docs/testing.md): test tiers and coverage.
- [AGENTS.md](AGENTS.md): repository layout and engineering conventions.
