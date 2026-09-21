# Local Mode

## Summary

Local Mode lets the desktop and android clients run the complete agent — provider streaming, tool calling, and workspace execution — without a Lemma server.
Traces are stored locally in a plaintext SQLite database and optionally synchronized with a server when one is configured.

## Requirements

- WHEN no server is configured, THE SYSTEM SHALL offer complete agent runs on desktop and android, including streaming provider calls, tool execution, and a workspace sandbox.
- THE SYSTEM SHALL store local traces in a single plaintext SQLite database and MUST NOT encrypt conversation content at rest.
- THE SYSTEM SHALL store binary and oversized payloads (images, large tool outputs) as content-addressed files, keeping only references in the database.
- THE SYSTEM SHALL provide a read-only `query_history` tool so the agent can search its own traces, backed by a full-text index.
- WHEN the user jumps to an earlier trace entry, THE SYSTEM SHALL branch by appending new entries under that entry and MUST NOT rewrite existing history.
- WHEN a conversation is marked local-only, THE SYSTEM SHALL NOT upload its messages and MAY register a stub carrying title and metadata so other devices can see the conversation exists.
- WHEN the user toggles a conversation between synced and local-only, THE SYSTEM SHALL preserve its history without any storage migration.
- WHEN connectivity returns after offline work, THE SYSTEM SHALL reconcile synced conversations by pushing the local outbox and pulling changes by sync cursor.
- THE SYSTEM MAY export any conversation as a JSONL event log.

## Client Matrix

- `web` is server-backed by design and does not implement Local Mode.
- `desktop` runs the embedded Rust core as a sidecar with a full workspace sandbox (file and shell tools behind approval).
- `android` runs the same Rust core via UniFFI with the full capability set, constrained to the platform sandbox (app-private and SAF-scoped storage).
