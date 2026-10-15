# AGENTS.md — The documentation standard

English | [中文](AGENTS.zh.md)

This file defines document structure, Markdown tiers, writing rules, and word budgets for Lemma. Use `.agents/skills/lemma-doc/SKILL.md` for placement and validation, and `.agents/skills/lemma-prose-standard/SKILL.md` for required coverage and editorial judgment. The [bilingual contract](i18n/README.md) defines how English and Chinese pairs are maintained.

## Document structure

These rules apply to human-facing documentation; Agent Notes (`.agents/notes/README.md`) remain outside their scope. A postmortem is an incident-scoped reference; chronology records evidence, not a teaching sequence. A document's subject and tree position fix its scope: describe its own subject at appropriate detail and direct children only by purpose, responsibility, and high-level behavior; link to the owning descendant for lower-level detail. Document type does not widen that scope. A reference may be exhaustive only about its own subject. Testing mechanisms, fixtures, and harnesses belong at the lowest owning level; higher documents link there.

Classify every in-scope document as a tutorial or reference. Tutorials follow an ordered path to an outcome and introduce only what each step needs. References define a lookup scope and current behavior without a teaching sequence. Separate substantial tutorial and reference content; label a section when either part is small.

Before writing a tutorial, privately classify the reader's starting knowledge and each concept as beginner, intermediate, or advanced. Establish prerequisites before dependent concepts, increase difficulty gradually, and move unnecessary advanced material to a later tutorial or reference.

Author in this order: locate the document in the tree; set its permitted detail; choose tutorial or reference; for a tutorial, order concepts by prerequisite and difficulty; relocate descendant-owned detail; replace lower-level explanations with links to their owners.

## The tier taxonomy: one home per fact

Each fact has one home: the tier whose job it is; elsewhere, link there.

| Tier | Job | Does NOT belong there |
| --- | --- | --- |
| Root `AGENTS.md` | Standing orders: rules an agent needs in context in every session, one to three lines each, linking its home | Stories, worked examples, situational procedures, anything restated from a linked home |
| Subtree `AGENTS.md` (`crates/`, `web/`, `desktop/`, `mobile/`, `proto/`, `docs/`, `.agents/notes/`) | Orders specific to that subtree | Repo-wide rules the root file already carries |
| `architecture.md` | Ordered map: crate layers, server and local modes, the path of one turn, extension points; read before changing `crates/` | Type definitions (→ subsystems), per-crate detail (→ crate READMEs), decision rationale (→ Agent Notes), implementation-status annotations |
| `subsystems/` | One reference page per subsystem: type definitions, semantics, invariants | Behavior narration across subsystems (→ architecture.md) |
| Agent Notes (`.agents/notes/`) | Active decision records: the why, what-was-given-up, and required verification; `implemented/` notes describe shipped reality in present tense | Migration plans, acceptance-task checklists, fixture walkthroughs, and spec-speak ("should…") once the decision has shipped; archived notes are frozen history, never current authority |
| `defensive-patterns/` | Rules this repository enforces in review, split by artifact: one general bug-class page plus per-domain pages | Type definitions and semantics (→ subsystems), decision rationale (→ Agent Notes) |
| `postmortems/` | Incident stories — the only tier where war-story narrative belongs | — |
| `cookbook/` | Step-by-step how-tos with numbered verify steps | Design rationale (→ the Agent Note each guide links) |
| Crate and package README | The per-crate contract: config, semantics, limitations, extension points | Doc-comment restatement, other crates' concerns |
| `development.md` | Contributor setup, daily workflow, and a summary of CI | Runtime/version rationale (→ Agent Notes), check-by-check lists that drift from the `justfile` |
| `DESIGN.md` | Design tokens and the visual system; source of the generated `tokens.css` | Component behavior (→ subsystems) |
| Skills (`.agents/skills/`) | Reusable workflows and specialized decision standards, including per-language code style | Product and runtime contracts (→ docs or source) |

Placement: bugs → postmortems; rationale → Agent Notes; procedures → cookbook; type definitions → subsystems; crate contracts → READMEs; code style → skills; standing orders → root `AGENTS.md` with a rationale link; review-enforced rules → `defensive-patterns/`.

## Writing rules

- **Document current state.** Keep history in commits, PRs, Agent Notes, or postmortems. Other prose names live mechanisms, not changes or stack positions.
- **Apply the Agent Note creation criteria.** Mechanical/local edits are exempt, including local UI changes; keep existing owning notes accurate.
- **One physical line per paragraph**: use editor soft-wrap. Code blocks, tables, and list structure keep their formatting.
- **The owning subsystems page updates in the same change** that reshapes a documented type.
- **Pairs update together**: a change to either language updates its counterpart in the same commit ([bilingual contract](i18n/README.md)).
- **Doc comments state complete contracts, not reasoning transcripts.** `//!`, `///`, JSDoc, and KDoc preserve behavior, failure, timing, ownership, and consequences; delete narration, test walkthroughs, review analysis, and code restatement. Keep the local contract and link its rationale. Use `.agents/skills/lemma-prose-standard/SKILL.md` for details.
- **Write directly**: name actors and facts. Name the exact check, type, API, operation, or behavior instead of metaphorical "gate", "vocabulary", or "surface".

## Wordcount budgets

Targets: root `AGENTS.md` ≤ 1,500; this file ≤ 1,200; other subtree `AGENTS.md` ≤ 500; `architecture.md` ≤ 2,400. Budgets count words in the English file. Review governs unbudgeted tiers.

When a document exceeds its budget:

1. **Relocate** content that belongs in another tier; leave a one-line link if needed.
2. **Condense** content that belongs here but can be shorter.
3. **Raise** the budget only when the words need the space; justify it in the PR. A too-low budget is a budget bug.

Budgets are guardrails, not reduction targets.

## The slop checklist

Hunt these in any doc; `.agents/skills/lemma-doc/SKILL.md` runs this list as an audit:

- Duplicated rules: search a distinctive phrase; keep one home and link the rest.
- History outside its permitted tier: state current facts and link the historical owner.
- Implementation-status annotations in prose or diagrams ("implemented!", "future: …"). Status rots; issues and the project board carry it.
- Hand-restated catalogs, doc comments, or inventories of tests, crates, and status when source or a generator is authoritative.
- Reasoning transcripts: step-by-step implementation narration, proof of obvious branches, test walkthroughs, or rejected local alternatives. Keep the resulting contract or durable rationale; delete the path used to derive it.
- Rationale repeated beside sibling functions instead of once at the owning capability or helper.
- Paragraph walls: one paragraph carrying several rules and parenthetical asides. Split it or demote the detail to its home.
- Emphasis inflation: bold, CAPS, or "critically" everywhere means nothing stands out. Reserve emphasis for the clause that changes behavior.
- Spec-speak in `implemented/` Agent Notes: "should", migration plans, acceptance checklists. An implemented Agent Note describes what is.

## Repository references

Use relative Markdown links for current files and code-formatted paths for planned ones. When a planned file lands, search the repository for its path and convert every code-formatted reference into a link in the same change. Historical references use tags or PR numbers, never commit identifiers.
