# Development

English | [中文](development.zh.md)

How to set up a machine for Lemma and run each client. The [root AGENTS.md](../AGENTS.md#commands) lists the everyday commands; the [justfile](../justfile) owns the full recipe list.

## Setup tutorial

### Prerequisites

- [mise](https://mise.jdx.dev/) installs the tools pinned in [mise.toml](../mise.toml): Node.js, Java, just, buf, protoc, mbx, and the cargo tools `cargo-binstall`, `cargo-llvm-cov`, and `cargo-nextest`. Local shells and CI read the same pins, and Cargo runs through mbx ([Build cache](#build-cache)).
- Rust through rustup. [rust-toolchain.toml](../rust-toolchain.toml) pins the Rust release, the `rustfmt`, `clippy`, and `llvm-tools-preview` components, and the four Android targets; Dependabot opens a pull request for each new release. The Rust build needs `protoc` on `PATH` to compile `proto/`.
- For Android only: the Android SDK, found through `ANDROID_HOME` or `sdk.dir` in `local.properties`, with an NDK under `<sdk>/ndk/`. Gradle uses the newest NDK there.

### Windows

Native Windows is the primary environment. just runs every recipe with `sh`, so a POSIX `sh` must be on `PATH`; Git for Windows provides one in its `bin` directory. Recipes such as `./gradlew` then run unchanged, and the commands in this tutorial also run in PowerShell.

mbx replaces `target/` with a link, which Windows creates only in Developer Mode; without it, Cargo builds in a plain `target/` directory ([mbx on Windows](https://mr-boxington.jdx.dev/installation#windows)). A shell with `mise activate` finds the mise `cargo` wrapper. Editors, Android Studio, and coding agents find it only when `%LOCALAPPDATA%\mise\command-wrappers\bin` precedes `%USERPROFILE%\.cargo\bin` on the user `Path`; restart them after changing `Path`.

### First-time setup

From the repository root:

```sh
mise install
rustup toolchain install
npm ci
```

`rustup toolchain install` installs the Rust release that rust-toolchain.toml pins, with its components and targets. `npm ci` installs the `web`, `desktop`, and `packages/*` workspaces. Generated contract code is not committed; the web npm scripts regenerate it before `dev`, `build`, `lint`, and `test`, and Gradle before compiling Kotlin ([proto/AGENTS.md](../proto/AGENTS.md)).

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

Android builds also need `cargo-ndk`, which mise installs; rust-toolchain.toml already lists the Rust Android targets.

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

### Build cache

[mbx](https://mr-boxington.jdx.dev/) caches compiler outputs and reuses them across worktrees and CI runs. The `[wrappers.cargo]` entry in [mise.toml](../mise.toml) makes the `cargo` command on `PATH` run through mbx, so the `just` recipes and the Gradle tasks that call Cargo use it too. mbx restores each compilation whose inputs match a cached result and compiles the rest; calling `~/.cargo/bin/cargo` directly bypasses it.

- `target` is a link into mbx's cache directory, `%LOCALAPPDATA%\mbx` on Windows. `cargo check` and `cargo clippy` build in `target/check/`, so they run beside a build or a test.
- mbx removes the targets of deleted worktrees and keeps the rest within disk budgets that `mbx settings` changes ([managed target directories](https://mr-boxington.jdx.dev/managed-targets)).
- A build that runs through mbx ends with `mbx[cache]:` summary lines. `mbx doctor` checks the toolchain and the cache directory; its `setup` warning that the Cargo shim is not installed also appears while the mise wrapper runs Cargo through mbx.
- `just rust-cov` sets `MBX_SHARE_OUT_DIR=0`. With mbx's OUT_DIR sharing on, rustc records generated sources such as `lemma-proto`'s under a `${target}` placeholder, which cargo-llvm-cov does not recognize as the target directory and would report as uncovered.
- `mbx explain --last` explains the cache results of the last build, and `MBX_DISABLE=1` runs one command without mbx.

### CI workflows

Every workflow under [.github/workflows/](../.github/workflows/) except mise-upgrade runs on pushes to `main` and on pull requests; the path-filtered ones run only when their paths change, and every path filter also includes `justfile` and `mise.toml`. The Rust CI and Mobile CI filters also include `rust-toolchain.toml`, so a Rust release bump runs them. Every workflow also runs on demand regardless of paths, for example `gh workflow run rust-ci.yml --ref main`. Workflow steps call `just` recipes, and jobs that run Cargo install the pinned Rust release with `rustup toolchain install`. Mobile CI, the Android coverage job, and the CodeQL Kotlin scan install their tools through [.github/actions/setup-mobile](../.github/actions/setup-mobile/action.yml).

Steps whose result depends on the host operating system run on Linux, Windows, and macOS: Rust clippy and tests, the desktop build and tests, and the Android host tests, whose UniFFI host build picks the library file per system. Formatting, lint other than clippy, web, specs, coverage, and code scanning run on Linux only.

Cargo runs through mbx in CI too. The Rust clippy, test, and coverage jobs and setup-mobile restore and save `target/` and Cargo's downloads with [jdx/mr-boxington-action](https://github.com/jdx/mr-boxington-action): a push to `main` saves an entry, and a pull request restores one without saving.

Dependabot checks Cargo, npm, Gradle, and GitHub Actions dependencies and the Rust toolchain daily.

### Daily commands

The root [Commands](../AGENTS.md#commands) section lists the workspace recipes and their naming, and each subtree `AGENTS.md` lists its own; `just --list` prints every recipe with its description. Test tiers are in [testing.md](testing.md).
