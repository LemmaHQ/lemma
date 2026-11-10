---
name: lemma-find-simplifications
description: Use when looking for evidence-backed simplifications in Lemma code, APIs, proto contracts, configuration, tests, docs, or dependencies — removing dead, duplicated, speculative, or unnecessarily maintained behavior — or when assessing a proposed simplification.
---

# Finding Lemma simplifications

Find changes that remove maintained obligations: APIs, proto fields, states, configuration paths, dependencies, tests, or documentation. Prefer a few well-supported candidates over a count of deletions. This is guidance, not a checklist; keep the user's scope and distinguish a survey from permission to implement its proposals.

## Establish scope and constraints

Read the root `AGENTS.md`, [architecture.md](../../../docs/architecture.md) before judging crates, [testing.md](../../../docs/testing.md), and the subtree `AGENTS.md` for the area. Decisions and their rationale live in commit bodies: run `git log` on the files involved before calling something accidental.

Treat the designs [architecture.md](../../../docs/architecture.md) maps as intentional unless the user overrides them: the runtimes, the storage backends behind shared store traits, the provider adapters, and the wire contract shared by remote clients. Unused members inside an intentional design remain candidates when removing them preserves its purpose.

For a broad request, split independent domains among subagents (agent loop and session tree; providers and adapters; auth and crypto; RPC crates and proto; web client; desktop shell; Android; scripts, CI, and docs), and require consumer evidence and the strongest retention argument from each.

## Search for removable obligations

- **Does a declared feature have a complete effect path?** Trace producer, transformations, and observable result. A field copied everywhere may have no setter, no reader, or a handler that ignores it; an RPC may be accepted and do nothing. Search constructors and enum emitters as well as callers.
- **Which distinctions change a consumer's action?** Several internal states may need one client-visible status. Keep distinctions that control authorization, durability, or ownership; remove public distinctions that only invite an unusable choice.
- **Could a smaller explicit behavior remove the subsystem?** Name the capability given up and the machinery deleted. A production caller makes this a behavior decision for the user, not an automatic rejection.
- **Can a consumer read the authoritative value when needed?** Look for copies kept in sync by hand: a client cache beside the server's answer, two enums mapped onto each other, a list duplicated between a doc and the source.
- **What owns the complete maintenance cost?** Trace pass-through configuration, duplicate component trees, and helpers with their own upgrade lifecycle. Moving complexity, or adding a check to keep two copies equal, does not remove it.

## Prove reachability and the trade-off

Search exact symbols, field reads and writes, enum variants, proto field names in both generated languages, config keys, environment variables, and `justfile` recipes. Cover every area of the [repository layout](../../../AGENTS.md#repository-layout), including workflows and scripts. Tests and declarations show a contract without proving a shipped producer or consumer. A proto field is a wire contract: removing one reserves its number.

For each candidate, record the current owner, the effective producer and consumer path, what disappears, what remains, and the strongest reason to keep it. Distinguish:

- removal of unreachable or unread behavior;
- a narrower behavior with an explicit loss;
- a protected obligation or insufficient evidence.

Reject a candidate that breaks a retained obligation, merely relocates the same complexity, or has no meaningful reduction.

## Preserve ownership and failure semantics

For copies and clones, name the value's origin, next owner, and trust boundary; borrow where ownership does not move. For async machinery, map each task, channel, cancellation path, and drop to its owner. Collapse mechanisms only when they express the same fact. Dropping work a user started, such as an interrupted turn's partial message, is a capability loss, not cleanup.

## Replace infrastructure only for a net reduction

Search existing workspace dependencies, the standard library, and Node built-ins before adding a dependency. Identify the code and tests the replacement deletes, its transitive and maintenance cost, and every behavior the glue must preserve: cancellation, bounds, streaming, platform packaging for Android and Electron.

## Record and validate

Report each supported candidate with its evidence, removed cost, capability given up, and observable acceptance condition. A candidate the user does not take now becomes a GitHub issue only with the user's approval; never a `TODO` in code. When implementing, update the affected docs, doc comments, generated outputs, and pairs in the same change, apply [lemma-prose-standard](../lemma-prose-standard/SKILL.md) to touched prose, and select checks through [lemma-pre-push-checks](../lemma-pre-push-checks/SKILL.md). Do not describe an unverified search as exhaustive.
