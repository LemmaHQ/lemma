# Development

English | [中文](development.zh.md)

How to set up a machine for Lemma and run each client. The [root AGENTS.md](../AGENTS.md#commands) lists the everyday commands; the [justfile](../justfile) owns the full recipe list.

## Setup tutorial

### Prerequisites

- [mise](https://mise.jdx.dev/) installs the tools pinned in [mise.toml](../mise.toml): Node.js, Java, just, buf, protoc, and the cargo tools `cargo-binstall`, `sqlx-cli`, `cargo-llvm-cov`, and `cargo-nextest`. Local shells, CI, and the Dockerfile read the same pins.
- Rust stable through rustup; [rust-toolchain.toml](../rust-toolchain.toml) adds `rustfmt`, `clippy`, and `llvm-tools-preview`. The Rust build needs `protoc` on `PATH` to compile `proto/`.
- Docker, for PostgreSQL and the full-stack image.
- For Android only: the Android SDK, found through `ANDROID_HOME` or `sdk.dir` in `local.properties`, with an NDK under `<sdk>/ndk/`. Gradle uses the newest NDK there.

### Windows

Native Windows is the primary environment. just runs every recipe with `sh`, so a POSIX `sh` must be on `PATH`; Git for Windows provides one in its `bin` directory. Recipes such as `./gradlew` then run unchanged, and the commands in this tutorial also run in PowerShell.

### First-time setup

From the repository root:

```sh
mise install
npm ci
just proto-gen
cp .env.example .env
```

`npm ci` installs the `web` and `desktop` workspaces. Generated contract code is not committed, so `just proto-gen` runs after every clone and every `.proto` change ([proto/AGENTS.md](../proto/AGENTS.md)). In `.env`, set one database password in both `LEMMA_DB_PASSWORD` and `DATABASE_URL`, and replace both secrets.

### Run the server and the web client

```sh
docker compose up -d
just web-build
just rust-dev
```

`docker compose up -d` starts only the PostgreSQL container, on port 5432; the server container belongs to the `full` profile. `lemma-server` embeds `web/dist` at compile time, so the web client is built once before the Rust workspace compiles. `just rust-dev` then serves the API and that build on port 1025, running migrations at startup.

For web development, `just web-dev` starts Vite with hot reload and proxies `/lemma.v1.*` requests to the server on port 1025. A `sqlite:` `DATABASE_URL` runs the same server on SQLite without Docker.

`docker compose --profile full up -d` starts the server container, building its image from the Dockerfile when none exists, together with the database; `docker compose --profile full down` stops them.

### Run the desktop app

`just desktop-dev` builds `lemma-server` in debug, builds the web client into `desktop/web-dist/`, and starts Electron, which runs the server as its local engine. The engine keeps its database and secrets in Electron's `userData` directory and needs no `.env`. [desktop/AGENTS.md](../desktop/AGENTS.md) describes the engine handshake.

### Run the Android app

Android builds also need the Rust Android targets; mise installs `cargo-ndk`:

```sh
rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
```

`just mobile-android-build` assembles the debug APK. Before compiling Kotlin, Gradle builds `lemma-mobile` for the host to generate the UniFFI Kotlin bindings; before packaging, it cross-compiles the library for the four ABIs with `cargo-ndk`. `-Plemma.rust.profile=release` builds those libraries in release mode. The APK runs in local mode with no server, or in remote mode against a server URL entered in the app ([mobile/AGENTS.md](../mobile/AGENTS.md#modules-and-generated-code)).

## Reference

### Environment variables

| Variable | Read by | Meaning |
| --- | --- | --- |
| `DATABASE_URL` | `lemma-server`, server mode | `postgres://` or `postgresql://` selects PostgreSQL; `sqlite:` selects SQLite at the given path |
| `LEMMA_JWT_SECRET` | `lemma-server`, server mode | signs and verifies access tokens |
| `LEMMA_SECRET_KEY` | `lemma-server`, server mode | derives the key that seals provider API keys; changing it makes stored keys unreadable |
| `LEMMA_DB`, `LEMMA_DB_USER`, `LEMMA_DB_PASSWORD` | `docker-compose.yml` | database name, user, and password of the PostgreSQL container; the password is required |
| `LEMMA_LOCAL_MODE`, `LEMMA_DATA_DIR` | `lemma-server` | run as the local engine with SQLite and secrets in the data directory; Electron sets both |
| `LEMMA_ENGINE_PROFILE` | `desktop/` | Cargo profile of the engine binary for unpackaged runs, default `debug` |
| `LEMMA_DEBUG_PORT` | `desktop/` | Chromium remote-debugging port |
| `ANDROID_HOME` | `mobile/shared` Gradle build | Android SDK location; `local.properties` is the alternative |

`lemma-server` loads `.env` from its working directory or the nearest parent that has one; variables already set in the environment take precedence.

### CI workflows

Every workflow under [.github/workflows/](../.github/workflows/) except mise-upgrade runs on pushes to `main` and on pull requests; the path-filtered ones run only when their paths change, and every path filter also includes `justfile` and `mise.toml`. Workflow steps call `just` recipes. Rust CI, Web CI, Desktop CI, Mobile CI, and Spec CI end in a `check` job that fails if any of their jobs failed. Mobile CI, the Android coverage job, and the CodeQL Kotlin scan install their tools through [.github/actions/setup-mobile](../.github/actions/setup-mobile/action.yml).

| Workflow | Paths | Runs |
| --- | --- | --- |
| Rust CI | `Cargo.toml`, `Cargo.lock`, `crates/`, `proto/` | builds `web/dist` for the embed, then `cargo fmt --check`, clippy with warnings denied, and `cargo nextest` with a PostgreSQL service |
| Web CI | `web/`, `design/`, root `package.json`, `package-lock.json` | proto and token generation, prettier check, eslint, build, vitest |
| Desktop CI | `desktop/`, `web/`, `design/`, root `package.json`, `package-lock.json` | proto and token generation, prettier check, eslint, renderer build, vitest |
| Mobile CI | `mobile/`, `crates/shared/`, `proto/`, `design/`, root `Cargo.toml`, `Cargo.lock`, the Gradle build files | ktfmt check, Android Lint, host tests, debug APK build |
| Spec CI | `proto/`, `design/`, `docs/`, `scripts/`, every Markdown file and pairing record, the markdownlint and autocorrect configs | `buf lint`, `buf format`, and `buf build`, the token generator's checks, the docs lint, the translation-pairing check |
| Coverage | all | Rust, web, desktop, and Android coverage, uploaded to Codecov ([testing.md](testing.md#coverage)) |
| CodeQL | all, plus weekly | code scanning for Rust, JavaScript/TypeScript, GitHub Actions, and Kotlin; the Kotlin scan compiles through `just mobile-android-test` |
| mise-upgrade | daily schedule | bumps the pins in `mise.toml`, syncs the Dockerfile's Node version, and opens a pull request |

Dependabot checks Cargo, npm, Gradle, GitHub Actions, and Docker dependencies daily.

### Daily commands

The root [Commands](../AGENTS.md#commands) section lists the workspace recipes and their naming, and each subtree `AGENTS.md` lists its own; `just --list` prints every recipe with its description. Test tiers are in [testing.md](testing.md).
