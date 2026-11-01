# Complexity pass

Simplify the files that are hardest to follow.

## Detect

```sh
npx --no-install jscpd --complexity --reporters ai --summary-top 10 --no-tips
npx --no-install jscpd --reporters ai --summary --summary-by complexity --no-tips
```

`cx` is a cyclomatic-complexity estimate: roughly one path per function plus one per branch (`if`, loops, `&&` and `||`, `match` arms). Read it as a ranking signal, not an exact metric. jscpd's health score counts a file at 50 or above as complex, a reasonable cutoff for "worth reading". A large file with low `cx` is a size problem, not a complexity problem, and a file near the 300-line limit may need a split for that reason alone.

## Workflow

1. Take the top files by `cx`, and from the summary by size.
2. Read each file and name the actual driver: deep nesting, a long function doing several unrelated things, a large branch over a fixed set of cases, or a file that is several modules glued together.
3. Pick the matching change:
    - **Deep nesting**: guard clauses and early returns; in Rust, `?` and `let ... else`. Lemma code keeps braces on every `if`.
    - **Long function with several responsibilities**: extract one function per responsibility, named for what it does.
    - **Branching over a fixed set of cases**: an exhaustive `match` over an enum, or a lookup table; a `switch` on a TypeScript union with an exhaustiveness check.
    - **File doing too much**: split along its seams into files named by lemma-code-style, not at an arbitrary line count.
4. Keep behavior identical; this is a complexity pass, not a rewrite. A clone or dead branch met here waits for its own pass.
5. Re-run `--complexity` on the touched files and confirm `cx` per function dropped. A split that only moves branches between files renamed the problem without fixing it.
