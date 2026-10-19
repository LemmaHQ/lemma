# 设计 token

[English](README.md) | 中文

## 概要

`design/` 存放 Android 应用的色板及其生成器。[`tokens.json`](tokens.json) 列出色板，[`gen-tokens.ts`](gen-tokens.ts) 把它转换为 Kotlin。Web 客户端的主题来自 [`web/src/index.css`](../web/src/index.css) 中的 shadcn 预设，桌面端外壳在 `desktop/src/theme-colors.ts` 中镜像该主题的窗口颜色；两者都不读取此目录。

## Token 文件

`tokens.json` 遵循 [W3C Design Tokens Community Group 格式](https://www.designtokens.org/tr/drafts/format/)：token 是带 `$value` 的对象，分组通过 `$type` 为其后代设定类型。唯一的分组 `palette` 以 `#rrggbb` 或 `#rrggbbaa` 字符串存放静态颜色：白、灰阶、蓝与红的色阶，以及黑与白的透明度阶。色板名称描述颜色本身，而不是用途。

## 输出

`gen-tokens.ts` 写出 `mobile/shared/build/generated/source/tokens/…/LemmaPalette.kt`，该文件被 Git 忽略。`LemmaPalette` 以 Compose `Color` 表示每个色板条目，`theme/Scheme.kt` 把它映射到应用的颜色角色。

Gradle 任务 `generateDesignTokens` 在 Kotlin 编译前运行生成器；`just design-gen` 用于手动运行。

## 检查

`tokens.json` 缺少 `palette` 分组，或某个色板条目既不是分组也不是 `#rrggbb` 或 `#rrggbbaa` 颜色时，生成器报错退出，不写出任何文件。`design/` 下的任何修改都会触发 Spec CI 运行它。
