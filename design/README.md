# Design tokens

English | [中文](README.zh.md)

## Summary

`design/` holds the Android app's color palette and its generator. [`tokens.json`](tokens.json) lists the palette, and [`gen-tokens.ts`](gen-tokens.ts) turns it into Kotlin. The web client takes its theme from the shadcn preset in [`web/src/index.css`](../web/src/index.css), and the desktop shell mirrors that theme's window colors in `desktop/src/theme-colors.ts`; neither reads this directory.

## Token file

`tokens.json` follows the [W3C Design Tokens Community Group format](https://www.designtokens.org/tr/drafts/format/): a token is an object with `$value`, and a group sets `$type` for its descendants. Its one group, `palette`, holds static colors as `#rrggbb` or `#rrggbbaa` strings: white, gray steps, blue and red steps, and alpha tiers of black and white. Palette names describe the color, not its use.

## Output

`gen-tokens.ts` writes `mobile/shared/build/generated/source/tokens/…/LemmaPalette.kt`, which Git ignores. `LemmaPalette` holds each palette entry as a Compose `Color`, and `theme/Scheme.kt` maps it onto the app's color roles.

The Gradle task `generateDesignTokens` runs the generator before Kotlin compiles; `just design-gen` runs it by hand.

## Checks

The generator exits with an error, writing nothing, when `tokens.json` has no `palette` group, or when a palette entry is neither a group nor a `#rrggbb` or `#rrggbbaa` color. Spec CI runs it on every change under `design/`.
