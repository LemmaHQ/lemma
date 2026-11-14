# Shared UI components

English | [中文](README.zh.md)

## Summary

`@lemma/ui` exports Lemma's shared shadcn/ui controls and AI Elements session components as TypeScript source. The package has two entries: `@lemma/ui` exports every component, icon, hook, and helper, the package's `cn`, and `AnimateIcon` and `toast` from the libraries underneath, and `@lemma/ui/styles.css` loads the theme and all component styles. Feature code imports nothing else from the package and none of those libraries directly. The package owns the semantic theme and the Streamdown styles and plugins; it holds no interface text, so the consuming application translates every string a component shows or announces and passes it as a prop.

`src/components/` holds three directories: `primitives/` for the domain-free shadcn controls and layout parts, `ai/` for the visual session components, and `icons/` for Animate UI's Lucide set and the brand logos. An icon that the Animate UI set does not provide uses the static icon of the same name from `lucide-react`.

<a id="component-catalog"></a>

## Component catalog

Check this list before writing a control in feature code, and reuse what fits.

| Module                           | Use                                                                            |
| -------------------------------- | ------------------------------------------------------------------------------ |
| `ai/code-block`                  | Syntax-highlighted code                                                        |
| `ai/composer-box`                | 680 px message composer with top dock, live running bar, and footer actions    |
| `ai/detail-pane`                 | Slide-in 52 px header detail drawer for prose, numbered code, web hits, output |
| `ai/message`                     | Message layout, Markdown response, completion mark, and message actions        |
| `ai/model-picker`                | Provider-grouped model selection menu                                          |
| `ai/prompt-input`                | Message composer form, field, tools, and submit control                        |
| `ai/reasoning`                   | Collapsible reasoning text and streaming label                                 |
| `ai/session`                     | Scroll-following transcript and scroll-to-latest control                       |
| `ai/session-stage`               | Centered 680 px reading stage with scroll shade, turn outline, and drawer slot |
| `ai/session-tree-pane`           | Branch tree drawer with search, filter pills, 16 px fork rails, and labels     |
| `ai/shimmer`                     | Sweeping text treatment for pending states                                     |
| `ai/step-timeline`               | Collapsible step summary bar expanding into tool-execution rows                |
| `ai/thinking-loader`             | Pending indicator before the first reply token                                 |
| `ai/tool`                        | Tool-call groups, status, arguments, and output                                |
| `ai/turn-card`                   | Conversation turn with sticky question card and hover timestamp                |
| `primitives/anchored-picker`     | 340 px anchored searchable popover with grouped options and keyboard nav       |
| `primitives/settings`            | The page, section, field, and row of a [settings page](#settings-pages)        |
| `primitives/theme-preview-tiles` | Three pure-CSS 92×58 px radio preview tiles for light, dark, and system modes  |
| `primitives/wordmark`            | Brand wordmark set in `NewCM` with a trailing brand dot                        |

`button`, `separator`, `tooltip`, the inline message `alert`, the sidebar and its sheet, `dropdown-menu`, the overlays `dialog` and `alert-dialog`, the toast container `sonner`, the layout parts `avatar`, `collapsible`, `empty`, `scroll-area`, and `skeleton`, and the form controls `checkbox`, `field`, `input`, `input-group`, `password-input`, `label`, `select`, `switch`, `textarea`, `toggle`, and `toggle-group` are also shared controls under `primitives/`. `useSidebar` reads the sidebar state. The [shadcn docs](https://ui.shadcn.com/docs/components) describe the underlying props and composition.

Two pairs are easy to confuse:

- **`AlertDialog` against a toast.** `AlertDialog` asks before an action and blocks until the user answers. A toast reports the outcome of an action after it ran and blocks nothing.
- **`Tooltip` against `title`.** `Tooltip` shows on keyboard focus and follows the theme; the `title` attribute does neither. Icon-only buttons use `Tooltip` plus an `aria-label`.

## Styling

Components and feature code style through the theme's utilities. The color roles and radii come from [design/tokens.json](../../design/README.md); `src/styles/tokens.css` adds the type roles, font stacks, and shadows and maps everything into Tailwind. Lint rejects Tailwind's type sizes, radii from `rounded-xl` up, and arbitrary radii, so every element draws from the scales below.

| Type role      | Size / line height     | Use                                                              |
| -------------- | ---------------------- | ---------------------------------------------------------------- |
| `text-caption` | 12 / 18 px             | Timestamps, group labels, code-block labels                      |
| `text-small`   | 13 / 20 px             | List rows, sidebar items, tool rows, descriptions, alerts        |
| `text-body`    | 14 / 22 px             | Default interface text, buttons, menu items, inputs from `md` up |
| `text-reading` | 15.5 / 27 px           | Message text, the composer, inputs below `md`                    |
| `text-title`   | 15 / 24 px, weight 600 | Section and dialog titles                                        |
| `text-display` | 17 / 24 px, weight 600 | Home and settings page headings                                  |

- **Brand font:** `font-brand` sets `"NewCM"` (falling back to serif) for the wordmark and brand headings; every other text uses the interface sans.
- **Radius:** `rounded-sm` (6px) for badges, checkboxes, and controls inside inputs; `rounded-md` (8px) for buttons, inputs, list rows, menu items, code blocks, and alerts; `rounded-lg` (10px) for cards, popovers, dialogs, the composer, and the main panel; `rounded-full` for avatars, switches, and pills.
- **Sizes:** controls are `h-7`, `h-8` (the default), or `h-9`, and `h-6` only inside inputs; one row uses one height. List rows are `h-8` with `text-small`; `Button variant="row"` draws one and marks the current row through `data-active`.
- **Hover and selection:** `bg-accent` is the hover color of every row, menu item, and ghost or outline button; `bg-selected` marks the current row and a pressed toggle. Text on these tints uses `text-foreground` or `text-muted-foreground`.
- **Surfaces:** content containers take a border and no shadow. Floating surfaces (menus, select popups, the model picker, toasts) are an opaque `bg-popover` with a border and `shadow-overlay`; dialogs and sheets use `shadow-modal` over `bg-scrim`. `shadow-raised` is reserved for the composer and the floating toolbar. The base layer in `src/styles/index.css` colors text selection and the caret from `brand` and scrollbars from `input`.

## Settings pages

Every settings page is composed from the four parts of `primitives/settings`. The parts fix the page's geometry: feature code passes them text and controls and adds no spacing, border, or width around them.

| Part              | Role                                                                                                                                                               |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `SettingsPage`    | The scrolling page: one centered column up to 760 px wide with an optional hairline-underlined `text-display` header (`title`, `media`, `actions`)                 |
| `SettingsSection` | A cardless hairline-divided group: 2-column grid (`200px` aside + rows) when `description` or `meta` is passed, or compact subhead above hairline-divided rows     |
| `SettingsField`   | A setting with a wide control: its label and description beside a control column of at most 320 px, stacked on narrow containers, with `align` (`center` or `top`) |
| `SettingsRow`     | A one-line hairline entry: a label with compact actions at its end, such as a listed model and its remove button                                                   |

- **Alignment:** the page heading, section titles or descriptions, and every row share the 760 px column edge with hairline dividers between rows and sections.
- **Rhythm:** sections are separated by top hairlines and `py-7` spacing (the first section omits its top hairline and top padding). Fields use `py-3.5`, one-line rows use `py-2.5`.
- **Controls:** a choice among up to three options is a `ToggleGroup` or `ThemePreviewTiles`, a longer choice is a `Select`, and an on/off setting is a `Switch`. Inputs and selects fill the control column; other controls keep their width and sit at its end.
- **Feedback:** a field's validation error replaces its description through the `error` prop. A section's `error` and its `footer`, the bar holding the section's pending changes, follow the rows at 12 px.
- **Narrow widths:** a 2-column section stacks to one column below `lg`, a section subhead's actions wrap when needed, and a page title truncates before its actions.
- **Index and detail:** a page that lists entities, such as the providers, puts a 256 px index pane titled in `text-title` before the `SettingsPage` of the open entity.

## Motion utilities

`src/styles/` holds the token center `tokens.css`, the motion center `motion.css`, and `components/`, whose files hold the styles that target one component's internal parts and take that component's file name; `index.css`, exported as `@lemma/ui/styles.css`, loads them with Tailwind. Components write static styling as Tailwind classes, every keyframe and every shared transition that a utility class cannot express lives in `motion.css`, and the classes in `components/` belong to their component, not to the package interface.

Tailwind utilities, usable with variants such as `before:`:

| Class               | Behavior                                                            |
| ------------------- | ------------------------------------------------------------------- |
| `animate-blur-in`   | Reveals content from a slight vertical offset and blur              |
| `animate-draw`      | Draws an SVG path whose `pathLength` is `1`, after an 80 ms delay   |
| `animate-pop`       | Reveals content with a spring-like scale transition                 |
| `animate-card-in`   | Lifts a card in from a slight offset and scale                      |
| `animate-grow-y`    | Grows an element downward from zero height                          |
| `animate-morph-in`  | Brings changed text up from below with a blur                       |
| `animate-ray`       | Fades a spinner ray in a loop, offset by `--ray-index`              |
| `animate-spin-loop` | Spins continuously                                                  |
| `animate-spin-once` | Spins one turn; remount the element to spin again                   |
| `live-dot`          | 6×6 px `brand` dot pulsing gently for active status indicators      |
| `qed-mark`          | 7×7 px `completion` square with a spring pop at the end of a reply  |
| `text-sweep`        | Sweeps a theme-colored highlight across text                        |
| `grid-collapse`     | Transitions between `0fr` and `1fr`; set `data-open="true"` to open |

Motion classes, which coordinate state attributes and override a component's own transition:

| Class              | Behavior                                                                                         |
| ------------------ | ------------------------------------------------------------------------------------------------ |
| `press-scale`      | Shrinks a button while pressed, to `--press-scale` (default `0.96`)                              |
| `swap-layer`       | Cross-fades stacked layers: the one with `data-on="true"` shows, the others shrink and blur away |
| `swap-turn`        | Like `swap-layer`, with a slight turn                                                            |
| `stagger-children` | Lifts the children in one after another                                                          |

View transition classes, which the app passes to a React `<ViewTransition>` as its `share`, `enter`, or `exit` class; the old snapshot fades out, and the app never references the keyframes:

| Class           | Behavior                                                                 |
| --------------- | ------------------------------------------------------------------------ |
| `ui-fade`       | Fades the new snapshot in                                                |
| `ui-rise`       | Fades the new snapshot in from slightly below                            |
| `ui-from-start` | Fades the new snapshot in from slightly left                             |
| `ui-from-end`   | Fades the new snapshot in from slightly right                            |
| `ui-morph`      | Moves and resizes the group to the new box and fades the new snapshot in |

`html.theme-transition` applies a 240 ms color, background, border, and shadow transition when switching themes. The motion tokens provide five durations, `duration-fast` (120 ms), `duration-base` (150 ms), `duration-medium` (240 ms), `duration-slow` (280 ms), and `duration-reveal` (280 ms), and four easings, `ease-enter`, `ease-exit`, `ease-move`, and `ease-spring`. Every animation and motion class has a reduced-motion fallback that stops movement and looping while preserving the final state.

## Conventions

- Base UI composes through the `render` prop, not `asChild`: `<TooltipTrigger render={<Button size="icon" />}>`. Triggers render a `button` themselves, so a plain trigger takes its classes directly.
- Package-internal imports use the `#primitives/`, `#ai/`, `#icons/`, `#hooks/`, and `#lib/` aliases. Public consumers import from `@lemma/ui`. Components import `cn` from `#lib/cn`, whose configuration counts the type roles as font sizes, so merging `text-small` with `text-muted-foreground` keeps both.
- Components hold no text: every visible string and accessible name arrives through a required prop, such as `closeLabel`, `label`, or a typed `labels` object, and text that embeds a value the component computes arrives as a function, such as `thoughtFor(duration)`. Colors come from theme roles, never the Tailwind palette.
- The `src/components/**` override in [`.oxlintrc.json`](.oxlintrc.json) lets components restyle composed controls, use arbitrary values for geometry, build classes with `cva`, and set ARIA roles directly.

## Adding a component

Run `npx shadcn add <name>` from `packages/ui/`; the CLI writes into `src/components/primitives/`. Bring the new file under the rules above: import `cn` from `#lib/cn`, drop `"use client"`, delete the parts Lemma does not use, turn its strings into props, replace palette colors with theme roles, and move its type sizes and radii onto the scales in [Styling](#styling). Add an Animate UI Lucide icon with `npx shadcn add @animate-ui/icons-lucide-<name>` from the same directory and move the generated file into `src/components/icons/`. Color, radius, and motion values shared with the desktop and Android clients belong in [`design/tokens.json`](../../design/README.md), followed by `just design-gen`; tokens only the web uses belong in `src/styles/tokens.css`. Then export the module from `src/index.ts` and add it to the catalog above. Existing components are changed by editing them directly; the CLI does not overwrite them.
