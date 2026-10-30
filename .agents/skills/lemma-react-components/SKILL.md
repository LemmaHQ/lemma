---
name: lemma-react-components
description: Use when creating, changing, or reviewing a React component in Lemma's web client (`web/src`), including designing its props, splitting or composing components, typing the states a component can be in, or deciding whether the component or its parent owns spacing and conditional rendering.
---

# React components in Lemma

A component is an encapsulated unit, and its props are its whole interface: it exposes no implementation details and works the same wherever it is placed. Design props to be explicit and unambiguous. These are decision rules for writing and reviewing components, not an audit workflow; effects, memoization, and data loading belong to [lemma-react-effects](../lemma-react-effects/SKILL.md).

## Scope

- The rules govern the components in `web/src/features/` and `web/src/app/`, on top of the layout and styling rules in [web/AGENTS.md](../../../web/AGENTS.md).
- The shadcn and AI Elements components in `packages/ui/src/components/` keep their upstream interfaces: they take `className`, compose through Base UI's `render` prop, and export their parts. A visual difference several features need becomes a variant there, per the [styling rules](../../../web/AGENTS.md#styling).

## Minimal interface

- Every prop is read.
- A default value only where it saves real repetition at the call sites.
- Props are required unless call sites actually omit them. `MessageComposer` marks `onStop` and `streaming` optional and defaults `streaming` to `false`, though its one caller always passes both.
- No conflicting or overlapping props, such as both `onClick` and `onSelect`, or a flag beside the handler it enables: `MessageItem`'s `canRegenerate` and `onRegenerate` state one fact, so one prop carries it.

## Composition

- A component owns meaningful presentation or complex logic. When most of the logic is independent of JSX, write a pure function and keep the trivial JSX at each call site; write a hook instead only when the logic needs React state or lifecycle.
- One component has one presentation. When an action looks different in different places, write one component per presentation instead of choosing with a mode prop or flag. `NewConversationButton`'s `compact` flag switches between a toolbar icon with a tooltip and a labeled sidebar button.
- One component has one workflow. When a prop would select fundamentally different workflows, split them: creating and editing a provider are `NewProviderForm` and `ProviderDetail`, not one form with a `mode`.
- Extract only what call sites share. Shared presentation becomes a presentational component; shared state or behavior alone becomes a hook, and each call site keeps its own presentation.

## Explicit states

- Prop types derived from another type use `Pick<>`, not `Omit<>`, so the accepted props are listed.
- A component that spreads props onto an element types the spread with `Pick<>` and leaves out the props it sets on that element itself.
- Discriminated unions state intent and make impossible states unrepresentable, instead of optional or nullable fields checked at runtime. `CheckResult` in `ConnectionCheck.tsx` is the shape: `{ status: "checking" } | { status: "passed" } | { status: "failed"; message: string }`; a separate `loading` flag and `error` field would allow a failed check that is still loading.

## Encapsulation

- Components take no `className` or `style` prop; none in `web/src` does. The exception is a headless component, one that has no styling or layout of its own.
- A component file exports its components and the types their callers need. Helpers, class tables, constants, and subcomponents used only inside the file stay unexported; `just deadcode-check` reports exports nothing imports.

## Ownership

- The parent places its children: margin and the space between siblings come from the parent, through `gap` or a wrapping element. A component sets only its own padding and the spacing of its contents.
- A component that returns `null` signals that a parent may own the condition. Prefer having the parent skip the render when it already knows the condition: `MessageItem` returns `null` for tool messages, which `MessageList` could filter out, and `ProviderGroup` in `ProviderListPane.tsx` returns `null` for an empty group its parent could skip. Keep the `null` when the condition is one branch of the component's own decision: `MessageThinking` chooses among a loader, nothing, and the reasoning block from the same message fields, and moving one branch into `MessageItem` would split that decision.
