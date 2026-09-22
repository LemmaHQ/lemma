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
import subprocess
import tempfile
import xml.etree.ElementTree as ET

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SVG_DIR = os.path.join(BASE_DIR, "svg")
os.makedirs(SVG_DIR, exist_ok=True)

tex_snippets = {
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

print("[1/3] Compiling TeX glyph sources...")
work_dir = tempfile.TemporaryDirectory(prefix="lemma-brand-")
for name, tex in tex_snippets.items():
    tex_file = os.path.join(work_dir.name, f"{name}.tex")
    with open(tex_file, "w", encoding="utf-8") as f:
        f.write(tex)
    subprocess.run(
        ["lualatex", "--output-format=dvi", f"{name}.tex"],
        cwd=work_dir.name,
        capture_output=True,
        check=True,
    )
    subprocess.run(
        ["dvisvgm", "--no-fonts", f"{name}.dvi", "-o", f"{name}_raw.svg"],
        cwd=work_dir.name,
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


l_vb, l_paths, l_uses = extract_defs_and_uses(
    os.path.join(work_dir.name, "mark_serif_l_raw.svg")
)
wm_vb, wm_paths, wm_uses = extract_defs_and_uses(
    os.path.join(work_dir.name, "wordmark_lemma_raw.svg")
)
qed_vb, qed_paths, qed_uses = extract_defs_and_uses(
    os.path.join(work_dir.name, "seal_qed_raw.svg")
)


def assemble_single_group(paths, uses, color="currentColor"):
    inner = []
    for x, y, href in uses:
        d = paths[href]
        if x != 0 or y != 0:
            inner.append(
                f'<path fill="{color}" transform="translate({x:.3f}, {y:.3f})" d="{d}"/>'
            )
        else:
            inner.append(f'<path fill="{color}" d="{d}"/>')
    return "\n        ".join(inner)


def calc_center(vb, target_w, target_h, pad_ratio=0.22):
    min_x, min_y, w, h = vb
    avail_w = target_w * (1.0 - 2.0 * pad_ratio)
    avail_h = target_h * (1.0 - 2.0 * pad_ratio)
    scale = min(avail_w / w, avail_h / h)
    orig_cx = min_x + w / 2.0
    orig_cy = min_y + h / 2.0
    tx = (target_w / 2.0) - (orig_cx * scale)
    ty = (target_h / 2.0) - (orig_cy * scale)
    return tx, ty, scale


print("[2/3] Generating 15 essential curated SVG assets...")
svg_assets = {}

COLOR_BLUE = "#1783ff"
COLOR_ROSE = "#e83168"
COLOR_DARK_BASE = "#121212"

# 1. Marks (512x512)
tx, ty, s = calc_center(l_vb, 512, 512, pad_ratio=0.22)
svg_assets[
    "mark_serif_dark.svg"
] = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
    <g transform="translate({tx:.2f}, {ty:.2f}) scale({s:.4f})">
        {assemble_single_group(l_paths, l_uses, "#ffffff")}
    </g>
</svg>"""
svg_assets[
    "mark_serif_light.svg"
] = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
    <g transform="translate({tx:.2f}, {ty:.2f}) scale({s:.4f})">
        {assemble_single_group(l_paths, l_uses, "#111111")}
    </g>
</svg>"""

# 2. Wordmark (Normalized)
full_wm_w = wm_uses[-1][0] + 44.0
pad_x = 16
pad_y = 12
out_w = full_wm_w + pad_x * 2
out_h = wm_vb[3] + pad_y * 2
tx = pad_x - wm_vb[0]
ty = pad_y - wm_vb[1]

svg_assets[
    "wordmark_lemma_dark.svg"
] = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {out_w:.2f} {out_h:.2f}" width="{out_w:.2f}" height="{out_h:.2f}">
    <g transform="translate({tx:.2f}, {ty:.2f})">
        {assemble_single_group(wm_paths, wm_uses, "#ffffff")}
    </g>
</svg>'''
svg_assets[
    "wordmark_lemma_light.svg"
] = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {out_w:.2f} {out_h:.2f}" width="{out_w:.2f}" height="{out_h:.2f}">
    <g transform="translate({tx:.2f}, {ty:.2f})">
        {assemble_single_group(wm_paths, wm_uses, "#111111")}
    </g>
</svg>'''

# 3. App Icons (Classic Solid Serif L + Blue Dot)
tx_l, ty_l, s_l = calc_center(l_vb, 512, 512, pad_ratio=0.25)

svg_assets[
    "app_icon_dark.svg"
] = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
    <defs>
        <radialGradient id="darkGlow" cx="50%" cy="15%" r="85%">
            <stop offset="0%" stop-color="#222322"/>
            <stop offset="100%" stop-color="#121312"/>
        </radialGradient>
        <filter id="darkShadow" x="-5%" y="-5%" width="110%" height="110%">
            <feDropShadow dx="0" dy="16" stdDeviation="24" flood-color="#000000" flood-opacity="0.4"/>
        </filter>
    </defs>
    <rect x="24" y="24" width="464" height="464" rx="104" fill="url(#darkGlow)" stroke="#ffffff1c" stroke-width="2" filter="url(#darkShadow)"/>
    <g transform="translate({tx_l:.2f}, {ty_l:.2f}) scale({s_l:.4f})">
        {assemble_single_group(l_paths, l_uses, "#f5f5f5")}
    </g>
    <circle cx="396" cy="116" r="10" fill="{COLOR_BLUE}"/>
</svg>'''

svg_assets[
    "app_icon_light.svg"
] = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
    <defs>
        <radialGradient id="lightGlow" cx="50%" cy="20%" r="80%">
            <stop offset="0%" stop-color="#ffffff"/>
            <stop offset="100%" stop-color="#f5f5f7"/>
        </radialGradient>
        <filter id="lightShadow" x="-5%" y="-5%" width="110%" height="110%">
            <feDropShadow dx="0" dy="16" stdDeviation="24" flood-color="#000000" flood-opacity="0.08"/>
        </filter>
    </defs>
    <rect x="24" y="24" width="464" height="464" rx="104" fill="url(#lightGlow)" stroke="#00000014" stroke-width="2" filter="url(#lightShadow)"/>
    <g transform="translate({tx_l:.2f}, {ty_l:.2f}) scale({s_l:.4f})">
        {assemble_single_group(l_paths, l_uses, "#111111")}
    </g>
    <circle cx="396" cy="116" r="10" fill="{COLOR_BLUE}"/>
</svg>'''

# 4. Lockups
# Badge: 56x56, R=13, canvas height=110, center y=55.
b_size = 56
b_x = 24
b_y = 27
tx_b_l = b_x + 14.78
ty_b_l = b_y + 43.68

wm_lockup_x = b_x + b_size + 28  # 108px
wm_scale = 1.0
wm_total_w = full_wm_w * wm_scale  # 285.27px
wm_center_x = wm_lockup_x + wm_total_w / 2.0  # 250.63px

# 4.1 Balanced Subtitle (AI WORKSPACE Centered)
wm_y_stacked = 64
sub_y = 82

svg_assets[
    "lockup_workspace_dark.svg"
] = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 440 110" width="440" height="110">
    <rect x="{b_x}" y="{b_y}" width="{b_size}" height="{b_size}" rx="13" fill="#1f201f" stroke="#ffffff24" stroke-width="1.5"/>
    <g transform="translate({tx_b_l:.2f}, {ty_b_l:.2f}) scale(0.48)">
        {assemble_single_group(l_paths, l_uses, "#ffffff")}
    </g>
    <circle cx="{b_x + 44}" cy="{b_y + 12}" r="3" fill="{COLOR_BLUE}"/>

    <g transform="translate({wm_lockup_x}, {wm_y_stacked}) scale({wm_scale})">
        {assemble_single_group(wm_paths, wm_uses, "#ffffff")}
    </g>
    <text x="{wm_center_x:.2f}" y="{sub_y}" text-anchor="middle" fill="#ffffff70" font-family="system-ui, -apple-system, sans-serif" font-size="10" font-weight="600" letter-spacing="4.5">AI WORKSPACE</text>
</svg>'''

svg_assets[
    "lockup_workspace_light.svg"
] = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 440 110" width="440" height="110">
    <rect x="{b_x}" y="{b_y}" width="{b_size}" height="{b_size}" rx="13" fill="#ffffff" stroke="#00000014" stroke-width="1.5"/>
    <g transform="translate({tx_b_l:.2f}, {ty_b_l:.2f}) scale(0.48)">
        {assemble_single_group(l_paths, l_uses, "#111111")}
    </g>
    <circle cx="{b_x + 44}" cy="{b_y + 12}" r="3" fill="{COLOR_BLUE}"/>

    <g transform="translate({wm_lockup_x}, {wm_y_stacked}) scale({wm_scale})">
        {assemble_single_group(wm_paths, wm_uses, "#111111")}
    </g>
    <text x="{wm_center_x:.2f}" y="{sub_y}" text-anchor="middle" fill="#00000070" font-family="system-ui, -apple-system, sans-serif" font-size="10" font-weight="600" letter-spacing="4.5">AI WORKSPACE</text>
</svg>'''

# 4.2 Pure Single-Line Baseline Lockup (Zero drag, absolute center)
wm_y_single = 71.9

svg_assets[
    "lockup_pure_dark.svg"
] = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 430 110" width="430" height="110">
    <rect x="{b_x}" y="{b_y}" width="{b_size}" height="{b_size}" rx="13" fill="#1f201f" stroke="#ffffff24" stroke-width="1.5"/>
    <g transform="translate({tx_b_l:.2f}, {ty_b_l:.2f}) scale(0.48)">
        {assemble_single_group(l_paths, l_uses, "#ffffff")}
    </g>
    <circle cx="{b_x + 44}" cy="{b_y + 12}" r="3" fill="{COLOR_BLUE}"/>

    <g transform="translate({wm_lockup_x}, {wm_y_single:.2f}) scale({wm_scale})">
        {assemble_single_group(wm_paths, wm_uses, "#ffffff")}
    </g>
</svg>'''

svg_assets[
    "lockup_pure_light.svg"
] = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 430 110" width="430" height="110">
    <rect x="{b_x}" y="{b_y}" width="{b_size}" height="{b_size}" rx="13" fill="#ffffff" stroke="#00000014" stroke-width="1.5"/>
    <g transform="translate({tx_b_l:.2f}, {ty_b_l:.2f}) scale(0.48)">
        {assemble_single_group(l_paths, l_uses, "#111111")}
    </g>
    <circle cx="{b_x + 44}" cy="{b_y + 12}" r="3" fill="{COLOR_BLUE}"/>

    <g transform="translate({wm_lockup_x}, {wm_y_single:.2f}) scale({wm_scale})">
        {assemble_single_group(wm_paths, wm_uses, "#111111")}
    </g>
</svg>'''

# 5. Q.E.D. Proof Seals
full_qed_w = qed_uses[-1][0] + 16.0
q_pad_x = 16
q_pad_y = 12
q_out_w = full_qed_w + q_pad_x * 2
q_out_h = qed_vb[3] + q_pad_y * 2
q_tx = q_pad_x - qed_vb[0]
q_ty = q_pad_y - qed_vb[1]

for name, color in [
    ("rose", COLOR_ROSE),
    ("white", "#ffffff"),
    ("black", "#111111"),
    ("blue", COLOR_BLUE),
]:
    svg_assets[
        f"seal_qed_{name}.svg"
    ] = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {q_out_w:.2f} {q_out_h:.2f}" width="{q_out_w:.2f}" height="{q_out_h:.2f}">
    <g transform="translate({q_tx:.2f}, {q_ty:.2f})">
        {assemble_single_group(qed_paths, qed_uses, color)}
    </g>
</svg>'''

# 6. Typographic Q.E.D. Lockup
wm_t_s = 1.05
wm_t_tx = 24.0 - wm_vb[0] * wm_t_s
wm_t_ty = 60.0 - (wm_vb[1] + wm_vb[3] / 2.0) * wm_t_s

qed_t_s = 0.85
qed_t_tx = 24.0 + full_wm_w * wm_t_s + 20.0 - qed_vb[0] * qed_t_s
qed_t_ty = 60.0 - (qed_vb[1] + qed_vb[3] / 2.0) * qed_t_s
canvas_w = qed_t_tx + full_qed_w * qed_t_s + 24.0

svg_assets[
    "lockup_qed_dark.svg"
] = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {canvas_w:.1f} 120" width="{canvas_w:.1f}" height="120">
    <g transform="translate({wm_t_tx:.2f}, {wm_t_ty:.2f}) scale({wm_t_s:.3f})">
        {assemble_single_group(wm_paths, wm_uses, "#ffffff")}
    </g>
    <g transform="translate({qed_t_tx:.2f}, {qed_t_ty:.2f}) scale({qed_t_s:.3f})">
        {assemble_single_group(qed_paths, qed_uses, COLOR_ROSE)}
    </g>
</svg>'''

for filename, content in svg_assets.items():
    dest = os.path.join(SVG_DIR, filename)
    with open(dest, "w", encoding="utf-8", newline="") as f:
        f.write(content.strip())

work_dir.cleanup()
print(f"[3/3] Generated {len(svg_assets)} curated essential SVGs in {SVG_DIR}")
