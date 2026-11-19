---
name: lemma-doc
description: Use when creating, restructuring, reviewing, auditing, or trimming Lemma documentation or prose — Markdown docs, AGENTS.md files, READMEs, skills, doc comments, tests, tool descriptions, diagnostics, and UI strings — including tier placement, fact-checking operations, required prose coverage, chain-of-thought leakage removal, and documentation checks.
---

# Lemma documentation and prose

Write enough to preserve the contract, then remove reasoning transcripts, repetition, and decoration. Apply the root and subtree `AGENTS.md` files first, then this workflow. [docs/AGENTS.md](../../../docs/AGENTS.md) owns document structure, the tier taxonomy, writing rules, and the slop checklist; the [bilingual contract](../../../docs/i18n/README.md) owns pairs. This skill is guidance, not a script.

## Inputs and exclusions

- Require an explicit scope for audits or trimming; default to `automatic` mode (report findings in review tasks, apply clear changes in edit tasks; ask calibration questions only when the user requests interactive mode).
- Search tracked files only (`git ls-files`), excluding gitignored build outputs and `.agents/skills/lemma-code-style/references/` (quoted upstream guides).
- Update owners before derivatives: [proto/AGENTS.md](../../../proto/AGENTS.md) for RPC contracts, [design/README.md](../../../design/README.md) for design tokens, `lemma-uniffi` for UniFFI bindings, and [i18n/README.md](../../../i18n/README.md) for UI strings.

## Documentation workflow

1. Read the root and subtree `AGENTS.md`, [docs/AGENTS.md](../../../docs/AGENTS.md), the target page, the code and tests it describes, and its pairing record if paired.
2. Place the page at its owning tier. Keep crate and package contracts beside their code; use `docs/` for cross-crate architecture, workflow, and shared conventions. A fact with an existing home gets a link, not a second copy.
3. Classify the page as tutorial or reference, then follow [document structure](../../../docs/AGENTS.md#document-structure).
4. For paired documents, update the counterpart in the same pass with [terminology.md](../../../docs/i18n/terminology.md) loaded ([lemma-translate-docs](../lemma-translate-docs/SKILL.md)).
5. Fact-check every operation, command, default, error, and platform difference against the current checkout: read the authoritative source (`justfile`, `package.json`, `Cargo.toml`, `.proto`, `design/tokens.json`), run claimed commands when permitted (or state how to verify commands needing keys, devices, or unapproved workspace builds), and delete anything that fails to reproduce.
6. Run the checks in [Validation](#validation), then re-read the diff for accuracy and brevity.

## Editorial standard: preserve the complete proposition

Before trimming or rewriting any passage, identify every factual proposition: actor and action; condition, timing, and ordering; modality (`must`, `may`, `never`); negative guarantees and exceptions; ownership, side effects, failure modes, and consequences. Remove adjectives, repetition, and narration only when every factual clause survives. For calibration examples, read [references/examples.md](references/examples.md).

Keep a complete local contract at the point of use (behavior, failure, ownership, consequence) and link to the owning document for architecture or extended examples. Keep non-obvious rationale only when omitting it could cause misuse; otherwise put rationale in the commit message body.

Prefer exact nouns (the check, type, API, field set, validation, or failure) over vague labels like `contract`, `boundary`, `shape`, `surface`, `seam`, `gate`, or `vocabulary` unless the term names the exact technical subject.

## Required coverage by prose location

Add or restore prose when code, types, and structure do not communicate a required contract below; do not add comments for facts already obvious locally.

- **Rust doc comments:** `//!` states a crate or top-level public module's role and crate-level invariants. `///` on `pub` APIs and traits documents caller-visible return distinctions, errors, side effects, ownership, timing, cancellation, and durability (`missing_docs` is denied workspace-wide; narrow internal items to `pub(crate)` instead of writing filler docs).
- **`// SAFETY:` comments:** state only the proof that the `unsafe` block's preconditions hold.
- **JSDoc and KDoc:** compact contracts on exported public interfaces with the same coverage as `///`; omit on self-explanatory members.
- **Other code comments:** none by default ([conventions](../../../AGENTS.md#conventions)). Move non-obvious rationale to the owning doc or commit body; keep at most a one-line pointer when a subtle invariant or security boundary cannot live in names or types. Delete control-flow narration and code restatement.
- **Tests:** test names state the pinned behavior. Comment only non-obvious test design (fixtures, platform accommodations, indirect observation).
- **READMEs:** state consumer contracts (configuration, semantics, failures, limitations, extension points), not API catalogs or doc-comment restatements.
- **Commit bodies:** lead with why, then the decision and alternatives ([lemma-commit](../lemma-commit/SKILL.md)).
- **Skills and agent instructions:** state behavioral guardrails and explicit scope limits; link sources of truth instead of repeating them.
- **Configuration comments** (`justfile`, workflows, Gradle, Vite): explain access limits, non-obvious wiring or load order, and build workarounds. A `justfile` recipe comment is its `just --list` summary.
- **Model-visible text:** `ToolSpec` descriptions reach model requests; treat wording changes as behavior, note them in the commit body, and verify against a real provider when tool use can shift.
- **UI strings:** wording is behavior; inspect text, accessible names, tooltips, and placeholders together in [i18n/](../../../i18n/README.md) with [terminology.md](../../../docs/i18n/terminology.md).
- **Diagnostics and errors:** name the failing subject, violated rule, and non-obvious fix. Client-visible failures carry an `ErrorReason` translated by clients, with English as fallback.

## Auditing docs and chain-of-thought leakage

1. Apply [document structure](../../../docs/AGENTS.md#document-structure) and tier placement: move descendant-owned detail to its owner and replace hand-written catalogs with links.
2. Hunt the [slop checklist](../../../docs/AGENTS.md#the-slop-checklist) and chain-of-thought leakage using the taxonomy and recall probes in [references/cot-leakage.md](references/cot-leakage.md).
3. If removing prose would change a promised behavior rather than its explanation, propose the behavior change first ([lemma-find-simplifications](../lemma-find-simplifications/SKILL.md)).

## Validation

- **Pairs:** `just docs-pairing-check <file>` (and read both sides to verify lists, tables, and links).
- **Links and references:** verify relative links resolve (Chinese links to paired docs target `.zh.md`) and run `just docs-refs-check`.
- **Formatting:** `just docs-lint-check` (`just docs-lint` to fix); Markdown under `web/` also runs `just web-fmt` before recording pairs.
- **Code prose:** run the owning crate's clippy for Rust doc comments and the owning test for changed UI strings.
- **Skills:** frontmatter `name` matches directory name, relative links resolve, and `description` states load triggers.
- **Whitespace:** `git diff --check`.
