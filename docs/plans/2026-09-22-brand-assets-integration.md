# Brand Asset Check-In: assets/brand as the Single Source of Truth

Date: 2026-09-22
Status: Completed
Prerequisite: the brand asset masters (15 SVG + 15 PNG) were designed and reviewed in the scratch workspace; this plan covers moving them into the repository.

## Scope

This round only checks the assets into the repository: `assets/brand/` masters + generation pipeline + documentation.
Wiring the new icons and assets into Web / Desktop / Mobile is out of scope and will be planned separately.

## Target Layout (landed)

```text
assets/brand/
├── README.md       # Asset roster, usage conventions, color discipline, regeneration
├── generate.py     # TeX → SVG generation pipeline (intermediates go to the system temp dir)
├── svg/            # 15 vector masters
└── png/            # 15 high-resolution 2x PNG masters
```

## Asset System (four tiers)

- Base elements: `mark_serif_*` (serif L mark) and `wordmark_lemma_*` (pure wordmark); never appear in the UI alone, composition ingredients only.
- App icons: `app_icon_dark/light`, deep-black / pure-white squircle + serif L + `#1783ff` blue dot, facing the operating system (Dock, taskbar, launcher, favicon).
- Lockups: `lockup_workspace_*` (with the centered AI WORKSPACE subtitle, for hero/splash surfaces) and `lockup_pure_*` (single-line baseline, for sidebars/title bars).
- Q.E.D. seals: `seal_qed_*`, marking AI reasoning completion / proof closure only; `#e83168` rose is the dedicated ink color.
- Color discipline: `#121212` / `#ffffff` base, `#1783ff` as the single interactive accent, `#e83168` restricted to Q.E.D.; a fourth chromatic color is forbidden.

## Execution Log

1. Created `assets/brand/svg` and `assets/brand/png`; migrated all 15+15 masters from `tmp/assets/`.
2. Migrated `assets/brand/generate.py` from `tmp/generate_all.py`; intermediates now go to the system temp directory and never touch the repo.
3. Reproducibility verified: re-running `generate.py` regenerates all 15 SVGs byte-identical to the checked-in masters.
4. Completed `assets/brand/README.md` covering the roster, usage conventions, color discipline, regeneration, and prohibitions.
5. Added explicit `check=True` to both `subprocess.run` calls (Ruff PLW1510) so a failed lualatex/dvisvgm aborts immediately instead of surfacing later as a missing-file error.

## Acceptance

- All 15 SVG + 15 PNG masters are in place and match the reviewed design finals.
- `python assets/brand/generate.py` reproducibly regenerates every SVG master (requires TeX Live + dvisvgm).
- Zero changes to any other repository file; `tmp/` remains a gitignored scratch workspace.

## Follow-Ups (separate plans)

- Web: replace `favicon.svg`, declare the icon link in `index.html`, and wire `web/src/assets/brand/` lockup copies into the sidebar.
- Desktop: generate `icon.png/.ico/.icns` and wire them into `forge.config.ts` and `BrowserWindow`.
- Mobile: replace adaptive icon vectors and mipmap PNGs.
