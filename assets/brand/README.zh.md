# Lemma 品牌素材

[English](README.md) | 中文

本目录是整个仓库中 Lemma 品牌的唯一权威来源。
Web、桌面端与移动端的品牌素材都必须从这里存放的母版派生。

## 目录布局

```text
assets/brand/
├── README.md       # 本文档
├── generate.py     # TeX → SVG 生成流程（见"重新生成"）
├── svg/            # 15 个矢量母版（生产环境首选）
└── png/            # 15 张 2 倍高分辨率透明 PNG（用于只支持位图的场景）
```

## 素材清单与角色

### 基础元素（从不单独出现在 UI 中，只作为组合素材）

| 文件 | 内容 |
| :--- | :--- |
| `mark_serif_dark.svg` / `mark_serif_light.svg` | 经典学术衬线 L 标志（Latin Modern Roman，由 TeX 编译出的纯矢量轮廓），512×512 |
| `wordmark_lemma_dark.svg` / `wordmark_lemma_light.svg` | `LEMMA` 纯文字标（衬线排版，LetterSpace 22 字距） |

### 应用图标（软件在操作系统中的形象）

| 文件 | 内容 |
| :--- | :--- |
| `app_icon_dark.svg` | 深黑 `#121312` 柔光超椭圆 + 白色衬线 L + 右上角 `#1783ff` 蓝点；桌面端主图标 |
| `app_icon_light.svg` | 纯白超椭圆 + 细线边框 + 炭灰衬线 L + 蓝点；用于浅色环境 |

### 组合标（界面中的品牌标题）

| 文件 | 内容 | 适用位置 |
| :--- | :--- | :--- |
| `lockup_workspace_dark/light.svg` | `[L·]` 徽标 + `LEMMA` + 副标题 `AI WORKSPACE`，沿垂直轴居中（4.5px 字距） | 首屏横幅、关于页、启动画面等需要建立产品辨识度的位置 |
| `lockup_pure_dark/light.svg` | `[L·]` 徽标 + `LEMMA` 排成一行，共用一条绝对水平中线（y=55），只含徽标与文字标 | 侧边栏顶部、窗口标题栏等紧凑位置 |

### Q.E.D. 证毕印章（标示证明完成的语义印记）

| 文件 | 内容 |
| :--- | :--- |
| `seal_qed_rose.svg` | LaTeX `\symcal{Q.E.D.}` 花体印章，使用专用墨色 `#e83168`；只标示 AI 推理完成或证明完成 |
| `seal_qed_white.svg` / `seal_qed_black.svg` / `seal_qed_blue.svg` | 受限场景使用的单色版本（反白、墨黑、焦点蓝） |
| `lockup_qed_dark.svg` | 横排 `LEMMA · Q.E.D.` 理念组合标，用于具有仪式感的品牌叙事场合 |

## 颜色规范

| 角色 | 取值 | 用途 |
| :--- | :--- | :--- |
| 基底 | `#121212` / `#ffffff` | 底板、背景、正文 |
| 焦点蓝 | `#1783ff` | 唯一的交互强调色（图标蓝点、交互元素）；与 `design/tokens.json` 中的 `palette.blue.500` 一致 |
| 证明玫红 | `#e83168` | 只用于 Q.E.D. 印章与推理完成状态 |

## 使用约定

- 矢量场景始终引用 `svg/` 母版；PNG 只用于只支持位图的流程（例如生成 `.ico`、mipmap 中间产物）。
- 平台本地副本（例如 `web/public/favicon.svg`、`desktop/assets/icon.*`、mipmap PNG）必须从这些母版派生：副本只从母版生成，母版更新后随之刷新。
- 切换主题时深色与浅色版本成对替换：直接部署成对的主题专用素材。

## 重新生成

SVG 母版由 TeX 字形实时编译，整个流程完全可复现（重复运行得到逐字节相同的输出）：

```bash
python assets/brand/generate.py
```

依赖：TeX Live（`lualatex`，带 Latin Modern Roman 与 Latin Modern Math 字体）与 `dvisvgm`。
中间产物（`.tex` / `.dvi` / `_raw.svg`）写入系统临时目录，始终不进入仓库目录树。

PNG 母版是对应 SVG 的 2 倍栅格化结果（512 viewBox → 1024px，透明背景）。
任何 SVG 改动之后，用任意栅格化工具以 2 倍重新渲染，例如 `rsvg-convert -z 2 -b none in.svg -o out.png` 或 Inkscape 中的等效操作。

## 仓库约束

- 本目录只存放规范的发布素材（花体 L、纸张与海军蓝版本已永久退役，保留在 git 历史中）。
- 本目录中的文件是平台素材的唯一权威来源。
- 只依赖 `svg/` 与 `png/` 中已提交的母版素材。
