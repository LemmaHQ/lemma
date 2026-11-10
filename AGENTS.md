# AGENTS.md

English | [中文](AGENTS.zh.md)

Lemma runs LLM agents for web, desktop, and Android clients from one Rust core. Read [docs/architecture.md](docs/architecture.md) before changing `crates/`; follow [docs/AGENTS.md](docs/AGENTS.md) for documentation.

## Repository layout

```text
crates/       Rust workspace (crates/AGENTS.md)
  shared/     crates linked by the server, the desktop engine, and Android
  rpc/        one ConnectRPC service crate per proto service, and lemma-host assembling them
  server/     lemma-server, the server binary
  desktop/    lemma-desktop, the Node-API addon the desktop shell runs the engine in
  mobile/     lemma-mobile, the UniFFI facade for Android
  test/       crates only tests use, as dev-dependencies
proto/        Protobuf contracts, package lemma.v1 (proto/AGENTS.md)
web/          React web client, also the desktop renderer (web/AGENTS.md)
desktop/      Electron shell running the engine in a utility process (desktop/AGENTS.md)
packages/     shared npm packages under the @lemma scope (packages/AGENTS.md)
mobile/       Android app and Kotlin Multiplatform shared module (mobile/AGENTS.md)
assets/       brand assets
design/       design tokens for all clients (tokens.json) and their generator
i18n/         platform-neutral UI strings (i18n/README.md) and their generator
.agents/      skills
docs/         documentation (docs/AGENTS.md)
scripts/      documentation checks (translation pairing, brief generator, repository references) and the issue translator
```

## Commands

```sh
just rust-dev            # run lemma-server with .env
just web-dev             # Vite dev server
just desktop-dev         # build the engine addon, then launch Electron
just design-gen          # regenerate the web theme, desktop window colors, and Android palette from design tokens
just i18n-gen            # regenerate client strings from the platform-neutral sources
just i18n-test           # test i18n source validation and client rendering
just docs-lint-check     # markdownlint and autocorrect on tracked Markdown
just docs-pairing-check  # check bilingual pairs; docs-pairing <file> records one
just docs-refs-check     # check recipe names and repository paths cited in Markdown
just dup-check           # report copy-pasted code (jscpd, .jscpd.json)
just deadcode-check      # report unused files, exports, and dependencies (knip, knip.json)
just source-check        # check source file length, names, re-export modules, and test placement
```

Recipes are named `<area>-<action>`. A `-check` recipe only reads; the same name without the suffix applies the fixes. CI steps call recipes instead of repeating their commands, so a local run reproduces a CI step. Each subtree `AGENTS.md` lists its own recipes; `just --list` shows all of them.

## Secrets / .env

`lemma-server` reads the root `.env`; [.env.example](.env.example) lists the variables. Never commit credentials.

## Conventions

- **Formatting:** 4-space indentation (YAML and `.proto` use 2), no trailing whitespace, exactly one trailing newline, UTF-8.
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

## Git

- Commit messages follow [lemma-commit](.agents/skills/lemma-commit/SKILL.md), in English.
- Commit and push only on explicit request.
- One commit does one complete thing; split independent hunks into separate commits. Only the latest snapshot must build; intermediate commits need not build on their own.
- Stage each file explicitly with `git add <file>`. Before committing, check the changes on disk and keep edits the user made in the meantime.

## Documentation

Docs accompany every code change: update the affected README and doc comments together. [docs/AGENTS.md](docs/AGENTS.md) owns tiers, writing rules, and word budgets; the [bilingual contract](docs/i18n/README.md) owns English and Chinese pairs.

## Editing these instructions

`AGENTS.md` and `AGENTS.zh.md` are one English–Chinese pair; update both in the same change. Keep each rule self-contained and link its home.
