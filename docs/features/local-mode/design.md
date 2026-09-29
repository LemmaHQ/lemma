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
- An FTS5 virtual table indexes the plain text extracted from message content; the read-only `QueryHistoryTool` it backs returns with the agent tool-loop work (it previously lived in the removed `lemma-client`).

## Engine assembly

- The server hosts the shared `AgentLoop` through `lemma-chat`; no separate facade crate exists today.
- Desktop embeds the Rust core directly or as a sidecar; Android embeds it via UniFFI. Both compose `lemma-session` + `lemma-agent` + `lemma-adapter` + `lemma-tools` + `lemma-db-client` the same way the server does.

## Synchronization

- The legacy sync system (outbox, `sync_seq` cursors, `SyncEngine`) was excised in 2026-09; there is no wire sync today.
- Any future sync must be redesigned tree-native against the session tree, not resurrected as outbox/seq machinery.
