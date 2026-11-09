---
name: lemma-react-effects
description: Use when adding, reviewing, or removing `useEffect`, `useLayoutEffect`, `useMemo`, or `useCallback` in Lemma's web client; seeding forms or local state from store data; keeping a client selection valid against server data; moving RPC calls or async workflows out of components; or auditing every effect in a `web/src` directory.
---

# React effects in Lemma

An effect synchronizes a component with a system outside React: the DOM, a browser API, a timer, a subscription, or the server. Derived values, state seeded from data, and responses to user events belong in render, in a component boundary, or in an event handler. This skill holds the decision rules and the audit workflow for `web/src`; it is guidance, not a script.

Before adding or keeping an effect, answer all four:

1. Which external system does it synchronize?
2. What starts or updates the synchronization?
3. What cleanup prevents leaks or duplicate subscriptions?
4. Why can an event handler, a store action, a render-time derivation, a conditional mount, or the feature's data hook not own the behavior?

Without a concrete answer to the first question, the effect goes.

## Scope and context

- Read [web/AGENTS.md](../../../web/AGENTS.md) before changing web code: only a feature's `store.ts` calls RPC, and components take their building blocks from `@lemma/ui`.
- The scope is `web/src`. `packages/ui/src/components/` and `packages/ui/src/hooks/` keep upstream shadcn and AI Elements code, effects included; leave them out of inventories and refactors.
- Read [the refactoring patterns](references/refactoring-patterns.md) before implementing a refactor; they show each rule on Lemma code.

## Decision rules

Apply these in order:

1. **Derive during render.** Compute values from props, store state, and local state instead of storing a synchronized copy.
2. **Load server data through the feature store.** The feature's zustand store in `store.ts` holds the data and a `loaded` flag, and the feature's data hook starts the first load in its one effect, as `useProviders` and `useSessions` do. Components read that hook; they never fetch in their own effect and mirror loading, error, or data into local state.
3. **Mount after the data is ready.** When a form or panel cannot initialize without store data, the parent checks `loaded`, renders a `Skeleton` from `@lemma/ui` shaped like the final layout until then, and mounts the child with complete initial values for `useState`. Replacing a half-ready form with a skeleton is an intended behavior change.
4. **Make reset semantics explicit.** A `key` remounts the child for a new entity only when discarding the old draft is intended. When a draft must survive a refetch, keep it, compute dirty state from the draft and the saved value, and reset only from a user action.
5. **Run actions from events.** Submits, RPC calls, navigation, toasts, and multi-step async workflows run in event handlers that call the feature's store actions. A store action is a plain async function on the zustand store: it calls no hooks, and code outside React reaches it through `getState()`, as `refreshSessions` does.
6. **Keep real integration effects.** DOM writes, browser event listeners, observers, timers, and subscriptions may need an effect. Setup and cleanup are symmetric, each effect has one concern, and it lives in the component or hook that owns the integration. A subscription that produces a rendered value uses `useSyncExternalStore`. Never add a wrapper hook only to hide `useEffect`.

`useMemo` and `useCallback` are not defaults. Add one only for a measured performance problem or when referential stability is a correctness requirement: the value is a dependency of a retained effect, or it is a callback ref whose rerun has a side effect. Fix render cost by splitting components or moving state down; hoist a function that closes over nothing to module scope instead of memoizing it.

An effect that writes React or zustand state from props or store data is presumed removable. Switching it to `useLayoutEffect`, moving it into a custom hook, or suppressing `react/exhaustive-deps`, which `web/.oxlintrc.json` sets to `error`, leaves the problem in place; an `oxlint-disable` comment never keeps a removable effect.

## Quick identification

Refactor when any of these appear:

- `useEffect(() => setX(derive(y)), [y])`;
- a fetch in a component effect whose result goes into `setState`, as in `VersionTags.tsx`;
- a flag set by a handler, acted on by an effect, then cleared;
- effect chains, where one state write triggers the next effect;
- local state reset because an ID or prop changed;
- a child reporting its state to a parent from an effect;
- an integration guarded inside an effect when the component could mount only after the precondition holds;
- `useMemo` or `useCallback` around a cheap computation with no stability requirement.

## Workflow

### 1. Establish the behavior boundary

Identify the state owner (store or component), the store action that loads the data, the user events, the external systems, and the loading and error states.

Web tests are `src/**/*.test.ts` files in vitest's `node` environment, and none renders a component ([testing.md](../../../docs/testing.md)). When logic moves out of a component into a pure module, cover a real risk such as draft preservation, an entity change, a refetch, or a submit with a test beside the module; for a bug in such a module, write the failing test first. Verify component behavior in the browser. Never write tests that inspect source or assert that a hook is absent; the inventory proves that.

### 2. Inventory every effect

Search the target directory, such as `web/src/features/<domain>/`, for `\buse(Layout)?Effect\b`, and for `\buse(Memo|Callback)\b` when the audit covers memoization. Classify each result as:

- render derivation;
- store data seeding local state;
- client and server state synchronization;
- user event or async workflow;
- mount-time load in the feature's data hook;
- external-system integration.

Record what triggers each one, what it writes or controls, and the replacement. A raw count alone never justifies a refactor.

### 3. Refactor one change at a time

Work in this order:

1. replace redundant state with a derivation;
2. split the data-owning parent from the stateful child;
3. move event-driven work into handlers and store actions;
4. keep each unavoidable integration in the component or hook that owns it;
5. remove dead state, guards, dependencies, imports, and memoization.

Keep user-visible behavior stable apart from intended loading states. Keep file moves, visual changes, and store restructuring out of the same change.

### 4. Complete a directory

Repeat the inventory after each change. Before calling a directory clean:

- every original effect is accounted for;
- no effect moved behind a wrapper hook;
- a refetch leaves local edits intact;
- an entity change has a deliberate preserve or reset behavior;
- complex actions are store actions callable without rendering the feature;
- each retained integration effect has its external system recorded in the audit report or the commit message body; Lemma code carries no comments.

Adding or changing oxlint rules or checks for effects is separate work, done only on request.

### 5. Verify

- Select checks through [lemma-pre-push-checks](../lemma-pre-push-checks/SKILL.md); its `web/` row includes `just web-build`, which type-checks with `tsc -b`.
- Review user-visible flows in a real browser: `just web-dev` proxies RPC to the server that `just rust-dev` runs. The server recipe compiles the Rust workspace, which needs the user's consent; without it, hand the steps to the user.
- Run the inventory again to show the target directory is clean.

Report the exact summary line of each command and every retained effect with its external system.

## Output format

Return valid Markdown. A directory audit includes a compact table: effect location, classification, replacement, and status.
