# Defensive patterns

English | [中文](README.zh.md)

Hard-won rules: each pattern in this directory is a requirement this repository enforces in review, stated as the rule and the defect it prevents. Every rule states what must hold, the condition a reviewer judges it by, its boundary and who approves an exception, and a correct and a wrong example. Read the page for the artifact you are about to change, before you change it.

## Why these rules

Five habits cover most of what follows, and each page is their application to one artifact:

- **Make correctness explicit.** Write it into the structure — named call points, explicit lifecycles, explicit conditions and types — rather than compensating for it afterwards with timing.
- **Keep one source of truth.** One read path for a piece of data, one home for a fact, one owner for shared state.
- **Extend through the registered extension point.** A new provider goes through adapter dispatch, a new tool through the tool registry; an existing carrier stops taking new logic instead of growing a branch inside it.
- **Keep the change face equal to the review face.** A change carries only the lines its stated behavior change needs, a migration moves code rather than rewriting it, and a performance-sensitive change carries its measurement.
- **Require evidence.** A claim is falsifiable and recomputable — measured before and after, or checked by a test or command — rather than kept in sync by hand.

| Changing | Read |
|---|---|
| Crate public APIs, crate layout, dependency declarations, feature flags | `crate-surface.md` |
| Proto contracts, ConnectRPC services, error mapping | `rpc-and-proto.md` |
| Agent turns, stream events, the session tree, store implementations | `agent-and-session.md` |
| Web and desktop components, stores, hooks, effects | `client-components.md` |
| UniFFI bindings and the Android client | `mobile-and-ffi.md` |
| Timing, state representation, shared ownership, refactors, migrations, performance evidence, disposal, child processes | `general.md` |

Type definitions and per-subsystem semantics live in [subsystems/](../subsystems/README.md); this directory carries the rules, and the semantics pages carry what the types mean. `.agents/skills/lemma-code-review/SKILL.md` reads this directory when judging a pull request.
