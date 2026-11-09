---
name: lemma-codebase-refactoring
description: Use when cleaning up accumulated code in Lemma with measured passes — merging copy-pasted, renamed, or near-miss duplicates found by jscpd, removing dead code found by knip and the Rust compiler, and simplifying the most complex files — then re-measuring to confirm each pass reduced what it targeted.
---

# Lemma codebase refactoring

A measured cleanup of the three biggest maintenance costs in code that stays: duplicated code, dead code, and complexity. Tools find the candidates; you verify and edit them. Adapted from `dry-refactoring`, `codebase-refactoring`, and `jscpd` in [kucherenko/jscpd](https://github.com/kucherenko/jscpd) (MIT); the plan and review steps from `ai-slop-cleaner` in [Yeachan-Heo/oh-my-claudecode](https://github.com/Yeachan-Heo/oh-my-claudecode) (MIT).

Neighboring skills own the rest: [lemma-improve-architecture](../lemma-improve-architecture/SKILL.md) restructures modules across seams, and [lemma-find-simplifications](../lemma-find-simplifications/SKILL.md) removes features, fields, and configuration nobody consumes. A duplicate that is really a shallow module, or dead code that is a declared but unused capability, goes to them.

## Tools

- **jscpd** (`jscpd` in the root `package.json`, configured by `.jscpd.json`): clones, complexity, and the health score. Run it from the repository root so `.jscpd.json` applies; `just dup-check` is the default exact run, and a positional path narrows any run. Options and output format: [references/jscpd.md](references/jscpd.md).
- **knip** (`just deadcode-check`, configured by `knip.json`): unused TypeScript files, exports, and dependencies across the npm workspaces.
- **The Rust compiler**: `cargo check --message-format=json` diagnostics, fed to jscpd with `--rust-diagnostics -`. Compiling Rust needs the user's consent, per [lemma-pre-push-checks](../lemma-pre-push-checks/SKILL.md).

No tool here finds dead Kotlin code in `mobile/`; search it by hand or leave it out of the pass and say so.

## Measure, then prioritize

```sh
npx --no-install jscpd --health --reporters ai --no-tips
```

Read only the duplication and complexity sub-scores. The dead-code sub-score is unreliable in Lemma: jscpd infers entry points from `package.json`, so it reports the scripts run by `node` and every file they import as unused. knip has the configured entries; use it for that dimension.

The lowest trustworthy dimension goes first. Otherwise the default order is duplication, then dead code, then complexity: merging clones first moves the call sites dead-code tracing would follow, and removing dead code first keeps the complexity ranking on files worth simplifying.

## Plan

Before the first edit of a pass, write its plan in the conversation: the candidates to change with their locations and the flags that found them, the candidates already skipped with the reason, the order from safest deletion to riskiest consolidation, and the check that verifies each step. Where no test covers a behavior a step touches, state how you will verify it instead. A candidate found mid-pass gets a plan entry before it is changed.

## Passes

Run one pass at a time; each has its own workflow, triage rules, and acceptance check:

1. **Duplication**: [references/duplication.md](references/duplication.md). Exact clones first, then renamed, then near-miss, each with the flags that found it.
2. **Dead code**: [references/dead-code.md](references/dead-code.md). knip for TypeScript, compiler diagnostics for Rust, confirmed by a repository-wide search before every deletion.
3. **Complexity**: [references/complexity.md](references/complexity.md). The top files by `cx`, each simplified along the driver you name.

A finding of one kind met during another pass waits for its own pass, so each change stays attributable to one reason.

## Lemma rules for every edit

- Behavior stays identical. A pass that would change observable behavior stops and becomes a question for the user.
- Shared code lands where [lemma-code-style](../lemma-code-style/SKILL.md#source-files) places it, never in a new catch-all `utils` module; every source file stays within 300 lines, and `just source-check` enforces the machine-checkable part.
- Update every call site, not only the pair a tool reported, and remove the imports and helpers the change orphans.
- Tests follow [testing.md](../../../docs/testing.md): an extracted function is covered through the callers' existing tests unless its edge cases need their own; web and packages still require 100% coverage.
- Update affected READMEs and doc comments in the same change, and select checks through [lemma-pre-push-checks](../lemma-pre-push-checks/SKILL.md).

## Review each pass

When a pass is done, pass its diff, plan, tool output before and after, and the checks you ran to a reviewer with a fresh context that edits nothing: a subagent when the environment provides one, otherwise a separate pass that only reads. The reviewer checks:

- every planned candidate was applied or explicitly skipped with a reason, and nothing outside the pass's kind changed;
- behavior is unchanged: no test was modified except tests that only covered deleted code, and no error handling, validation, or cancellation path was weakened;
- no leftovers: orphaned imports, helpers, exports, or files, and call sites the tool did not report but the change should have covered;
- consolidations have precise names and placement by lemma-code-style, and no duplicate the pass targeted was left half-merged;
- the re-run uses the same flags as the first run and its numbers match the report.

The reviewer returns approval or required follow-ups. Follow-ups go back to a writing pass; the pass that wrote a change never approves it.

## Confirm and report

Re-run `--health` and the pass's own command with the same flags as the first run. A dimension that got worse sends you back to that pass. Health scores compare only when built from the same dimensions and file set; say so when they differ.

Report per pass: what changed, the before and after numbers with the flags that produced them, and the candidates skipped with the reason. Each pass is a separate commit when the user asks for commits, per [lemma-commit](../lemma-commit/SKILL.md).
