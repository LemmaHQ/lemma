# Lemma Brand Assets

This directory is the single source of truth for the Lemma brand across the entire repository.
Web, Desktop, and Mobile must derive their brand assets from the masters stored here.

## Directory Layout

```text
assets/brand/
├── README.md       # This document
├── generate.py     # TeX → SVG generation pipeline (see "Regeneration")
├── svg/            # 15 vector masters (preferred for production use)
└── png/            # 15 high-resolution 2x transparent PNGs (fallback for raster-only contexts)
```

## Asset Roster and Roles

### Base Elements (never appear in the UI alone; composition ingredients only)

| File | Content |
| :--- | :--- |
| `mark_serif_dark.svg` / `mark_serif_light.svg` | Classic academic serif L mark (Latin Modern Roman, pure vector outlines compiled from TeX), 512×512 |
| `wordmark_lemma_dark.svg` / `wordmark_lemma_light.svg` | `LEMMA` pure wordmark (serif typesetting with LetterSpace 22 tracking) |

### App Icons (the face of the software for the operating system)

| File | Content |
| :--- | :--- |
| `app_icon_dark.svg` | Deep-black `#121312` softly glowing squircle + white serif L + `#1783ff` blue dot at top right; primary desktop icon |
| `app_icon_light.svg` | Pure-white squircle + hairline border + charcoal serif L + blue dot; for light environments |

### Lockups (brand titles for interfaces)

| File | Content | Intended Surfaces |
| :--- | :--- | :--- |
| `lockup_workspace_dark/light.svg` | `[L·]` badge + `LEMMA` + subtitle `AI WORKSPACE` centered on the vertical axis (4.5px tracking) | Hero sections, About pages, splash screens — anywhere product recognition must be established |
| `lockup_pure_dark/light.svg` | `[L·]` badge + `LEMMA` on a single line, sharing one absolute horizontal centerline (y=55), no subtitle | Compact placements such as sidebar headers and window title bars |

### Q.E.D. Proof Seals (semantic stamps, not brand identifiers)

| File | Content |
| :--- | :--- |
| `seal_qed_rose.svg` | LaTeX `\symcal{Q.E.D.}` calligraphic seal in the dedicated ink color `#e83168`; marks AI reasoning completion / proof closure only |
| `seal_qed_white.svg` / `seal_qed_black.svg` / `seal_qed_blue.svg` | Monochrome variants for constrained contexts (reverse white, ink black, focus blue) |
| `lockup_qed_dark.svg` | Horizontal `LEMMA · Q.E.D.` philosophical lockup for ceremonial brand-narrative moments |

## Color Discipline

| Role | Value | Usage |
| :--- | :--- | :--- |
| Base | `#121212` / `#ffffff` | Plates, backgrounds, body text |
| Focus blue | `#1783ff` | The single interactive accent (icon dot, interactive elements); matches `primary` in `DESIGN.md` |
| Proof rose | `#e83168` | Q.E.D. seals and reasoning-completion states only |

## Usage Conventions

- Always reference the `svg/` masters for vector contexts; use PNGs only for raster-only pipelines (e.g. `.ico` generation, mipmap intermediates).
- Platform-local copies (e.g. `web/public/favicon.svg`, `desktop/assets/icon.*`, mipmap PNGs) must be derived from these masters; never hand-edit copies, and refresh them whenever a master changes.
- Dark and light variants are swapped in pairs on theme change; do not recolor a single variant by inversion.

## Regeneration

The SVG masters are compiled live from TeX glyphs, and the pipeline is fully reproducible (re-running yields byte-identical output):

```bash
python assets/brand/generate.py
```

Requirements: TeX Live (`lualatex`, with Latin Modern Roman / Latin Modern Math fonts) and `dvisvgm`.
Intermediate artifacts (`.tex` / `.dvi` / `_raw.svg`) are written to the system temp directory and never touch the repository.

The PNG masters are 2x rasterizations of the corresponding SVGs (512 viewBox → 1024px, transparent background).
After any SVG change, re-render at 2x with any rasterizer, e.g. `rsvg-convert -z 2 -b none in.svg -o out.png` or the Inkscape equivalent.

## Prohibitions

- No drafts, variants, or experiments in this directory (the calligraphic-L, paper, and navy editions from the review phase are retired and must not be revived).
- Never reverse-sync platform copies back into this directory as if they were the source of truth.
- The scratch workspace `tmp/` (gitignored) and its showcase page and legacy scripts are not asset references.
