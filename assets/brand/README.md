# Lemma Brand Assets

English | [中文](README.zh.md)

Single source of truth for Lemma brand masters (`svg/` vectors and `png/` 2× transparent fallbacks). Brand color values (`brand`, `completion`) live in [design/tokens.json](../../design/README.md).

## Usage rules

- **Base elements never appear alone in UI:** `mark_serif_*` and `wordmark_lemma_*` are composition ingredients only; the L mark appears only in app icons and the favicon.
- **Q.E.D. seals never appear in client UI:** `seal_qed_*` and `lockup_qed_*` are for brand-narrative documents only.
- **Client UI uses the `NewCM` wordmark:** render `Lemma` in New Computer Modern (`NewCM10`, licensed under `packages/ui/src/styles/fonts/GUST-FONT-LICENSE.txt`) via `font-brand` with the brand-blue dot at its top right.
- **Derive platform copies from masters:** prefer `svg/` for vector contexts and `png/` only for raster pipelines (`.ico`, mipmaps). Regenerate platform copies (`web/public/favicon.svg`, `desktop/assets/icon.*`, Android mipmaps) from `svg/` / `png/` on every master update, and swap dark/light pairs together on theme change.

## Regeneration

Compile reproducible SVG masters from TeX glyphs:

```sh
python assets/brand/generate.py
```

Requires TeX Live (`lualatex` with Latin Modern Roman / Latin Modern Math fonts) and `dvisvgm`. Intermediate files stay in the OS temp directory. After changing an SVG, re-render its 2× PNG (`1024px`, transparent background) with a rasterizer such as `rsvg-convert -z 2 -b none in.svg -o out.png`.
