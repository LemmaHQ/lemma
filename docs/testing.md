# Testing

English | [中文](testing.zh.md)

How Lemma tests each part of the repository, how the suites run locally and in CI, and how coverage is measured. Commands live in the root [AGENTS.md](../AGENTS.md#commands) and the subtree `AGENTS.md` files; CI is summarized in [development.md](development.md#ci-workflows).

## Tiers

- **Rust** (`just rust-test`, which runs `cargo nextest run --workspace` locally and in CI): the tier covers the provider adapters' stream parsers and `InProcessTransport` in `lemma-host`, which runs against a real local engine; storage, the turn loop, the domain services, and the RPC services have no tests. Unit tests live in a `#[cfg(test)] mod tests` at the bottom of the source file they cover; an integration test goes in the crate's `tests/` directory and uses only its public API.
- **Web** (`just web-test`, which runs `vitest run` in `web/`): tests are `src/**/*.test.ts` files beside the module they cover, run in vitest's `node` environment. The tier covers data, cache, and logic modules, plus a check that `en.json` and `zh.json` hold the same keys; no test renders a React component.
- **Desktop** (`just desktop-test`, which runs `vitest run` in `desktop/`): `src/engine.test.ts` covers the engine process lifecycle in `src/engine.ts` with `electron` mocked: readiness, a failed open, the startup timeout, an early exit, the port handoff, a crash after readiness, and stop. `src/serve-engine-port.test.ts` covers request forwarding on the engine port: head, chunks, and end; failures; cancellation before and after the head; and malformed messages.
- **Android** (`just mobile-android-test`): the `androidApp` debug unit tests plus the `:mobile:shared` host tests, which include the `commonTest` source set, and the SQLDelight migration check, which applies the `.sqm` migrations to the committed schema snapshots and compares the result with `LemmaDatabase.sq`. These run on the JVM with no device, locally and in Mobile CI.

## Coverage

No recipe or workflow fails on a coverage percentage; the Codecov project status below is the only coverage gate.

- **Rust**: `just rust-cov` prints a `cargo llvm-cov nextest` summary, and `just rust-cov --html --open` opens the HTML report. It excludes `lemma-server`, `lemma-core`, and `lemma-proto`.
- **Web**: `just web-cov` runs vitest with v8 coverage, excluding `src/gen/` and `src/i18n/locales/`.
- **Desktop**: `just desktop-cov` runs vitest with v8 coverage, excluding `src/gen/`.
- **Android**: `just mobile-android-cov` writes Kover HTML and XML reports for `androidApp` and `shared`, excluding generated code: the contract code, SQLDelight, UniFFI bindings, Compose resources, and `LemmaPalette`.

The Coverage workflow runs these recipes and uploads their reports to Codecov under the `rust`, `web`, `desktop`, and `mobile` flags, plus JUnit results for Rust, web, and desktop. [codecov.yml](../codecov.yml) fails the project status when total coverage drops more than 1% from the base commit and disables the patch status.

## How tests run

`cargo nextest` runs each Rust test in its own process and does not run doctests. Its `ci` profile in [.config/nextest.toml](../.config/nextest.toml) writes JUnit XML to `target/nextest/ci/junit.xml`; the Coverage workflow selects it with `NEXTEST_PROFILE=ci`.

Compiling the workspace includes `lemma-server`, which embeds `web/dist`; Rust CI therefore builds the web client before clippy and tests.

## Real implementations over mocks

Tests replace only the model boundary, with vendor output written into the test; everything behind it runs the shipping code, on an in-memory backend where the code needs storage:

- Provider adapter tests feed a vendor SSE payload written in the test through the adapter's parser as a byte stream and compare the complete `StreamEvent` sequence.
- The Android repository tests run the real SQLDelight schema on `JdbcSqliteDriver.IN_MEMORY`, and settings tests use `MapSettings`.
- Time-dependent web logic fixes the clock with vitest fake timers.
