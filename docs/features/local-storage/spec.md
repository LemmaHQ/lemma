# Local Storage

## Summary

Local Storage defines how Lemma persists accounts, provider configurations, global settings, and conversation traces.
Two backends exist — PostgreSQL (`lemma-db-pgsql`) for the server and SQLite (`lemma-db-sqlite`) for embedded clients — with full functional parity over the shared domains.
All SQL lives inside the two storage crates; every other module persists data only through their public functions and types.

## Requirements

### Backend parity

- THE SYSTEM SHALL provide two storage backends, `lemma-db-pgsql` (PostgreSQL) and `lemma-db-sqlite` (SQLite), exposing functionally identical operations for the shared domains: accounts, provider configurations, global settings, conversations, and messages.
- Modules outside the two storage crates MUST NOT issue SQL directly; WHEN a component needs to read or persist data, THE SYSTEM SHALL route the call through the storage crates' public functions or types.
- THE SYSTEM SHALL enforce parity with a single conformance suite run against both backends.
- Auth credentials (password hashes, refresh tokens) and synchronization metadata MUST NOT be part of the shared schema surface; they live in server-only or sync-specific crates.
- THE SYSTEM SHALL maintain an accounts table with identical columns in both backends; the SQLite backend holds exactly one local account row, and every owned row references an account.
- Secret encryption SHALL happen above the storage layer, so both backends expose identical signatures; the server seals provider API keys before storage while the local backend stores them in plaintext.

### Trace tree

- THE SYSTEM SHALL store one row per canonical message: a user message, an assistant message, or a tool result each occupies exactly one row.
- Each message row SHALL carry at most one parent reference, so messages form a tree, never a graph.
- Message history is append-only: WHEN a conversation branches, THE SYSTEM SHALL append new rows under the branch point and MUST NOT modify or delete existing rows.
- Each conversation row SHALL carry a leaf pointer identifying the active branch tip; WHEN the user continues from an earlier message, THE SYSTEM SHALL move the leaf pointer to the newly appended branch tip.
- WHEN a streaming generation settles, THE SYSTEM SHALL finalize that pending message row in place (status, content, token usage, timings) and MUST NOT alter any other row.
- Each message row SHALL carry normalized metadata: lifecycle status, model and provider references, token usage, and timing fields.
- THE SYSTEM SHALL store binary or oversized payloads (images, large tool outputs) as content-addressed files, keeping only references in message rows.
- THE SYSTEM MAY export any conversation as a JSONL event log.

### Schema evolution

- WHEN the schema changes, THE SYSTEM SHALL regenerate the migration from scratch rather than layering incremental migrations; a version mismatch on open drops and rebuilds the SQLite database.
