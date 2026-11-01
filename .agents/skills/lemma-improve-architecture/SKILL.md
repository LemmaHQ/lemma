---
name: lemma-improve-architecture
description: Use when looking for architectural friction in Lemma code — shallow modules, logic spread across callers, coupling that leaks across seams, similar business logic that belongs behind one interface — and proposing deepening refactors as an HTML report before grilling through the one the user picks.
---

# Improving Lemma architecture

Surface architectural friction and propose deepening opportunities: refactors that turn shallow modules into deep ones, so behavior, bugs, and tests concentrate behind one small interface. Adapted from `improve-codebase-architecture` and `codebase-design` in [mattpocock/skills](https://github.com/mattpocock/skills) (MIT); the implementation plan and review steps from `ai-slop-cleaner` in [Yeachan-Heo/oh-my-claudecode](https://github.com/Yeachan-Heo/oh-my-claudecode) (MIT).

This skill restructures code that stays; [lemma-find-simplifications](../lemma-find-simplifications/SKILL.md) removes obligations nobody needs. Run that one first when a candidate may simply be deletable.

## Vocabulary

Read [references/vocabulary.md](references/vocabulary.md) before exploring and use its terms exactly in every candidate: **module**, **interface**, **implementation**, **depth**, **seam**, **adapter**, **leverage**, **locality**. Domain nouns come from [glossary.md](../../../docs/glossary.md): say "the turn loop", not "the AgentLoop service".

## 1. Scope

- If the user named a direction (a module, a crate, a feature, a pain point), take it.
- Otherwise run `git log --oneline` over a long stretch and let the files and areas that keep changing pull attention first. Deepening pays off where future changes land. With no clear hot spot, widen the net.
- Read the root `AGENTS.md`, [architecture.md](../../../docs/architecture.md), the subtree `AGENTS.md` for the area, and [testing.md](../../../docs/testing.md).
- Treat the designs architecture.md maps as settled: the three runtimes, the storage backends behind shared store traits, the provider adapters, the wire contract in `proto/lemma/v1`. Decisions and their rationale live in commit bodies; read `git log` on the files involved before calling a shape accidental. Surface a candidate that contradicts a settled design only when the friction is real enough to reopen it, and mark it as such.

## 2. Explore

Spawn a subagent with a fresh context to walk the scoped code. Explore organically and note friction instead of following a checklist:

- Where does understanding one concept require bouncing between many small modules?
- Where is a module shallow, its interface nearly as complex as its implementation?
- Where does the same business logic live in several callers that each re-derive it, such as the same mapping in a store and a component, or parallel handlers across RPC crates?
- Where were pure functions extracted only for testability while the real bugs hide in how they are called (no locality)?
- Where do tightly coupled modules leak across their seams?
- Which parts are untested, or hard to test through their current interface?

Apply the deletion test to every suspect: would deleting the module concentrate complexity, or just move it? "Concentrates" is the signal. Classify each candidate's dependencies with [references/deepening.md](references/deepening.md); the category decides how the deepened module is tested.

## 3. Report

Render the candidates as a self-contained HTML file in the OS temp directory, following [references/html-report.md](references/html-report.md). Nothing lands in the repository. Each candidate card carries files, problem, solution, wins in vocabulary terms, a before/after diagram, a dependency category, and a strength: `Strong`, `Worth exploring`, or `Speculative`. End with the top recommendation.

Do not propose interfaces yet. After writing the file, give the user its absolute path and ask which candidate to explore.

## 4. Grill

Once the user picks a candidate, walk its decision tree with [grill-me](../grill-me/SKILL.md): constraints, dependencies, the shape of the deepened module, what sits behind the seam, which tests survive. To compare alternative interfaces, follow [references/design-it-twice.md](references/design-it-twice.md).

Place decisions as they settle, after the user approves each write:

- A new domain term the deepened module is named after goes into `docs/glossary.md` and its Chinese pair through [lemma-translate-docs](../lemma-translate-docs/SKILL.md).
- A rejection with a reason a future review would need belongs in architecture.md when it constrains a design, or in the commit body of the change that settles it.
- A candidate the user accepts but defers becomes a GitHub issue, never a `TODO` in code.

## Implementing

Implementation is a separate request. Before the first edit, write the plan in the conversation from the grilled decisions: the modules merged or moved, the interface as agreed, the call sites migrated, the tests deleted and the tests written at the new interface, and the check for each step.

Then replace the shallow modules' tests with tests at the new interface (see [references/deepening.md](references/deepening.md#testing-replace-dont-layer)), update affected docs and doc comments in the same change, and select checks through [lemma-pre-push-checks](../lemma-pre-push-checks/SKILL.md).

When done, pass the diff, the plan, and the checks you ran to a reviewer with a fresh context that edits nothing: a subagent when the environment provides one, otherwise a separate pass that only reads. The reviewer checks:

- the interface matches the agreed one, and behavior changed only where the user agreed;
- every caller moved to the new interface, and no pass-through module or old entry point remains;
- the absorbed modules' tests are gone and the new tests cross the interface without reaching past it;
- docs, doc comments, and `docs/glossary.md` reflect the new module;
- each check claimed was actually run.

The reviewer returns approval or required follow-ups. Follow-ups go back to a writing pass; the pass that wrote a change never approves it.
