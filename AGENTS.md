# AGENTS.md

English | [中文](AGENTS.zh.md)

Lemma runs LLM agents for web, desktop, and Android clients from one Rust core. Read [docs/architecture.md](docs/architecture.md) before changing `crates/`; follow [docs/AGENTS.md](docs/AGENTS.md) for documentation.

## Repository layout

```text
crates/       Rust workspace (crates/AGENTS.md)
  shared/     crates linked by the server, the desktop engine, and Android
  server/     server-only crates: the lemma-server binary, the PostgreSQL store
    rpc/      one ConnectRPC service crate per proto service
proto/        Protobuf contracts, package lemma.v1 (proto/AGENTS.md)
web/          React web client, also the desktop renderer (web/AGENTS.md)
desktop/      Electron shell running lemma-server as a local engine (desktop/AGENTS.md)
mobile/       Android app and Kotlin Multiplatform shared module (mobile/AGENTS.md)
assets/       brand assets
design/       design tokens (tokens.json) and the generator for web, desktop, and Android
.agents/      skills
docs/         documentation (docs/AGENTS.md)
```

## Commands

```sh
just check              # buf lint/build, clippy, web and desktop eslint
just verify             # check, then Rust and web tests
just rust-dev           # run lemma-server with .env
just web-dev            # Vite dev server
just desktop-dev        # build lemma-server, then launch Electron
just proto-gen          # regenerate web TypeScript and Android Kotlin from proto/
just docker-up          # full stack with PostgreSQL; docker-down stops it
just docs-lint          # markdownlint and autocorrect
```

Each subtree `AGENTS.md` lists its own recipes; `just --list` shows all of them.

## Secrets / .env

`lemma-server` reads the root `.env`; [.env.example](.env.example) lists the variables. Never commit credentials.

## Conventions

- **Formatting:** 4-space indentation (YAML and `.proto` use 2), no trailing whitespace, exactly one trailing newline, UTF-8.
- **Scaffold with generators.** Initialize configuration files and project skeletons with their tool's generator (`cargo new`, `buf init`, `npm create`).
- **Names:** types use `PascalCase`; constants and environment variables use `UPPER_SNAKE_CASE`; identifiers use plain, standard terms. Crates and concept directories are singular; directories that hold entries of one kind are plural (`crates/`, `migrations/`).
- **Names and types explain themselves** instead of comments that restate them.
- **Delivered code carries no comments by default.** Design and constraint explanations stay in the conversation, docs, or commit messages; known issues go to GitHub issues, never to `TODO`, `FIXME`, or similar markers. Doc comments take the compact forms each subtree `AGENTS.md` defines.
- **Remove debug statements** (`console.log`, `debugger`, `println!`, `dbg!`) before delivery.
- **Delete obsolete and temporary code;** Git keeps history.
- **Write logic for a defined scenario.** Before adding defensive logic (limits, fallback branches, extra validation, degraded paths), explain the scenario and the reason to the user and let the user decide.
- **Specs, docs, and comments state function and boundaries precisely.** Phrase positively by default; boundaries, exclusions, and review checklists may use negative phrasing.
- **Code style:** [lemma-code-style](.agents/skills/lemma-code-style/SKILL.md) holds the upstream guides behind these rules.

## Git

- Commit messages follow [lemma-commit](.agents/skills/lemma-commit/SKILL.md), in English.
- Commit and push only on explicit request.
- One commit does one complete thing; split independent hunks into separate commits.
- Stage each file explicitly with `git add <file>`. Before committing, check the changes on disk and keep edits the user made in the meantime.

## Documentation

Docs accompany every code change: update the affected README and doc comments together. [docs/AGENTS.md](docs/AGENTS.md) owns tiers, writing rules, and word budgets; the [bilingual contract](docs/i18n/README.md) owns English and Chinese pairs.

## Editing these instructions

`AGENTS.md` and `AGENTS.zh.md` are one English–Chinese pair; update both in the same change. Keep each rule self-contained and link its home.
