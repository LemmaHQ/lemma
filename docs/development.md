# Development

English | [中文](development.zh.md)

How to set up a machine for Lemma and run each client. The [root AGENTS.md](../AGENTS.md#commands) lists the everyday commands; the [justfile](../justfile) owns the full recipe list.

## Setup tutorial

### Prerequisites

- [mise](https://mise.jdx.dev/) installs the tools pinned in [mise.toml](../mise.toml): Node.js, Java, just, buf, protoc, and the cargo tools `cargo-binstall`, `cargo-llvm-cov`, and `cargo-nextest`. Local shells and CI read the same pins.
- Rust stable through rustup; [rust-toolchain.toml](../rust-toolchain.toml) adds `rustfmt`, `clippy`, and `llvm-tools-preview`. The Rust build needs `protoc` on `PATH` to compile `proto/`.
- For Android only: the Android SDK, found through `ANDROID_HOME` or `sdk.dir` in `local.properties`, with an NDK under `<sdk>/ndk/`. Gradle uses the newest NDK there.

### Windows

Native Windows is the primary environment. just runs every recipe with `sh`, so a POSIX `sh` must be on `PATH`; Git for Windows provides one in its `bin` directory. Recipes such as `./gradlew` then run unchanged, and the commands in this tutorial also run in PowerShell.

### First-time setup

From the repository root:

```sh
mise install
npm ci
```

`npm ci` installs the `web`, `desktop`, and `packages/*` workspaces. Generated contract code is not committed; the web npm scripts regenerate it before `dev`, `build`, `lint`, and `test`, and Gradle before compiling Kotlin ([proto/AGENTS.md](../proto/AGENTS.md)).

### Run the server and the web client

```sh
just web-build
just rust-dev
```

`lemma-server` embeds `web/dist` at compile time, so the web client is built once before the Rust workspace compiles. `just rust-dev` then opens `LocalEngine` over `LEMMA_DATA_DIR` (default `./data`) and serves the API and that build on `127.0.0.1:1025`.

For web development, `just web-dev` starts Vite with hot reload and proxies `/lemma.v1.*` requests to the server on port 1025.

### Run the desktop app

`just desktop-dev` builds the `lemma-desktop` addon in debug, builds the web client into `desktop/web-dist/`, and starts Electron, which runs the engine from the addon in a utility process. The engine keeps its database, secrets, and workspaces in Electron's `userData` directory. [desktop/AGENTS.md](../desktop/AGENTS.md) describes the engine process and its port.

### Run the Android app

Android builds also need the Rust Android targets; mise installs `cargo-ndk`:

```sh
rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
```

`just mobile-android-build` assembles the debug APK. Before compiling Kotlin, Gradle builds `lemma-mobile` for the host to generate the UniFFI Kotlin bindings; before packaging, it cross-compiles the library for the four ABIs with `cargo-ndk`. `-Plemma.rust.profile=release` builds those libraries in release mode. The app runs the in-process local engine directly over `filesDir` ([mobile/AGENTS.md](../mobile/AGENTS.md#modules-and-generated-code)).

## Reference

### Environment variables

| Variable               | Read by                      | Meaning                                                                             |
| ---------------------- | ---------------------------- | ----------------------------------------------------------------------------------- |
| `LEMMA_DATA_DIR`       | `lemma-server`, server mode  | data directory for `lemma.db`, `secrets.json`, and `workspaces/`, default `./data`  |
| `LEMMA_PORT`           | `lemma-server`, server mode  | TCP port `lemma-server` binds on `127.0.0.1`, default `1025`                        |
| `LEMMA_ENGINE_PROFILE` | `desktop/`                   | Cargo profile of the `lemma-desktop` addon for unpackaged runs, default `debug`     |
| `LEMMA_DEBUG_PORT`     | `desktop/`                   | Chromium remote-debugging port                                                      |
| `ANDROID_HOME`         | `mobile/shared` Gradle build | Android SDK location; `local.properties` is the alternative                         |

`lemma-server` loads `.env` from its working directory or the nearest parent that has one; variables already set in the environment take precedence.

### CI workflows

Every workflow under [.github/workflows/](../.github/workflows/) except mise-upgrade runs on pushes to `main` and on pull requests; the path-filtered ones run only when their paths change, and every path filter also includes `justfile` and `mise.toml`. Every workflow also runs on demand regardless of paths, for example `gh workflow run rust-ci.yml --ref main`. Workflow steps call `just` recipes. Mobile CI, the Android coverage job, and the CodeQL Kotlin scan install their tools through [.github/actions/setup-mobile](../.github/actions/setup-mobile/action.yml).

Steps whose result depends on the host operating system run on Linux, Windows, and macOS: Rust clippy and tests, the desktop build and tests, and the Android host tests, whose UniFFI host build picks the library file per system. Formatting, lint other than clippy, web, specs, coverage, and code scanning run on Linux only.

Dependabot checks Cargo, npm, Gradle, and GitHub Actions dependencies daily.

### Daily commands

The root [Commands](../AGENTS.md#commands) section lists the workspace recipes and their naming, and each subtree `AGENTS.md` lists its own; `just --list` prints every recipe with its description. Test tiers are in [testing.md](testing.md).
