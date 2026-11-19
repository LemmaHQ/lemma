---
name: lemma-react-effects
description: Use when adding, reviewing, or removing `useEffect`, `useLayoutEffect`, `useMemo`, or `useCallback` in Lemma's web client; seeding forms or local state from store data; keeping a client selection valid against server data; moving RPC calls or async workflows out of components; or auditing every effect in a `web/src` directory.
---

# React effects in Lemma

An effect synchronizes a component with a system outside React: the DOM, a browser API, the desktop bridge, a timer, a subscription, or the daemon. Derived values, state seeded from data, and responses to user events belong in render, in a component boundary, or in an event handler. This skill is guidance, not a script.

Before adding or keeping an effect, confirm: (1) which external system it synchronizes, (2) what starts or updates it, (3) what cleanup prevents leaks or duplicate subscriptions, and (4) why a render derivation, conditional mount, event handler, store action, or data hook cannot own it. Without a concrete external system, remove the effect.

## Scope and context

- Read [web/AGENTS.md](../../../web/AGENTS.md) before changing web code: only a feature's `store.ts` calls RPC, and components take building blocks from `@lemma/ui`.
- Primary scope is `web/src` plus Lemma-authored modules in `packages/ui/src/components/composites/`. Upstream ports in `packages/ui/src/components/primitives/`, `icons/`, and `hooks/` keep their upstream effects unless a local change touches them.
- Read [references/refactoring-patterns.md](references/refactoring-patterns.md) before refactoring.

## Decision rules

Apply in order:

1. **Derive during render.** Compute values from props, store state, and local state instead of mirroring them via `useEffect`.
2. **Load daemon data through the feature store.** The feature's zustand store in `store.ts` holds data and a `loaded` flag; `createLoadedHook` in `src/store/loaded-hook.ts` owns the initial load effect (`useProviders`, `useSessions`). Components never fetch in their own effect.
3. **Mount after data is ready.** When a form or panel needs store data to initialize `useState`, the parent checks `loaded`, renders a `Skeleton` from `@lemma/ui` until ready, and mounts the child with complete initial values.
4. **Make reset semantics explicit.** Use `key` remounts only when discarding an old draft is intended. When drafts must survive refetches, keep the draft, derive dirty state, and reset only on user action.
5. **Run actions from events.** Submits, RPC calls, navigation, toasts, and multi-step workflows run in event handlers calling plain async store actions (callable outside React via `getState()`, e.g. `refreshSessions`).
6. **Keep real integration effects.** DOM writes, browser listeners, observers, timers, subscriptions, and desktop bridge calls may use an effect with symmetric setup/cleanup and one concern per effect, living in the owning component or hook (use `useSyncExternalStore` for rendered subscriptions; never hide `useEffect` behind a wrapper hook).

Use `useMemo` / `useCallback` only for a measured performance problem or required referential stability (dependency of a retained effect, or a callback ref with side effects); hoist pure helpers to module scope instead. Never move a removable effect to `useLayoutEffect`, hide it in a custom hook, or suppress `react/exhaustive-deps` (`error` in `web/.oxlintrc.json`) with `oxlint-disable`.

## Audit and refactor workflow

1. **Inventory:** search the target directory for `\buse(Layout)?Effect\b` (and `\buse(Memo|Callback)\b` when auditing memoization). Classify each hit (render derivation, store-to-local seeding, client/daemon sync, user event/workflow, mount-time data load, or external-system integration) with its trigger, target, and replacement.
2. **Refactor one change at a time** in order: (a) redundant state → derivation, (b) split data-owning parent from stateful child, (c) event-driven work → handlers and store actions, (d) keep unavoidable integrations in their owners, (e) delete dead state, guards, deps, imports, and memoization. Keep file moves, visual tweaks, and store restructures separate.
3. **Test behavior, not hook absence:** cover real risks (draft preservation, entity change, refetch, submit) with `*.test.ts(x)` beside the module ([testing.md](../../../docs/testing.md)); never inspect source text to assert a hook is gone.
4. **Verify:**
   - Re-run the inventory and confirm every original effect is accounted for, no effect moved behind a wrapper hook, refetches preserve local edits, and retained effects are recorded in the audit report or commit body (Lemma code carries no comments).
   - Run the `web/` row from [lemma-pre-push-checks](../lemma-pre-push-checks/SKILL.md).
   - For browser verification, `just web-dev` proxies RPC to `lemma-daemon` (`just rust-dev`), and title-bar or `platform` effects also need `just desktop-dev`. Both `rust-dev` and `desktop-dev` compile Rust and require user consent; otherwise hand the steps to the user.

Report the exact command summary lines and, for directory audits, a compact Markdown table: effect location, classification, replacement, and status.
