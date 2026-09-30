# 1. Dual-backend storage with functional parity

- Status: accepted
- Date: 2026-10-01

## Context

SQL was scattered across domain crates (`lemma-providers`, `lemma-conversations`, `lemma-auth`), while `lemma-db-server` and `lemma-db-client` were thin shells holding only connections, migrations, and entities.
The client/server names described where the code ran, not what it did, and provider configuration had no local persistence path at all.
Embedded clients (desktop, android) need the same domains as the server — accounts, provider configs, settings, traces — without going through RPC.

## Decision

- Rename the storage crates after their engines: `lemma-db-pgsql` and `lemma-db-sqlite`.
- Consolidate all SQL into the two storage crates; other modules call only their public functions and types.
- Keep function-level parity between the backends across the shared domains: accounts, provider configurations, global settings, conversations, messages.
- Align the accounts table too: local storage holds exactly one local account, and every owned row carries an account reference, keeping rows shaped identically on both ends for a future sync.
- Exclude auth credentials (password hashes, refresh tokens) and synchronization metadata from the parity surface; they live in server-only or sync-specific crates.
- Keep contract traits in shared crates (as `lemma-session` does for traces) so parity is compile-checked and the agent loop assembles identically over either backend.
- Encrypt secrets above the storage layer; both backends expose identical signatures.

## Consequences

- Every storage function signature takes an account id; local mode is the one-account special case of the multi-account model, not a separate model.
- The storage crates grow large; they are kept manageable by mirroring per-domain modules (accounts, providers, settings, conversations, messages) one-to-one between the two crates.
- Drift between backends is caught by the shared conformance suite rather than by convention.
- `lemma-providers`, `lemma-conversations`, and `lemma-auth` shrink to pure domain logic plus RPC exposure.
