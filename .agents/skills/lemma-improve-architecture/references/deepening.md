# Deepening

How to deepen a cluster of shallow modules safely, given its dependencies. Uses the terms in [vocabulary.md](vocabulary.md).

## Dependency categories

Classify each candidate's dependencies; the category decides how the deepened module is tested across its seam. [testing.md](../../../../docs/testing.md#real-implementations-over-mocks) fixes the rule behind all four: tests replace only the model boundary and run everything else as shipped.

1. **In-process**: pure computation and in-memory state, no I/O. Always deepenable: merge the modules and test through the new interface directly. No adapter.
2. **Local-substitutable**: dependencies with a local stand-in that runs in the suite: in-memory SQLite through `lemma-test-db` for the Rust stores, `JdbcSqliteDriver.IN_MEMORY` and `MapSettings` on Android, vitest fake timers for time. Deepenable when the stand-in exists; the seam stays internal, with no port at the module's external interface.
3. **Remote but owned**: Lemma's own services across a transport, the ConnectRPC services the clients call. The deep module owns the logic; the transport is injected as an adapter. The web feature stores are this seam: tests drive them against mocked RPC clients.
4. **True external**: the model vendors behind the provider adapters. The deepened module takes them through the adapter seam; tests feed vendor output written in the test through the adapter's parser.

## Seam discipline

- A port needs at least two justified adapters, typically production and test. A single-adapter seam is indirection.
- Keep internal seams internal. Do not widen the interface because a test uses an internal seam.

## Testing: replace, don't layer

- Tests at the deepened module's interface replace the tests on the shallow modules it absorbs; delete the old ones.
- Tests assert observable outcomes through the interface, not internal state, and survive internal refactors. A test that must change with the implementation is testing past the interface.
- Coverage gates in testing.md still apply: web, desktop, and packages require 100%.
