"""TeX glyph compilation: lualatex/dvisvgm pipeline and raw SVG extraction."""

import os
import subprocess
import xml.etree.ElementTree as ET

TEX_SNIPPETS = {
    "mark_serif_l": r"""
\documentclass[preview,border=10pt]{standalone}
\usepackage{unicode-math}
\setmainfont{Latin Modern Roman}
\begin{document}
{\fontsize{100}{100}\selectfont L}
\end{document}
""",
    "wordmark_lemma": r"""
\documentclass[preview,border=10pt]{standalone}
\usepackage{unicode-math}
\setmainfont{Latin Modern Roman}
\begin{document}
{\fontsize{64}{64}\selectfont \addfontfeatures{LetterSpace=22.0}LEMMA}
\end{document}
""",
    "seal_qed": r"""
\documentclass[preview,border=10pt]{standalone}
\usepackage{unicode-math}
\setmathfont{Latin Modern Math}
\begin{document}
{\fontsize{64}{64}\selectfont $\symcal{Q.E.D.}$}
\end{document}
""",
}


def compile_glyph_sources(work_dir):
    for name, tex in TEX_SNIPPETS.items():
        tex_file = os.path.join(work_dir, f"{name}.tex")
        with open(tex_file, "w", encoding="utf-8") as f:
            f.write(tex)
        subprocess.run(
            ["lualatex", "--output-format=dvi", f"{name}.tex"],
            cwd=work_dir,
            capture_output=True,
            check=True,
        )
        subprocess.run(
            ["dvisvgm", "--no-fonts", f"{name}.dvi", "-o", f"{name}_raw.svg"],
            cwd=work_dir,
            capture_output=True,
            check=True,
        )


def extract_defs_and_uses(raw_svg_path):
    tree = ET.parse(raw_svg_path)
    root = tree.getroot()
    ns = {"svg": "http://www.w3.org/2000/svg", "xlink": "http://www.w3.org/1999/xlink"}
    vb_parts = [float(x) for x in root.attrib.get("viewBox", "0 0 100 100").split()]
    paths = {
        p.attrib.get("id"): p.attrib.get("d") for p in root.findall(".//svg:path", ns)
    }
    uses = [
        (
            float(u.attrib.get("x", 0)),
            float(u.attrib.get("y", 0)),
            u.attrib.get("{http://www.w3.org/1999/xlink}href", "").replace("#", ""),
        )
        for u in root.findall(".//svg:use", ns)
    ]
    return vb_parts, paths, uses


def load_glyphs(work_dir):
    return {
        name: extract_defs_and_uses(os.path.join(work_dir, f"{name}_raw.svg"))
        for name in TEX_SNIPPETS
    }
