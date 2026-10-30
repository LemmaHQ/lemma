# Shared UI components

English | [中文](README.zh.md)

## Summary

`@lemma/ui` exports Lemma's shared shadcn/ui controls and AI Elements conversation components as TypeScript source. Feature code imports controls from `@lemma/ui/components/<name>` and conversation components from `@lemma/ui/components/ai-elements/<name>`. The package owns their semantic theme, Streamdown styles, and `ui` i18next namespace; consuming applications register the locale JSON from `@lemma/ui/locales/<language>.json`.

Icons come from Animate UI's Lucide set under `@lemma/ui/icons/<name>`. An icon that the set does not provide uses the static icon of the same name from `lucide-react`. Brand logos come from `@lemma/ui/components/brand/<name>`.

<a id="component-catalog"></a>

## Component catalog

Check this list before writing a control in feature code, and reuse what fits.

| Module                     | Use                                                      |
| -------------------------- | -------------------------------------------------------- |
| `badge`                    | Short status or count label                              |
| `ai-elements/code-block`   | Syntax-highlighted code                                  |
| `ai-elements/conversation` | Scroll-following transcript and scroll-to-latest control |
| `ai-elements/message`      | Message layout, Markdown response, and message actions   |
| `ai-elements/model-picker` | Provider-grouped model selection menu                    |
| `ai-elements/prompt-input` | Message composer form, field, tools, and submit control  |
| `ai-elements/reasoning`    | Collapsible reasoning text and streaming label           |
| `ai-elements/shimmer`      | Sweeping text treatment for pending states               |
| `ai-elements/suggestion`   | Suggested prompt button                                  |
| `ai-elements/tool`         | Tool-call groups, status, arguments, and output          |

`button`, `separator`, `tooltip`, the sidebar and its sheet, `dropdown-menu`, the overlays `dialog` and `alert-dialog`, the layout parts `avatar`, `collapsible`, `empty`, `item`, `scroll-area`, and `skeleton`, and the form controls `checkbox`, `field`, `input`, `input-group`, `password-input`, `label`, `select`, `switch`, `textarea`, `toggle`, and `toggle-group` are also shared controls. Import `@lemma/ui/hooks/use-sidebar` for the sidebar state. The [shadcn docs](https://ui.shadcn.com/docs/components) describe the underlying props and composition.

Two pairs are easy to confuse:

- **`AlertDialog` against a toast.** `AlertDialog` asks before an action and blocks until the user answers. A toast reports the outcome of an action after it ran and blocks nothing.
- **`Tooltip` against `title`.** `Tooltip` shows on keyboard focus and follows the theme; the `title` attribute does neither. Icon-only buttons use `Tooltip` plus an `aria-label`.

## Motion utilities

`src/styles/motion.css` defines the shared animation classes. `globals.css` imports them for package consumers, and the web CSS entry imports `@lemma/ui/motion.css` directly.

| Class             | Behavior                                                            |
| ----------------- | ------------------------------------------------------------------- |
| `animate-blur-in` | Reveals content from a slight vertical offset and blur              |
| `animate-draw`    | Draws an SVG path whose `pathLength` is `1`, after an 80 ms delay   |
| `animate-pop`     | Reveals content with a spring-like scale transition                 |
| `text-sweep`      | Sweeps a theme-colored highlight across text                        |
| `grid-collapse`   | Transitions between `0fr` and `1fr`; set `data-open="true"` to open |

The motion tokens also provide `duration-reveal`, `duration-settle`, `ease-morph`, and `ease-spring`. Every shared animation has a reduced-motion fallback that stops movement and looping while preserving the final state.

## Conventions

- Base UI composes through the `render` prop, not `asChild`: `<TooltipTrigger render={<Button size="icon" />}>`. Triggers render a `button` themselves, so a plain trigger takes its classes directly.
- Package-internal component and icon imports use the `#components/` and `#icons/` aliases. Public consumers use the `@lemma/ui` exports.
- User-visible text, including accessible names, uses `useTranslation("ui")`; English and Chinese locale files carry the same keys. Colors come from theme roles, never the Tailwind palette.
- The `src/components/**` override in [`.oxlintrc.json`](.oxlintrc.json) lets components restyle composed controls, use arbitrary values for geometry, build classes with `cva`, and set ARIA roles directly.

## Adding a component

Run `npx shadcn add <name>` from `packages/ui/` and bring the new file under the rules above: import `cn` from `cn`, drop `"use client"`, delete the parts Lemma does not use, move strings into the `ui` locale files, and replace palette colors with theme roles. Add an Animate UI Lucide icon with `npx shadcn add @animate-ui/icons-lucide-<name>` from the same directory. Color and motion variables belong in [`design/tokens.json`](../../design/README.md), followed by `just design-gen`. Then add the module to the catalog above. Existing components change by editing them; the CLI never overwrites them.
