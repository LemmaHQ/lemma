# Web theme styles

English | [中文](README.zh.md)

## Summary

`web/src/styles/` holds the global style sheets of the web client and the desktop renderer: the generated token sheet and the hand-written theme sheet. [`web/src/index.css`](../index.css) loads them after Tailwind. Feature code consumes the resulting utilities and defines no global styles ([ownership](../../../docs/web-styling.md#ownership)).

## Files

| File                     | Owner                                                                          | Contents                                                                                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tokens.css`             | Generated from [`design/tokens.json`](../../../design/tokens.json); gitignored | Semantic colors and shadows per theme, the base `--radius`, and the Tailwind `@theme` mappings for colors, the heading font, the radius scale, and shadows |
| [`theme.css`](theme.css) | Hand-written                                                                   | Scrollbar colors and the glass material                                                                                                                    |

## theme.css

- **Scrollbar colors.** `--scrollbar-thumb` and `--scrollbar-thumb-hover` mix `--foreground` at 18% and 32%, so they follow the theme.
- **Glass material.** `.glass` fills with the `glass` color and blurs the backdrop by 20px at 1.5 saturation.

## index.css

[`index.css`](../index.css) imports Tailwind, `tw-animate-css`, `tokens.css`, `theme.css`, and `shadcn/tailwind.css` in that order and defines the theme-wide and platform-shell styles:

- the `dark` custom variant, bound to the `.dark` class;
- the base layer from the shadcn CLI: every element defaults to the `border` color and a `ring` outline, `body` takes the canvas and foreground colors, and `html` the sans stack;
- `.desktop-titlebar`, the 40px drag region the desktop shell renders above the page, and the `html.desktop` rules that offset `body` and the `h-dvh` and `min-h-dvh` utilities by its height;
- the scrollbar geometry: thin standard scrollbars and 8px WebKit scrollbars with a 4px-radius thumb.
