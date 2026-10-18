# 设计 token

[English](README.md) | 中文

## 概要

`design/` 存放 Lemma 的设计 token 源文件及其生成器。[`tokens.json`](tokens.json) 是 Web 客户端、桌面端外壳与 Android 应用所用全部颜色、字体、字体角色、圆角、动效与阴影的唯一来源。[`gen-tokens.ts`](gen-tokens.ts) 把它转换为每个平台各一份生成文件。使用规则见 [Web 样式参考](../docs/web-styling.zh.md)与[圆角标准](../docs/ui-radius.zh.md)；本页定义文件格式、输出与检查。

## Token 文件

`tokens.json` 遵循 [W3C Design Tokens Community Group 格式](https://www.designtokens.org/tr/drafts/format/)：token 是带 `$value` 的对象，分组通过 `$type` 为其后代设定类型，`{group.token}` 形式的值引用另一个 token。颜色是 `#rrggbb` 或 `#rrggbbaa` 字符串，尺寸与时长是带单位的字符串，三次贝塞尔缓动是四个数字组成的数组。

| 分组 | 内容 |
| --- | --- |
| `palette` | 静态颜色：白、黑、灰阶、蓝与红的色阶，以及黑、白和几种带色调颜色的透明度阶。色板名称描述颜色本身，而不是用途。 |
| `light`、`dark` | 各对应一个主题。`color` 存放语义别名（`primary`、`background`、`muted-foreground` 等），`shadow` 存放层级阴影。每个取值都引用色板。 |
| `font` | 字体族栈：`sans` 与 `mono`。 |
| `typography` | 从 `display-xl` 到 `mono-sm` 的字体角色，每个角色包含字体族、字号、字重、行高与字距。 |
| `radius` | 圆角刻度。 |
| `duration`、`easing` | 动效时长与曲线。 |

语义别名分两层：功能代码读取 `muted-foreground`，由主题决定它对应哪个色板条目。新增颜色时，在同一次修改中加入一个色板条目，并在每个主题中加入语义别名。

## 输出

`gen-tokens.ts` 写出三份文件。三者都被 Git 忽略，每次构建都会重新生成。

| 输出 | 使用方 | 内容 |
| --- | --- | --- |
| `web/src/styles/tokens.css` | Web 客户端与桌面端渲染层 | `:root` 与 `[data-theme="dark"]` 上作为 CSS 变量的语义颜色与层级阴影、动效变量，以及颜色、字体、阴影、字体角色与圆角的 Tailwind `@theme` 映射 |
| `desktop/src/gen/design-tokens.ts` | Electron 主进程 | `themeColors`：各主题的语义颜色，供标题栏覆盖层与窗口背景使用 |
| `mobile/shared/build/generated/source/tokens/…/LemmaPalette.kt` | Android 应用 | `LemmaPalette`：以 Compose `Color` 表示的静态色板；`theme/Scheme.kt` 把它映射到应用的颜色角色 |

Web 的 `dev`、`build` 与 `build:desktop` 脚本会先运行生成器，Gradle 任务 `generateDesignTokens` 在 Kotlin 编译前运行它。`just design-gen` 用于手动运行。

## 检查

出现以下情况时，生成器报错退出，不写出任何文件：

- 引用指向不存在的 token；
- 某个键只存在于一个主题中。

`design/` 下的任何修改都会触发 Spec CI 运行生成器。
