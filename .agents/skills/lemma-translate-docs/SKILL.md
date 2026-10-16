---
name: lemma-translate-docs
description: Use when translating a Lemma document into its counterpart language — writing a new foo.md/foo.zh.md pair, updating a counterpart from a translation brief, or reconciling a pair whose two sides both changed.
---

# Translating Lemma docs

## What this skill is

**This skill is guidance, not a translation memory.** It is the workflow for keeping `foo.md` and `foo.zh.md` consistent and natural in both languages. Both languages carry equal authority: a change is authored in either one, and that side is the source for that update. You are the translator. The rules below say what must hold, not how to phrase any sentence; phrasing judgment is yours, terminology is not.

## Sources of truth (read, don't re-summarize)

- **[docs/i18n/README.md](../../../docs/i18n/README.md):** the pairing contract (`foo.md`, `foo.zh.md`, `foo.i18n.yaml`), the language switcher, the check, scope, and exclusions.
- **[docs/i18n/terminology.md](../../../docs/i18n/terminology.md):** the terminology table, binding in both directions. Load it before translating, not when a term feels uncertain; the terms you don't notice are the ones that drift.
- **[lemma-prose-standard](../lemma-prose-standard/SKILL.md):** required prose coverage and editorial judgment. Apply it to both sides without adding or dropping source propositions.

## Triage by change type

- **Update** (pair exists, one side edited): follow [the update path](#the-update-path). It is brief-driven and cheap: no corpus reading, no git archaeology, the smallest counterpart edit. Never re-translate a whole document to apply an update; a minimal update preserves the reviewed wording of everything that did not change.
- **New pair** (no counterpart yet): follow [the whole-document path](#the-whole-document-path).
- **Both sides changed:** reconcile by hand. Carry each side's change to the other, keep the wording neither change touched, then record.
- **Deleted or renamed document:** delete or rename the counterpart and the `.i18n.yaml` with it, and repair inbound links on both sides in the same change.

## The update path

1. **Generate the brief:** `just docs-brief <any file of the pair>`; with no arguments it briefs every out-of-sync pair. A section brief holds each changed section's last committed source that matched the record, its current source, the current counterpart with line numbers, and the terminology rows the change touches.
2. **Translate from the brief.** The brief is the working set: do not re-read the corpus or re-derive the diff. Escalate to the sources of truth only when the brief leaves a decision unanswerable, such as an unlisted term with no precedent in the surrounding text.
3. **Make the smallest edit that covers the change.** Keep the reviewed wording of everything the change does not touch, then verify the changed sections clause by clause against the source: nothing added, nothing dropped, terminology per the rows, code spans verbatim.
4. **Record and check the named pair:** `just docs-pairing --write <file>`, then `just docs-pairing <file>`. Use `--write --all` only when you confirmed every pair.

The brief's confirmed source comes from git history, so a source edited twice without a commit in between shows no confirmed text. Compare against `git diff` in that case.

## The whole-document path

Translate the whole file section by section, keeping each section's structure locked to the source as you go rather than fixing structure at the end.

- **Pass 1: write, don't transpose.** Read a semantic unit, then restate it as a native technical author would. Keep the structure; do not force sentence-by-sentence correspondence.
- **Pass 2: verify against the source, clause by clause.** Confirm nothing was added or dropped, every term follows the table, and each code span survived verbatim. Fix by rewriting the sentence natively, not by patching words into it.
- **Read the counterpart alone.** After the comparison, read the translated file without the source and rewrite phrasing whose awkwardness only shows in isolation.
- Write only the final text to the file, never drafts or notes.

## Translation rules

- **Terminology:** every listed term renders exactly as the table specifies. An unlisted term follows the rendering already used in the surrounding documents; with no precedent it stays English, and the commit body lists it for addition to the table. Never invent a rendering inline.
- **Code:** code blocks match line for line; only comments may be translated. Inline code, paths, commands, and identifiers stay verbatim.
- **Links:** each link keeps the same target and fragment. Links to paired documents use `.md` on the English side and `.zh.md` on the Chinese side; Chinese fragments use the Chinese heading slug. The switcher is the only cross-language link.
- **Structure:** heading levels and order, list kinds and item counts, and table rows and columns match. The script checks headings only; check lists, tables, and links by reading both sides.
- **Chinese typography:** full-width punctuation in Chinese prose; `just docs-lint` (autocorrect) owns spacing between Chinese and Latin text.
- **Paragraphs:** one physical line per paragraph on both sides.

## Finish the pair

1. Switcher: `English | [中文](foo.zh.md)` after the English H1, `[English](foo.md) | 中文` after the Chinese H1; add both for a new pair.
2. Record the pair with `just docs-pairing --write <file>` only after you confirmed the two sides say the same thing; the record diff states that confirmation.
3. Run `just docs-pairing <file>` and `just docs-lint` for the touched pairs.
4. In the report and the commit body, state which pairs are new and which were minimally updated, and list any unlisted terms kept in English.

When the user corrects a rendering, apply the decision to [terminology.md](../../../docs/i18n/terminology.md) and every affected document, not only to one file.
