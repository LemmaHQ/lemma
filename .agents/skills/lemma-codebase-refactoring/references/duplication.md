# Duplication pass

Eliminate copy-paste duplication found by jscpd. Option details are in [jscpd.md](jscpd.md).

## Detect

Exact clones first; an exact clone is almost always a real copy:

```sh
npx --no-install jscpd --reporters ai --summary --no-tips
```

`.jscpd.json` already excludes tests, JSON, TOML, XML, and Markdown, and sets `minTokens` 70 and `minLines` 8. Two later passes find copies edited after pasting. They ignore names, values, or a few statements on purpose, so they also surface blocks that merely look alike; run them one family at a time, after the exact clones are handled, and treat their hits as leads:

```sh
npx --no-install jscpd --reporters ai --no-tips --ignore-identifiers --min-tokens 90
npx --no-install jscpd --reporters ai --no-tips --max-gap-lines 1 --similarity 0.85
```

`--similarity` covers TypeScript, Rust, and Kotlin.

## Workflow

1. Start from the summary: a large file with a high `dup%` pays back first.
2. Parse each clone line into its two locations and its kind: no suffix is exact, `(renamed)` differs only in names or values, `[~N gap]` has a few edited lines, `[~N ast]` is a function pair with the same structure.
3. Read both ranges, not whole files, and for renamed and similar clones list exactly what differs.
4. **Triage before touching.** Skip the pair, and record why, when any of these holds:
    - the sides do different things despite the same shape, such as a `match` over different enums;
    - the sameness is intended: proto-to-domain mappings, SeaORM entities and migrations, provider adapters that each speak one vendor dialect, the per-feature store shape in `web/src/features/*/store.ts`, route or RPC registration;
    - the code is generated: `web/src/gen`, proto and UniFFI bindings, `LemmaPalette`;
    - the shared abstraction would need a vague name like `processData`;
    - the pair is under about 10 lines.
5. Design the refactoring from the clone kind (below), apply it to every usage, and remove what it orphans.
6. Re-run jscpd **with the same flags** and confirm the clone is gone and the touched files' `dup%` fell. A `(renamed)` clone does not show in a default run; re-check it with `--ignore-identifiers`.
7. Continue highest impact first: exact, renamed, similar.

## Strategies

- **Extract function**: the duplicate is a block of logic. Name it for what it does.
- **Extract module**: the duplicate spans files in different features. Place the module by lemma-code-style; a clone across crates belongs in the crate both already depend on, never in a new crate made for it.
- **Extract constant**: the duplicate is repeated data. A `(renamed)` clone whose only difference is a literal is a missing constant, not a missing function.
- **Parameterize**: for `(renamed)` clones, the same algorithm over other names or values; what differed becomes a parameter.
- **Unify near-miss copies**: for `[~N gap]` clones, the unmatched lines are where the copies diverged, typically a guard, a log call, or an extra field. Extract the common body and pass the divergence in, or move the extra line to the caller. If the gap changes meaning rather than adding a step, keep two functions and extract the shared halves.
- **Merge similar functions**: for `[~N ast]` clones, diff the two functions first. Extract the shared skeleton and inject what differs as arguments or a closure. Below about `0.8` the pair usually shares an idiom, not an implementation; leave it unless the summary marks the file a hotspot.

Many `(renamed)` clones in one file usually mean one missing abstraction; look for the shared shape before extracting pair by pair.

## Report

Refactored clones with before and after `dup%`, and skipped candidates with the reason, so nobody reads a normalized run's count as real duplication. Never state a clone count without the flags that produced it.
