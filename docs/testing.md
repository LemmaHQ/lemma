# Testing

English | [中文](testing.zh.md)

How Lemma tests each part of the repository, how the suites run locally and in CI, and how coverage is measured. Commands live in the root [AGENTS.md](../AGENTS.md#commands) and the subtree `AGENTS.md` files; CI is summarized in [development.md](development.md#ci-workflows).

## Tiers

- **Rust** (`just rust-test`, which runs `cargo test --workspace`): unit tests live in a `#[cfg(test)] mod tests` at the bottom of the source file they cover; integration tests live in the crate's `tests/` directory and use only its public API. CI runs the same tests with `cargo nextest run --workspace`.
- **Real provider** (local only): tests that call a live vendor API read the key from an environment variable and carry `#[ignore]`, so `just rust-test` and CI skip them; `cargo test --workspace -- --ignored` runs them. Each provider kind has a smoke test that sends one prompt and expects `Done` with non-empty text, and one that completes a tool call.
- **Snapshot** (part of `just rust-test`): adapter request snapshots and recorded turn tests; see [Snapshot tests](#snapshot-tests).
- **Web** (`just web-test`, which runs `vitest run` in `web/`): tests are `src/**/*.test.ts` files beside the module they cover, run in vitest's `node` environment. The tier covers data, cache, and logic modules; no test renders a React component.
- **Android** (`just mobile-android-test`): the `androidApp` debug unit tests plus the `:mobile:shared` host tests, which include the `commonTest` source set. These run on the JVM with no device. `just verify` and CI do not run this tier.

## Store tests

Both storage backends run the same test cases, written against the store traits, so a migration added to one backend alone fails a test. SQLite store tests open `lemma_db_sqlite::connect_in_memory()` and run the migrations. PostgreSQL store tests run against the server in `DATABASE_URL` with one fresh database per test, and are skipped when `DATABASE_URL` is unset; the Rust CI test job and the Coverage job set it.

## Snapshot tests

Snapshots pin what the model receives and what the store keeps. They use `insta`, with snapshot files in a `snapshots/` directory beside the test.

- **Adapter request snapshots**: each adapter encodes a fixed set of `ChatRequest`s (plain text, thinking, a tool call with its result, an image) and the test snapshots the URL, the headers with the key redacted, and the JSON body.
- **Recorded turn tests**: a fixture holds the `StreamEvent` sequence of every step of one turn, recorded from a real provider. A scripted `Provider` replays it, and `AgentLoop` runs on an in-memory SQLite `TraceStore` with the real tool registry in a temporary workspace. The test snapshots the `ChatRequest` of each step, the `TurnEvent` sequence, and the stored message tree, with ids and timestamps redacted. Scenarios use tool calls whose results are the same on every platform.

Recording a fixture calls a live provider, so it runs locally like the real-provider tier. A change to the turn loop, to an adapter's encoding or parsing, or to the stored message shape adds or updates a snapshot in the same commit. Review every snapshot diff before accepting it.

## Coverage

Coverage gates apply to Rust and web; Android has none.

- **Rust**: `just rust-cov` prints a `cargo llvm-cov` summary, and `just rust-cov-html` opens the HTML report. Both exclude `lemma-server`, `lemma-core`, and `lemma-proto`. The Coverage workflow runs `cargo llvm-cov nextest` with the same exclusions and fails below 85% line coverage.
- **Web**: `just web-cov` runs vitest with v8 coverage, excluding `src/gen/` and `src/i18n/locales/`. `web/vite.config.ts` sets a 90% line threshold, so the local run and CI enforce it alike.

The Coverage workflow uploads both reports and their JUnit results to Codecov under the `rust` and `web` flags. [codecov.yml](../codecov.yml) fails the project status when total coverage drops more than 1% from the base commit and disables the patch status.

## How tests run

`cargo nextest` runs each Rust test in its own process. Its `ci` profile in [.config/nextest.toml](../.config/nextest.toml) writes JUnit XML to `target/nextest/ci/junit.xml`; the Coverage workflow selects it with `NEXTEST_PROFILE=ci`.

Compiling the workspace includes `lemma-server`, which embeds `web/dist`; Rust CI therefore builds the web client before clippy and tests.

## Real implementations over mocks

Only the model boundary is replaced, by recorded provider output; everything behind it runs the shipping code, on an in-memory backend where the code needs storage:

- Provider adapter tests feed a recorded vendor SSE payload through the adapter's parser as a byte stream and compare the complete `StreamEvent` sequence.
- Recorded turn tests run the real loop, store, and tool registry behind a scripted `Provider`.
- The web cache tests run the real Dexie database on `fake-indexeddb`.
- The Android repository tests run the real SQLDelight schema on `JdbcSqliteDriver.IN_MEMORY`, and settings tests use `MapSettings`.
- Time-dependent web logic fixes the clock with vitest fake timers.
