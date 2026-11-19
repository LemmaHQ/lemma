# Testing

English | [中文](testing.zh.md)

How Lemma organizes, runs, and measures tests across the repository.

## Tiers

| Area     | Command                                            | Placement and runtime                                                                                                                                                                                                                                                                                                                                  |
| -------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Rust     | `just rust-test` (`cargo nextest run --workspace`) | Unit tests in `#[cfg(test)] mod tests` at the bottom of the source file; public-API integration tests in `<crate>/tests/`. `nextest` runs each test in its own process and skips doctests; `NEXTEST_PROFILE=ci` writes JUnit XML per [.config/nextest.toml](../.config/nextest.toml). Compiling `lemma-daemon` requires `web/dist` (`just web-build`). |
| Web      | `just web-test` (`vitest run`)                     | Sibling `src/**/*.test.{ts,tsx}` files in `happy-dom` with Testing Library and English locales.                                                                                                                                                                                                                                                        |
| Desktop  | `just desktop-test` (`vitest run`)                 | Sibling `src/**/*.test.ts` files with `electron` mocked.                                                                                                                                                                                                                                                                                               |
| Packages | `just packages-test` (`vitest run`)                | Sibling `src/**/*.test.{ts,tsx}` files in `happy-dom`.                                                                                                                                                                                                                                                                                                 |
| Android  | `just mobile-android-test`                         | `:mobile:androidApp` Robolectric unit tests and `:mobile:shared` JVM host tests (`commonTest` + `androidHostTest`), running without a device.                                                                                                                                                                                                          |

## Coverage

All five areas enforce strict coverage checks (`just rust-cov`, `just web-cov`, `just desktop-cov`, `just packages-cov`, `just mobile-android-cov`):

- **Web, Desktop, Packages:** fail below 100% statement, branch, function, and line coverage (configured in each package's `vitest.config.*`).
- **Rust:** fails on any uncovered line or function via `cargo llvm-cov nextest` (exclusions live in [justfile](../justfile)).
- **Android:** fails on any uncovered line, uncalled method, or missed branch outside Composable functions via Kover and `verifyCoverage` (exclusions live in `mobile/androidApp/build.gradle.kts`).

[codecov.yml](../codecov.yml) fails project status if total coverage drops more than 1% from base and disables patch status.

## Real implementations over mocks

Prefer shipping implementations and fake only the model network boundary:

- Use in-memory SQLite (`lemma_db::in_memory`) or temporary directories for Rust storage and tools, and feed scripted vendor SSE or loopback HTTP responses into real adapters and `InProcessEngine`.
- On Android, run `SettingsRepository` over `MapSettings` and test `ConnectLemmaClient` against the host `lemma-uniffi` engine with a loopback mock model server.
- Use vitest fake timers for time-dependent web logic.
