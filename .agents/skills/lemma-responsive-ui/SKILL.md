---
name: lemma-responsive-ui
description: Use when designing, implementing, or reviewing responsive layouts in the Lemma web client or Android app — the 390px minimum, sidebar and settings collapse, text truncation, title wrapping, icon-only controls, hover on touch devices, tooltips, the on-screen keyboard, focus during width changes, and the Compose WindowSizeClass equivalents.
---

# Responsive client UI

This skill is guidance, not a complete checklist. [lemma-client-ui-ux](../lemma-client-ui-ux/SKILL.md) owns feedback, overlays, and copy; this skill owns what changes with width and input type.

## 1. Minimum viewport

Use a viewport width of 390 CSS px as the primary acceptance minimum for the web client; Android meets the same requirements on a compact-width phone in portrait. There must be no unintended overlap, clipping, page-wide horizontal scrolling, or inaccessible primary actions. Below the minimum, layout requirements may be relaxed.

## 2. Narrow layouts

- **The session sidebar becomes a drawer** below the width where it and a readable conversation no longer fit side by side. The drawer opens from a header button, closes on selection, outside tap, and Escape, and traps focus while open.
- **Settings become list, then detail.** The settings rail and the active section stop sharing the width; the list is one page, each section another, with a back action in the header.
- **Choose breakpoints from content, not devices.** Use Tailwind's responsive variants on the existing scale; do not add arbitrary breakpoints.
- **Android** reads the width through `WindowSizeClass`: the compact class uses the drawer and list-then-detail forms, and medium or expanded classes may show panes side by side.

## 3. Decision order

1. First adjust space allocation or wrap elements onto another line; then consider text truncation, icon-only controls, or moving actions into an overflow menu.
2. Primary actions and primary states must not be omitted.
3. Do not hide conflicts through global clipping, reducing all font sizes, or shrinking click targets.
4. Reduce font sizes only when the design specifically requires it.

## 4. Text truncation

1. Truncated content must be fully available elsewhere: in a tooltip, a detail page, or an opened menu.
2. Truncation must not lose errors or other key information.
3. Prefer single-line truncation (`truncate`, with `min-w-0` on the flex child) for tabs, visible selectors, buttons, tags, and conversation rows.
4. Important information that is not available elsewhere is displayed in full without truncation.

## 5. Titles

1. Prefer displaying page titles in full. Move the action area onto another line when necessary.
2. Prefer natural wrapping for card titles. If the number of lines is limited, the full title must remain available.

## 6. Icon-only controls

Reducing a control to an icon requires both:

- the icon clearly conveys its meaning, or the operation is familiar to users;
- an accessible name and a tooltip, per [lemma-client-ui-ux](../lemma-client-ui-ux/SKILL.md#reuse-before-adding).

A control that navigates to a separate page keeps its label. The model selector in the composer can shrink to its model name or icon because users see it constantly and its menu shows the full choice.

## 7. Hover on touch devices

1. Hover effects apply only to devices that support hovering. Tailwind v4 compiles `hover:` inside `@media (hover: hover)`; do not gate hover by viewport width.
2. A tap must not leave behind backgrounds, highlights, or action visibility intended only for hover.
3. An action revealed on hover is also revealed on keyboard focus within its row and stays visible on devices without hover.
4. Preserve selected, enabled, and pressed states, and focus indicators for keyboard interaction.
5. Keep focus when the width changes, unless the focused element leaves the page; then move focus to the control that replaced it, such as the drawer button.

## 8. Tooltips on touch devices

1. Tooltips that only name an action or a shortcut do not show on touch; tapping performs the action directly. Compose shows such a `PlainTooltip` on long-press only.
2. Tooltips that add an explanation support tap-to-show on touch, or the explanation moves into visible text.

## 9. On-screen keyboard

1. Do not raise the keyboard automatically on touch devices unless the screen exists to type into, such as a new conversation.
2. The composer stays above the keyboard: `h-dvh` sizing on web, `imePadding` in Compose.

## 10. Verification

Check every changed page at 390px and at full width, in both themes and both languages, since Chinese and English wrap differently. In the browser, resize the window or use device emulation; touch behavior needs emulated touch, not a narrow mouse window. On Android, check a compact phone in portrait and the keyboard open.
