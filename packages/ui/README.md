# Shared UI components

English | [中文](README.zh.md)

## Summary

`@lemma/ui` exports Lemma's shared shadcn/ui controls and AI Elements conversation components as TypeScript source. The package has two entries: `@lemma/ui` exports every component, icon, hook, and helper, together with `AnimateIcon`, `cn`, and `toast` from the libraries underneath, and `@lemma/ui/styles.css` loads the theme and all component styles. Feature code imports nothing else from the package and none of those libraries directly. The package owns the semantic theme and the Streamdown styles and plugins; it holds no interface text, so the consuming application translates every string a component shows or announces and passes it as a prop.

`src/components/` holds three directories: `primitives/` for the domain-free shadcn controls and layout parts, `ai/` for the visual conversation components, and `icons/` for Animate UI's Lucide set and the brand logos. An icon that the Animate UI set does not provide uses the static icon of the same name from `lucide-react`.

<a id="component-catalog"></a>

## Component catalog

Check this list before writing a control in feature code, and reuse what fits.

| Module               | Use                                                         |
| -------------------- | ----------------------------------------------------------- |
| `ai/code-block`      | Syntax-highlighted code                                     |
| `ai/conversation`    | Scroll-following transcript and scroll-to-latest control    |
| `ai/message`         | Message layout, Markdown response, and message actions      |
| `ai/model-picker`    | Provider-grouped model selection menu                       |
| `ai/prompt-input`    | Message composer form, field, tools, and submit control     |
| `ai/reasoning`       | Collapsible reasoning text and streaming label              |
| `ai/shimmer`         | Sweeping text treatment for pending states                  |
| `ai/suggestion`      | Suggested prompt button                                     |
| `ai/thinking-loader` | Pending indicator before the first reply token              |
| `ai/tool`            | Tool-call groups, status, arguments, and output             |
| `primitives/reveal`  | Height and opacity transition for content toggled by `open` |

`button`, `separator`, `tooltip`, the sidebar and its sheet, `dropdown-menu`, the overlays `dialog` and `alert-dialog`, the toast container `sonner`, the layout parts `avatar`, `collapsible`, `empty`, `item`, `scroll-area`, and `skeleton`, and the form controls `checkbox`, `field`, `input`, `input-group`, `password-input`, `label`, `select`, `switch`, `textarea`, `toggle`, and `toggle-group` are also shared controls under `primitives/`. `useSidebar` reads the sidebar state. The [shadcn docs](https://ui.shadcn.com/docs/components) describe the underlying props and composition.

Two pairs are easy to confuse:

- **`AlertDialog` against a toast.** `AlertDialog` asks before an action and blocks until the user answers. A toast reports the outcome of an action after it ran and blocks nothing.
- **`Tooltip` against `title`.** `Tooltip` shows on keyboard focus and follows the theme; the `title` attribute does neither. Icon-only buttons use `Tooltip` plus an `aria-label`.

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
| `text-sweep`        | Sweeps a theme-colored highlight across text                        |
| `grid-collapse`     | Transitions between `0fr` and `1fr`; set `data-open="true"` to open |

Motion classes, which coordinate state attributes and override a component's own transition:

| Class              | Behavior                                                                                         |
| ------------------ | ------------------------------------------------------------------------------------------------ |
| `press-scale`      | Shrinks a button while pressed, to `--press-scale` (default `0.96`)                              |
| `swap-layer`       | Cross-fades stacked layers: the one with `data-on="true"` shows, the others shrink and blur away |
| `swap-turn`        | Like `swap-layer`, with a slight turn                                                            |
| `stagger-children` | Lifts the children in one after another                                                          |

View transition utilities, for an element the app gives a `view-transition-name`; its old snapshot fades out, and the app never references the keyframes:

| Class                        | Behavior                                                                 |
| ---------------------------- | ------------------------------------------------------------------------ |
| `view-transition-fade`       | Fades the new snapshot in                                                |
| `view-transition-rise`       | Fades the new snapshot in from slightly below                            |
| `view-transition-from-start` | Fades the new snapshot in from slightly left                             |
| `view-transition-from-end`   | Fades the new snapshot in from slightly right                            |
| `view-transition-morph`      | Moves and resizes the group to the new box and fades the new snapshot in |

The motion tokens also provide `duration-reveal`, `ease-morph`, and `ease-spring`. Every animation and motion class has a reduced-motion fallback that stops movement and looping while preserving the final state.

## Conventions

- Base UI composes through the `render` prop, not `asChild`: `<TooltipTrigger render={<Button size="icon" />}>`. Triggers render a `button` themselves, so a plain trigger takes its classes directly.
- Package-internal imports use the `#primitives/`, `#ai/`, `#icons/`, `#hooks/`, and `#lib/` aliases. Public consumers import from `@lemma/ui`.
- Components hold no text: every visible string and accessible name arrives through a required prop, such as `closeLabel`, `label`, or a typed `labels` object, and text that embeds a value the component computes arrives as a function, such as `thoughtFor(duration)`. Colors come from theme roles, never the Tailwind palette.
- The `src/components/**` override in [`.oxlintrc.json`](.oxlintrc.json) lets components restyle composed controls, use arbitrary values for geometry, build classes with `cva`, and set ARIA roles directly.

## Adding a component

Run `npx shadcn add <name>` from `packages/ui/`; the CLI writes into `src/components/primitives/`. Bring the new file under the rules above: import `cn` from `cn`, drop `"use client"`, delete the parts Lemma does not use, turn its strings into props, and replace palette colors with theme roles. Add an Animate UI Lucide icon with `npx shadcn add @animate-ui/icons-lucide-<name>` from the same directory and move the generated file into `src/components/icons/`. Color and motion values shared with the desktop and Android clients belong in [`design/tokens.json`](../../design/README.md), followed by `just design-gen`; tokens only the web uses belong in `src/styles/tokens.css`. Then export the module from `src/index.ts` and add it to the catalog above. Existing components change by editing them; the CLI never overwrites them.
