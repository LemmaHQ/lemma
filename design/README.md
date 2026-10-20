# Design tokens

English | [中文](README.zh.md)

## Summary

`design/` holds the colors and motion values of the three clients and their generator. [`tokens.json`](tokens.json) lists the palette, the color roles of the light and dark themes, and the motion durations and easings, and [`gen-tokens.ts`](gen-tokens.ts) writes them into the web theme, the desktop window colors, and the Android palette.

## Token file

`tokens.json` follows the [W3C Design Tokens Community Group format](https://www.designtokens.org/tr/drafts/format/): a token is an object with `$value`, and a group sets `$type` for its descendants. It has four groups:

- `palette` holds static colors as `#rrggbb` or `#rrggbbaa` strings: white, transparent, the gray steps of the Android app, the neutral steps of the web theme, blue and red steps with their alpha tiers, and alpha tiers of black and white. Palette names describe the color, not its use.
- `light` and `dark` hold the same color roles: the shadcn theme variables such as `background`, `primary`, and `sidebar-border`, plus the state roles of the shared web controls such as `control-hover` and `destructive-ring`. Each role references a palette entry, for example `{palette.blue.500}`.
- `motion` holds `duration` tokens as `{ "value": <milliseconds>, "unit": "ms" }` and `easing` tokens as cubic Bézier control points `[x1, y1, x2, y2]`. [Web styling](../docs/web-styling.md#motion) defines what each step and easing is for.

## Output

The generator writes three files, all ignored by Git:

| File                                                            | Content                                                                                     | Consumer                                                     |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `web/src/tokens.css`                                            | One CSS variable per motion token in `:root`, and one per color role in `:root` and `.dark` | `web/src/index.css` imports it                               |
| `desktop/src/gen/theme-colors.ts`                               | The background, sidebar, and foreground of each theme                                       | `desktop/src/main.ts` colors the titlebar and window from it |
| `mobile/shared/build/generated/source/tokens/…/LemmaPalette.kt` | Each palette entry as a Compose `Color`                                                     | `theme/Scheme.kt` maps it onto the app's color roles         |

The Android app reads only the palette, and only the web theme reads the motion tokens. Each consumer runs the generator before reading the output:

- The web npm scripts run it before `dev`, `build`, `build:desktop`, `lint`, `test`, `test:cov`, `format`, and `format:check`.
- The desktop npm scripts run it before `lint`, `test`, and `test:cov`; the desktop `build` runs the web `build:desktop` first.
- The Gradle task `generateDesignTokens` runs it before Kotlin compiles.

`just design-gen` runs it by hand.

## Checks

The generator exits with an error, writing nothing, when:

- `tokens.json` lacks the `palette`, `light`, `dark`, or `motion` group, or `motion` lacks `duration` or `easing`;
- a palette entry is neither a group nor a `#rrggbb` or `#rrggbbaa` color;
- a theme role does not reference an existing palette entry;
- `light` and `dark` define different roles, or lack `background`, `sidebar`, or `foreground`;
- a duration is not a non-negative number of milliseconds, or an easing is not four numbers with `x1` and `x2` between 0 and 1.

Spec CI runs it on every change under `design/`, and the Web and Desktop CI workflows run on those changes too.
