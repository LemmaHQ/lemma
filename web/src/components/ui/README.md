# Shared UI components

English | [中文](README.zh.md)

## Summary

`web/src/components/ui/` holds the shared controls of the web client: shadcn/ui components on [Base UI](https://base-ui.com/) primitives. The shadcn CLI wrote their first version from the `base-nova` style in [`components.json`](../../../components.json); Lemma owns them since and edits them in place. Icons come from Tabler. Feature code imports a control from `@/components/ui/<name>`; the [shadcn docs](https://ui.shadcn.com/docs/components) describe each component's props and composition. Styling rules are in [Web styling](../../../../docs/web-styling.md).

The sibling `web/src/components/ai-elements/` holds the chat components, first added from the `@ai-elements` registry of [AI Elements](https://ai-sdk.dev/elements) and cut down to the parts Lemma renders: `message` renders Markdown through Streamdown, and `prompt-input`, `model-selector`, `reasoning`, `tool`, `code-block`, `suggestion`, and `shimmer` cover the composer and the transcript.

<a id="component-catalog"></a>

## Component catalog

Check this list before writing a control in feature code, and reuse what fits.

| Module          | Use                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------ |
| `alert-dialog`  | Confirmation before a destructive or irreversible action                                   |
| `avatar`        | Round initial or image for a user or provider; `AvatarBadge` marks a status                |
| `badge`         | Short status or count label                                                                |
| `button`        | Clickable action                                                                           |
| `button-group`  | Row of joined controls, such as an input with its save button                              |
| `card`          | Bordered content card                                                                      |
| `collapsible`   | Show-and-hide region; the caller draws the trigger                                         |
| `command`       | Searchable list of commands or options; `model-selector` builds on it                      |
| `dialog`        | Modal window for a task that keeps the page underneath                                     |
| `dropdown-menu` | Menu of actions or choices anchored to a trigger                                           |
| `empty`         | Empty state with icon, title, description, and actions                                     |
| `field`         | Form layout: label, control, description, and error, grouped and separated                 |
| `hover-card`    | Preview card shown on hover                                                                |
| `input`         | Single-line text field                                                                     |
| `input-group`   | Text field with attached icons, text, or buttons                                           |
| `item`          | Row with title, description, and trailing actions in a list or settings group              |
| `label`         | Form label bound to a control by `htmlFor`                                                 |
| `select`        | Single choice from a list in a form                                                        |
| `scroll-area`   | Scrollable region with a themed overlay scrollbar; panes and panels scroll through it      |
| `separator`     | Horizontal or vertical divider line                                                        |
| `sheet`         | Panel that slides in from a screen edge; `sidebar` uses it on narrow screens               |
| `sidebar`       | Collapsible app navigation with its provider, menu parts, and toggle                       |
| `skeleton`      | Placeholder block shown while content loads                                                |
| `spinner`       | Animated loading icon inside a button or row                                               |
| `sonner`        | The toast host, mounted once in `App`; raise toasts with `toast` from the `sonner` package |
| `switch`        | Two-state toggle that applies immediately                                                  |
| `tabs`          | Tablist that switches between panels                                                       |
| `textarea`      | Multi-line text field                                                                      |
| `toggle`        | Pressable two-state button                                                                 |
| `toggle-group`  | Row of toggles that sets one value or several                                              |
| `tooltip`       | Short label for an icon-only control, shown on hover and keyboard focus                    |

Three pairs are easy to confuse:

- **`Tabs` against `ToggleGroup`.** `Tabs` switches which panel is shown and owns the panels through `TabsContent`. `ToggleGroup` sets a value, such as the theme preference, and owns no panels.
- **`AlertDialog` against a toast.** `AlertDialog` asks before an action and blocks until the user answers. A toast reports the outcome of an action after it ran and blocks nothing.
- **`Tooltip` against `title`.** `Tooltip` shows on keyboard focus and follows the theme; the `title` attribute does neither. Icon-only buttons use `Tooltip` plus an `aria-label`.

## Conventions

- Base UI composes through the `render` prop, not `asChild`: `<TooltipTrigger render={<Button size="icon" />}>`. Triggers render a `button` themselves, so a plain trigger takes its classes directly.
- The theme comes from `next-themes`, mounted in `App` with the `class` attribute and the `lemma.theme` storage key; `Toaster` reads it through `useTheme`.
- `useSidebar` reads the state of the enclosing `SidebarProvider` from [`src/lib/hooks/use-sidebar.ts`](../../lib/hooks/use-sidebar.ts), so `sidebar.tsx` exports only components.
- oxlint checks both directories with the rules of feature code. The `src/components/**` override in [`web/.oxlintrc.json`](../../../.oxlintrc.json) lets them restyle the controls they compose, use arbitrary values for geometry, build classes with `cva`, and set ARIA roles directly.
- User-visible text, including accessible names, comes from i18next; colors come from theme roles, never the Tailwind palette.

## Adding a component

Run `npx shadcn@latest add <name>` from `web/` (AI Elements: `npx shadcn@latest add @ai-elements/<name>`) and bring the new file under the rules above: import `cn` from `cn`, drop `"use client"`, delete the parts Lemma does not use, move strings into the locale files, and replace palette colors with theme roles. Color variables the CLI writes into `src/index.css` move into [`design/tokens.json`](../../../../design/README.md). Then add the module to the catalog above. Existing components change by editing them; the CLI never overwrites them.
