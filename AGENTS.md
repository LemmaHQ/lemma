# AGENTS.md

Lemma runs LLM agents for web, desktop, and Android clients from one Rust core. Read [docs/architecture.md](docs/architecture.md) before changing `crates/`; follow [docs/AGENTS.md](docs/AGENTS.md) for documentation.

## Repository layout

```text
crates/       Rust workspace (crates/AGENTS.md)
  shared/     crates linked by the daemon, the desktop engine, and Android
  daemon/     lemma-daemon, the daemon binary
  napi/       lemma-napi, the Node-API addon the desktop shell runs the engine in
  uniffi/     lemma-uniffi, the UniFFI facade for Android
proto/        Protobuf contracts, package lemma.v1 (proto/AGENTS.md)
web/          React web client, also the desktop renderer (web/AGENTS.md)
desktop/      Electron shell running the engine in a utility process (desktop/AGENTS.md)
packages/     shared npm packages under the @lemma scope (packages/AGENTS.md)
mobile/       Android app and Kotlin Multiplatform shared module (mobile/AGENTS.md)
assets/       brand assets
design/       design tokens for all clients (tokens.json)
i18n/         platform-neutral UI strings (i18n/README.md)
.agents/      skills (.agents/skills/README.md)
docs/         documentation (docs/AGENTS.md)
scripts/      repository automation scripts run by Node
```

## Commands

[justfile](justfile) (`just --list`) is the single source of truth for workspace commands. Recipes follow `just <area>-<action>` (such as `dev`, `build`, `test`, `cov`, `lint-check`, `fmt-check`); a `-check` recipe only reads, while the same name without `-check` applies fixes. CI steps call recipes directly so local runs reproduce CI.

## Environment / .env

Never commit `.env` or local data directories; see [environment variables](docs/development.md#environment-variables) for configuration.

## Conventions

- **Scaffold with generators.** Initialize configuration files and project skeletons with their tool's generator (`cargo new`, `buf init`, `npm create`).
- **Dependency versions** are compatible-update ranges written to every component the release has (`^44.8.0`, not `^44`; `0.64` for a release numbered `0.64`). npm writes the `^`, Cargo's bare version (`"1.53.1"`) means the same range, and Gradle catalogs and `mise.toml` write the plain version. Action tags, container image tags, and Android SDK levels follow their publisher's scheme.
- **Names:** types use `PascalCase`; constants and environment variables use `UPPER_SNAKE_CASE`; identifiers use plain, standard terms, one term per concept as the [glossary](docs/glossary.md) defines. Names for one concept are singular and names for a collection are plural ([rules](.agents/skills/lemma-code-style/SKILL.md#singular-and-plural)).
- **Names and types explain themselves** instead of comments that restate them.
- **Delivered code carries no comments by default.** Design and constraint explanations stay in the conversation, docs, or commit messages; known issues go to GitHub issues, never to `TODO`, `FIXME`, or similar markers. Doc comments take the compact forms each subtree `AGENTS.md` defines.
- **Remove debug statements** (`console.log`, `debugger`, `println!`, `dbg!`) before delivery.
- **Delete obsolete and temporary code;** Git keeps history.
- **Write logic for a defined scenario.** Before adding defensive logic (limits, fallback branches, extra validation, degraded paths), explain the scenario and the reason to the user and let the user decide.
- **Specs, docs, and comments state function and boundaries precisely.** Phrase positively by default; boundaries, exclusions, and review checklists may use negative phrasing.
- **Source files** stay within 300 lines and follow the file layout, naming, and test placement rules in [lemma-code-style](.agents/skills/lemma-code-style/SKILL.md#source-files); `just source-check` enforces the machine-checkable part.
- **Code style:** [lemma-code-style](.agents/skills/lemma-code-style/SKILL.md) holds the upstream guides behind these rules.

## Answering the user

- **Treat a confirmation-seeking question as an open hypothesis.** A question ending in "right?", "对吧？", or "是不是？" carries no preferred answer; evaluate it as if asked neutrally.
- **Verify before agreeing.** Check code, facts, and architecture claims independently first; the answer opens with the finding, never with "Yes", "Exactly", or "No problem".
- **Lead with the correction.** When a premise is wrong, flawed, or not the best option, the first sentence says so and why; technical accuracy, boundary conditions, and trade-offs come before agreement.

## Verification

- **Run the narrowest check that owns the change, once.** While working, run its test file or `cargo nextest run -p <crate>`; never widen to unrelated subtrees or rerun a check that passed on unchanged content. Before a push, [lemma-pre-push-checks](.agents/skills/lemma-pre-push-checks/SKILL.md) selects checks by changed directory; [docs/testing.md](docs/testing.md) describes the test tiers.
- **Ask the user before compiling the whole Rust workspace or the Android app:** a Cargo `build`, `check`, `clippy`, or test command without `-p <crate>` or `--package <crate>`, `just rust-lint`, `just rust-lint-check`, `just rust-test`, `just rust-cov`, and the `mobile-android-*` recipes. Report a check skipped for lack of consent as not run, never as passing.
- **Scope delegated work:** a sub-agent's task names the files it may change and the checks it runs; a sub-agent that needs another file or check stops and reports.

## Git

- **Work on a branch; never edit or commit on `main` directly** unless the user asks: on `main`, create a `<type>/<topic>` branch before the first edit, with `<type>` from the [lemma-commit types](.agents/skills/lemma-commit/SKILL.md#type-taxonomy).
- **Use a separate worktree** when another agent or the user changes files in the same worktree at the same time, or when the worktree holds uncommitted changes from other work or runs a process that switching branches would disturb ([setup](docs/development.md#worktrees)).
- Commit messages follow [lemma-commit](.agents/skills/lemma-commit/SKILL.md), in English.
- Commit, push, and merge only on explicit request; [lemma-commit](.agents/skills/lemma-commit/SKILL.md#atomicity) defines how a branch lands on `main`.
- One commit does one complete thing; split independent hunks into separate commits. Only the latest snapshot must build; intermediate commits need not build on their own.
- Stage each file explicitly with `git add <file>`. Before committing, check the changes on disk and keep edits the user made in the meantime.

## Documentation

Docs accompany every code change: update the affected README and doc comments together. [docs/AGENTS.md](docs/AGENTS.md) owns tiers and writing rules; the [bilingual contract](docs/i18n/README.md) owns English and Chinese pairs.

## Editing these instructions

Keep each rule self-contained and link its home.
