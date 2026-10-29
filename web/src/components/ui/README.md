# Shared UI components

English | [中文](README.zh.md)

## Summary

`web/src/components/ui/` holds the shared controls of the web client: shadcn/ui components on [Base UI](https://base-ui.com/) primitives. The shadcn CLI wrote their first version from the `base-nova` style in [`components.json`](../../../components.json); Lemma owns them since and edits them in place. Icons come from Tabler. Feature code imports a control from `@/components/ui/<name>`; the [shadcn docs](https://ui.shadcn.com/docs/components) describe each component's props and composition.

The sibling `web/src/components/ai-elements/` holds the conversation components, first added from the `@ai-elements` registry of [AI Elements](https://ai-sdk.dev/elements) and cut down to the parts Lemma renders: `message` renders Markdown through Streamdown, `conversation` keeps the transcript at its newest message until the reader scrolls up, `tool` shows each tool call and groups the calls of one reply, and `prompt-input`, `model-selector`, `reasoning`, `code-block`, `suggestion`, and `shimmer` cover the composer and the rest of the transcript.

<a id="component-catalog"></a>

## Component catalog

Check this list before writing a control in feature code, and reuse what fits.

| Module    | Use                                                                   |
| --------- | --------------------------------------------------------------------- |
| `badge`   | Short status or count label                                           |
| `command` | Searchable list of commands or options; `model-selector` builds on it |

`button`, `separator`, `tooltip`, the sidebar and its sheet, `dropdown-menu`, the overlays `dialog` and `alert-dialog`, the layout parts `avatar`, `collapsible`, `empty`, `item`, `scroll-area`, and `skeleton`, and the form controls `checkbox`, `field`, `input`, `input-group`, `password-input`, `label`, `select`, `switch`, `textarea`, `toggle`, and `toggle-group` come from `@lemma/ui`: import them from `@lemma/ui/components/<name>` and `@lemma/ui/hooks/use-sidebar`; Animate UI Lucide icons come from `@lemma/ui/icons/<name>` and brand logos from `@lemma/ui/components/brand/<name>`. `AppShell` in `web/src/app/shell/` assembles the sidebar for the signed-in pages, and `AppTooltipProvider` in `web/src/app/` keeps every tooltip clear of the desktop titlebar. The toast host `sonner` also lives in `@lemma/ui`; `AppToaster` in `web/src/app/` mounts it once with the theme and the titlebar offset, and code raises toasts with `toast` from the `sonner` package.

Two pairs are easy to confuse:

- **`AlertDialog` against a toast.** `AlertDialog` asks before an action and blocks until the user answers. A toast reports the outcome of an action after it ran and blocks nothing.
- **`Tooltip` against `title`.** `Tooltip` shows on keyboard focus and follows the theme; the `title` attribute does neither. Icon-only buttons use `Tooltip` plus an `aria-label`.

## Conventions

- Base UI composes through the `render` prop, not `asChild`: `<TooltipTrigger render={<Button size="icon" />}>`. Triggers render a `button` themselves, so a plain trigger takes its classes directly.
- The theme comes from `next-themes`, mounted in `App` with the `class` attribute and the `lemma.theme` storage key; `Toaster` reads it through `useTheme`.
- oxlint checks both directories with the rules of feature code. The `src/components/**` override in [`web/.oxlintrc.json`](../../../.oxlintrc.json) lets them restyle the controls they compose, use arbitrary values for geometry, build classes with `cva`, and set ARIA roles directly.
- User-visible text, including accessible names, comes from i18next; colors come from theme roles, never the Tailwind palette.

## Adding a component

Run `npx shadcn@latest add <name>` from `web/` (AI Elements: `npx shadcn@latest add @ai-elements/<name>`) and bring the new file under the rules above: import `cn` from `cn`, drop `"use client"`, delete the parts Lemma does not use, move strings into the locale files, and replace palette colors with theme roles. Color variables the CLI writes into `src/index.css` move into [`design/tokens.json`](../../../../design/README.md). Then add the module to the catalog above. Existing components change by editing them; the CLI never overwrites them.
