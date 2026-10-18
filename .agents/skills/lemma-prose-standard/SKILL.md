---
name: lemma-prose-standard
description: Use when writing, reviewing, restoring, trimming, or auditing prose in the Lemma repo, including deciding where documentation or comments are required across Markdown, doc comments, tests, tool descriptions, diagnostics, commit messages, and UI strings.
---

# Lemma Prose Standard

Write enough to preserve the contract, then remove reasoning transcripts, repetition, and decoration. A contract is an obligation, invariant, precondition, postcondition, or compatibility promise that a caller, callee, implementer, producer, or consumer relies on. This skill owns editorial judgment and required prose coverage; use [lemma-doc](../lemma-doc/SKILL.md) for placement, budgets, bilingual pairs, and documentation checks, and [lemma-trim-cot-leakage](../lemma-trim-cot-leakage/SKILL.md) for hunting and fixing reasoning-transcript leakage. It is guidance, not a script.

Treat `contract`, `boundary`, `shape`, `surface`, `seam`, `gate`, and `vocabulary` as terms to check before use, not banned words. First ask whether the exact rule, API, field set, type, validation, timing point, component split, or failure states the fact better. Keep a term when it names the exact technical subject, including caller/callee contracts and security or process boundaries.

Lemma code carries no comments by default ([conventions](../../../AGENTS.md#conventions)). Doc comments state compact contracts in the forms each subtree `AGENTS.md` defines; design reasoning lives in docs or commit message bodies.

## Inputs and exclusions

Require an explicit `scope`. If it is missing, report the required input and stop; do not infer a repository-wide scope or begin an interview.

Accept `mode: automatic | interactive`; default to `automatic`. Enter interactive mode only when the user explicitly requests questions or calibration.

`mode` controls questions, not write authority. Review and audit tasks report findings without editing; explicitly requested write, fix, or trim tasks apply clear changes.

Always exclude gitignored files from discovery, review, and edits: generated output, build directories, and dependencies. Search tracked files only, with `git ls-files` or a search that respects `.gitignore`. Also exclude the upstream style guides under `.agents/skills/lemma-code-style/references/`; they are quoted sources, not Lemma prose.

Treat generated files as derivative. Edit the owning source, then regenerate: the [proto contract](../../../proto/AGENTS.md) for the generated RPC code, the [design tokens](../../../design/README.md) for the token outputs, and `lemma-mobile`'s public API for the [UniFFI bindings](../../../mobile/AGENTS.md#modules-and-generated-code). Bilingual pairs have no permanent owner: either language may be the authored side for an update. Follow the [pairs rule](../../../docs/AGENTS.md#writing-rules), update the counterpart minimally, and re-record the pair.

## Preserve the complete proposition

Before editing, identify every proposition in the passage. Preserve each relevant:

- actor and action;
- condition, timing, and ordering;
- modality such as must, may, or never;
- negative guarantee and exception;
- ownership, side effect, failure mode, and consequence.

Remove adjectives, repetition, and narration only when every factual clause survives and the result is clearer. A smaller word count alone is not an improvement.

Keep a complete local contract at the point of use: behavior, failure, ownership, and consequence that a caller or maintainer needs there. Link to the owning document for architecture, rationale, algorithms, or extended examples. One explanation has one home; essential contract facts may repeat locally.

Keep non-obvious rationale when omitting it could plausibly cause misuse or an incorrect simplification. Otherwise state the consequence and link the rationale home; when the rationale has no doc home, it belongs in the commit message body.

## Required coverage by prose location

This is not a one-way shortening pass. Add or restore prose when code, types, and structure do not communicate a required contract below. Do not add a comment when those facts are already obvious locally.

- **Rust doc comments:** `//!` states a crate or top-level public module's role in one compact statement. `///` on public APIs and traits documents caller-visible return distinctions, errors, side effects, ownership, timing, cancellation, and durability. `missing_docs` is denied workspace-wide, so every public item needs one; keep it a contract, not a restatement of the signature.
- **`// SAFETY:` comments:** state the proof that the `unsafe` block's preconditions hold, nothing else.
- **JSDoc and KDoc:** a compact contract on exported public interfaces, under the same coverage as `///`. KDoc's first sentence is a complete summary phrase; self-explanatory members omit it.
- **Other code comments:** none by default. When a non-obvious invariant, race ordering, or security boundary cannot be expressed through names and types, move the explanation to the owning doc or the commit body and keep at most a one-line pointer. Delete control-flow narration and code restatement.
- **Tests:** test names state the behavior they pin. Comment only a non-obvious test design: why a fixture, platform accommodation, or indirect observation is necessary. Delete walkthroughs and inventories.
- **READMEs:** include the consumer contract: configuration, semantics, failures, limitations, and extension points. Keep durable gaps and maintainer traps, not cleanup inventories; known issues go to GitHub issues.
- **Commit message bodies:** lead with why, then the decision and the alternatives that shaped it; [lemma-commit](../lemma-commit/SKILL.md) owns the format. This is the home for rationale that has no durable doc location.
- **Skills and agent instructions:** state behavioral guardrails and explicit scope limitations such as "guidance, not a script". Keep the workflow concise and link its source of truth.
- **Configuration comments** (`justfile`, workflows, Gradle, Vite): explain access limits, non-obvious wiring or load order, and likely misuse. A `justfile` recipe's comment is its `just --list` summary. Do not narrate entries the configuration already shows.
- **Model-visible text:** tool and parameter descriptions in `lemma-tools` `ToolSpec`s reach every model request that advertises the tool. Treat their wording as behavior: write it per [lemma-agent-experience](../lemma-agent-experience/SKILL.md), change it deliberately, state the change in the commit body, and exercise it through the local real-provider tests ([testing.md](../../../docs/testing.md#tiers)) when the change can alter tool use.
- **UI strings:** wording is behavior. Web copy lives in the [locale files](../../../web/src/i18n/locales/) with matching keys; inspect text, accessible names, tooltips, and placeholders together. Chinese terms follow [terminology.md](../../../docs/i18n/terminology.md); notice style follows [lemma-client-ui-ux](../lemma-client-ui-ux/SKILL.md).
- **Diagnostics and errors:** name the failing subject or path, the violated rule, and the correction when it is non-obvious. A client-visible failure carries an `ErrorReason` that clients translate; its English message is a fallback ([lemma-error-handling](../lemma-error-handling/SKILL.md)). Remove internal execution narration.

Preserve searchable mechanism names and meaningful modal, temporal, or negative emphasis. Normalize decorative emphasis only.

## Workflow

1. Confirm the scope, mode, and applicable `AGENTS.md` files.
2. Read [the documentation standard](../../../docs/AGENTS.md) and the owning code or document before judging a passage. For calibration or unfamiliar cases, read [the distilled examples](references/examples.md).
3. Inspect the requested scope, not only the largest files. Use searches and word counts to find candidates, then judge passages semantically.
4. Classify each candidate as keep, add, trim, restore, restructure, or defer. Apply clear changes only when the task authorizes edits; do not manufacture edits to satisfy a deletion target.
5. Update the owner before derivative artifacts. Re-check analogous passages after learning a new rule.
6. Run the narrow relevant checks: `just docs-pairing-check` for touched pairs, `git diff --check`, the crate's clippy for doc-comment changes, and the owning test for changed UI strings.
7. Report the inspected scope, clear changes, deliberate keeps, deferred cases, and checks actually run.

## Borderline decisions

A case is borderline only when at least two versions satisfy the complete-proposition rule but trade accepted principles, and this skill does not already resolve the tradeoff. A rewrite with one proposition-preserving answer is not borderline.

In automatic mode, apply clear edits when authorized and report genuine borderline cases without asking questions. Do not weaken a proposition to make progress.

In interactive mode, group analogous passages under the governing principle. Present two or three viable versions, recommend one, and state the factual or structural difference. Do not offer inferior distractors.

After the user decides, distill the principle and versions into [the examples](references/examples.md), without conversation history, and apply the learned rule to every analogous passage in scope.
