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

| Signal | Simplification |
| --- | --- |
| Nesting three or more levels deep | Guard clauses and early returns; in Rust `?` and `let ... else` |
| A function over about 50 lines doing several things | One function per responsibility, named for what it does |
| Nested ternaries | `if` chain, `switch` on a union, or `match` |
| Boolean flag parameters (`load(true, false)`) | Separate functions or an enum |
| The same condition in several places | One named predicate |
| A wrapper that only forwards a call | Call the target directly |
| A trait, interface, or factory with one implementation and no second one coming | The concrete type |
| A check for a state the types or callers already exclude | Delete the check |
| A redundant assertion or conversion (`as`, `!!`, `.clone()` where a borrow works) | Remove it, or fix the type |
| Generic names (`data`, `result`, `item`, `tmp`) | Name the content |
| A comment that restates the code | Delete it; Lemma code carries no comments by default |
| Unused imports, variables, unreachable branches left by the change | Delete them |
| Hand-written loops building a collection | `filter`, `map`, iterator adaptors, when the result reads clearer |

Real before-and-after cases from the repository are in [references/examples.md](references/examples.md). React components and effects follow [lemma-react-components](../lemma-react-components/SKILL.md) and [lemma-react-effects](../lemma-react-effects/SKILL.md).

### 3. Plan before editing

Write the plan in the conversation before the first edit: each simplification with its file and lines, ordered from safe deletions to riskier consolidations, and the check that verifies it. When no test covers a behavior a step touches, state how you will verify it instead. A simplification found later gets a plan entry before it is applied.

### 4. Apply one change at a time

Make one simplification, then run the narrowest check that covers it, chosen through [lemma-pre-push-checks](../lemma-pre-push-checks/SKILL.md). Green: continue. Red: revert that change and reconsider; do not debug a failed simplification forward. A change touching hundreds of similar sites goes through a codemod (`xd://ast_edit`) instead of hand edits. Keep simplification separate from feature or bug-fix work; commit only when the user asks, per [lemma-commit](../lemma-commit/SKILL.md).

### 5. Hand off to a read-only review

Compare before and after yourself first: is the result genuinely easier to follow, consistent with neighboring code, and a clean diff? If not, revert it.

Then pass the diff, the plan, and the checks you ran to a reviewer with a fresh context that edits nothing: a subagent when the environment provides one, otherwise a separate pass that only reads. The reviewer checks:

- every planned step was applied or explicitly dropped, and nothing outside the plan changed;
- behavior is unchanged: no test was modified, and no error handling, validation, or cancellation path was weakened;
- nothing the change orphaned remains: imports, helpers, branches;
- each check claimed was actually run and covers the touched code.

The reviewer returns approval or required follow-ups. Follow-ups go back to a writing pass; the pass that wrote a change never approves it.

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
