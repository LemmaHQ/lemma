# Design tokens

English | [中文](README.zh.md)

## Summary

`design/` holds the colors, corner radii, and motion values of the three clients and their generator. [`tokens.json`](tokens.json) lists the palette, the color roles of the light and dark themes, the corner radii, and the motion durations and easings, and [`gen-tokens.ts`](gen-tokens.ts) writes them into the web theme, the desktop window colors, and the Android palette.

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

The generator writes three files, all ignored by Git:

| File                                                            | Content                                                                                                                                                                | Consumer                                                            |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `packages/ui/src/styles/tokens.gen.css`                         | A Tailwind `@theme` block with one `--radius-*` variable per radius token, one CSS variable per motion token in `:root`, and one per color role in `:root` and `.dark` | `packages/ui/src/styles/tokens.css` imports it                      |
| `desktop/src/gen/theme-colors.ts`                               | The background, sidebar, and foreground of each theme                                                                                                                  | `desktop/src/main-window.ts` colors the titlebar and window from it |
| `mobile/shared/build/generated/source/tokens/…/LemmaPalette.kt` | Each palette entry as a Compose `Color`                                                                                                                                | `theme/LemmaColorScheme.kt` maps it onto the app's color roles      |

The Android app reads only the palette, and only the web theme reads the radius and motion tokens. Each consumer runs the generator before reading the output:

- The web npm scripts run it before `dev`, `build`, `build:desktop`, `lint`, `test`, `test:cov`, `format`, and `format:check`; the `@lemma/ui` npm scripts run it before `lint`.
- The desktop npm scripts run it before `lint`, `test`, and `test:cov`; the desktop `build` runs the web `build:desktop` first.
- The Gradle task `generateDesignTokens` runs it before Kotlin compiles.

`just design-gen` runs it by hand. `web/vite.config.ts` also reads `tokens.json` through the same reader, taking the `background` and `foreground` roles to color the web client's first paint.

## Checks

The generator exits with an error, writing nothing, when:

- `tokens.json` lacks the `palette`, `light`, `dark`, `radius`, or `motion` group, or `motion` lacks `duration` or `easing`;
- a palette entry is neither a group nor a `#rrggbb` or `#rrggbbaa` color;
- a theme role does not reference an existing palette entry;
- `light` and `dark` define different roles, or lack `background`, `sidebar`, or `foreground`;
- a radius is not a non-negative number of pixels;
- a duration is not a non-negative number of milliseconds, or an easing is not four numbers with `x1` and `x2` between 0 and 1.

Spec CI runs it on every change under `design/`, and the Web and Desktop CI workflows run on those changes too.
