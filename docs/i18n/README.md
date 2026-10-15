# Bilingual documentation

English | [中文](README.zh.md)

Lemma's documentation is maintained in English and Simplified Chinese. This page defines the pairing contract and its scope.

## The pairing contract

- **Both languages carry equal authority.** A document may be written in either language first, and the counterpart is translated from it. The two files say the same thing.
- **A pair is two sibling files.** The English `foo.md` and the Chinese `foo.zh.md` sit in the same directory. A commit that changes one side updates the other.
- **Language switcher.** The line after the H1 is `English | [中文](foo.zh.md)` in the English file and `[English](foo.md) | 中文` in the Chinese file.
- **Structure mirrors the counterpart.** Heading levels and order, list kinds and item counts, table rows and columns, and link targets match one to one. Code blocks match line for line; only comments may be translated. Links from a Chinese file to a paired document target its `.zh.md` side.

## Scope and exclusions

**Scope**: every maintained Markdown document, including `README.md` and `AGENTS.md` files.

**Excluded** (English only, because tools consume them verbatim):

- `SKILL.md` files and the references under each skill.
- `DESIGN.md`, the source of the generated design tokens.
- Generated files.
