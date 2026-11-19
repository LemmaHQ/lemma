# AGENTS.md — The documentation standard

This file defines document structure, Markdown tiers, and writing rules for Lemma. Use [lemma-doc](../.agents/skills/lemma-doc/SKILL.md) for placement, coverage, editorial judgment, and validation. The [bilingual contract](i18n/README.md) defines how English and Chinese pairs are maintained.

## Document structure

These rules apply to human-facing documentation. A document's subject and tree position fix its scope: describe its own subject at appropriate detail and direct children only by purpose, responsibility, and high-level behavior; link to the owning descendant for lower-level detail. Testing mechanisms, fixtures, and harnesses belong at the lowest owning level; higher documents link there.

Classify each document as tutorial (an ordered path introducing prerequisites step by step) or reference (current behavior for lookup without a teaching sequence), separate substantial mixed content, and replace descendant-owned detail with links to its owner.

## The tier taxonomy: one home per fact

Each fact has one home: the tier whose job it is; elsewhere, link there.

| Tier                                                                                           | Job                                                                                         | Does NOT belong there                                                                                                      |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Root `AGENTS.md`                                                                               | Standing orders needed in every task, linking their authoritative homes                     | Worked examples, situational procedures, duplicated `just` or formatter rules                                              |
| Subtree `AGENTS.md` (`crates/`, `web/`, `desktop/`, `mobile/`, `packages/`, `proto/`, `docs/`) | Orders and invariants specific to that subtree                                              | Repo-wide rules, routine `just` command tables                                                                             |
| [architecture.md](architecture.md)                                                             | Cross-crate map: crate layers, runtimes, wire boundaries, turn flow, persistence invariants | Source type catalogs (→ Rust `//!`/`///`), decision rationale (→ commit bodies), status annotations                        |
| [glossary.md](glossary.md)                                                                     | Cross-boundary domain terms, one definition each                                            | Single-struct restatements, runtime defaults or volatile lists                                                             |
| Rust `//!` and `///`                                                                           | Single-crate invariants and public API contracts                                            | Cross-crate architecture narration (→ architecture.md)                                                                     |
| Subsystem / package README                                                                     | Consumer contract: conventions, constraints, extension points                               | Hand-written file/component catalogs, doc-comment or config restatements                                                   |
| [development.md](development.md)                                                               | First-time setup, platform traps, worktrees, environment variables                          | Tool/workflow inventories duplicating `mise.toml`, `rust-toolchain.toml`, or `.github/workflows/`                          |
| [testing.md](testing.md)                                                                       | Test layout, coverage thresholds, and core testing principles                               | Test inventories or file-by-file exclusion lists duplicating configs                                                       |
| [design/README.md](../design/README.md) and `tokens.json`                                      | Token format, color role families, generator outputs, contrast standard                     | Component usage of type roles, shadows, and Tailwind classes (→ [packages/ui/README.md](../packages/ui/README.md#styling)) |
| Skills (`.agents/skills/`)                                                                     | Reusable workflows and specialized decision standards, including per-language style guides  | Product and runtime contracts (→ docs or source)                                                                           |

## Writing rules

- **Document current state.** Keep history in commits; prose describes live behavior, not changes or stack positions.
- **One physical line per paragraph:** use editor soft-wrap; code blocks, tables, and lists keep their formatting.
- **Pairs update together:** for human-facing Markdown in scope of [docs/i18n/README.md](i18n/README.md#scope-and-exclusions), update the counterpart with [terminology.md](i18n/terminology.md) loaded and re-record the pair in the same commit.
- **Doc comments state complete contracts, not reasoning transcripts.** `//!`, `///`, JSDoc, and KDoc preserve behavior, failure, timing, ownership, and consequences; delete narration, walkthroughs, and code restatement ([lemma-doc](../.agents/skills/lemma-doc/SKILL.md)).
- **Write directly:** name the exact check, type, API, operation, or behavior instead of vague labels.

## The slop checklist

Hunt these in any doc; [lemma-doc](../.agents/skills/lemma-doc/SKILL.md) runs this list as an audit:

- Duplicated rules: keep one home and link the rest.
- History or implementation-status annotations ("implemented!", "future: …") outside commit bodies or issues.
- Hand-restated catalogs, inventories, or config transcriptions where source or a generator is authoritative.
- Reasoning transcripts: step-by-step narration, proofs of obvious branches, test walkthroughs, or rejected local alternatives.
- Paragraph walls and emphasis inflation: reserve bold for clauses that change behavior.

## Repository references

Link files with relative Markdown links. A code-formatted path names a tracked or gitignored location; `just docs-refs-check` fails on any other, and on any `just` recipe that does not exist. When a path moves or is removed, search the repository and update every reference in the same change. Historical references use tags, never commit identifiers.
