---
name: lemma-doc
description: Use when creating, restructuring, reviewing, auditing, or moving Lemma Markdown documentation — docs/, AGENTS.md files, READMEs, skills — including placement in the tier taxonomy, fact-checking operations, bilingual pairs, word budgets, and documentation checks.
---

# Lemma documentation

Make every page exact enough for agents and readable for a newcomer. Apply the root and subtree `AGENTS.md` files first, then this workflow. [docs/AGENTS.md](../../../docs/AGENTS.md) owns document structure, the tier taxonomy, writing rules, budgets, and the slop checklist; the [bilingual contract](../../../docs/i18n/README.md) owns pairs. This skill applies them; it does not restate them. Use [lemma-prose-standard](../lemma-prose-standard/SKILL.md) for sentence-level coverage and editorial judgment.

## Workflow

Follow this sequence for each requested scope. Keep the common reader path brief, but do not delete failures, ownership, limitations, or other required contracts merely to reduce words.

1. Read the root and more-specific `AGENTS.md`, [docs/AGENTS.md](../../../docs/AGENTS.md), the target page, the source and tests it describes, and its pairing record.
2. Classify the page by one primary job and reader: standing orders, architecture map, glossary, subsystem reference, crate or package README, development or testing guide, styling reference, or skill.
3. Place the page at its owning tier. Keep crate and package contracts beside their code; use `docs/` for cross-crate architecture, workflow, and the client styling system. A fact with an existing home gets a link, not a second copy.
4. Classify the page as tutorial or reference, then follow the authoring order in [document structure](../../../docs/AGENTS.md#document-structure).
5. Write the English or Chinese side, then update the counterpart in the same pass with [terminology.md](../../../docs/i18n/terminology.md) loaded. Keep headings, lists, tables, code blocks, and link targets aligned.
6. Verify every claim against code, tests, generators, or configuration, and run the operations the page instructs, per the fact-check procedure below. Update the owner before any derivative.
7. Run the checks listed in the [Validation](#validation) section below, then re-read the complete diff for correctness and again for brevity and repository fit.

## Fact-check procedure: test, do not assume

Documentation states how Lemma behaves today, and the only admissible evidence for an operation claim is having run it. This procedure applies to every new document and every new paragraph that claims an operation, command, default, error, or platform difference.

1. **Read the facts, not the names.** Take recipe behavior from the `justfile`, package scripts from `package.json`, crate dependencies from `Cargo.toml`, wire contracts from the `.proto` files, and token values from the design token source ([design/README.md](../../../design/README.md)). A directory or crate name is not evidence of what it does.
2. **Run every claimed operation against the current checkout.** Execute each command and configuration exactly as the page will show it; write down only what you observed, including output, warnings, and failure modes. A claim that needs a provider key, a device, or a long build the user has not approved names how to verify it instead of asserting the behavior.
3. **Delete what you could not reproduce.** Never carry a command, field, default, or behavior from memory, analogy, or a neighboring page. When a claim fails to reproduce, fix the claim, not the code.
4. **Check old prose against the code.** A stale statement already committed is still wrong; correct it against current code, not against the old prose.
5. **Re-record the pair after every edit** with `just docs-pairing <file>`.

## Voice rules

- **Say what the subject does.** Opening paragraphs and user-facing sections state what a reader can do or observe, when to choose the subject, and its main cost; internal identity and registrations come later or not at all.
- **Developer sections explain, never enumerate.** Cover the design concept, ownership, and data flow, and link code for exact detail. No API catalogs, column lists, or doc-comment restatement.
- **Current state only.** History lives in commits; known issues live in GitHub issues.
- **Controlled technical English.** Name the actor and action; use one term per concept, as [glossary.md](../../../docs/glossary.md) fixes them; prefer direct verbs; put one instruction in each sentence and use a list for three or more steps; split long clause chains. Treat 20 words for an instruction and 25 for a description as review prompts, not limits. Never remove or strengthen `must`, `may`, `never`, timing, exceptions, or numbers to meet a length.
- **Emphasis discipline.** Bold only the clause that changes behavior or the comparison that matters.

## Quality criteria

Each section opens with a short orienting paragraph before subsections or exhaustive detail.

- **Brief:** the common path contains only facts needed for its outcome; exhaustive truth stays one link away.
- **Intuitive:** prerequisites precede dependent concepts, one next action is obvious, and headings use terms readers search for.
- **Accurate:** each durable claim has one owner and a verification path proportionate to its risk.
- **Agent-readable:** stable headings, anchors, terminology, and ownership support targeted retrieval without loading the whole corpus.
- **Newcomer-complete:** an engineer with no repository context can answer, within three to five linked pages, what a feature does, how to run it, where its state lives, which crate owns it, how it fails, and where to change it.

Do not apply a universal word limit to exhaustive references. Measure the entry-path length, unrelated material scanned for one lookup, and the largest section; split by an existing owner when retrieval cost is high.

## Audit the corpus

Read, do not re-summarize, the owning contracts: [docs/AGENTS.md](../../../docs/AGENTS.md), the [bilingual contract](../../../docs/i18n/README.md), and the [root AGENTS.md](../../../AGENTS.md).

Apply the authoring order to every document in scope: locate it and state its own subject; set the permitted detail and move deeper explanations to owning descendants with links; classify tutorial or reference from intended use, not path; split substantial mixed forms. Then check placement: each paired edit costs a counterpart update and a re-record; generated files are never hand-edited; a move is atomic with every inbound link repaired in the same change.

After the structural pass, hunt the [slop checklist](../../../docs/AGENTS.md#the-slop-checklist) with the cheapest probes first. Use [lemma-trim-cot-leakage](../lemma-trim-cot-leakage/SKILL.md) for reasoning-transcript leakage, search distinctive phrases to find duplicated rules, and replace hand-written catalogs with links to their authoritative owners. If removing prose changes a promised behavior rather than its explanation, propose the behavior change first ([lemma-find-simplifications](../lemma-find-simplifications/SKILL.md)). Keep every load-bearing rule, preferably as one to three lines plus a link.

## Word budgets

Budgets and the relocate-condense-raise policy live in [docs/AGENTS.md](../../../docs/AGENTS.md#wordcount-budgets). They keep standing context small: every agent session loads the root `AGENTS.md` and the subtree files for the area it touches, so situational procedures belong in skills, which load on demand. Measure the English file with `wc -w`. At or below a target, keep at least 5% headroom; raise a target only when the words need the space, and justify the raise in the commit body.

## Validation

Validate the affected format, not merely Markdown syntax.

- **Pairs:** `just docs-pairing-check <file>` checks alignment and the record; also compare list, table, and link structure by reading both sides, which the script does not check.
- **Links:** every relative link resolves, and Chinese links to paired documents target the `.zh.md` side.
- **References:** `just docs-refs-check` fails on a cited `just` recipe that does not exist and on a code-formatted path that is neither tracked nor gitignored ([repository references](../../../docs/AGENTS.md#repository-references)).
- **Formatting:** `just docs-lint-check` runs markdownlint and autocorrect on tracked Markdown, and `just docs-lint` applies their fixes; Markdown under `web/` also goes through `just web-fmt`, which reformats tables, before the pair is recorded.
- **Tutorials:** exercise the documented entry path, or name how to verify it when it needs a key, device, or build the user has not approved.
- **Skills:** frontmatter `name` equals the directory name, every relative link resolves, and `description` is the load trigger: it names the tasks and file types that should load the skill, not what the skill contains.
- **Whitespace:** `git diff --check`.
