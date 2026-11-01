# Design it twice

When the user wants alternative interfaces for a chosen candidate, design it several radically different ways in parallel, then compare. The first idea is rarely the best (Ousterhout). Uses the terms in [vocabulary.md](vocabulary.md).

## 1. Frame the problem space

Write a user-facing explanation of the candidate before spawning subagents:

- the constraints any new interface must satisfy;
- the dependencies it relies on and their category from [deepening.md](deepening.md);
- a rough code sketch that makes the constraints concrete, not a proposal.

Show it, then continue at once; the user reads while the subagents work.

## 2. Spawn subagents

Spawn three or more subagents in parallel, each with a fresh context and a separate technical brief: file paths, coupling details, dependency category, what sits behind the seam, the vocabulary terms, and the domain terms from `docs/glossary.md`. Give each a different constraint:

- Minimize the interface: one to three entry points, maximum leverage per entry point.
- Maximize flexibility: support many use cases and extension.
- Optimize for the most common caller: make the default case trivial.
- When cross-seam dependencies exist: design around ports and adapters.

Each returns the interface (types, entry points, parameters, invariants, ordering, error modes), a caller's usage example, what the implementation hides, the dependency strategy and adapters, and the trade-offs: where leverage is high and where it is thin.

## 3. Compare

Present the designs one at a time, then compare them in prose by depth, locality, and seam placement. Give your own recommendation; propose a hybrid when elements combine well. Be opinionated: the user wants a strong read, not a menu.
