# Lemma corner-radius standard

English | [中文](ui-radius.zh.md)

## Summary

Choose corner radii by component role, and align nested fills, hover states, and borders with their enclosure. This standard covers the web client and the desktop renderer.

## Table of Contents

- [Scope and authority](#scope)
- [Select the radius](#radius-scale)
- [Reuse tokens and preserve deliberate shapes](#shapes)
- [Nested geometry and hover](#nested-hover)
- [Apply and verify](#verification)

<a id="scope"></a>

## Scope and authority

This reference defines the radius scale for `web/` and its component rules; the [Web UI style reference](web-styling.md) defines general styling ownership. The values live in the `radius` group of [`design/tokens.json`](../design/tokens.json); the generator turns them into the `rounded-*` utilities. Change a value there, and update both language versions of this standard when a rule changes.

<a id="radius-scale"></a>

## Select the radius

Choose the component role first. Height, width, label length, and wrapping do not select a larger radius: a taller instance of a role keeps the role's radius.

| Role | Members | Radius | Utility |
| --- | --- | --- | --- |
| Small detail | Inline code, sidebar inline action buttons, menu and select items | 4px | `rounded-xs` |
| Inset block inside a panel | Tool-call argument and output blocks | 6px | `rounded-sm` |
| Control or row | Buttons, inputs, selects, tooltips, menus, session and settings rows, code blocks, tool panels | 8px | `rounded-md` |
| Pane or standalone chrome | Page canvas panels, alert dialogs, the tabs track, the new-chat button, the sidebar expand button | 12px | `rounded-lg` |
| Content card | Cards, user bubbles, the composer | 16px | `rounded-xl` |
| Reserved | Landing banners | 24px | `rounded-xxl` |
| Circle or capsule | Avatars, the switch, round icon buttons (send, stop), status dots | 9999px | `rounded-full` |

The generator also emits a bare `--radius` equal to the 12px step, the shadcn base variable.

<a id="shapes"></a>

## Reuse tokens and preserve deliberate shapes

Reuse the controls in `web/src/components/ui/` before adding feature-owned geometry. Filled, outline, ghost, loading, and disabled variants keep the same radius; hover, pressed, selected, and focus states do not change it.

Use the named utilities instead of arbitrary values such as `rounded-[10px]`. Drawing details, such as the streaming caret or the tooltip arrow, may keep their own small radius; they do not justify arbitrary radii on surrounding controls.

Keep circles and capsules for the members listed above. A small rectangular button does not become a capsule because it is short.

<a id="nested-hover"></a>

## Nested geometry and hover

Classify the arrangement before choosing a child radius:

| Arrangement | Rule | Example |
| --- | --- | --- |
| Concentric inset | Inner radius = outer radius − inset, rounded down to the nearest step | Menus are 8px with 4px padding, so their items are 4px; the 12px tabs track has a 3px inset, so its triggers are 8px |
| Fill flush against an enclosing edge | The enclosure owns the corner and clips the fill with `overflow-hidden`; the fill takes no radius | The header strip of a code block |
| Separate surface inside another surface | The child takes its own role's radius | A code block in a message, a tool-call block in a panel |

A single clickable surface paints hover on itself with its own radius. A hover fill that is not the clickable element itself uses the same radius as the visible enclosure, so no crescent shows between fill and border.

<a id="verification"></a>

## Apply and verify

1. Inspect the component together with its shared primitive, overlays, and sibling variants. Classify roles before replacing values; one old radius does not map to one new token everywhere.
2. Change the shared owner where one exists, then align child corners, clipping, and state styles. Keep separate child surfaces on their own role.
3. Compare the rendered radius, fill, and border in light and dark themes, in normal, hover, selected, disabled, and keyboard-focus states.
