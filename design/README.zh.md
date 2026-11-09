# 设计 token

[English](README.md) | 中文

## 概要

`design/` 存放 Lemma 客户端的颜色、圆角与动效取值及其生成器。[`tokens.json`](tokens.json) 列出色板、亮色与暗色两套主题的颜色角色、圆角，以及动效的时长与缓动。[`gen-tokens.ts`](gen-tokens.ts) 生成 Web 主题与 Android 色板；[`gen-desktop.ts`](gen-desktop.ts) 生成 gpui-kit 原生主题。

## Token 文件

`tokens.json` 遵循 [W3C Design Tokens Community Group 格式](https://www.designtokens.org/tr/drafts/format/)：token 是带 `$value` 的对象，分组通过 `$type` 为其后代设定类型。它有五个分组：

- `palette` 以 `#rrggbb` 或 `#rrggbbaa` 字符串存放静态颜色：白、透明、一套偏冷的灰阶，蓝、红、绿与琥珀的色阶，以及红、黑、白的透明度阶。色板名称描述颜色本身，而不是用途。
- `light` 与 `dark` 存放同一组颜色角色，每个角色引用一个色板条目，例如 `{palette.blue.600}`。
- `radius` 存放 `dimension` token，写作 `{ "value": <像素数>, "unit": "px" }`：`sm`、`md` 与 `lg`。
- `motion` 存放 `duration` token，写作 `{ "value": <毫秒数>, "unit": "ms" }`，以及 `easing` token，写作三次贝塞尔控制点 `[x1, y1, x2, y2]`。

颜色角色分为五类：

- 表面：`background`、`card`、`popover`、`muted`、`sidebar`，以及输入框与描边按钮用的 `control`。
- 文字，分三级：`foreground`，用于说明文字的 `muted-foreground`，用于时间、标签与占位符的 `subtle-foreground`。
- 交互：`primary` 及 `primary-hover`、`secondary` 及 `secondary-hover`，作为悬停色调的 `accent`，作为当前项色调的 `selected`，以及表示焦点的 `ring`。
- 状态：`destructive` 及其 `-border`、`-ring`、`-subtle`、`-subtle-hover` 色调，`success` 与 `warning`。
- 其余：`border`、`input`、`track`、`thumb`，logo 用的 `brand`，`scrim`，以及层级阴影的颜色 `shadow`。

两套主题中，每个文字角色、`primary` 与各状态角色在 `background`、`card`、`popover`、`muted` 与 `sidebar` 上的对比度都达到 4.5:1；在 `accent` 与 `selected` 色调上，`foreground` 与 `muted-foreground` 达到这一对比度。`primary-foreground` 在 `primary` 与 `primary-hover` 上达到这一对比度。

## 输出

所有生成的文件均被 Git 忽略：

| 文件 | 内容 | 使用方 |
| --- | --- | --- |
| `packages/ui/src/styles/tokens.gen.css` | 一个 Tailwind `@theme` 块，每个圆角 token 一个 `--radius-*` 变量；`:root` 中每个动效 token 一个 CSS 变量，`:root` 与 `.dark` 中每个颜色角色一个 CSS 变量 | `packages/ui/src/styles/tokens.css` 导入它 |
| `mobile/shared/build/generated/source/tokens/…/LemmaPalette.kt` | 以 Compose `Color` 表示的每个色板条目 | `theme/LemmaColorScheme.kt` 把它映射到应用的颜色角色 |
| 桌面 Cargo 输出 | 包含 Lemma 亮色与暗色 `ThemeConfig` 值的 gpui-kit `ThemeSet` | `crates/desktop/lemma-desktop/src/lemma_theme.rs` 包含并应用它 |

桌面渲染器把 Lemma 角色映射到 gpui-kit 颜色，包括侧边栏式标题栏、显式悬停与激活颜色、状态颜色、选中状态、边框与组件表面。它把基础字号设为 16 px，与 Web 客户端 rem 单位所用的根字号相同，因此 gpui-kit 以 rem 计的字号与 Tailwind 换算出同样的像素；字体族保留系统默认值，并以 `radius.md` 作为通用圆角、`radius.lg` 作为大型元素圆角。构建脚本在 Rust 编译前运行 `node design/gen-desktop.ts <output>`。

Android 应用只读取色板。Web 与桌面主题读取圆角 token；只有 Web 主题读取动效 token。每个现有使用方在读取输出前运行 `gen-tokens.ts`：

- Web 的 npm 脚本在 `dev`、`build`、`lint`、`test`、`test:cov`、`format` 与 `format:check` 之前运行它；`@lemma/ui` 的 npm 脚本在 `lint` 之前运行它。
- Gradle 任务 `generateDesignTokens` 在 Kotlin 编译前运行它。

`just design-gen` 用于手动运行 Web 与 Android 生成器。`web/vite.config.ts` 也通过同一个读取模块读取 `tokens.json`，用 `background` 与 `foreground` 角色为 Web 客户端的首次绘制着色。

## 检查

出现以下情况时，生成器报错退出，不写出任何文件：

- `tokens.json` 缺少 `palette`、`light`、`dark`、`radius` 或 `motion` 分组，或 `motion` 缺少 `duration` 或 `easing`；
- 某个色板条目既不是分组，也不是 `#rrggbb` 或 `#rrggbbaa` 颜色；
- 某个主题角色没有引用已存在的色板条目；
- `light` 与 `dark` 定义的角色不同；
- 某个圆角不是非负的像素数；
- 某个时长不是非负的毫秒数，或某个缓动不是四个数字，或其 `x1`、`x2` 不在 0 到 1 之间。

桌面渲染器在缺少 `radius.md`、`radius.lg` 或已映射的颜色角色时也会报错。

`design/` 下的任何修改都会触发 Spec CI 运行它，Web CI 工作流也会随之运行。
