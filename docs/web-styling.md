# Web UI style reference

English | [中文](web-styling.zh.md)

This reference defines styling ownership and component rules for `web/`, which is also the desktop renderer. Token values live in [`design/tokens.json`](../design/tokens.json) ([format](../design/README.md)); this document names roles and rules and does not repeat the values.

## Ownership

- [`design/tokens.json`](../design/tokens.json) owns the static palette, the semantic aliases of each theme, type roles, radii, motion, font stacks, and elevation shadows. The generator turns them into `web/src/styles/tokens.css`.
- [`web/src/styles/`](../web/src/styles/README.md) owns global styles: font faces, the base layer, the glass and menu materials, and scrollbar colors.
- [`web/src/components/ui/`](../web/src/components/ui/README.md) owns the shared controls and their variants.
- Feature code in `web/src/app/` and `web/src/features/` composes utilities and controls. It defines no global style and no theme.

The theme is the `data-theme` attribute on `<html>`, `light` or `dark`. An inline script in `index.html` sets it before first paint, and `features/preferences/theme.ts` updates it when the preference or the system scheme changes.

## Styling stack

Lemma keeps the principles of the DeepSeek Harness styling reference and expresses them in Tailwind CSS v4 and shadcn/ui, where DSH uses CSS Modules and no component library:

| Principle | Lemma form |
| --- | --- |
| Components consume semantic tokens, never palette values or literal colors | Semantic utilities generated from the tokens: `bg-card`, `text-muted-foreground`, `border-border`, `rounded-md` |
| Light and dark overrides belong to the theme owner | `tokens.css` holds both themes; no `dark:` variant appears in feature code or in `components/ui/` |
| Shared controls live in one catalog | shadcn components in `components/ui/`, combined with `cn()` |
| Hover styles apply only to hover-capable pointers | Tailwind v4 already compiles `hover:` inside `@media (hover: hover)` |

## Component rules

- Reuse the control before restyling one: check the [component catalog](../web/src/components/ui/README.md#component-catalog). A visual difference that more than one feature needs becomes a variant of the shared component, not a second copy.
- Use semantic utilities only. Do not write hex colors, palette values, or arbitrary values such as `bg-[#fff]`, `text-[13px]`, or `w-[372px]`. Arbitrary values are limited to geometry no scale step expresses, such as Radix CSS variables (`origin-(--radix-…)`) and `calc()` over theme values.
- Do not write `dark:`. A difference between themes is a semantic token with different light and dark values.
- Use the type role utilities (`text-sm`, `text-caption`, `text-mono`); each carries its line height. Use weights 400 and 500 only (`font-normal`, `font-medium`); hierarchy comes from size, weight, and the two text colors, not from more grays or heavier weights.
- Keep keyboard focus visible: interactive elements show the `ring` color on `focus-visible`.
- A control revealed on hover, such as a row's inline actions, is also revealed on keyboard focus within its row and stays visible on devices without hover.
- Transitions use the motion tokens and respect reduced motion: wrap movement in `motion-safe:` or remove it under `motion-reduce:`.
- Flat surfaces separate by hairline borders: neutral borders (`border-border`, `border-input`) draw at 0.5px. Dashed affordances and state-colored borders keep 1px.
- Elevated surfaces (menus, selects, alert dialogs, the composer) take `border-0` and an elevation shadow (`shadow-md`, `shadow-composer`) whose first layer is the 0.5px hairline stroke. Never pair a neutral border with an elevation shadow.
- Dropdown menus and select lists use the translucent menu material owned by `styles/theme.css`, the popover color plus a backdrop blur; feature code does not override it. Alert dialog masks stay dark and translucent without blur.
- Rounded corners use the superellipse curve where the engine supports `corner-shape`; full-round shapes pair `rounded-full` with `corner-shape: round`.
- Icons come from Lucide at `size-4`, `size-3.5` in dense rows, and `size-3` for sidebar inline actions. Every icon-only button has an accessible name and a `Tooltip`, not a `title` attribute.

## Visual system

### Color

Blue `primary` is the single chromatic accent. It marks primary buttons, the focus ring, link emphasis, and the armed send button, and nothing else. `destructive` marks delete actions and error text. Hover darkens through opacity (`hover:bg-primary/90`), so no hover color tokens exist.

Neutrals are black or white at fixed alpha tiers, so both themes share one hierarchy:

| Role | Utilities | Use |
| --- | --- | --- |
| Canvas | `bg-background` | The main canvas and panes |
| Sidebar zone | `bg-sidebar`, `bg-sidebar-accent` | The session sidebar, the settings rail, and the selected row in them |
| Panel and overlay | `bg-card`, `bg-popover` | Cards, menus, selects, dialogs |
| Glass | `.glass` | The conversation top bar, the sidebar expand button, the composer: the `glass` color with a backdrop blur |
| Fills | `bg-secondary`, `bg-muted`, `bg-accent` | The secondary button, the user bubble, hover and selected fills |
| Code | `bg-code`, `border-code-border` | Code blocks and inline code |

Text has two levels: `text-foreground` for primary text and `text-muted-foreground` for captions, metadata, group headers, and placeholders. Each surface has a matching `*-foreground` color.

### Elevation

| Level | Treatment | Use |
| --- | --- | --- |
| Flat | No border, no shadow | Body text, assistant messages, sidebar rows |
| Panel | `bg-card` or `bg-background` with a hairline border | Cards, panes, settings panels |
| Fill shift | `bg-accent` or `bg-muted` | Hovered and selected rows, ghost buttons, the selected tab |
| Overlay | Menu material or `bg-popover`, `border-0`, elevation shadow | Menus, selects, alert dialogs, the composer |
| Focus | `ring` color on `focus-visible` | Focused controls |

The tooltip is the one inverse surface: `bg-foreground` with `text-background`, no shadow.

### Type roles

| Role | Use |
| --- | --- |
| `display-xl`, `display-lg`, `display-md` | Reserved for landing pages |
| `headline` | Page-level titles |
| `card-title` | Card and empty-state titles |
| `subhead` | Lead paragraphs |
| `body-lg`, `body` | Emphasized and default long-form body text |
| `body-sm` (`text-sm`) | The default UI text: lists, forms, chat messages |
| `caption` | Captions, metadata, group headers |
| `button` | Button and tab labels |
| `eyebrow` | Uppercase category labels |
| `mono`, `mono-sm` | Code blocks; model IDs and inline code |

Sarasa UI SC carries all UI text, including Chinese; Maple Mono NF CN carries machine text. Both are self-hosted. Letter spacing tightens as the size grows and is zero from `body-sm` down; `eyebrow` alone uses positive tracking.

## Corner radii

The [corner-radius standard](ui-radius.md) defines the radius roles, nesting, and hover geometry.

## Changing the system

Add or change a value in [`design/tokens.json`](../design/tokens.json): a new color is a palette entry plus a semantic alias in both themes, in the same change. Consume the semantic utility from components. When a shared control's variants or behavior change, update the [component catalog](../web/src/components/ui/README.md#component-catalog) in the same change.
