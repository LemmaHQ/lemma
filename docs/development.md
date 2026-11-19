# Development

English | [中文](development.zh.md)

How to set up a machine for Lemma and run each client. [justfile](../justfile) (`just --list`) owns the full command list.

## Setup

### Prerequisites

- [mise](https://mise.jdx.dev/) installs the tools pinned in [mise.toml](../mise.toml) and wraps `cargo` through [mbx](https://mr-boxington.jdx.dev/).
- [rustup](https://rustup.rs/) installs the toolchain, components, and Android targets pinned in [rust-toolchain.toml](../rust-toolchain.toml).
- For Android only: an Android SDK (`ANDROID_HOME` or `sdk.dir` in `local.properties`) with an NDK under `<sdk>/ndk/`.

### Windows

Native Windows is the primary environment. `just` runs recipes with `sh`, so a POSIX `sh` (such as Git for Windows' `bin`) must be on `PATH`.

`mbx` links `target/` into `%LOCALAPPDATA%\mbx`, which requires Windows Developer Mode (otherwise Cargo falls back to a plain `target/` directory; see [mbx on Windows](https://mr-boxington.jdx.dev/installation#windows)). Editors, Android Studio, and coding agents pick up the mise `cargo` wrapper only when `%LOCALAPPDATA%\mise\command-wrappers\bin` precedes `%USERPROFILE%\.cargo\bin` on the user `Path`; restart them after changing `Path`.

### First-time setup

From the repository root:

```sh
mise install
rustup toolchain install
npm ci
```

### Run the clients

- **Daemon and web:** `just web-build` then `just rust-dev` (`lemma-daemon` embeds `web/dist` at compile time and serves `http://127.0.0.1:1025`). For hot reload against a running daemon, run `just web-dev`.
- **Desktop:** `just desktop-dev` builds `lemma-napi`, builds the web renderer, and launches Electron ([desktop/AGENTS.md](../desktop/AGENTS.md)).
- **Android:** `just mobile-android-build` assembles the debug APK (`-Plemma.rust.profile=release` for release JNI libs; [mobile/AGENTS.md](../mobile/AGENTS.md)).

## Reference

### Environment variables

| Variable               | Read by                      | Meaning                                                                             |
| ---------------------- | ---------------------------- | ----------------------------------------------------------------------------------- |
| `LEMMA_DATA_DIR`       | `lemma-daemon`               | Data directory for `lemma.db`, `secrets.json`, and `workspaces/` (default `./data`) |
| `LEMMA_PORT`           | `lemma-daemon`               | TCP port `lemma-daemon` binds on `127.0.0.1` (default `1025`)                       |
| `LEMMA_ENGINE_PROFILE` | `desktop/`                   | Cargo profile of `lemma-napi` for unpackaged runs (default `debug`)                 |
| `LEMMA_DEBUG_PORT`     | `desktop/`                   | Chromium remote-debugging port                                                      |
| `ANDROID_HOME`         | `mobile/shared` Gradle build | Android SDK location (`local.properties` is the alternative)                        |

`lemma-daemon` loads `.env` from its working directory or nearest parent; process environment variables take precedence.

### Worktrees

Create a separate worktree beside the main checkout when working in parallel ([AGENTS.md](../AGENTS.md#git)):

```sh
git worktree add ../lemma-<topic> -b <type>/<topic>
cd ../lemma-<topic>
npm ci --prefer-offline
```

- Run `npm ci` in each worktree: `node_modules/@lemma/*` links use absolute junctions on Windows, so copying `node_modules/` from the main worktree resolves to the wrong sources.
- Copy gitignored `.env` or `local.properties` from the main worktree if needed, and run `just web-build` before compiling `lemma-daemon`.
- After removing a worktree (`git worktree remove ../lemma-<topic>`), Windows leaves behind `node_modules/@lemma` junctions and the outer folder; delete the leftover directory manually.

### Build cache

Cargo runs through `mbx` (via `[wrappers.cargo]` in `mise.toml`), reusing compiler outputs across worktrees and CI (`cargo check` and `cargo clippy` build in `target/check/`). Use `mbx doctor` to check setup, `mbx explain --last` to inspect cache hits, and `MBX_DISABLE=1` to bypass it for one command.

### CI workflows

Workflows under [.github/workflows/](../.github/workflows/) invoke the same `just` recipes on pushes to `main`, pull requests, and manual dispatch (`gh workflow run`). Inspect each workflow file for its path filters, OS matrix, and caching setup.
