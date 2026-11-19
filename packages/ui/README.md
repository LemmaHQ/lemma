# Shared UI components

English | [中文](README.zh.md)

## Summary

`@lemma/ui` exports Lemma's shared shadcn/ui controls and composed components as TypeScript source via two entries: `@lemma/ui` (`src/index.ts`, the authoritative export list including `cn`, `AnimateIcon`, and `toast`) and `@lemma/ui/styles.css` (theme and component styles). Feature code imports nothing else from the package or its underlying libraries. Components hold no interface text; callers pass every visible string and accessible label as props.

`src/components/` has three directories (`just source-check` enforces repository file rules across all three):

- `primitives/` — shadcn controls and layout parts (`kebab-case.tsx`).
- `icons/` — Animate UI Lucide icons (`kebab-case.tsx`).
- `composites/` — Lemma-authored components (`PascalCase.tsx` with sibling tests and hooks).

`src/hooks/` holds hooks written by the shadcn CLI under their upstream names. [packages/AGENTS.md](../AGENTS.md#packages) defines what belongs in this package.

Two control pairs are easy to confuse:

- **`AlertDialog` vs. toast:** `AlertDialog` confirms before an action and blocks until answered; a toast reports an outcome afterward and blocks nothing.
- **`Tooltip` vs. `title`:** `Tooltip` shows on keyboard focus and follows the theme; `title` does neither. Icon-only buttons use `Tooltip` plus an `aria-label`.

## Styling

Feature code styles exclusively through semantic theme utilities. Exact color, radius, type-scale, and motion values live in [design/tokens.json](../../design/README.md); `src/styles/tokens.css` adds font stacks and shadows and maps them into Tailwind.

| Type role              | Use                                                              |
| ---------------------- | ---------------------------------------------------------------- |
| `text-caption`         | Timestamps, group labels, code-block labels                      |
| `text-small`           | List rows, sidebar items, tool rows, descriptions                |
| `text-body`            | Default interface text, buttons, menu items, inputs from `md` up |
| `text-reading`         | Message text, composer, inputs below `md`                        |
| `text-title`           | Section and dialog titles                                        |
| `text-display`         | Home and settings page headings                                  |
| `text-wordmark`        | Sidebar brand wordmark                                           |
| `text-wordmark-splash` | Boot and splash brand wordmark                                   |

- **Brand font:** `font-brand` sets `"NewCM"` (serif fallback) for wordmarks and brand headings; all other text uses the interface sans.
- **Radius:** `rounded-sm` for badges, checkboxes, and controls inside inputs; `rounded-md` for buttons, inputs, list rows, menu items, and code blocks; `rounded-lg` for cards, popovers, dialogs, the composer, and the main panel; `rounded-full` for avatars, switches, and pills.
- **Sizes:** controls use `h-7`, `h-8` (default), or `h-9` (`h-6` only inside inputs); one row uses one height. List rows use `h-8` with `text-small` (`Button variant="row"`, active state via `data-active`).
- **Hover and selection:** `bg-accent` for row/menu/ghost/outline hover; `bg-selected` for active rows and pressed filter pills, paired with `text-foreground` or `text-muted-foreground`.
- **Surfaces:** content containers use a border with no shadow; floating surfaces (menus, popups, pickers, toasts) use opaque `bg-popover` with border and `shadow-overlay`; dialogs and sheets use `shadow-modal` over `bg-scrim`; `shadow-raised` is reserved for the composer and floating toolbar.
- **Theme preview:** `[data-theme-preview="light"]` or `[data-theme-preview="dark"]` scopes that mode's semantic tokens onto a subtree.

## Settings pages

Compose settings pages from `SettingsPage`, `SettingsSection`, `SettingsSectionCompact`, `SettingsField`, and `SettingsRow` without adding outer spacing, borders, or widths:

- Pass an `index` directory prop to `SettingsPage` for entity-list pages (such as providers); single-column pages omit it.
- Use `SettingsSection` for 2-column hairline-divided groups (stacks below `lg`), `SettingsSectionCompact` for single-column subhead groups, `SettingsField` for wide controls (inputs/selects fill the control column; compact controls sit at its end), and `SettingsRow` for single-line entries with trailing actions.
- Use radio preview tiles for theme choice, `Select` for multi-option lists, and `Switch` for booleans. Pass field validation messages through `error` (replaces description) and section-level status/actions through `error` and `footer`.

## Motion utilities

`src/styles/motion.css` holds shared keyframes and motion classes, while `src/styles/components/` holds component-internal styles (never part of the public interface). Every animation and motion class includes a reduced-motion fallback preserving final state.

- **Tailwind utilities:** `animate-draw` (SVG path with `pathLength="1"`), `animate-spin-once` (remount to replay), `live-dot` (active status indicator), `qed-mark` (reply completion square), `grid-collapse` (`data-open="true"`).
- **Motion classes:** `swap-layer` (cross-fades stacked layers via `data-on="true"`), `stagger-children`.
- **View transition classes** (for React `<ViewTransition>` `share`/`enter`/`exit`): `ui-rise`, `ui-from-start`, `ui-from-end`.
- **Theme switch:** `html.theme-transition` animates color, background, border, and shadow changes. Motion tokens provide `duration-{fast,base,medium,slow,reveal}` and `ease-{enter,exit,move,spring}`.

## Conventions

- Base UI composes via the `render` prop, never `asChild` (`<TooltipTrigger render={<Button size="icon" />}>`); triggers already render a `button`.
- Package-internal imports use `#primitives/`, `#icons/`, `#hooks/`, and `#lib/` aliases; `composites/` files import each other relatively. Always import `cn` from `#lib/cn` so `text-*` type roles do not collide with `text-*` color utilities.
- `.oxlintrc.json` exempts `src/components/**` so shared components can restyle primitives, use arbitrary geometry values, build `cva` variants, and set ARIA roles directly.

## Adding a component

Run `npx shadcn add <name>` from `packages/ui/` (writes to `src/components/primitives/`), or `npx shadcn add @animate-ui/icons-lucide-<name>` and move it to `src/components/icons/`. Adapt generated files to Lemma rules (import `cn` from `#lib/cn`, drop `"use client"`, remove unused parts, turn strings into props, map colors/typography/radii to theme roles), put Lemma-authored components in `src/components/composites/PascalCase.tsx` with sibling tests, put cross-client tokens in [design/tokens.json](../../design/README.md) (`just design-gen`) and web-only tokens in `src/styles/tokens.css`, then export consumed symbols from `src/index.ts`.
