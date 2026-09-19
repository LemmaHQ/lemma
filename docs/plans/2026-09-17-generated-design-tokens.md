# 设计 token 生成式同步（DESIGN.md → tokens.css)

## 背景与动机

当前 `web/src/styles/theme.css` 靠"mirrored byte-for-byte"约定手工同步 DESIGN.md,CI 只 lint DESIGN.md 自身，无任何对账机制。
漂移已实际发生:`headline.letterSpacing` 在 DESIGN.md 为 -0.6px,theme.css 为 -0.025em(28px 下为 -0.7px)。

## 方案

将 theme.css 拆分为两个文件，生成面收束为纯机械映射:

- `web/src/styles/tokens.css`(**生成物，gitignore**):由生成器从 DESIGN.md front matter 产出，含 `:root` 亮色变量、`[data-theme="dark"]` 暗色变量、`@theme inline` 映射(颜色 / typography 全阶梯 / radius 阶梯直值)。
- `web/src/styles/theme.css`(手写保留):`@font-face`、字体栈、滚动条 color-mix、阴影、`@layer base`、`.app-canvas`。
  只消费 `var(--*)`,不含任何原始值。

`index.css` 先 import tokens.css 再 import theme.css。

## 生成器

- `web/scripts/gen-theme.mjs`:gray-matter 解析 front matter（新增根 devDependency `gray-matter`，由 dependabot 接管）。
  token 全部为 hex（项目决策），无需色彩库。
- 映射规则:
  - colors 非 `dark-` 前缀 → `:root { --<name>: <hex> }`;
  - `dark-<name>` → `[data-theme="dark"] { --<name>: <hex> }`;
  - `@theme inline` 颜色映射由同一组键机械生成;
  - typography 14 级全量产出 `--text-<name>` + line-height/letter-spacing(px 转 em 按 fontSize 精确换算，修正现有 headline 漂移);
  - radius 阶梯直值 `--radius-xs..xxl`（取代现有 calc 链，值不变)。
- npm script:web/package.json 加 `gen:theme`,并用 `predev` / `prebuild` 钩子自动执行,堵死绕过 just 直接跑 vite 的路径。

## 接线点

- justfile:`web-dev` / `web-build` / `web-build-desktop` 前不再需手工步骤(pre 钩子兜底);新增 `web-gen-tokens` recipe 供单独调用。
- CI:web-ci 的 build 前由 prebuild 钩子自动覆盖;spec-ci design job 加一步运行生成器(生成失败即门禁)。
- Dockerfile web-builder 阶段:`npm run build` 经 prebuild 钩子自动覆盖,无需改动。

## 验收

1. 生成器输出与现 theme.css 手工值逐一 diff:除已确认的 headline letter-spacing 修正外必须零差异，差异清单显式列出待确认。
2. `just web-build` 成功;浏览器实际渲染验证亮/暗主题无回归(真实渲染验收,不以控制台无报错推断)。
3. 故意改 DESIGN.md 一个色值不重跑生成 → pre 钩子下一次 build 自动追上,证明同步不再依赖人。

## 非目标

- Compose `Tokens.kt` 生成（KMP 动工时复用同一脚本扩展，预留出口但本轮不实现）。
- components 块的 `borderColor` 消费(维持现状,仅供 lint 与未来生成器使用)。
