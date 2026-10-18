# Design tokens

English | [中文](README.zh.md)

## Summary

`design/` holds Lemma's design token source and its generator. [`tokens.json`](tokens.json) is the single source of every color, font, type role, radius, motion value, and shadow used by the web client, the desktop shell, and the Android app. [`gen-tokens.mjs`](gen-tokens.mjs) turns it into one generated file per platform. Usage rules live in [Web styling](../docs/web-styling.md) and [the radius standard](../docs/ui-radius.md); this page defines the file format, the outputs, and the checks.

## Token file

`tokens.json` follows the [W3C Design Tokens Community Group format](https://www.designtokens.org/tr/drafts/format/): a token is an object with `$value`, a group sets `$type` for its descendants, and a value of the form `{group.token}` references another token. Colors are `#rrggbb` or `#rrggbbaa` strings, dimensions and durations are strings with a unit, and cubic Bézier easings are four-number arrays.

| Group | Contents |
| --- | --- |
| `palette` | Static colors: white, black, gray steps, blue and red steps, and alpha tiers of black, white, and a few tinted colors. Palette names describe the color, not its use. |
| `light`, `dark` | One theme each. `color` holds the semantic aliases (`primary`, `background`, `muted-foreground`, …) and `shadow` holds the elevation shadows. Every value references the palette. |
| `font` | Font family stacks: `sans` and `mono`. |
| `typography` | Type roles from `display-xl` to `mono-sm`, each with family, size, weight, line height, and letter spacing. |
| `radius` | The radius scale. |
| `duration`, `easing` | Motion durations and curves. |

Semantic aliases come in two layers: a feature reads `muted-foreground`, and the theme decides which palette entry that is. A new color enters as a palette entry plus a semantic alias in each theme, in the same change.

## Outputs

`gen-tokens.mjs` writes three files. Git ignores all of them; each build regenerates them.

| Output | Consumer | Contents |
| --- | --- | --- |
| `web/src/styles/tokens.css` | Web client and desktop renderer | Semantic colors and elevation shadows as CSS variables on `:root` and `[data-theme="dark"]`, motion variables, and the Tailwind `@theme` mappings for colors, fonts, shadows, type roles, and radii |
| `desktop/src/gen/design-tokens.ts` | Electron main process | `themeColors`: the semantic colors of each theme, for the titlebar overlay and the window background |
| `mobile/shared/build/generated/source/tokens/…/LemmaPalette.kt` | Android app | `LemmaPalette`: the static palette as Compose `Color` values; `theme/Scheme.kt` maps it onto the app's color roles |

The web `dev`, `build`, and `build:desktop` scripts run the generator first, and the Gradle task `generateDesignTokens` runs it before Kotlin compiles. `just design-gen` runs it by hand.

## Checks

The generator exits with an error, writing nothing, when:

- a reference names a token that does not exist;
- a key exists in one theme and not in the other.

Spec CI runs the generator on every change under `design/`.
