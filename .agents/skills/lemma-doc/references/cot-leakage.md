# Trimming chain-of-thought leakage

Chain-of-thought leakage is prose whose vantage is the authoring session rather than the repository: it cites artifacts only that session could see, narrates the change instead of the state, or argues with a reviewer who has left. When a suspect passage carries factual clauses, restate each so it stands at HEAD, then delete the transcript around it; delete passages carrying none outright.

## The one test

Ask for every suspect passage: **could a reader at HEAD, with no access to any session transcript, conversation, or uncommitted draft, resolve every reference and verify every claim?** If no, restate the surviving facts from the repository's vantage and delete the rest. Even when resolvable, change narration on current-state surfaces (docs, READMEs, doc comments) belongs in the commit body instead.

## Taxonomy

1. **Dead design-session citations:** `(decision 5)`, `(audit B6)`, `F3`, "step 4", "per the plan", "as agreed". Cite a committed owner by name and path if one exists; otherwise delete the citation and restate its factual clause standalone.
2. **Commit and review vantage:** "this commit adds", "the previous change", "a follow-up commit". State the shipped mechanism; deferred work becomes a GitHub issue, never `TODO` or `FIXME`.
3. **Change narration and version stamps:** "used to", "no longer", "the old X", "was renamed", "v1", "for now", "currently", "now" contrasting with a past state. State present behavior; frame fixed regressions as present-tense counterfactuals ("without X, Y happens").
4. **Review choreography:** "rejected in review", "the user decided", round attributions. Keep the surviving decision as plain fact; delete who said it when.
5. **Reviewer-addressed justification:** "the cast is safe — it simply…", "this is correct because…". Encode the invariant in a name, type, or caller doc comment, or delete it if the code shows it.
6. **Restatement and derivation transcripts:** control-flow narration ("first we X, then we Y"), test walkthroughs, proofs of obvious branches. Delete; keep only non-obvious contracts.
7. **Hedges and planning residue:** "probably fine for now", "should be enough", "we may want to". State the actual bound or open an issue; delete the hedge.
8. **Authoring-language slips:** Chinese working fragments in English prose, or unlisted English fragments in Chinese prose. Translate per [terminology.md](../../../../docs/i18n/terminology.md) or delete.

## What is not leakage

- **Issue references:** `#123` resolves at HEAD; keep on any surface.
- **Commit message bodies:** sanctioned home for change history, alternatives, and decisions (classes 1, 4, 5, and 8 still apply; classes 2 and 3 do not).
- **Suppression reasons:** `oxlint-disable … -- reason`, `#[allow(…)]` justifications, and `// SAFETY:` proofs are required prose; fix false reasons, never delete them.
- **Counterfactual-present regression pins:** "without X, Y happens", "a naive X would…".
- **Measured bounds:** "(measured: …)" calibrating a constant.
- **Runtime old and new states:** "canceling a turn marks the streaming message interrupted" describes runtime lifecycle, not repository history.
- **External references:** RFC sections, upstream style guides, vendor API docs.
- **Project voice:** "we" as project voice.

## Recall probes

Run these case-insensitive regex searches over the scope, then judge every hit semantically. Also read the densest prose in scope directly.

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

## Procedure

1. Audit read-only first: run the recall probes, judge every hit, and read the densest prose directly.
2. Fix owner-first per surface; leave model-visible tool descriptions and UI strings unchanged unless backed by owning behavior evidence.
3. Before deleting anything, verify no trim flips an obligation into an endorsement, promotes a hypothetical to a shipped feature, deletes a true fact, or drops an evidence source.
4. Re-run the probes and the checks for touched surfaces (`just docs-pairing-check`, crate clippy, `git diff --check`).
