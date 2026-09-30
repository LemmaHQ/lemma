# 2. One row per canonical message

- Status: accepted
- Date: 2026-10-01

## Context

The previous store kept one row per user or assistant message, with thinking blocks, tool calls, and tool results nested inside the assistant row as content blocks.
Per-event metadata (timings, token usage, status) then had no home, tool-loop trajectories could not be recorded faithfully, and branching or rendering at sub-message granularity was impossible.

## Decision

Store one tree row per canonical message, using the existing `lemma-core` vocabulary and nothing else: `User`, `Assistant`, and `ToolResult` each occupy exactly one row.
Tool calls remain content blocks inside the assistant row that requested them; their results are separate `ToolResult` rows.
No new event or record types are introduced.

## Consequences

- Tables grow more rows per turn; acceptable at conversation scale.
- Context assembly gains a fold step: the messages along a branch path are collapsed back into the provider-facing sequence before dispatch.
- UI rendering, history branching, and future sync all operate on single-message units, which matches how tool loops actually produce them.
