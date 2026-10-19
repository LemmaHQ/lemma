# Web UI style reference

English | [中文](web-styling.zh.md)

This reference defines styling ownership and component rules for `web/`, which is also the desktop renderer. Theme colors come from the [design tokens](../design/README.md), and the remaining theme values live in [`web/src/index.css`](../web/src/index.css); this document names roles and rules and does not repeat the values.

## Ownership

- [`design/tokens.json`](../design/tokens.json) owns the theme colors. The design token generator writes the color variables of both themes into `web/src/tokens.css`, which Git ignores and `index.css` imports.
- [`web/src/index.css`](../web/src/index.css) owns the rest of the theme and the global styles: the base `--radius` of the shadcn preset in [`components.json`](../web/components.json), and the Tailwind `@theme` mappings for colors, the heading font, and the radius scale. It also holds the base layer, the desktop titlebar rules, and the Streamdown stylesheet import with the `@source` lines that let Tailwind see Streamdown's classes. Type sizes, font stacks, motion, and shadows are Tailwind's defaults.
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
- Transitions use Tailwind's duration and easing utilities and respect reduced motion: wrap movement in `motion-safe:` or remove it under `motion-reduce:`.
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

| Level      | Treatment                                         | Use                                                        |
| ---------- | ------------------------------------------------- | ---------------------------------------------------------- |
| Flat       | No border, no shadow                              | Body text, assistant messages, sidebar rows                |
| Panel      | `bg-card` or `bg-background` with a border        | Cards, panes, settings panels                              |
| Fill shift | `bg-accent` or `bg-muted`                         | Hovered and selected rows, ghost buttons, the selected tab |
| Overlay    | The shared component's popover surface and shadow | Menus, selects, alert dialogs                              |
| Focus      | `ring` color on `focus-visible`                   | Focused controls                                           |

The tooltip is the one inverse surface: `bg-foreground` with `text-background`, no shadow.

### Type

Text uses Tailwind's type scale and its system font stacks (`font-sans`, `font-mono`). `text-sm` is the default UI text: lists, forms, chat messages. `text-xs` carries captions, metadata, and code; `text-xl` and `text-3xl` carry empty-state and page titles.

## Corner radii

The [corner-radius standard](ui-radius.md) defines the radius roles, nesting, and hover geometry.

## Changing the system

Colors change in `design/tokens.json`. The web and desktop npm scripts regenerate the outputs before they run, and `just design-gen` runs the generator by hand. Rerunning the shadcn CLI as the [component README](../web/src/components/ui/README.md) describes keeps its `@theme inline` block and `--radius` in `index.css`; color variables it writes move into `tokens.json`. Consume the semantic utility from components. When a shared control's variants or behavior change, update the [component catalog](../web/src/components/ui/README.md#component-catalog) in the same change.
