# Local Mode — Design

Current implementation approach for the Local Mode spec.
Rewrite this file when the implementation changes; do not archive old versions.

## Shared Rust core

- The agent core is one codebase shared by server and clients: `lemma-core` (canonical trace types), `lemma-adapter` (provider wire protocols), `lemma-session` (session tree, branching, context assembly, and the `TraceStore` persistence contract), `lemma-agent` (turn loop consuming `lemma-session`), `lemma-tools` (tool contract and `ExecEnv` sandbox abstraction).
- `lemma-proto` stays a standalone crate carrying the ConnectRPC bindings and business error codes.
- Server-side orchestration is being converged onto the same agent loop; follow the active plan `docs/plans/2026-09-21-core-restructure.md`.

## Local storage

- `lemma-db-client` persists traces in a single plaintext SQLite database (rusqlite, WAL mode, foreign keys on).
- Messages form a tree through a `parent_id` column; each conversation row carries the active `leaf_id` pointer, and context is a read-time path projection.
- An FTS5 virtual table indexes the plain text extracted from message content and backs the read-only `query_history` tool.
- Content-addressed payload externalization and the sync outbox tables are specified but not yet implemented.

## Engine assembly

- `LocalEngine` in `lemma-db-client` bundles the SQLite store, the agent loop, and the built-in tool registry (`read_file`, `write_file`, `bash`, `query_history`) into one entry point.
- Desktop embeds this engine as a sidecar; android will embed it through UniFFI.
- A future `lemma-client` crate will be the single UI-facing facade, with `LocalEngine` and a ConnectRPC-backed `RemoteEngine` behind one trait.

## Synchronization

- Server-side pull endpoints exist in `lemma-sync` (cursor over `sync_seq`).
- The client-side outbox, push, and echo-back reconciliation are pending; local-only conversations will be a sync policy flag rather than a storage fork.
