# Local Storage

## Summary

Local Storage defines how Lemma persists accounts, provider configurations, global settings, and conversation traces.
Two backends exist — PostgreSQL (`lemma-db-pgsql`) for the server and SQLite (`lemma-db-sqlite`) for embedded clients — with full functional parity over the shared domains.
All SQL lives inside the two storage crates; every other module persists data only through their public functions and types.

## Requirements

### Backend parity

- THE SYSTEM SHALL provide two storage backends, `lemma-db-pgsql` (PostgreSQL) and `lemma-db-sqlite` (SQLite), exposing functionally identical operations for the shared domains: accounts, provider configurations, global settings, conversations, and messages.
- Modules outside the two storage crates SHALL route data persistence and retrieval exclusively through the storage crates' public functions and types, preserving strict SQL isolation within the storage crates.
- THE SYSTEM SHALL enforce parity with a single conformance suite run against both backends.
- Auth credentials (password hashes, refresh tokens) and synchronization metadata SHALL reside strictly within server-only or sync-specific crates, keeping the shared schema surface focused on common domain entities.
- THE SYSTEM SHALL maintain an accounts table with identical columns in both backends; the SQLite backend holds exactly one local account row, and every owned row references an account.
- Secret encryption SHALL happen above the storage layer, so both backends expose identical signatures; the server seals provider API keys before storage while the local backend stores them in plaintext.

### Trace tree

- THE SYSTEM SHALL store one row per canonical message: a user message, an assistant message, or a tool result each occupies exactly one row.
- Each message row SHALL carry at most one parent reference, strictly enforcing a single-parent hierarchy that ensures messages structure as a rooted tree.
- Message history is append-only: WHEN a conversation branches, THE SYSTEM SHALL append new rows under the branch point while preserving all existing historical rows immutably.
- Each conversation row SHALL carry a leaf pointer identifying the active branch tip; WHEN the user continues from an earlier message, THE SYSTEM SHALL move the leaf pointer to the newly appended branch tip.
- WHEN a streaming generation settles, THE SYSTEM SHALL finalize that pending message row in place (status, content, token usage, timings) while preserving all other rows untouched.
- Each message row SHALL carry normalized metadata: lifecycle status, model and provider references, token usage, and timing fields.
- THE SYSTEM SHALL store binary or oversized payloads (images, large tool outputs) as content-addressed files, keeping only references in message rows.
- THE SYSTEM MAY export any conversation as a JSONL event log.

### Schema evolution

- THE SYSTEM SHALL define each backend's schema as ordered, versioned migrations owned by the storage crates; both backends run on sqlx.
- WHILE the project is in its pre-release refactor window, schema changes SHALL be applied by editing the initial migration in place.
- WHEN the project ships its first release, subsequent schema changes SHALL be delivered as incremental migrations that upgrade existing databases in place, on both backends.
