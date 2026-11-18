# Shared UI components

English | [中文](README.zh.md)

## Summary

`@lemma/ui` exports Lemma's shared shadcn/ui controls and the components Lemma composes from them as TypeScript source. The package has two entries: `@lemma/ui` exports every consumed component, icon, hook, and helper, the package's `cn`, and `AnimateIcon` and `toast` from the libraries underneath, and `@lemma/ui/styles.css` loads the theme and all component styles. Feature code imports nothing else from the package and none of those libraries directly. The package owns the semantic theme and the Streamdown styles and plugins; it holds no interface text, so the consuming application translates every string a component shows or announces and passes it as a prop.

`src/components/` holds three directories. `primitives/` holds the shadcn controls and layout parts the shadcn CLI writes, and `icons/` holds Animate UI's Lucide set; both keep their upstream layout and kebab-case file names. `composites/` holds the components Lemma composes from them in `PascalCase.tsx` files named after the main component they export, which `just source-check` holds to the repository's source file rules. `src/hooks/` holds the hooks the shadcn CLI writes. [packages/AGENTS.md](../AGENTS.md#packages) decides which components belong in the package.

<a id="component-catalog"></a>

## Component catalog

Check this list before writing a control in feature code, and reuse what fits.

| Module                       | Use                                                                                                                              |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `composites/AnchoredPicker`  | 340 px anchored searchable popover with grouped options and keyboard nav                                                         |
| `composites/CodeBlock`       | Highlighted, line-numbered code outside Markdown with an actions slot in its header                                              |
| `composites/CopyButton`      | Ghost icon button that copies text and draws a check while the tooltip reads copied                                              |
| `composites/DrawerLayout`    | Main column beside a focus-managed 480 px slide-in drawer, and the drawer's 52 px `DrawerHeader`                                 |
| `composites/FollowScroll`    | Live log that follows new content, with a scroll-to-bottom button, a sticky-header shade, an overlay slot, and `useFollowScroll` |
| `composites/Markdown`        | Streamed Markdown with highlighted code, an inline end mark slot, and code block actions                                         |
| `composites/PasswordInput`   | Password input group with a labeled show and hide toggle                                                                         |
| `composites/SettingsField`   | The field and row of a [settings page](#settings-pages)                                                                          |
| `composites/SettingsPage`    | The scrolling page of a [settings page](#settings-pages)                                                                         |
| `composites/SettingsSection` | The two section kinds of a [settings page](#settings-pages)                                                                      |
| `composites/Wordmark`        | Brand wordmark set in `NewCM` (`default` 19 px or `splash` 24 px) with a brand dot                                               |

`button`, `tooltip`, the sidebar and its sheet, `dropdown-menu`, the overlays `dialog` and `alert-dialog`, the toast container `sonner`, the layout parts `collapsible`, `empty`, and `skeleton`, and the form controls `checkbox`, `input`, `input-group`, `select`, and `switch` are also shared controls under `primitives/`. `useSidebar` reads the sidebar state, `formatDuration` and `formatClockTime` format durations and local `HH:mm` timestamps, and `isShortcutIgnored` guards global keyboard shortcuts when an editable control or IME is active. The [shadcn docs](https://ui.shadcn.com/docs/components) describe the underlying props and composition.

Two pairs are easy to confuse:

- **`AlertDialog` against a toast.** `AlertDialog` asks before an action and blocks until the user answers. A toast reports the outcome of an action after it ran and blocks nothing.
- **`Tooltip` against `title`.** `Tooltip` shows on keyboard focus and follows the theme; the `title` attribute does neither. Icon-only buttons use `Tooltip` plus an `aria-label`.

## Styling

Components and feature code style through the theme's utilities. The color roles, radii, and type roles come from [design/tokens.json](../../design/README.md); `src/styles/tokens.css` adds the font stacks and shadows and maps everything into Tailwind. Lint rejects Tailwind's type sizes, radii from `rounded-xl` up, and arbitrary radii, so every element draws from the scales below.

| Type role              | Size / line height     | Use                                                              |
| ---------------------- | ---------------------- | ---------------------------------------------------------------- |
| `text-caption`         | 12 / 18 px             | Timestamps, group labels, code-block labels                      |
| `text-small`           | 13 / 20 px             | List rows, sidebar items, tool rows, descriptions                |
| `text-body`            | 14 / 22 px             | Default interface text, buttons, menu items, inputs from `md` up |
| `text-reading`         | 15.5 / 27 px           | Message text, the composer, inputs below `md`                    |
| `text-title`           | 15 / 24 px, weight 600 | Section and dialog titles                                        |
| `text-display`         | 17 / 24 px, weight 600 | Home and settings page headings                                  |
| `text-wordmark`        | 19 / 24 px             | Sidebar brand wordmark                                           |
| `text-wordmark-splash` | 24 / 32 px             | Boot and splash brand wordmark                                   |

- **Brand font:** `font-brand` sets `"NewCM"` (falling back to serif) for the wordmark and brand headings; every other text uses the interface sans.
- **Radius:** `rounded-sm` (6px) for badges, checkboxes, and controls inside inputs; `rounded-md` (8px) for buttons, inputs, list rows, menu items, and code blocks; `rounded-lg` (10px) for cards, popovers, dialogs, the composer, and the main panel; `rounded-full` for avatars, switches, and pills.
- **Sizes:** controls are `h-7`, `h-8` (the default), or `h-9`, and `h-6` only inside inputs; one row uses one height. List rows are `h-8` with `text-small`; `Button variant="row"` draws one and marks the current row through `data-active`.
- **Hover and selection:** `bg-accent` is the hover color of every row, menu item, and ghost or outline button; `bg-selected` marks the current row and a pressed filter pill. Text on these tints uses `text-foreground` or `text-muted-foreground`.
- **Surfaces:** content containers take a border and no shadow. Floating surfaces (menus, select popups, anchored pickers, toasts) are an opaque `bg-popover` with a border and `shadow-overlay`; dialogs and sheets use `shadow-modal` over `bg-scrim`. `shadow-raised` is reserved for the composer and the floating toolbar. The base layer in `src/styles/index.css` colors text selection and the caret from `brand` and scrollbars from `input`.
- **Theme preview:** `[data-theme-preview="light"]` or `[data-theme-preview="dark"]` on any subtree scopes that mode's semantic tokens onto its descendants.

## Settings pages

Every settings page is composed from the five parts in `composites/SettingsPage`, `composites/SettingsSection`, and `composites/SettingsField`. The parts fix the page's geometry: feature code passes them text and controls and adds no spacing, border, or width around them.

| Part                     | Role                                                                                                                                                               |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `SettingsPage`           | The scrolling page: one centered 760 px column, or an 840 px two-pane workbench with a 220 px sticky `index` directory before the detail canvas                    |
| `SettingsSection`        | A 2-column hairline-divided group (`200px` aside with `title`, `description`, `meta`, and `actions` beside stacked rows)                                           |
| `SettingsSectionCompact` | A single-column hairline-divided group with a compact subhead bar (`title` and `actions`) above stacked rows                                                       |
| `SettingsField`          | A setting with a wide control: its label and description beside a control column of at most 320 px, stacked on narrow containers, with `align` (`center` or `top`) |
| `SettingsRow`            | A one-line hairline entry: a label with compact actions at its end, such as a listed model and its remove button                                                   |

- **Alignment:** the page heading, section titles or descriptions, and every row share the 760 px column edge with hairline dividers between rows and sections.
- **Rhythm:** sections are separated by top hairlines and `py-7` spacing (the first section omits its top hairline and top padding). Fields use `py-3.5`, one-line rows use `py-2.5`.
- **Controls:** theme selection uses radio preview tiles, a longer choice uses `Select`, and an on/off setting uses `Switch`. Inputs and selects fill the control column; other controls keep their width and sit at its end.
- **Feedback:** a field's validation error replaces its description through the `error` prop. A section's `error` and its `footer`, the bar holding the section's pending changes, follow the rows at 12 px.
- **Narrow widths:** a 2-column section stacks to one column below `lg`, a section subhead's actions wrap when needed, and a page title truncates before its actions.
- **Index and detail:** a page that lists entities, such as the providers, passes a 220 px `index` directory to `SettingsPage`.

## Motion utilities

`src/styles/` holds the token center `tokens.css`, the motion center `motion.css`, and `components/`, whose files hold the styles that target one component's internal parts and take that component's file name; `index.css`, exported as `@lemma/ui/styles.css`, loads them with Tailwind. Components write static styling as Tailwind classes, every keyframe and every shared transition that a utility class cannot express lives in `motion.css`, and the classes in `components/` belong to their component, not to the package interface.

Tailwind utilities, usable with variants such as `before:`:

| Class               | Behavior                                                            |
| ------------------- | ------------------------------------------------------------------- |
| `animate-draw`      | Draws an SVG path whose `pathLength` is `1`, after an 80 ms delay   |
| `animate-spin-once` | Spins one turn; remount the element to spin again                   |
| `live-dot`          | 6×6 px `brand` dot pulsing gently for active status indicators      |
| `qed-mark`          | 7×7 px `completion` square with a spring pop at the end of a reply  |
| `grid-collapse`     | Transitions between `0fr` and `1fr`; set `data-open="true"` to open |

Motion classes, which coordinate state attributes and override a component's own transition:

| Class              | Behavior                                                                                         |
| ------------------ | ------------------------------------------------------------------------------------------------ |
| `swap-layer`       | Cross-fades stacked layers: the one with `data-on="true"` shows, the others shrink and blur away |
| `stagger-children` | Lifts the children in one after another                                                          |

View transition classes, which the app passes to a React `<ViewTransition>` as its `share`, `enter`, or `exit` class; the old snapshot fades out, and the app never references the keyframes:

| Class           | Behavior                                      |
| --------------- | --------------------------------------------- |
| `ui-rise`       | Fades the new snapshot in from slightly below |
| `ui-from-start` | Fades the new snapshot in from slightly left  |
| `ui-from-end`   | Fades the new snapshot in from slightly right |

`html.theme-transition` applies a 240 ms color, background, border, and shadow transition when switching themes. The motion tokens provide five durations, `duration-fast` (120 ms), `duration-base` (150 ms), `duration-medium` (240 ms), `duration-slow` (280 ms), and `duration-reveal` (280 ms), and four easings, `ease-enter`, `ease-exit`, `ease-move`, and `ease-spring`. Every animation and motion class has a reduced-motion fallback that stops movement and looping while preserving the final state.

## Conventions

- Base UI composes through the `render` prop, not `asChild`: `<TooltipTrigger render={<Button size="icon" />}>`. Triggers render a `button` themselves, so a plain trigger takes its classes directly.
- Package-internal imports use the `#primitives/`, `#icons/`, `#hooks/`, and `#lib/` aliases, and files in `composites/` import each other through relative paths. Public consumers import from `@lemma/ui`. Components import `cn` from `#lib/cn`, whose configuration counts the type roles as font sizes, so merging `text-small` with `text-muted-foreground` keeps both.
- Components hold no text: every visible string and accessible name arrives through a required prop, such as `closeLabel` or `label`, and domain elements, such as the mark that ends a reply, arrive through slots. Colors come from theme roles, never the Tailwind palette.
- The `src/components/**` override in [`.oxlintrc.json`](.oxlintrc.json) lets components restyle composed controls, use arbitrary values for geometry, build classes with `cva`, and set ARIA roles directly.

## Adding a component

Run `npx shadcn add <name>` from `packages/ui/`; the CLI writes into `src/components/primitives/`. Bring the new file under the rules above: import `cn` from `#lib/cn`, drop `"use client"`, delete the parts Lemma does not use, turn its strings into props, replace palette colors with theme roles, and move its type sizes and radii onto the scales in [Styling](#styling). Add an Animate UI Lucide icon with `npx shadcn add @animate-ui/icons-lucide-<name>` from the same directory and move the generated file into `src/components/icons/`. A component Lemma writes goes into `src/components/composites/` as `PascalCase.tsx` with its test beside it, and a hook it needs sits beside it as `useThing.ts`; `src/hooks/` is for the hooks the shadcn CLI writes. Color, radius, type, and motion values shared with the desktop and Android clients belong in [`design/tokens.json`](../../design/README.md), followed by `just design-gen`; tokens only the web uses belong in `src/styles/tokens.css`. Then export the consumed symbols explicitly from `src/index.ts` and add the module to the catalog above. Existing components are changed by editing them directly; the CLI does not overwrite them.
