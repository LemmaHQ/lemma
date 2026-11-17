# 设计 token

[English](README.md) | 中文

## 概要

`design/` 存放三端客户端的颜色、圆角、字号刻度与动效取值。[`tokens.json`](tokens.json) 列出色板、亮色与暗色两套主题的颜色角色、圆角、字体样式，以及动效的时长与缓动，生成器 [`gen-tokens.ts`](../scripts/design-token/gen-tokens.ts) 把它们写入 Web 主题、桌面端窗口颜色与 Android 主题。

## Token 文件

`tokens.json` 遵循 [W3C Design Tokens Community Group 格式](https://www.designtokens.org/tr/drafts/format/)：token 是带 `$value` 的对象，分组通过 `$type` 为其后代设定类型。它有六个分组：

- `palette` 以 `#rrggbb` 或 `#rrggbbaa` 字符串存放静态颜色：白、一套中性灰阶，蓝、玫红、红、绿与琥珀的色阶，以及红与黑的透明度阶。色板名称描述颜色本身，而不是用途。
- `light` 与 `dark` 存放同一组颜色角色，每个角色引用一个色板条目，例如 `{palette.gray.925}`。
- `radius` 存放 `dimension` token，写作 `{ "value": <像素数>, "unit": "px" }`：`sm`、`md` 与 `lg`。
- `typography` 为每个字体样式存放一个 `typography` token：`caption`、`small`、`body`、`reading`、`title`、`display`、`wordmark` 与 `wordmark-splash`。每个 `$value` 把 `fontSize` 与 `lineHeight` 写作 `{ "value": <像素数>, "unit": "px" }`，并可设一个数值 `fontWeight`；未设 `fontWeight` 的样式沿用继承的字重。`lineHeight` 是像素尺寸，而不是该格式中无单位的倍数。字体族由各客户端自行决定。
- `motion` 存放 `duration` token，写作 `{ "value": <毫秒数>, "unit": "ms" }`，以及 `easing` token，写作三次贝塞尔控制点 `[x1, y1, x2, y2]`。

颜色角色分为五类：

- 表面：`background`、`card`、`popover`、`muted`、`sidebar`，以及输入框与描边按钮用的 `control`。
- 文字，分三级：`foreground`，用于说明文字的 `muted-foreground`，用于时间、标签与占位符的 `subtle-foreground`。
- 交互：`primary` 及 `primary-hover`、`secondary` 及 `secondary-hover`，作为悬停色调的 `accent`，作为当前项色调的 `selected`，以及表示焦点的 `ring`。
- 状态：`destructive` 及其 `-border`、`-ring`、`-subtle`、`-subtle-hover` 色调，标示 turn 完成印记的 `completion`，以及 `success` 与 `warning`。
- 其余：`border`、`input`、`track`、`thumb`，用于 logo、运行指示与链接的 `brand`，`scrim`，以及层级阴影的颜色 `shadow`。

两套主题中，每个文字角色、`primary` 与各文字状态角色（`destructive`、`success`、`warning`）在 `background`、`card`、`popover`、`muted`、`sidebar`、`accent` 与 `selected` 上的对比度都达到 4.5:1；`completion` 用于非文字印记。`primary-foreground` 在 `primary` 与 `primary-hover` 上达到 4.5:1。

## 输出

生成器写出三个文件，均被 Git 忽略：

| 文件                                                           | 内容                                                                                                                                                                                                                                                                                                | 使用方                                                |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `packages/ui/src/styles/tokens.gen.css`                        | 一个 Tailwind `@theme` 块，每个圆角 token 一个 `--radius-*` 变量，每个字体样式一组以 16 px 为基准换算成 `rem` 的 `--text-*` 字号、行高与字重变量；`:root` 中每个动效 token 一个 CSS 变量，`:root, [data-theme-preview="light"]` 与 `.dark, [data-theme-preview="dark"]` 中每个颜色角色一个 CSS 变量 | `packages/ui/src/styles/tokens.css` 导入它            |
| `desktop/src/gen/theme-colors.ts`                              | 每套主题的背景、侧边栏与前景色                                                                                                                                                                                                                                                                      | `desktop/src/main-window.ts` 据此设置标题栏与窗口颜色 |
| `mobile/shared/build/generated/source/tokens/…/LemmaTokens.kt` | `LemmaColorScheme`，每个颜色角色一个 Compose `Color`，并含亮色与暗色取值；`LemmaTypography`，每个字体样式一个以 `sp` 为单位的 `TextStyle`；`LemmaShapes`，每个圆角一个以 `dp` 为单位的 `RoundedCornerShape`                                                                                         | `theme/Theme.kt` 通过 `LemmaTheme` 提供它们           |

Web 主题与 Android 应用读取全部颜色角色、字体样式与圆角；只有 Web 主题读取动效 token。每个使用方在读取输出前运行生成器：

- Web 的 npm 脚本在 `dev`、`build`、`build:desktop`、`lint`、`test`、`test:cov`、`format` 与 `format:check` 之前运行它；`@lemma/ui` 的 npm 脚本在 `lint` 之前运行它。
- 桌面端的 npm 脚本在 `lint`、`test` 与 `test:cov` 之前运行它；桌面端的 `build` 先运行 Web 的 `build:desktop`。
- Gradle 任务 `generateDesignTokens` 在 Kotlin 编译前运行它。

`just design-gen` 用于手动运行。`web/vite.config.ts` 也通过同一个读取模块读取 `tokens.json`，用 `background` 与 `foreground` 角色为 Web 客户端的首次绘制着色。

## 检查

出现以下情况时，生成器报错退出，不写出任何文件：

- `tokens.json` 缺少 `palette`、`light`、`dark`、`radius`、`typography` 或 `motion` 分组，或 `motion` 缺少 `duration` 或 `easing`；
- 某个色板条目既不是分组，也不是 `#rrggbb` 或 `#rrggbbaa` 颜色；
- 某个主题角色没有引用已存在的色板条目；
- `light` 与 `dark` 定义的角色不同，或缺少 `background`、`sidebar` 或 `foreground`；
- 某个圆角不是非负的像素数；
- 某个字体样式缺少非负像素数的 `fontSize` 或 `lineHeight`，其 `fontWeight` 不是 1 到 1000 之间的整数，或设置了其他属性；
- 某个时长不是非负的毫秒数，或某个缓动不是四个数字，或其 `x1`、`x2` 不在 0 到 1 之间。

`design/` 或 `scripts/design-token/` 下的任何修改都会触发 Spec CI 运行它，Web 与桌面端的 CI 工作流也会随之运行。
