# Design tokens

English | [中文](README.zh.md)

## Summary

`design/` holds Lemma's design token source and its generator. [`tokens.json`](tokens.json) is the single source of the colors, the base radius, and the custom shadows used by the web client, the desktop shell, and the Android app; type sizes, font stacks, motion, and the other shadows are Tailwind's defaults. [`gen-tokens.ts`](gen-tokens.ts) turns it into one generated file per platform. Usage rules live in [Web styling](../docs/web-styling.md) and [the radius standard](../docs/ui-radius.md); this page defines the file format, the outputs, and the checks.

## Token file

`tokens.json` follows the [W3C Design Tokens Community Group format](https://www.designtokens.org/tr/drafts/format/): a token is an object with `$value`, a group sets `$type` for its descendants, and a value of the form `{group.token}` references another token. Colors are `#rrggbb` or `#rrggbbaa` strings, and dimensions are strings with a unit.

| Group | Contents |
| --- | --- |
| `palette` | Static colors: white, gray steps, blue and red steps, and alpha tiers of black, white, and a few tinted colors. Palette names describe the color, not its use. |
| `light`, `dark` | One theme each. `color` holds the semantic aliases (`primary`, `background`, `muted-foreground`, …) and `shadow` holds the shadows Tailwind's scale lacks. Every value references the palette. |
| `radius` | The base radius; the web radius scale derives every step from it. |

Semantic aliases come in two layers: a feature reads `muted-foreground`, and the theme decides which palette entry that is. A new color enters as a palette entry plus a semantic alias in each theme, in the same change.

## Outputs

`gen-tokens.ts` writes three files. Git ignores all of them; each build regenerates them.

| Output | Consumer | Contents |
| --- | --- | --- |
| `web/src/styles/tokens.css` | Web client and desktop renderer | Semantic colors and shadows as CSS variables on `:root` and `.dark`, the base `--radius`, and the Tailwind `@theme` mappings for colors, the heading font, the radius scale, and shadows |
| `desktop/src/gen/design-tokens.ts` | Electron main process | `themeColors`: the semantic colors of each theme, for the titlebar overlay and the window background |
| `mobile/shared/build/generated/source/tokens/…/LemmaPalette.kt` | Android app | `LemmaPalette`: the static palette as Compose `Color` values; `theme/Scheme.kt` maps it onto the app's color roles |

The web `dev`, `build`, and `build:desktop` scripts run the generator first, and the Gradle task `generateDesignTokens` runs it before Kotlin compiles. `just design-gen` runs it by hand.

## Checks

The generator exits with an error, writing nothing, when:

- a reference names a token that does not exist;
- a key exists in one theme and not in the other;
- the `radius` token is missing.

Spec CI runs the generator on every change under `design/`.
