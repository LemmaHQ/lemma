---
name: lemma-code-simplification
description: Use after Lemma code is written or changed and works but reads heavier than it should — deep nesting, wrappers that only forward, redundant checks or assertions, vague names, repeated conditions — to simplify the recently changed code without changing behavior.
---

# Simplifying Lemma code

Simplify working code so it is faster to understand, without changing what it does. The goal is comprehension, not fewer lines. Adapted from `code-simplification` in [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) (MIT); the plan and review steps from `ai-slop-cleaner` in [Yeachan-Heo/oh-my-claudecode](https://github.com/Yeachan-Heo/oh-my-claudecode) (MIT).

The default scope is the code changed in the current task or branch (`git diff` against the base). Widen it only when the user names a file or area. Whole-repository measured cleanup belongs to [lemma-codebase-refactoring](../lemma-codebase-refactoring/SKILL.md), restructuring across modules to [lemma-improve-architecture](../lemma-improve-architecture/SKILL.md), and removing unused features to [lemma-find-simplifications](../lemma-find-simplifications/SKILL.md).

## Principles

- **Preserve behavior exactly.** Same output for every input, same errors, same side effects and ordering. If you cannot establish that a change preserves behavior, skip it.
- **Follow Lemma conventions, not outside preferences.** [lemma-code-style](../lemma-code-style/SKILL.md) and the subtree `AGENTS.md` decide naming, layout, and idioms; neighboring code decides the rest. A change that breaks consistency is churn.
- **Clarity over cleverness.** A five-line `if` chain beats a one-line nested ternary. Fewer lines is never the measure.
- **Keep names that carry concepts.** Inlining a helper whose name explains a step makes the call site harder to read.
- **Never simplify away a safety check**: validation at a trust boundary, authorization, error propagation, cancellation, or a guard against data loss.

## Process

### 1. Understand before touching

For each block, answer: what is its responsibility, what calls it and what does it call, which tests define its behavior, and why might it be written this way? Run `git log` or `git blame` on it; Lemma records design rationale in commit bodies. If you cannot answer, read more before changing anything.

### 2. Find opportunities

Look for deep nesting, multi-responsibility functions, boolean flags, forwarding wrappers, single-implementation abstractions, redundant checks or conversions, generic names, and leftover dead code. Real before-and-after cases from the repository are in [references/examples.md](references/examples.md). React components and effects follow [lemma-react-components](../lemma-react-components/SKILL.md) and [lemma-react-effects](../lemma-react-effects/SKILL.md).

### 3. Plan before editing

Write the plan in the conversation before the first edit: each simplification with its file and lines, ordered from safe deletions to riskier consolidations, and the check that verifies it. When no test covers a behavior a step touches, state how you will verify it instead. A simplification found later gets a plan entry before it is applied.

### 4. Apply one change at a time

Make one simplification, then run the narrowest check that covers it, chosen through [lemma-pre-push-checks](../lemma-pre-push-checks/SKILL.md). Green: continue. Red: revert that change and reconsider; do not debug a failed simplification forward. A change touching hundreds of similar sites goes through a codemod (`xd://ast_edit`) instead of hand edits. Keep simplification separate from feature or bug-fix work; commit only when the user asks, per [lemma-commit](../lemma-commit/SKILL.md).

### 5. Hand off to a read-only review

Compare before and after yourself first and revert anything that is not genuinely clearer. Then hand the diff, plan, and executed checks to a fresh read-only pass (a subagent when available) to verify that every planned step preserved behavior without modifying tests, weakening guards, or leaving orphaned code, and route any follow-up back to a writing pass.

## Red flags

- A test had to change for the simplification to pass: behavior probably changed.
- The "simplified" code is longer or harder to follow than the original.
- Names changed to personal preference rather than Lemma conventions.
- Error handling or a guard was removed because it "looked noisy".
- Code outside the scope was changed without the user asking.

## Done when

- Existing tests pass unmodified, and the checks for the touched area pass with no new warnings.
- No error handling, validation, or cancellation path was weakened.
- Nothing the change orphaned remains: imports, helpers, branches.
- Each simplification is a reviewable step with no unrelated edits mixed in.
