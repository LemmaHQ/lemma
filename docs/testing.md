# Testing

English | [中文](testing.zh.md)

How Lemma tests each part of the repository, how the suites run locally and in CI, and how coverage is measured. Commands live in the root [AGENTS.md](../AGENTS.md#commands) and the subtree `AGENTS.md` files; CI is summarized in [development.md](development.md#ci-workflows).

## Tiers

- **Rust** (`just rust-test`, which runs `cargo nextest run --workspace` locally and in CI): the tier covers the provider adapters' request encoding and stream parsers; `ReqwestTransport` against an HTTP server on the loopback interface; the workspace tools against a temporary directory; credential sealing in `lemma-crypto`; and the auth service in `lemma-auth`, the provider service in `lemma-provider`, the session service in `lemma-session`, and the turn loop in `lemma-agent-loop`, which run on in-memory SQLite and, when `LEMMA_TEST_POSTGRES_URL` names a PostgreSQL server, again on a fresh database there, through `lemma-test-db`. The Connect services run end to end in `lemma-host`'s `tests/`: each test opens a local engine over a temporary data directory, sends Connect requests through `InProcessTransport`, and serves a scripted vendor on the loopback interface when a turn calls a model. `lemma-server`'s `tests/` run its HTTP application against the web build in `web/dist`. Unit tests live in a `#[cfg(test)] mod tests` at the bottom of the source file they cover; an integration test goes in the crate's `tests/` directory and uses only its public API.
- **Web** (`just web-test`, which runs `vitest run` in `web/`): tests are `src/**/*.test.ts` and `src/**/*.test.tsx` files beside the module they cover, run in vitest's `happy-dom` environment with English interface text. The tier covers data, cache, and logic modules, the feature stores against mocked RPC clients, and the feature components rendered with Testing Library and driven with `user-event`, plus a check that `en.json` and `zh.json` hold the same keys. `src/app/App.test.tsx` renders the whole app on the browser router against mocked RPC clients, through sign-in, the signed-in shell, the settings sections, and the desktop title bar.
- **Desktop** (`just desktop-test`, which runs `vitest run` in `desktop/`): tests are `src/**/*.test.ts` files beside the modules they cover. The tier covers the engine process lifecycle, the addon file name, the app version argument, and request forwarding on the engine port, with `electron` mocked.
- **Packages** (`just packages-test`, which runs `vitest run` in each package that has tests): `packages/ui` runs `src/**/*.test.{ts,tsx}` in `happy-dom`, covering the chat components, the primitives through compositions an app would render, and every icon in one table-driven test.
- **Android** (`just mobile-android-test`): the `androidApp` debug unit tests plus the `:mobile:shared` host tests, which include the `commonTest` source set, and the SQLDelight migration check, which applies the `.sqm` migrations to the committed schema snapshots and compares the result with `LemmaDatabase.sq`. These run on the JVM with no device, locally and in Mobile CI.

## Coverage

`just web-cov`, `just desktop-cov`, and `just packages-cov` fail below 100% statement, branch, function, and line coverage; `just rust-cov` fails on any uncovered line or function and only reports region coverage; `just mobile-android-cov` reports coverage without a gate.

- **Rust**: `just rust-cov` prints a `cargo llvm-cov nextest` summary, and `just rust-cov --html --open` opens the HTML report. It excludes `lemma-proto`, the Node-API addon `lemma-desktop`, the UniFFI facade `lemma-mobile`, the test-only `lemma-test-db`, the `lemma-server` binary files `main.rs`, `config.rs`, and `server_mode.rs`, `lemma-server`'s `web_dist.rs`, which holds only the `rust-embed` derive, and the SeaORM entity files under `entity/`.
- **Web**: `just web-cov` runs vitest with v8 coverage over every file in `src/`, excluding `src/gen/`, `src/i18n/locales/`, and the `src/main.tsx` entry.
- **Desktop**: `just desktop-cov` runs vitest with v8 coverage over every file in `src/`, excluding `src/gen/`, the Electron entries `src/main.ts`, `src/preload.ts`, and `src/engine-host.ts`, and the `src/titlebar.ts` constant.
- **Packages**: `just packages-cov` runs vitest with v8 coverage over every file in `packages/ui/src/`.
- **Android**: `just mobile-android-cov` writes Kover HTML and XML reports for `androidApp` and `shared`, excluding generated code: the contract code, SQLDelight, UniFFI bindings, Compose resources, and `LemmaPalette`.

The Coverage workflow runs these recipes and uploads their reports to Codecov under the `rust`, `web`, `desktop`, `packages`, and `mobile` flags, plus JUnit results for Rust, web, desktop, and packages. Its Rust job sets `LEMMA_TEST_POSTGRES_URL` to a PostgreSQL service, so the database tests also run on PostgreSQL there. [codecov.yml](../codecov.yml) fails the project status when total coverage drops more than 1% from the base commit and disables the patch status.

## How tests run

`cargo nextest` runs each Rust test in its own process and does not run doctests. Its `ci` profile in [.config/nextest.toml](../.config/nextest.toml) writes JUnit XML to `target/nextest/ci/junit.xml`; the Coverage workflow selects it with `NEXTEST_PROFILE=ci`.

Compiling the workspace includes `lemma-server`, which embeds `web/dist`; Rust CI and the Coverage workflow's Rust job therefore build the web client first.

## Real implementations over mocks

Tests replace only the model boundary, with vendor output written into the test; everything behind it runs the shipping code, on an in-memory backend where the code needs storage:

- Provider adapter tests feed a vendor SSE payload written in the test through the adapter's parser as a byte stream and compare the complete `StreamEvent` sequence.
- The Android repository tests run the real SQLDelight schema on `JdbcSqliteDriver.IN_MEMORY`, and settings tests use `MapSettings`.
- Time-dependent web logic fixes the clock with vitest fake timers.
