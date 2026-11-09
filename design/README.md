# Design tokens

English | [中文](README.zh.md)

## Summary

`design/` holds the colors, corner radii, and motion values of Lemma's clients and their generators. [`tokens.json`](tokens.json) lists the palette, the color roles of the light and dark themes, the corner radii, and the motion durations and easings. [`gen-tokens.ts`](gen-tokens.ts) writes the web theme and Android palette; [`gen-desktop.ts`](gen-desktop.ts) writes a native gpui-kit theme.

## Token file

`tokens.json` follows the [W3C Design Tokens Community Group format](https://www.designtokens.org/tr/drafts/format/): a token is an object with `$value`, and a group sets `$type` for its descendants. It has five groups:

- `palette` holds static colors as `#rrggbb` or `#rrggbbaa` strings: white, transparent, a cool gray ramp, blue, red, green, and amber steps, and alpha tiers of red, black, and white. Palette names describe the color, not its use.
- `light` and `dark` hold the same color roles, each referencing a palette entry such as `{palette.blue.600}`.
- `radius` holds `dimension` tokens as `{ "value": <pixels>, "unit": "px" }`: `sm`, `md`, and `lg`.
- `motion` holds `duration` tokens as `{ "value": <milliseconds>, "unit": "ms" }` and `easing` tokens as cubic Bézier control points `[x1, y1, x2, y2]`.

The color roles fall into five families:

- Surfaces: `background`, `card`, `popover`, `muted`, `sidebar`, and `control` for inputs and outline buttons.
- Text, in three levels: `foreground`, `muted-foreground` for descriptions, and `subtle-foreground` for timestamps, labels, and placeholders.
- Interaction: `primary` with `primary-hover`, `secondary` with `secondary-hover`, `accent` as the hover tint, `selected` as the tint of the current item, and `ring` for focus.
- Status: `destructive` with its `-border`, `-ring`, `-subtle`, and `-subtle-hover` tints, `success`, and `warning`.
- The rest: `border`, `input`, `track`, `thumb`, `brand` for the logo, `scrim`, and `shadow`, the color of the elevation shadows.

Every text role, `primary`, and the status roles reach a 4.5:1 contrast ratio on `background`, `card`, `popover`, `muted`, and `sidebar` in both themes; on the `accent` and `selected` tints, `foreground` and `muted-foreground` do. `primary-foreground` reaches it on `primary` and `primary-hover`.

## Output

All generated files are ignored by Git:

| File | Content | Consumer |
| --- | --- | --- |
| `packages/ui/src/styles/tokens.gen.css` | A Tailwind `@theme` block with one `--radius-*` variable per radius token, one CSS variable per motion token in `:root`, and one per color role in `:root` and `.dark` | `packages/ui/src/styles/tokens.css` imports it |
| `mobile/shared/build/generated/source/tokens/…/LemmaPalette.kt` | Each palette entry as a Compose `Color` | `theme/LemmaColorScheme.kt` maps it onto the app's color roles |
| Desktop Cargo output | A gpui-kit `ThemeSet` containing Lemma's light and dark `ThemeConfig` values | `crates/desktop/lemma-desktop/src/lemma_theme.rs` includes and applies it |

The desktop renderer maps Lemma roles to gpui-kit colors, including sidebar title bars, explicit hover and active colors, status colors, selection, borders, and component surfaces. It sets the base font to 16 px, the root size the web client's rem units use, so gpui-kit's rem-based text sizes resolve to the same pixels as Tailwind's; it leaves font families at the system defaults and uses `radius.md` for the general radius and `radius.lg` for large elements. Its build script runs `node design/gen-desktop.ts <output>` before Rust compiles.

The Android app reads only the palette. The web and desktop themes read radius tokens; only the web theme reads motion tokens. Each existing consumer runs `gen-tokens.ts` before reading its output:

- The web npm scripts run it before `dev`, `build`, `lint`, `test`, `test:cov`, `format`, and `format:check`; the `@lemma/ui` npm scripts run it before `lint`.
- The Gradle task `generateDesignTokens` runs it before Kotlin compiles.

`just design-gen` runs the web and Android generator by hand. `web/vite.config.ts` also reads `tokens.json` through the same reader, taking the `background` and `foreground` roles to color the web client's first paint.

## Checks

The generator exits with an error, writing nothing, when:

- `tokens.json` lacks the `palette`, `light`, `dark`, `radius`, or `motion` group, or `motion` lacks `duration` or `easing`;
- a palette entry is neither a group nor a `#rrggbb` or `#rrggbbaa` color;
- a theme role does not reference an existing palette entry;
- `light` and `dark` define different roles;
- a radius is not a non-negative number of pixels;
- a duration is not a non-negative number of milliseconds, or an easing is not four numbers with `x1` and `x2` between 0 and 1.

The desktop renderer also reports an error when `radius.md`, `radius.lg`, or a mapped color role is missing.

Spec CI runs it on every change under `design/`, and Web CI runs on those changes too.
