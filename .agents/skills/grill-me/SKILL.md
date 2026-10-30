---
name: grill-me
description: Use when the user wants a plan or design stress-tested before implementation, asks to be grilled on it, or says "grill me".
---

# Grill me

Interview the user about every aspect of the plan until you both share one understanding of it. Walk the design tree branch by branch, resolving each decision before the decisions that depend on it.

## Questions

- Ask one question at a time. Give your recommended answer with each question.
- Ask about upstream decisions and those that are risky or hard to reverse first; details that follow from them come later.
- Answer from the codebase whatever it can answer, and ask the user only what it cannot. Explore it yourself, or through a subagent when the environment provides one.

## Finishing

Stop when every branch is resolved or the user ends the interview. Then list the decisions made and the questions left open. Place the outcome by [document structure](../../../docs/AGENTS.md#document-structure): rationale in the commit message, contracts in docs or source.
