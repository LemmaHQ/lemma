# Design tokens

English | [中文](README.zh.md)

## Summary

`design/` is the single source of truth for colors, corner radii, typography scale, and motion tokens across web, desktop, and Android. [`tokens.json`](tokens.json) defines the values and [`gen-tokens.ts`](../scripts/design-token/gen-tokens.ts) (`just design-gen`) generates the three platform outputs.

## Format and color roles

`tokens.json` follows the [W3C Design Tokens Community Group format](https://www.designtokens.org/tr/drafts/format/) (`$value` on tokens, `$type` inherited from groups):

- Palette colors are static `#rrggbb` or `#rrggbbaa` values; `light` and `dark` define matching semantic color roles referencing palette entries.
- `radius` and `typography` dimensions use pixel units (`lineHeight` is a pixel dimension, not a unitless multiplier); font families stay with each client.
- `motion` holds millisecond durations and cubic Bézier `[x1, y1, x2, y2]` easings (consumed by web only).

Color roles fall into five families:

- **Surfaces:** `background`, `card`, `popover`, `muted`, `sidebar`, `control`.
- **Text:** `foreground`, `muted-foreground`, `subtle-foreground`.
- **Interaction:** `primary`/`primary-hover`, `secondary`/`secondary-hover`, `accent`, `selected`, `ring`.
- **Status:** `destructive` (and its `-border`, `-ring`, `-subtle`, `-subtle-hover` tints), `completion`, `success`, `warning`.
- **Other:** `border`, `input`, `track`, `thumb`, `brand`, `scrim`, `shadow`.

**Contrast standard:** every text role, `primary`, and text status roles (`destructive`, `success`, `warning`) must reach at least a **4.5:1** contrast ratio on `background`, `card`, `popover`, `muted`, `sidebar`, `accent`, and `selected` in both themes (`completion` is for non-text markers); `primary-foreground` must reach 4.5:1 on `primary` and `primary-hover`.

## Outputs

`just design-gen` validates `tokens.json` before writing three Git-ignored files (client build/lint/test scripts run it automatically; `web/vite.config.ts` also reads `tokens.json` directly for first-paint colors):

| File                                                           | Consumer                                                                                                                                  |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/ui/src/styles/tokens.gen.css`                        | Imported by `packages/ui/src/styles/tokens.css` (Tailwind `@theme` radii/typography in `rem`, motion vars, light/dark/preview color vars) |
| `desktop/src/gen/theme-colors.ts`                              | Read by `desktop/src/main-window.ts` (`background`, `sidebar`, `foreground` per theme)                                                    |
| `mobile/shared/build/generated/source/tokens/…/LemmaTokens.kt` | Provided through `LemmaTheme` (`LemmaColorScheme`, `LemmaTypography` in `sp`, `LemmaShapes` in `dp`)                                      |
