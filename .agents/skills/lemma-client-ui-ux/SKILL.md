---
name: lemma-client-ui-ux
description: Use when adding, changing, or reviewing user-visible UI in the Lemma web client, desktop shell, or Android app — token discipline, reuse before adding, feedback surfaces (toast, inline notice, empty state), loading states, overlay and menu safety, desktop titlebar clearance, copy placement, and the Compose equivalents.
---

# Lemma client UI/UX

This skill is guidance, not a complete checklist. It covers judgment calls that lint, typecheck, and tests cannot make: where feedback appears, what gets reused, and how surfaces behave at window edges and across platforms. Copy quality follows [lemma-prose-standard](../lemma-prose-standard/SKILL.md). Web styling ownership and token rules live in [docs/web-styling.md](../../../docs/web-styling.md), radii in [docs/ui-radius.md](../../../docs/ui-radius.md), and shared controls in the [component catalog](../../../web/src/components/ui/README.md#component-catalog); this skill adds judgment on top of those rules, not a second copy of them.

The web client is also the desktop renderer, so every web rule applies to desktop. Each section names the Android (Compose) form where it differs.

## Visual foundation

- **Use existing tokens for color, radius, spacing, and motion.** Before introducing a value, search the target page and its nearest established sibling for the token already in use, and adopt it. The same applies to whole treatments (toasts, menus, the composer, settings rows, page padding): reuse the established one instead of inventing a parallel one. Android reads colors from `LemmaTheme.colors`, which `Scheme.kt` maps from the generated `LemmaPalette`; it never declares a hex color.
- **Verify every change in light and dark themes.** Muted ink on a fill is the usual failure; check both before it ships.
- **Font weight tops out at 500.** Use `font-normal` and `font-medium` on web and `FontWeight.Normal` and `FontWeight.Medium` in Compose. Differentiate with size or ink, not weight.
- **Pick sizes from the type roles.** Parallel content shares one role; never invent a size for one element, and keep the number of distinct sizes on a page small. Without a precedent on the page, borrow the role of the most similar existing element.
- **Icons, text, and neighbors stay proportionate and aligned** along a deliberate axis (baseline, center, or shared edge). An icon's size follows the text beside it.

## Reuse before adding

- **Extend an existing component, container, or interaction before creating a new one.** An extra menu item or a new variant on a shared control beats a parallel element stacked beside it. A shadcn component not yet in the catalog is added through the shadcn CLI, then listed in the catalog.
- **Icons come from Lucide on web.** Pick the semantically closest existing icon. On Android, use vector icons, not text glyphs or emoji standing in for icons.
- **Icon-only actions get an accessible name and a tooltip.** Web uses `aria-label` plus the shared `Tooltip`, never a `title` attribute. Compose sets `contentDescription` and wraps the action in `TooltipBox` with a `PlainTooltip`, which shows on long-press.

## Feedback surfaces

Apply [lemma-error-handling](../lemma-error-handling/SKILL.md#localized-actionable-visible-reports) to failure reports. Choose the surface by the lifetime of the message relative to the surface that produced it:

- **Transient operation outcomes use a toast** (`toast` from `sonner`, rendered by the app-level `Toaster`; Compose: a `SnackbarHost` owned by the screen scaffold). The host outlives the surface that reported, so a delete that closes its panel still shows its result. Report failures, and successes the user cannot otherwise see; do not report pending states.
- **A failed operation keeps the data visible.** A failed delete keeps its row; a failed save keeps the user's input. Never blank content to show an error.
- **Inline notices are for states tied to the surface itself:** a load failure with its retry action, or field validation beside the field. A populated panel keeps a compact notice beside its content; only an empty panel centers a full error state.
- **Destructive confirmation uses `AlertDialog`** (Compose: `AlertDialog`), never `window.confirm`. The confirm button uses the destructive variant and names the action.
- **Error copy is plain and short.** No internal jargon or technical nouns unless the user needs them to act. Prefer one sentence; never grow past two. A Chinese notice of at most two sentences omits the trailing full stop (`。`). A notice must not shift the layout: reserve its space or overlay it.

## Copy placement

- Web copy lives in `web/src/i18n/locales/en.json` and `zh.json` with the same keys; components call `t()`.
- Android copy lives in Compose Multiplatform resources, `composeResources/values/strings.xml` and `values-zh/strings.xml`, read through `stringResource`. Composables take no hardcoded user-visible strings.
- Chinese terms follow [terminology.md](../../../docs/i18n/terminology.md); UI copy renders provider as `服务商`, while docs keep the English term.
- Check text, accessible names, tooltips, and placeholders together, in both languages.

## Loading states

- Lists use a skeleton of their rows; every other page-level load centers one spinner (`CircularProgressIndicator` in Compose). Never place a spinner in a corner of the page.
- One loading treatment per page or component; concurrent regions do not each flash their own style.
- A button running its own action shows its loading state in place and stays the same size.
- No loading text unless the context needs it.

## Overlays and menus

Verify every menu, select, popover, and tooltip for all three:

- **Dismissable:** an outside click and Escape close it; on Android, the back gesture closes it before leaving the screen.
- **Viewport-fitting:** it flips or slides to stay inside the window with an edge margin. In the desktop shell, the 40px `.desktop-titlebar` covers the top of the window, so top-anchored overlays set `collisionPadding` to keep clear of it.
- **Unclipped:** it portals out of `overflow` ancestors and is never covered by neighboring elements or the titlebar.

Scrollbars use the shared styles in `index.css`. Verify the bar is neither clipped by rounded corners nor flush against the container edge.

## Desktop window

- The desktop titlebar is a drag region painted by the web client; the shell's `titleBarOverlay` colors come from the generated `themeColors`. A new header element sets `-webkit-app-region: no-drag` on its interactive parts, and sits below or beside the window controls, never under them.
- The titlebar follows the surface beneath it, so a collapsed sidebar and an expanded one both look continuous at the top edge.
- Desktop-only behavior goes through `src/platform/`; feature code never reads `window.lemmaDesktop` directly.

## Android adaptation

- Content respects system insets (`safeDrawingPadding` at the app root); the composer adds `imePadding` so the keyboard never covers it.
- Touch targets are at least 48dp, even when the visible icon is smaller.
- The back gesture closes the topmost transient surface first: a sheet, a drawer, a dialog, then the screen.

## Spacing review

- Nothing sits flush against its neighbor without an intentional gap; adjacent icons keep the region's established spacing.
- Prefer symmetry for parallel elements; an unexplained one-off gap usually signals a missed shared value.

## Verification

Look at the result, not the code: open the changed surface in a browser (and in the desktop shell when the titlebar or window is involved) in both themes and both languages, at full width and at 390px per [lemma-responsive-ui](../lemma-responsive-ui/SKILL.md). Exercise the failure path, not only the success path.
