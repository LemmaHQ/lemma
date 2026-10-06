# COMMIT_CONVENTION.md

Discipline for git commit messages. Apply to every commit written. The Lemma Commit Standard (LCS) v1.0 — takes durable parts of established conventions, drops the parts that conflict with substance-over-style.

**Tradeoff**: bias toward signal-dense messages. For one-line fixes to typos in private branches, use judgment.

## The shape

```
<type>(<scope>): <imperative summary, ≤72 chars, no trailing period>

<why this change exists — motivation, 1-2 sentences>

<what changed at a level the diff doesn't show — invariants, alternatives>

<notes/risks/follow-ups, optional>

Refs: #123
Fixes: #789
Risk: <if destructive or migration>
```

## Subject line — `<type>(<scope>): <imperative>`

| Rule              | Detail                                                                                                                         |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `<type>`          | One of `feat fix refactor perf docs test style chore build ci revert`. Lowercase.                                              |
| `(<scope>)`       | Optional. Lowercase, kebab-case. Closest meaningful unit — file basename, module, feature area. Skip when genuinely repo-wide. |
| `:`               | Colon + single space.                                                                                                          |
| Summary           | Imperative mood (`add`, not `added`). Lowercase first letter. No trailing period.                                              |
| Length            | ≤ 72 chars total. Aim for ≤ 50. Hard limit 72 (GitHub truncation).                                                             |
| Banned in subject | Emoji, AI footers, " and " (split into two commits), past tense                                                                |

## Type taxonomy

| Type       | Use when                                                   | Triggers (semver) |
| ---------- | ---------------------------------------------------------- | ----------------- |
| `feat`     | New behavior, capability, surface visible to a user/caller | minor             |
| `fix`      | Bug fix — observable wrong behavior is now right           | patch             |
| `refactor` | Internal restructure with **no behavior change**           | none              |
| `perf`     | Performance improvement, no behavior change                | patch             |
| `docs`     | Documentation only                                         | none              |
| `test`     | Tests only                                                 | none              |
| `style`    | Formatting, whitespace, lint. **No logic change.**         | none              |
| `chore`    | Maintenance — deps, config, repo plumbing                  | none              |
| `build`    | Build system, packaging                                    | none              |
| `ci`       | CI pipeline only                                           | none              |
| `revert`   | Reverts a previous commit; body references SHA             | depends           |

## Body — optional, recommended for non-trivial changes

- Blank line after subject.
- Wrap at 72 chars (allow up to 100 for URLs / paths).
- **Lead with why.** Motivation in 1-2 sentences before describing what.
- Then _what_ changed at a level the diff doesn't show — invariants, rationale, alternatives considered.
- Then _notes/risks/follow-ups_ if any.
- 2-4 short paragraphs max. More = the change is too big for one commit.
- Don't restate the diff. Reviewers can read the diff.
- No AI flourishes, no hype, no apologies, no self-references.

## Footers — optional, machine-parseable

| Footer             | Use when                                                                                      | Example                                               |
| ------------------ | --------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `Refs`             | Related but not closed                                                                        | `Refs: #123, #456`                                    |
| `Fixes` / `Closes` | Closes an issue                                                                               | `Fixes: #789`                                         |
| `BREAKING CHANGE`  | Promotes major bump                                                                           | `BREAKING CHANGE: removed deprecated v1 client`       |
| `Risk`             | Destructive ops, migrations, perf-regression-possible. State risk + mitigation.               | `Risk: 30min lock on user_events; window coordinated` |
| `Verified`         | How verified beyond test suite — for ops/deploy/infra                                         | `Verified: 4-check deploy verify on backoffice-api`   |
| `Co-Authored-By`   | Authentic collaboration only. Never AI tool unless user explicitly requested for that commit. | `Co-Authored-By: Alex Doe <alex@example.com>`         |

## Banned

- Emoji prefixes: `🐛 fix: ...`, `🎉 feat: ...`, etc. The type-as-keyword carries the same signal.
- AI tool footers: `Generated with Claude Code`, `Co-Authored-By: Claude <noreply@anthropic.com>`. The work is yours unless you explicitly opt in.
- Marketing body language: "powerful", "stunning", "best-in-class", "winning approach". Pragmatic, fact-based.
- Bare `chore: misc` or scope-less catch-all commits.
- WIP commits on shared branches. Squash before push.

## Atomicity

- **One concern per commit.** If you can write " and " between two changes, split.
- **Tests for behavior changes ship in the same commit.** Not a follow-up.
- **Squash WIP before push.** A 6-commit branch with `wip: testing`, `wip: more`, `oops typo` should land as 1-2 clean commits.
- **Don't amend a published commit on a shared branch.** Follow up with a `style:` commit instead.
- **Merge commits stay rare.** Prefer rebase.

## Good examples

```
fix(screenshot): honor --output paths with a directory component

Bare basenames still land in the configured screenshotDir. Paths with a
separator (./foo, /abs/foo, sub/foo) are honored as written; the CLI
resolves relatives against its own cwd before sending so they don't
silently bind to the daemon's cwd.
```

```
refactor(auth): extract token-refresh into its own service

Pulled the refresh loop out of `Session.acquire()` so the same logic
covers the worker pool and the CLI. No behavior change; the worker
inherits the same retry/backoff that the CLI had.

Refs: #412
```

```
feat(orders): add bulk-cancel endpoint

Front-of-house wanted to cancel up to 500 orders in one call after a
warehouse mis-pick. The endpoint takes a list of order IDs and a
required reason code; cancellation is best-effort with a per-ID result
list, not transactional.

Risk: bad reason code or partial failure can leave orders mixed.
Mitigation: response includes per-ID outcome; dashboard surfaces partial
failures; worker requeues retryable IDs.

Refs: #1820
```

## Bad examples

```
🐛 fix: small fix to screenshot 🚀

Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>

This is a great improvement that makes the tool way better!
```

_Banned: emoji, AI footer, hype, no scope, no why, no what._

```
update files
```

_No type, no scope, no signal, no description._

```
feat(api): add login endpoint and refactor auth and update docs
```

_Two " and " in subject = three commits hiding as one._

```
fix: corrected the issue where the user was unable to login
```

_Too long, past tense ("corrected" not "fix"), restates the diff._

## Pre-commit checklist

1. **Subject ≤ 72?** Aim for 50.
2. **Imperative mood?** "add", not "added" or "adds".
3. **Lowercase first letter, no trailing period?**
4. **Type chosen deliberately?** Not `chore` because you're lazy.
5. **Scope present and meaningful?** Or genuinely repo-wide.
6. **Body leads with why?** (For non-trivial changes.)
7. **No emoji anywhere?**
8. **No AI footers?**
9. **No " and " in subject?**
10. **Diff matches the message?** No drive-by changes that aren't named.

## When upstream conventions differ

When contributing to a repo with its own style (Linux kernel, Rust, Chromium, etc.), **follow theirs.** LCS is the default for personal repos and contributions where no upstream style is specified.
