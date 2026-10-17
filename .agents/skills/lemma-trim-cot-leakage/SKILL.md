---
name: lemma-trim-cot-leakage
description: Use when auditing or fixing prose in Lemma that reads like a leaked reasoning transcript — dead design-session citations such as (decision N), audit item codes (B4, F2), or step labels; change narration such as "used to", "no longer", "now"; commit or review vantage ("this commit", "the previous change"); justifications addressed to a reviewer; control-flow narration; or hedged planning residue in code comments, doc comments, docs, skills, or commit messages.
---

# Trimming chain-of-thought leakage

Chain-of-thought leakage is prose whose vantage is the authoring session rather than the repository: it cites artifacts only that session could see, narrates the change instead of the state, or argues with a reviewer who has left. The fix is never deletion alone when a passage carries factual clauses: restate each so it stands at HEAD, then delete the transcript around it. A passage carrying none, such as an audit code or control-flow narration, is deleted outright. [lemma-prose-standard](../lemma-prose-standard/SKILL.md) owns the complete-proposition rule this skill applies. This skill is guidance, not a script.

## The one test

For every suspect passage ask: **could a reader at HEAD, with no access to any session transcript, conversation, or uncommitted draft, resolve every reference and verify every claim?** If no, restate the surviving facts from the repository's vantage and delete the rest. If yes, it is not leakage, however historical it sounds. Resolvability only clears this skill's bar: on current-state surfaces (docs, READMEs, doc comments) a resolvable change story is still change narration, and class 3 routes it to the commit message.

## Taxonomy

1. **Dead design-session citations:** `(decision 5)`, `(audit B6)`, `F3`, "step 4", "per the plan", "as agreed". If the decision has a committed owner, cite it by name and path; otherwise delete the citation and restate its factual clause to stand alone.
2. **Commit and review vantage:** "this commit adds", "the previous change", "a follow-up commit". State the shipped mechanism; deferred work becomes a GitHub issue, never a `TODO` or `FIXME` marker ([conventions](../../../AGENTS.md#conventions)).
3. **Change narration and version stamps:** "used to", "no longer", "the old X", "was renamed", and indexical stamps ("v1", "for now", "currently", "now" contrasting with a past state). State the present behavior; a fixed regression becomes a present-tense counterfactual ("without X, Y happens"), never repository history. The change story belongs in the commit body.
4. **Review choreography:** "rejected in review", "the user decided", draft ordinals, round attributions. Keep the surviving decision and rationale as plain fact; delete who said it when.
5. **Reviewer-addressed justification:** "the cast is safe — it simply…", "this is correct because…". A comment arguing its own correctness addresses a reviewer, not a maintainer. Encode the invariant in a name or type, state it in the doc comment when it is a caller contract, or delete the comment if the code shows it.
6. **Restatement and derivation transcripts:** control-flow narration ("first we X, then we Y"), test walkthroughs, proofs of obvious branches. Delete; keep only a non-obvious contract.
7. **Hedges and planning residue:** "probably fine for now", "should be enough", "we may want to". Restate as the actual bound or open an issue; delete the hedge.
8. **Authoring-language slips:** Chinese working fragments in English prose, or English fragments that are not listed terms in a Chinese counterpart. Translate per [terminology.md](../../../docs/i18n/terminology.md) or delete.

## What is not leakage

- **Issue references:** `#123` or "issue #123 tracks the reconnect gap" resolve at HEAD; keep them on any surface.
- **Commit message bodies:** the commit body is the sanctioned home for change history, alternatives, and decisions. Classes 1, 4, 5, and 8 still apply there; classes 2 and 3 do not.
- **Suppression reasons:** an `eslint-disable … -- reason`, `#[allow(…)]` with its justification, or a `// SAFETY:` proof is required prose; fix a false reason, never delete it.
- **Counterfactual-present regression pins:** "without X, Y happens", "a naive X would…".
- **Measured bounds:** "(measured: …)" calibrating a constant; the word "measured" is load-bearing.
- **Runtime old and new states:** "each refresh revokes the old token and issues a new pair" is runtime lifecycle, not change history.
- **External references:** standards sections (RFC 9110 §15.5), upstream style-guide sections, vendor API docs.
- **Project voice:** "we" as project voice.

## Recall probes

Run these as case-insensitive regex searches over the scope, then judge every hit semantically. Calibrate each probe against one known positive and one near-miss before trusting its output; the probes find candidates, not the definition, so also read the densest prose in scope without a pattern in hand.

| Class | Pattern |
| --- | --- |
| 1 | `\((decision\|audit\|step\|phase)\s*\w+\)`, `\b[A-F][0-9]{1,2}\b` |
| 2 | `this (commit\|change\|pr\|patch)`, `(previous\|next\|later\|follow-up) (commit\|change)` |
| 3 | `used to\|no longer\|was renamed\|the old \|for now\|currently\|\bv[0-9]\b` |
| 4 | `in review\|reviewer\|user (asked\|decided\|said)` |
| 5 | `is safe because\|this is correct\|simply\|just works` |
| 6 | `first,? (we\|it\|the)\|then (we\|it)\|which is why` |
| 7 | `probably\|should be (enough\|fine)\|might want\|TODO\|FIXME\|XXX\|HACK` |
| 8 | `\p{Han}` in English files; long ASCII runs in `.zh.md` files outside code |

## Workflow

1. Scope and exclusions per [lemma-prose-standard](../lemma-prose-standard/SKILL.md#inputs-and-exclusions): require an explicit scope; never edit generated output or the upstream style guides.
2. Audit read-only first: run the recall probes, judge every hit, and read the densest prose in scope directly.
3. Fix owner-first per surface: generated outputs → fix the owning source and regenerate ([lemma-prose-standard](../lemma-prose-standard/SKILL.md#inputs-and-exclusions)); bilingual prose → update the counterpart minimally and re-record with `just docs-pairing --write <file>`; model-visible tool descriptions and UI strings → route through [lemma-prose-standard](../lemma-prose-standard/SKILL.md) and change only with owning behavior evidence, otherwise leave unchanged and report the deferral.
4. Before deleting anything, enumerate the passage's propositions and check the overcorrection traps: a trim that flips an obligation into an endorsement, promotes a hypothetical to a shipped feature, deletes a true fact, or drops the evidence source.
5. Verify: re-run the probes expecting only sanctioned keeps and this skill's own file; confirm every remaining citation resolves at HEAD; run the checks for touched surfaces (`just docs-pairing`, the crate's clippy for doc comments, `git diff --check`).
