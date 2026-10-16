# Bilingual documentation

English | [中文](README.zh.md)

Lemma's documentation is maintained in English and Simplified Chinese. This page defines the pairing contract, its check, and its scope; [terminology.md](terminology.md) is the terminology source of truth.

## The pairing contract

- **Both languages carry equal authority.** A document may be written in either language first, and the counterpart is translated from it. The two files say the same thing.
- **A pair is three sibling files.** The English `foo.md`, the Chinese `foo.zh.md`, and a consistency record `foo.i18n.yaml` sit in the same directory. A commit that changes one side updates the other side and the record.
- **The consistency record.** `foo.i18n.yaml` holds one entry per heading section. The key is the section's English heading-slug path (`/` for text before the first heading; a repeated path gets `~2`, `~3`, …), and the entry holds a hash of the section's English text and of its Chinese text, code blocks included:

  ```yaml
  /bilingual-documentation/the-pairing-contract:
    en: 0b5c1e0e3f1a2d47
    zh: 9a4e8c2f71d03b65
  ```

  Section `i` of one side corresponds to section `i` of the other. Edits to different sections change separate record lines, so a record conflicts in a merge only when both branches changed the same section; resolve the Markdown, then re-record the pair. Recording a pair states that its two sides say the same thing at these exact contents.
- **Language switcher.** The line after the H1 is `English | [中文](foo.zh.md)` in the English file and `[English](foo.md) | 中文` in the Chinese file.
- **Structure mirrors the counterpart.** Heading levels and order, list kinds and item counts, table rows and columns, and link targets match one to one. Code blocks match line for line; only comments may be translated. Links from a Chinese file to a paired document target its `.zh.md` side.

## The check

`just docs-pairing` checks every pair:

1. Every document in scope has its counterpart and its record.
2. Both sides have the same heading levels in the same order.
3. The record equals the one computed from the current contents, so a change to either side that has not been re-recorded fails.
4. Excluded documents have no `.zh.md` and no `.i18n.yaml`.

`just docs-pairing <file>...` checks only the named pairs; any file of a pair names it. Spec CI runs the full check.

The check compares hashes and heading structure only. A recorded pair can still differ in meaning, terminology, lists, tables, or links; confirm those before recording.

## Updating a pair

1. Run `just docs-brief`, or `just docs-brief <file>...` for named pairs. For each pair out of sync it prints a translation brief. When one side changed some sections, the brief holds each changed section's last committed source text that matched the record, its current source text, the current counterpart text with line numbers, and the [terminology](terminology.md) rows the change touches. A new pair, an unrecorded pair, a change on both sides, or added and removed sections get a whole-document brief instead.
2. Edit the counterpart. Change only what the source change covers, and keep the reviewed wording elsewhere.
3. Record the pair with `just docs-pairing --write <file>`, then check it with `just docs-pairing <file>`. `--write --all` records every pair at once.

## Scope and exclusions

**Scope**: every maintained Markdown document, including `README.md` and `AGENTS.md` files.

**Excluded** (never paired; the check rejects a `.zh.md` or `.i18n.yaml` for them):

- `SKILL.md` files and the references under each skill, which are English only because tools consume them verbatim.
- Generated files.
- [terminology.md](terminology.md), which is bilingual by construction.
