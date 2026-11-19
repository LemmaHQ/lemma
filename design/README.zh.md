# 设计 token

[English](README.md) | 中文

## 概述

`design/` 是 Web、桌面与 Android 三端颜色、圆角、字号刻度与动效 token 的唯一真源。[`tokens.json`](tokens.json) 定义具体取值，[`gen-tokens.ts`](../scripts/design-token/gen-tokens.ts)（`just design-gen`）生成三端产物。

## 格式与颜色角色

`tokens.json` 遵循 [W3C Design Tokens Community Group 格式](https://www.designtokens.org/tr/drafts/format/)（token 使用 `$value`，分组通过 `$type` 向下继承）：

- `palette` 存放静态 `#rrggbb` 或 `#rrggbbaa` 色值；`light` 与 `dark` 定义一一对应的语义颜色角色并引用色板条目。
- `radius` 与 `typography` 均以像素为单位（`lineHeight` 为像素尺寸而非无单位倍率）；字体族由各端自行定义。
- `motion` 存放毫秒级时长与三次贝塞尔曲线 `[x1, y1, x2, y2]`（仅 Web 消费）。

颜色角色分为五类：

- **表面**：`background`、`card`、`popover`、`muted`、`sidebar`、`control`。
- **文本**：`foreground`、`muted-foreground`、`subtle-foreground`。
- **交互**：`primary`/`primary-hover`、`secondary`/`secondary-hover`、`accent`、`selected`、`ring`。
- **状态**：`destructive`（及其 `-border`、`-ring`、`-subtle`、`-subtle-hover` 变体）、`completion`、`success`、`warning`。
- **其他**：`border`、`input`、`track`、`thumb`、`brand`、`scrim`、`shadow`。

**对比度标准**：在明暗两套主题下，所有文本角色、`primary` 及文本状态角色（`destructive`、`success`、`warning`）在 `background`、`card`、`popover`、`muted`、`sidebar`、`accent` 与 `selected` 上必须达到至少 **4.5:1** 的对比度（`completion` 仅用于非文本标记）；`primary-foreground` 在 `primary` 与 `primary-hover` 上同样须达到 4.5:1。

## 生成产物

`just design-gen` 先校验 `tokens.json` 再写出三个 Git 忽略的文件（各端构建/检查/测试脚本会自动触发；`web/vite.config.ts` 也直接读取 `tokens.json` 用于首屏着色）：

| 文件                                                           | 消费方                                                                                                               |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `packages/ui/src/styles/tokens.gen.css`                        | 由 `packages/ui/src/styles/tokens.css` 导入（Tailwind `@theme` 的 `rem` 圆角/字体变量、动效变量及明暗/预览色值变量） |
| `desktop/src/gen/theme-colors.ts`                              | 由 `desktop/src/main-window.ts` 读取（各主题的 `background`、`sidebar`、`foreground`）                               |
| `mobile/shared/build/generated/source/tokens/…/LemmaTokens.kt` | 通过 `LemmaTheme` 提供（`LemmaColorScheme`、`sp` 单位 `LemmaTypography`、`dp` 单位 `LemmaShapes`）                   |
