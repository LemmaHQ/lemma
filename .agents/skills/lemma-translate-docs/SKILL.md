---
name: lemma-translate-docs
description: Use when translating a Lemma document into its counterpart language — writing a new foo.md/foo.zh.md pair, updating a counterpart from a translation brief, or reconciling a pair whose two sides both changed.
---

# Translating Lemma docs

**This skill is guidance, not a translation memory.** [docs/i18n/README.md](../../../docs/i18n/README.md) owns the pairing contract, consistency records, language switcher, scope, and exclusions; [docs/i18n/terminology.md](../../../docs/i18n/terminology.md) owns binding terminology in both directions (load it before translating, not when a term feels uncertain); [lemma-doc](../lemma-doc/SKILL.md) owns prose coverage and editorial judgment.

## Triage by change type

- **Update** (pair exists, one side edited): follow [the update path](#the-update-path). Never re-translate an entire document for a targeted update; preserve reviewed wording untouched by the change.
- **New pair** (no counterpart yet): follow [the whole-document path](#the-whole-document-path).
- **Both sides changed:** reconcile by hand, carry each side's change to the other while preserving untouched wording, then record.
- **Deleted or renamed document:** delete or rename the counterpart and `.i18n.yaml` together, and repair inbound links on both sides.

## The update path

1. **Generate the brief:** `just docs-brief <file>` (or with no arguments for all out-of-sync pairs). The brief gives the last confirmed source, current source, current counterpart with line numbers, and touched terminology rows.
2. **Translate from the brief.** Escalate to full files only when the brief cannot answer a decision (such as an unlisted term with no local precedent). If a source was edited twice without an intermediate commit, compare against `git diff`.
3. **Make the smallest edit that covers the change.** Verify changed sections clause by clause against the source: nothing added, nothing dropped, terminology exact, code spans verbatim.
4. **Record and check:** `just docs-pairing <file>`, then `just docs-pairing-check <file>` (use `--all` only after confirming every pair).

## The whole-document path

Translate section by section, keeping each section's structure aligned to the source as you go:

- **Pass 1: write natively.** Restate each semantic unit as a native technical author would without forcing sentence-by-sentence correspondence.
- **Pass 2: verify clause by clause.** Confirm nothing was added or dropped, every term follows [terminology.md](../../../docs/i18n/terminology.md), and every code span survived verbatim. Fix mismatches by rewriting natively.
- **Read in isolation.** Re-read the finished counterpart alone and smooth phrasing that reads awkwardly without the source. Write only final text, never drafts or notes.

## Authoring conventions

- **Unlisted terms:** follow precedent in surrounding documents; with no precedent, keep the English term and note it in the commit body for addition to `terminology.md`. Never invent a rendering inline.
- **Chinese links and typography:** links to paired documents target `.zh.md` with the Chinese heading slug; use full-width punctuation in Chinese prose (`just docs-lint` owns CJK-Latin spacing); keep one physical line per paragraph.
- **Verify and report:** run `just docs-pairing-check <file>` and `just docs-lint-check` after recording. State in the report and commit body which pairs are new or minimally updated and any unlisted terms kept in English.

When the user corrects a rendering, update [terminology.md](../../../docs/i18n/terminology.md) and every affected document, not just one file.
