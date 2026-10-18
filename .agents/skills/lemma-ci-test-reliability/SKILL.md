---
name: lemma-ci-test-reliability
description: Use when designing, reviewing, or diagnosing Lemma tests and fixtures that can fail nondeterministically — Rust tests under cargo test threads and nextest processes, PostgreSQL and SQLite store tests, tokio tasks and streams, vitest fake timers and globals, fake-indexeddb, environment variables, ports, temporary paths, or async teardown — and when investigating flaky CI.
---

# Reliable Lemma CI tests

Build tests that stay correct under the repository's real execution topology, not only when run alone on a quiet workstation. This skill owns isolation and reliability decisions; [testing.md](../../../docs/testing.md) owns the test tiers, and [lemma-pre-push-checks](../lemma-pre-push-checks/SKILL.md) selects the commands to run before a push.

## Read the owning rules

- [testing.md](../../../docs/testing.md) selects the tier: Rust unit or integration, store tests, web or desktop vitest, Android host tests, or the local real-provider tests.
- Read the owning [workflow](../../../.github/workflows/), the web client's [vite.config.ts](../../../web/vite.config.ts), and the desktop shell's [vitest.config.mts](../../../desktop/vitest.config.mts) when their job or worker topology affects the test.

## Model the execution topology

The same test runs under more than one runner, and each layer can overlap with the others:

1. **`cargo nextest`** (`just rust-test`, Rust CI, Coverage): each test is its own process, many in parallel; process isolation does not isolate the PostgreSQL server, ports, or paths.
2. **`cargo test`** (focused local runs and the `--ignored` real-provider tests): tests of one binary run as threads in one process, so process-global state is shared between them.
3. **vitest** (`just web-test`, `just desktop-test`, Web CI, Desktop CI, Coverage): files run in parallel workers in the `node` environment; tests in one file share module state.
4. **Gradle** host tests for Android run on the JVM, locally and in Mobile CI, Coverage, and the CodeQL Kotlin scan.

A test must pass under both Rust runners: correct under nextest alone can still race under `cargo test` threads, and the reverse. CI jobs run on separate GitHub-hosted runners, so cross-job host sharing does not apply; the PostgreSQL service is shared by every test in its job.

For every acquired resource, identify its owner, its atomic allocation, an observable readiness signal, registered cleanup, and a completion signal. Do not serialize a whole suite because one fixture lacks isolation; narrow the exclusive scope or change the allocation first.

## Allocate resources atomically

- Network fixtures bind `127.0.0.1:0` and read the assigned port from the bound listener, as the local engine does. Never pick a free port and bind it later.
- Store tests use a private database: SQLite through `lemma_db_sqlite::connect_in_memory()`, PostgreSQL through a new database per test named uniquely, dropped on teardown.
- Temporary directories come from a per-test unique root, such as `tempfile::tempdir` in Rust or `fs.mkdtemp` in Node; never a predictable shared path.
- Web cache tests import `fake-indexeddb/auto`; Vitest's default per-file isolation gives each test file its own in-memory IndexedDB. Within a file, delete the database in `beforeEach` before opening it, and give a test that needs a different schema its own database name.
- Literal paths and URLs used only as parser inputs or expected values are not acquired resources; leave them.

## Contain process-global state

Treat environment variables, the current directory, fake timers, locale and timezone, `vi.mock` and `vi.stubGlobal`, global `fetch`, and Rust statics as exclusive mutable resources.

Prefer an injected dependency: pass configuration as a value instead of reading the environment inside the code under test, and pass a clock instead of reading the system time. When mutation is unavoidable:

- capture whether the original value was absent or present, and restore that exact state;
- restore in `afterEach` or a drop guard registered immediately, not at the end of the test body;
- in Rust, `std::env::set_var` is `unsafe` because other threads may read the environment; a test that needs it is a design smell under `cargo test` threads, so inject the value instead.

## Synchronize on state

A fixed sleep is not evidence that setup completed or cleanup settled.

- Wait for an explicit readiness event, a channel message, a stream item, or an observable state change: the `LEMMA_READY` line, a `TurnEvent`, a message status in the store.
- Use channels or barriers to place a race at a deterministic point and prove the operations overlap.
- Use a timeout only to bound a wait (`tokio::time::timeout`), never as the condition that makes the assertion correct.
- When time is the subject, use `tokio::time::pause` or vitest fake timers with a fixed system time, and always restore real timers.
- Do not assert scheduler-dependent ordering unless the ordering is the behavior under test, such as stream events arriving in order.

## Dispose to quiescence

Register cleanup immediately after acquisition so a failed assertion still releases the resource. Teardown stops new work, aborts and awaits spawned tasks, closes servers and awaits their shutdown, and drops store connections before dropping their database. Calling `abort()` or `kill()` without awaiting completion is incomplete teardown.

## Prove the intended regression

- Observe the regression fail before the fix when practical.
- For a new guard, temporarily introduce the rejected case and observe the failure.
- For a race, use barriers to prove overlap; repeated execution alone is not a race test.
- Verify external state (store rows, emitted events, files, exit status) instead of the component's self-report.

## Reject flake-masking fixes

Do not present these as root-cause fixes:

- increasing a timeout without identifying the awaited state;
- adding retries;
- forcing `--test-threads=1` or serial files;
- swallowing an error;
- weakening an assertion;
- adding a sleep before cleanup or assertion.

Retries remain valid only at the real-provider boundary, in the local `#[ignore]` tests.

## Diagnose existing flakes

For an existing nondeterministic CI failure, read [the CI flake diagnosis workflow](references/ci-flake-diagnosis.md). A diagnosis-only request stays read-only: report the cause and evidence unless the user also asks for a fix.

## Validate and report

Run the smallest focused regression under the runner that owns the risk: `cargo test -p <crate> <name>` for thread-shared state, `cargo nextest run -p <crate>` for process topology, `npx vitest run <file>` in `web/` or `desktop/`. Add restoration evidence for global mutation, teardown evidence for spawned work, and a negative control for a new guard. Report exact commands and observed results; do not describe skipped, ignored, or pending tests as passing.
