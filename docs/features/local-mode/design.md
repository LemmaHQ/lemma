# Local Mode — Design

Current implementation approach for the Local Mode spec.
Rewrite this file when the implementation changes; do not archive old versions.

## Shared Rust core

- The agent core is one codebase shared verbatim by server and clients: `lemma-core` (canonical trace types), `lemma-adapter` (provider wire protocols), `lemma-session` (session tree, branching, context assembly, and the `TraceStore` persistence contract), `lemma-agent` (turn loop consuming `lemma-session` and `TurnEvent` streaming observer), `lemma-tools` (tool contract and `ExecEnv` sandbox abstraction).
- `lemma-proto` stays a standalone crate carrying the ConnectRPC bindings and business error codes.
- Server-side orchestration has been converged onto the same `AgentLoop` in `lemma-chat`, with state machine and placeholder machinery pruned to match the omp model.

## Local storage

- `lemma-db-client` persists traces in a single plaintext SQLite database (rusqlite, WAL mode, foreign keys on).
- Messages form a tree through a `parent_id` column; each conversation row carries the active `leaf_id` pointer, and context is a read-time path projection.
- An FTS5 virtual table indexes the plain text extracted from message content and backs the read-only `QueryHistoryTool`.
- An `outbox` table and `sync_state` cursor table capture local offline changes and sync progress.

## Engine assembly

- `lemma-client` is the single UI-facing facade crate implementing the `ClientEngine` trait.
- `LocalClientEngine` bundles the SQLite store, the agent loop, built-in tools (`read_file`, `write_file`, `bash`), and `QueryHistoryTool`.
- `RemoteClientEngine` provides the ConnectRPC gateway client skeleton.
- Desktop embeds `LocalClientEngine` directly or as a sidecar; Android embeds it via UniFFI.

## Synchronization

- `SyncEngine` in `lemma-client` provides bidirectional sync.
- Push reads pending `outbox` entries and confirms via `ack_outbox`.
- Pull applies remote changes from `lemma-sync` atomically to local SQLite and advances `sync_state.last_sync_seq`.
