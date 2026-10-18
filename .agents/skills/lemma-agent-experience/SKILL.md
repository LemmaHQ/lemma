---
name: lemma-agent-experience
description: Use when writing or changing a model-facing tool in lemma-tools — its name, description, parameter schema, or result text — or when judging how a tool change affects what the model does and how much context it costs.
---

# Lemma agent experience

The models Lemma runs read two kinds of text from `lemma-tools`. Each tool advertises a `ToolSpec` (name, description, JSON parameter schema) with every model request whose loop has a `ToolRuntime`, and its `execute` result becomes a tool result message the model reads in the next step. This skill governs how to write that text; the skill itself never reaches the model. Repository instructions for coding agents, such as `AGENTS.md` files and skills, follow [lemma-doc](../lemma-doc/SKILL.md).

## Context use

- **Start with minimal context:** the description states the tool's purpose, its actions, and its constraints; detailed rules live on the parameter they govern.
- **Keep critical constraints visible:** permissions, destructive effects, and required validation appear in the description of the tool that has them.
- **Prefer bounded outputs:** return concise results with identifiers or paths for retrieving details; do not dump entire logs or files.
- **Use locality:** include a bounded amount of likely needed adjacent context with a result. Mark omissions and truncation explicitly, and say how to retrieve more.
- **Evaluate total work:** saving context is useful only if it does not cause more calls, repeated reads, or mistakes.

## Tool definitions

- **Delete obvious constraints.** Omit rules the model learns from the call result, such as a missing file failing to read.
- **Describe behavior, not implementation.** State what the tool does and returns; omit internal mechanisms and enforcement details.
- **Put parameter rules on the parameter.** Defaults, ranges, formats such as "workspace-relative path", and when-to-set rules belong in that parameter's description or schema.
- **Say each fact once.** Do not repeat a parameter description in the tool description, or one tool's rules in another tool.
- **Results are text the model acts on.** An error result names what failed and what the model can change.

## Measure the change

Wording that reaches a model is behavior. Compare the first step's input tokens, from the message usage a real-provider run records, before and after a tool-definition change, and exercise the changed tool in a local-mode conversation (desktop or Android) against a real provider; server mode attaches no tools.
