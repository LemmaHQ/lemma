# 0001: Local trace storage is a single SQLite database; JSONL is export-only

- Status: accepted
- Date: 2026-09-20

## Context

Local Mode needs on-device trace storage shared by desktop and android.
Two candidates were considered: pure SQLite, and the hybrid pattern used by oh-my-pi and Codex (append-only JSONL event logs as source of truth plus a disposable SQLite index).

The hybrid pattern assumes the local log is the authority.
Lemma's shared conversations are server-authoritative: `sync_seq` is assigned by the server after push, so local records must be updated after being written, which an append-only log cannot do without a load-bearing side table.
Batch pull application must be atomic, which two write paths cannot give without a recovery protocol.
Concurrent writers (agent loop, UI, sync) get free serialization from SQLite WAL but would need file locking for JSONL.

## Decision

Local traces live in a single plaintext SQLite database (rusqlite, WAL), shared by desktop and android through the Rust core.
Sync cursor, outbox, and the FTS5 index are tables in the same database.
Binary and oversized payloads are externalized to content-addressed files referenced from the database.
Local-only conversations are a sync policy flag (`conversations.sync_mode`), not a storage-format fork.
JSONL is produced only by export; a write-through JSONL mirror may be added later as an append-only sink that is never read back.

## Consequences

- Sync pull is a single transaction; echo-back reconciliation is an upsert by message id.
- Branching uses a `parent_id` column plus a per-conversation leaf pointer; the tree is a read-time projection, same as oh-my-pi.
- Plaintext inspection requires an SQLite client rather than a text editor; conversation export covers the text-format use case.
- Toggling a conversation between synced and local-only is a flag flip with no data migration.
