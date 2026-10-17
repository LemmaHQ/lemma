---
name: lemma-error-handling
description: Use when designing or reviewing failures in Lemma — domain error enums, ErrorReason mapping in RPC crates, internal errors, agent stream errors, recovery and retries, and the error text web and Android clients show.
---

# Lemma error handling

Define failures, their owners, and what remains safe after failure. This skill is guidance, not a checklist; the wire contract lives in [errors.proto](../../../proto/lemma/v1/errors.proto) and the [glossary](../../../docs/glossary.md#errors).

## Typed, structured failures

Expected failures need declared types, stable discriminants, and handling-relevant details. Each domain crate owns a `<Domain>Error` enum in its `error.rs` (`ConversationError`, `ProviderError`, `AuthError`, …): one variant per expected failure, plus variants such as `Store(String)` that carry infrastructure text. Preserve causes, separate machine identity from display text, and never route handling by parsing messages.

At the RPC boundary, each service crate maps its domain enum exhaustively:

- An expected failure the client can act on becomes `app_error(ErrorReason::…)`, or `app_error_with` when the localized text needs attributes. Adding one adds an `ErrorReason` value in `errors.proto`, a key in both web locales, and a row in `reasonKeys` in [errors.ts](../../../web/src/data/rpc/errors.ts).
- An infrastructure failure becomes `ConnectError::internal` with text prefixed by its subsystem (`db: …`, `crypto: …`). Internal errors carry no reason; clients show the generic message.

`unwrap` is denied and `expect` warns workspace-wide; a defect that can only come from a bug may remain a panic, but containment must never turn it into success.

## Catch, recover, or stop

For each failure, define who handles it, who reports it, and what holds afterwards: valid invariants, whether effects are absent, partial, committed, or unknown, and who cleans up. Write that contract in the owning `///`, JSDoc, or KDoc. Streaming and background work keep these obligations: a turn that fails mid-step leaves its placeholder message with status `error` and the failure text in `error`, never `streaming`.

Catching limits propagation, not mutations. Only the owner of the affected state can establish safe continuation; otherwise stop dependent work, discard invalid state, or escalate. Logging alone is not recovery. A retry needs safe repetition, cancellation, and an explicit owner; finite operations need a bound.

Defensive additions (fallback branches, retries, extra validation, degraded paths) need a defined scenario: explain it and let the user decide before adding one ([conventions](../../../AGENTS.md#conventions)).

## Localized, actionable, visible reports

Every report a user sees needs a readable summary, the affected operation, and a safe next action. Keep sensitive internals (SQL, paths, keys, provider responses with credentials) out of user-facing text.

- **Web:** `errorText(e, t)` in [errors.ts](../../../web/src/data/rpc/errors.ts) turns any failure into localized text, ending at a generic message. A failed action reports through a toast (`toast.error(errorText(e, t))`); a form keeps the user's input and shows the failure beside it. A failed agent turn shows the localized summary with the provider's text as secondary detail.
- **Android:** errors reach the UI through `ErrorFormatter`; it must produce localized text from the reason, never the enum name or raw transport text. A failed send restores the unsent text so the user can retry.
- **Chinese copy** follows [lemma-client-ui-ux](../lemma-client-ui-ux/SKILL.md#feedback-surfaces): short, with no trailing full stop on notices of two sentences or fewer.

Untrusted state or unknown outcomes must be visible: report the impact, the uncertainty, and the safe next step. Never claim success, rollback, or a safe retry without a guarantee. A cached view shown while offline says so.

Verify the resulting state and the visible outcome, not merely that an error was caught: the store row, the message status, the restored input, the rendered text in both locales.

## Foundations

Meyer's *Object-Oriented Software Construction* (1997): contracts and invariants; Sutter's *Exceptional C++* (1999): exception-safety guarantees; Armstrong's [thesis](https://www.erlang.org/download/armstrong_thesis_2003.pdf) (2003): isolation and supervision.
