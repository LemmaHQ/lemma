#!/usr/bin/env python3
"""
Lemma Brand Identity Asset Generator (Curated Core Edition)

Compiles TeX vector glyphs and builds the 15 production SVG masters
into `assets/brand/svg/`.

Requirements:
- TeX Live (lualatex) with Latin Modern Roman / Latin Modern Math fonts
- dvisvgm

Intermediate artifacts (.tex/.dvi/_raw.svg) are written to a temporary
directory and never touch the repo.

PNG masters in `assets/brand/png/` are 2x rasterizations of these SVGs;
see README.md for the re-render procedure.
"""

import os
import tempfile

from svg_assets import build_svg_assets
from tex_glyphs import compile_glyph_sources, load_glyphs

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SVG_DIR = os.path.join(BASE_DIR, "svg")
os.makedirs(SVG_DIR, exist_ok=True)

print("[1/3] Compiling TeX glyph sources...")
work_dir = tempfile.TemporaryDirectory(prefix="lemma-brand-")
compile_glyph_sources(work_dir.name)
glyphs = load_glyphs(work_dir.name)

print("[2/3] Generating 15 essential curated SVG assets...")
svg_assets = build_svg_assets(glyphs)

for filename, content in svg_assets.items():
    dest = os.path.join(SVG_DIR, filename)
    with open(dest, "w", encoding="utf-8", newline="") as f:
        f.write(content.strip())

work_dir.cleanup()
print(f"[3/3] Generated {len(svg_assets)} curated essential SVGs in {SVG_DIR}")
