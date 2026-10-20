# Web UI style reference

English | [中文](web-styling.zh.md)

This reference defines styling ownership and component rules for `web/`, which is also the desktop renderer. Theme colors and motion values come from the [design tokens](../design/README.md), and the remaining theme values live in [`web/src/index.css`](../web/src/index.css); this document names roles and rules and does not repeat the values.

## Ownership

- [`design/tokens.json`](../design/tokens.json) owns the theme colors and the motion durations and easings. The design token generator writes the color variables of both themes and the motion variables into `web/src/tokens.css`, which Git ignores and `index.css` imports.
- [`web/src/index.css`](../web/src/index.css) owns the rest of the theme and the global styles: the base `--radius` of the shadcn preset in [`components.json`](../web/components.json), the shadow levels, and the Tailwind `@theme` mappings for colors, motion, the heading font, and the radius scale. It also holds the base layer, the reduced-motion rule, the `duration-*` utility that reads the duration tokens, the desktop titlebar rules, and the Streamdown stylesheet import with the `@source` lines that let Tailwind see Streamdown's classes. Type sizes and font stacks are Tailwind's defaults.
- [`web/src/components/ui/`](../web/src/components/ui/README.md) owns the shared controls and their variants; `web/src/components/ai-elements/` owns the chat components: the composer, messages, reasoning, tool calls, code blocks, and the model selector.
- Feature code in `web/src/app/` and `web/src/features/` composes utilities and controls. It defines no global style and no theme.

The theme is the `dark` class on `<html>`; without it the light theme applies. An inline script in `index.html` sets it before first paint, and `next-themes`, mounted in `App`, updates it when the preference or the system scheme changes.

## Styling stack

Lemma keeps the principles of the DeepSeek Harness styling reference and expresses them in Tailwind CSS v4 and shadcn/ui, where DSH uses CSS Modules and no component library:

| Principle                                                                  | Lemma form                                                                                           |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Components consume semantic tokens, never palette values or literal colors | Semantic utilities from the theme: `bg-card`, `text-muted-foreground`, `border-border`, `rounded-md` |
| Light and dark overrides belong to the theme owner                         | `tokens.json` gives each color role both values; no `dark:` variant appears in feature code          |
| Shared controls live in one catalog                                        | shadcn components in `components/ui/`, combined with `cn()`                                          |
| Hover styles apply only to hover-capable pointers                          | Tailwind v4 already compiles `hover:` inside `@media (hover: hover)`                                 |

## Component rules

- Reuse the control before restyling one: check the [component catalog](../web/src/components/ui/README.md#component-catalog). A visual difference that more than one feature needs becomes a variant of the shared component, not a second copy.
- Use semantic utilities only. Do not write hex colors, palette values, or arbitrary values such as `bg-[#fff]`, `text-[13px]`, or `w-[372px]`. Arbitrary values are limited to geometry no scale step expresses, such as Base UI CSS variables (`origin-(--transform-origin)`) and `calc()` over theme values.
- Do not write `dark:`. A difference between themes is a semantic token with different light and dark values.
- Use Tailwind's type scale (`text-xs`, `text-sm`, `text-xl`); each size carries its line height. Use weights 400 and 500 only (`font-normal`, `font-medium`); hierarchy comes from size, weight, and the two text colors, not from more grays or heavier weights.
- Keep keyboard focus visible: interactive elements show the `ring` color on `focus-visible`.
- A control revealed on hover, such as a row's inline actions, is also revealed on keyboard focus within its row and stays visible on devices without hover.
- Transitions and animations use the motion tokens and follow the [motion rules](#motion).
- Borders, shadows, and corner radii of a control come from its shared component; feature code adds none.
- Dropdown menus and select lists use the translucent menu of the shadcn `default-translucent` menu style, the popover color plus a backdrop blur; feature code does not override it.
- Icons come from Tabler. Inside shared controls they take the control's default size; elsewhere use `size-4`, `size-3.5` in dense rows, and `size-3` for sidebar inline actions. Every icon-only button has an accessible name and a `Tooltip`, not a `title` attribute.

## Visual system

### Color

Neutral grays carry the surfaces and text. `primary` and `ring` are the brand blue, so primary buttons and focus rings carry it; `destructive` is red and marks delete actions and error text. Shared components define their own hover colors.

| Role              | Utilities                               | Use                                                                   |
| ----------------- | --------------------------------------- | --------------------------------------------------------------------- |
| Canvas            | `bg-background`                         | The main canvas and panes                                             |
| Sidebar zone      | `bg-sidebar`, `bg-sidebar-accent`       | The session sidebar, the settings rail, and the selected row in them  |
| Panel and overlay | `bg-card`, `bg-popover`                 | Cards, menus, selects, dialogs                                        |
| Fills             | `bg-secondary`, `bg-muted`, `bg-accent` | The secondary button, the user bubble, code, hover and selected fills |

Text has two levels: `text-foreground` for primary text and `text-muted-foreground` for captions, metadata, group headers, and placeholders. Each surface has a matching `*-foreground` color.

### Elevation

| Level      | Treatment                                                       | Use                                              |
| ---------- | --------------------------------------------------------------- | ------------------------------------------------ |
| Flat       | No border, no shadow                                            | Body text, assistant messages, sidebar rows      |
| Panel      | `bg-card` or `bg-background` with a border                      | Cards, panes, settings panels                    |
| Raised     | `shadow-raised`                                                 | The floating and inset sidebar, the selected tab |
| Fill shift | `bg-accent` or `bg-muted`                                       | Hovered and selected rows, ghost buttons         |
| Overlay    | `bg-popover`, a `ring-foreground/10` edge, and `shadow-overlay` | Menus, selects, popovers, hover cards            |
| Modal      | `bg-popover` over a dimmed backdrop; sheets add `shadow-modal`  | Dialogs, alert dialogs, sheets                   |
| Focus      | `ring` color on `focus-visible`                                 | Focused controls                                 |

The tooltip is the one inverse surface: `bg-foreground` with `text-background`, no shadow. Shadows come only from the three levels above; Tailwind's shadow scale (`shadow-sm`, `shadow-md`) is not used.

### Type

Text uses Tailwind's type scale and its system font stacks (`font-sans`, `font-mono`). `text-sm` is the default UI text: lists, forms, chat messages. `text-xs` carries captions, metadata, and code; `text-xl` and `text-3xl` carry empty-state and page titles.

### Motion

Motion shows where an element came from, confirms that an action registered, or marks a change of state; an animation that does none of these is left out.

| Duration | Utility           | Use                                                                    |
| -------- | ----------------- | ---------------------------------------------------------------------- |
| `fast`   | `duration-fast`   | Hover and press feedback; small overlays closing                       |
| `base`   | `duration-base`   | Small overlays opening: tooltips, menus, selects, popovers; icon swaps |
| `medium` | `duration-medium` | Regions expanding and collapsing; dialogs                              |
| `slow`   | `duration-slow`   | Sheets and the sidebar sliding in and out                              |

| Easing  | Utility      | Use                                                    |
| ------- | ------------ | ------------------------------------------------------ |
| `enter` | `ease-enter` | An element appearing; it decelerates into place        |
| `exit`  | `ease-exit`  | An element leaving; it accelerates away                |
| `move`  | `ease-move`  | An element changing in place: size, position, or color |

- A transition without a duration or easing utility uses `base` and `move`.
- An element leaves one duration step faster than it entered: a menu opens with `duration-base` and closes with `duration-fast`.
- Tailwind's numeric durations (`duration-150`) and default easings (`ease-out`, `ease-in-out`) are not used.
- Under `prefers-reduced-motion: reduce`, `index.css` cancels the translation, scale, rotation, and blur of `animate-in` and `animate-out`, so overlays only fade. A transition that moves or resizes an element adds `motion-reduce:transition-none`.
- CSS transitions and the tw-animate-css `animate-in` and `animate-out` utilities carry overlays, collapsing regions, and state changes. The Motion library is reserved for effects CSS cannot express, such as the text shimmer.

### Density

- A control takes its height from its shared component's `size` prop, not from height classes. The default size fits buttons, inputs, selects, toggles, tabs, and sidebar rows; `sm` and `icon-sm` fit actions in pane headers and list rows; `xs` and `icon-xs` fit actions inside a field and inline links; the sidebar's `lg` row holds the account avatar.
- Controls in one row or toolbar share one size.
- Spacing follows the Tailwind scale: `gap-1` to `gap-2` between an icon and its label or between adjacent controls, `gap-3` to `gap-4` between items of a group, and `gap-6` or more between sections.

## Corner radii

The [corner-radius standard](ui-radius.md) defines the radius roles, nesting, and hover geometry.

## Changing the system

Colors and motion values change in `design/tokens.json`; shadow levels change in `index.css`. The web and desktop npm scripts regenerate the outputs before they run, and `just design-gen` runs the generator by hand. A component added through the shadcn CLI follows the [component README](../web/src/components/ui/README.md#adding-a-component); color variables it writes move into `tokens.json`. Consume the semantic utility from components. When a shared control's variants or behavior change, update the [component catalog](../web/src/components/ui/README.md#component-catalog) in the same change.
