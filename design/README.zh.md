# 设计 token

[English](README.md) | 中文

## 概要

`design/` 存放三端客户端的颜色及其生成器。[`tokens.json`](tokens.json) 列出色板以及亮色、暗色两套主题的颜色角色，[`gen-tokens.ts`](gen-tokens.ts) 把它们写入 Web 主题、桌面端窗口颜色与 Android 色板。

## Token 文件

`tokens.json` 遵循 [W3C Design Tokens Community Group 格式](https://www.designtokens.org/tr/drafts/format/)：token 是带 `$value` 的对象，分组通过 `$type` 为其后代设定类型。它有三个分组：

- `palette` 以 `#rrggbb` 或 `#rrggbbaa` 字符串存放静态颜色：白、Android 应用的灰阶、Web 主题的中性灰阶、蓝与红的色阶，以及黑与白的透明度阶。色板名称描述颜色本身，而不是用途。
- `light` 与 `dark` 存放同一组颜色角色，以 shadcn 主题变量命名，例如 `background`、`primary` 与 `sidebar-border`。每个角色引用一个色板条目，例如 `{palette.blue.500}`。

## 输出

生成器写出三个文件，均被 Git 忽略：

| 文件                                                            | 内容                                              | 使用方                                         |
| --------------------------------------------------------------- | ------------------------------------------------- | ---------------------------------------------- |
| `web/src/tokens.css`                                            | 每个角色一个 CSS 变量，位于 `:root` 与 `.dark` 中 | `web/src/index.css` 导入它                     |
| `desktop/src/gen/theme-colors.ts`                               | 每套主题的背景、侧边栏与前景色                    | `desktop/src/main.ts` 据此设置标题栏与窗口颜色 |
| `mobile/shared/build/generated/source/tokens/…/LemmaPalette.kt` | 以 Compose `Color` 表示的每个色板条目             | `theme/Scheme.kt` 把它映射到应用的颜色角色     |

Android 应用只读取色板。每个使用方在读取输出前运行生成器：

- Web 的 npm 脚本在 `dev`、`build`、`build:desktop`、`lint`、`test`、`test:cov`、`format` 与 `format:check` 之前运行它。
- 桌面端的 npm 脚本在 `lint`、`test` 与 `test:cov` 之前运行它；桌面端的 `build` 先运行 Web 的 `build:desktop`。
- Gradle 任务 `generateDesignTokens` 在 Kotlin 编译前运行它。

`just design-gen` 用于手动运行。

## 检查

出现以下情况时，生成器报错退出，不写出任何文件：

- `tokens.json` 缺少 `palette`、`light` 或 `dark` 分组；
- 某个色板条目既不是分组，也不是 `#rrggbb` 或 `#rrggbbaa` 颜色；
- 某个主题角色没有引用已存在的色板条目；
- `light` 与 `dark` 定义的角色不同，或缺少 `background`、`sidebar` 或 `foreground`。

`design/` 下的任何修改都会触发 Spec CI 运行它，Web 与桌面端的 CI 工作流也会随之运行。
