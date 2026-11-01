# jscpd reference

The options and output the passes use, for jscpd 5.4. `npx --no-install jscpd --help` lists every option.

## AI reporter output

```text
Clones:
src/ foo.ts:10-25 ~ bar.ts:42-57
src/cart/ basket.ts:1-9 ~ cart.ts:1-9 (renamed)
src/api/ save-account.ts:1-12 ~ save-user.ts:1-11 [~0.91 gap]
src/billing/ orders.ts:1-14 ~ refunds.ts:1-15 [~0.85 ast]
---
5 clones · 4.2% duplication
```

A shared path prefix is printed once. No suffix means an exact copy; `(renamed)` differs only in names, literals, or annotations; `[~N gap]` is two exact clones merged across unmatched lines, N being matched tokens over the span; `[~N ast]` is two functions whose normalized syntax trees share N of their subtrees.

## Options

| Option | Effect |
| --- | --- |
| `--reporters ai` | Compact clone list for agents; `json` writes a parseable report |
| `--no-tips` | No tips in the output |
| `--min-tokens N` / `--min-lines N` | Smallest clone reported; `.jscpd.json` sets 70 and 8 |
| `--format "list"` | Only these languages, such as `typescript,rust,kotlin` |
| `--ignore-identifiers` | Names match any name, one-to-one (renamed clones) |
| `--ignore-literals` | Strings match strings and numbers match numbers (renamed clones) |
| `--ignore-annotations` | Drop `@Name` annotations before matching, in Kotlin and TypeScript |
| `--max-gap-lines N` | Merge exact clones separated by at most N unmatched lines (gap clones) |
| `--similarity [RATIO]` | Pair functions sharing at least RATIO of their normalized subtrees, 0.8 by default (ast clones); TypeScript, Rust, Kotlin, and more, test files excluded |
| `--min-nodes N` | Smallest function tree `--similarity` compares, 20 by default |
| `--kind list` | Report only `exact`, `renamed`, `similar`, `gap`, or `ast`; never enables a detector |
| `--summary` | Append top files and folders by tokens, lines, size, `cx`, and `dup%` |
| `--summary-by metric` / `--summary-top N` | Rank the summary by `tokens`, `lines`, `size`, or `complexity`; list length, 10 by default |
| `--complexity` | Complexity tables only, without clone detection |
| `--health` | One 0-100 score with a grade from duplication, dead code, and complexity |
| `--dashboard` | One screen with the score, size, duplication, complexity, and dead code |
| `--dead-code` | Unused files, exports, symbols, and imports; with `--rust-diagnostics -`, Rust compiler warnings from stdin |

## Noise in normalized runs

Renamed and similar runs ignore the things that often make two blocks differ in meaning, so every hit is a lead to read. Expect false positives from intended boilerplate, generated code, language idioms such as two `match` blocks with unrelated logic, and short blocks, which become mostly placeholders under `--ignore-identifiers`. Start tight (`--ignore-identifiers` alone, `--max-gap-lines` 1 or 2, `--similarity` 0.85 or higher) and widen only when the tight run is empty. Normalized runs fingerprint clones differently from exact runs; gate CI on the exact run only.
