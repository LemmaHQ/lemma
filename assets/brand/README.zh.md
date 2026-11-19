# Lemma 品牌资产

[English](README.md) | 中文

Lemma 品牌母版（`svg/` 矢量母版与 `png/` 2 倍透明位图回退）的唯一来源。品牌色值（`brand`、`completion`）以 [design/tokens.json](../../design/README.zh.md) 为准。

## 使用规则

- **底稿元素不单独用于界面**：`mark_serif_*` 与 `wordmark_lemma_*` 仅作组合原料；L 徽标仅用于应用图标与 favicon。
- **Q.E.D. 印章不进入客户端 UI**：`seal_qed_*` 与 `lockup_qed_*` 仅用于品牌叙事文档。
- **客户端 UI 仅使用 `NewCM` 文字标**：通过 `font-brand` 以 New Computer Modern（`NewCM10`，许可见 `packages/ui/src/styles/fonts/GUST-FONT-LICENSE.txt`）渲染 `Lemma` 并在右上角配品牌蓝点。
- **从母版派生平台副本**：矢量场景优先用 `svg/`，仅光栅管线（`.ico`、mipmap）使用 `png/`。母版更新后同步重新生成各端副本（`web/public/favicon.svg`、`desktop/assets/icon.*`、Android mipmap），明暗主题切换时成对替换。

## 重新生成

从 TeX 字形可复现编译 SVG 母版：

```sh
python assets/brand/generate.py
```

需要 TeX Live（含 Latin Modern Roman / Latin Modern Math 字体的 `lualatex`）与 `dvisvgm`，中间产物仅写入系统临时目录。修改 SVG 后使用光栅化工具（如 `rsvg-convert -z 2 -b none in.svg -o out.png`）重新导出 2 倍透明 PNG（`1024px`）。
