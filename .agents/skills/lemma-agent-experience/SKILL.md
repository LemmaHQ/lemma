---
name: lemma-agent-experience
description: Use when writing or changing a model-facing tool definition in lemma-tools (name, description, parameter schema, result text), and when designing skills, AGENTS.md files, context loading, or multi-step agent workflows, to make information discoverable and use context efficiently.
---

# Lemma agent experience

Two kinds of agents read Lemma's text: the models Lemma runs, which see `ToolSpec`s and tool results, and the coding agents that work on this repository, which load `AGENTS.md` files and skills. The same rules serve both.

- **Start with minimal context:** expose purpose, available actions, and constraints first; load detailed instructions when needed. Root `AGENTS.md` holds standing orders; skills load on demand.
- **Make discovery explicit:** every deferred resource needs a clear description and a reliable way to retrieve it. A skill's `description` states when to load it; a link names what the target holds.
- **Keep critical constraints visible:** permissions, destructive effects, and required validation appear before the relevant action.
- **Prefer bounded outputs:** return concise results with identifiers or paths for retrieving details; do not dump entire logs or files.
- **Use locality:** include a bounded amount of likely needed adjacent context with a result. Mark omissions and truncation explicitly, and provide a way to retrieve more.
- **Evaluate total work:** saving context is useful only if it does not cause more searches, repeated reads, or mistakes.

## Tool definitions

A tool in `lemma-tools` advertises a `ToolSpec` (name, description, JSON parameter schema) with every model request whose loop has a `ToolRuntime`; its `execute` result becomes a tool result message the model reads in the next step.

- **Delete obvious constraints.** Omit rules the model learns from the call result, such as a missing file failing to read.
- **Describe behavior, not implementation.** State what the tool does and returns; omit internal mechanisms and enforcement details.
- **Put parameter rules on the parameter.** Defaults, ranges, formats such as "workspace-relative path", and when-to-set rules belong in that parameter's description or schema.
- **Say each fact once.** Do not repeat a parameter description in the tool description, or one tool's rules in another tool.
- **Results are text the model acts on.** An error result names what failed and what the model can change; a denial by the approval policy says so, so the model does not retry the same call.
- **Measure the change.** Compare the first step's input tokens, from the message usage a real-provider run records, before and after a tool-definition change. Wording that reaches a model is behavior: exercise it with the local real-provider tests ([testing.md](../../../docs/testing.md#tiers)).

## Repository instructions

- **One home per rule.** A rule lives in the `AGENTS.md` or skill that owns it; elsewhere, link it ([tier taxonomy](../../../docs/AGENTS.md#the-tier-taxonomy-one-home-per-fact)).
- **Budgets keep standing context small.** Root and subtree `AGENTS.md` files have word budgets because every session loads them; move situational procedures into skills.
- **A skill description is a trigger.** Name the tasks and file types that should load it, not what the skill contains.
