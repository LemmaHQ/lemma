# 共享 UI 组件

[English](README.md) | 中文

## 概述

`@lemma/ui` 以 TypeScript 源码形式导出 Lemma 共享的 shadcn/ui 控件与组合组件，提供两个入口：`@lemma/ui`（`src/index.ts` 为权威导出清单，包含 `cn`、`AnimateIcon` 与 `toast`）和 `@lemma/ui/styles.css`（主题与组件样式）。业务功能代码不得绕过这两个入口直接引入底层库。组件本身不持有任何界面文案，所有可见文本与无障碍标签由调用方通过 props 传入。

`src/components/` 下设三个目录（`just source-check` 对三者均执行仓库源文件规则）：

- `primitives/` — shadcn 控件与布局部件（`kebab-case.tsx`）。
- `icons/` — Animate UI 的 Lucide 图标（`kebab-case.tsx`）。
- `composites/` — Lemma 自研组合组件（`PascalCase.tsx`，测试与配套 hook 置于同级）。

`src/hooks/` 存放 shadcn CLI 生成的 hook 并保留上游文件名。哪些组件应放入本包见 [packages/AGENTS.md](../AGENTS.md#packages)。

两组容易混淆的控件：

- **`AlertDialog` 与提示消息**：`AlertDialog` 在操作前确认并阻塞等待回答；提示消息在操作后汇报结果且不阻塞。
- **`Tooltip` 与 `title`**：`Tooltip` 响应键盘聚焦并跟随主题，`title` 两者都不支持。纯图标按钮使用 `Tooltip` 搭配 `aria-label`。

## 样式

业务功能代码仅使用主题语义工具类。颜色、圆角、字号刻度与动效的具体数值以 [design/tokens.json](../../design/README.zh.md) 为唯一真源；`src/styles/tokens.css` 补充字体栈与阴影并映射到 Tailwind。

| 字体角色               | 用途                                          |
| ---------------------- | --------------------------------------------- |
| `text-caption`         | 时间戳、分组标签、代码块标签                  |
| `text-small`           | 列表行、侧边栏项、工具行、说明文字            |
| `text-body`            | 默认界面文本、按钮、菜单项、`md` 及以上输入框 |
| `text-reading`         | 消息正文、输入框面板、`md` 以下输入框         |
| `text-title`           | 分区与对话框标题                              |
| `text-display`         | 首页与设置页标题                              |
| `text-wordmark`        | 侧边栏品牌文字标                              |
| `text-wordmark-splash` | 启动页与闪屏品牌文字标                        |

- **品牌字体**：`font-brand` 使用 `"NewCM"`（回退 serif）用于文字标与品牌标题；其余文本使用界面无衬线字体。
- **圆角**：`rounded-sm` 用于徽章、复选框与输入框内控件；`rounded-md` 用于按钮、输入框、列表行、菜单项与代码块；`rounded-lg` 用于卡片、浮层、对话框、输入框面板与主面板；`rounded-full` 用于头像、开关与胶囊标签。
- **尺寸**：控件高度用 `h-7`、`h-8`（默认）或 `h-9`（`h-6` 仅用于输入框内部）；同一行保持同一高度。列表行使用 `h-8` 搭配 `text-small`（`Button variant="row"`，以 `data-active` 标记当前项）。
- **悬停与选中**：行、菜单项、幽灵/描边按钮悬停用 `bg-accent`；当前项与按下的筛选胶囊用 `bg-selected`，文字配 `text-foreground` 或 `text-muted-foreground`。
- **表面层级**：内容容器加边框不加阴影；浮动表面（菜单、弹出框、选择器、提示消息）使用不透明 `bg-popover` 配边框与 `shadow-overlay`；对话框与抽屉在 `bg-scrim` 上使用 `shadow-modal`；`shadow-raised` 仅用于输入框面板与浮动工具栏。
- **主题预览**：`[data-theme-preview="light"]` 或 `[data-theme-preview="dark"]` 将对应模式的语义 token 作用域限定在子树内。

## 设置页

设置页由 `SettingsPage`、`SettingsSection`、`SettingsSectionCompact`、`SettingsField` 与 `SettingsRow` 组合，业务代码不额外叠加外层间距、边框或宽度：

- 含实体目录的页面（如 provider 管理）向 `SettingsPage` 传入 `index`；单栏页面省略该属性。
- `SettingsSection` 用于双栏细线分组（小于 `lg` 自动堆叠），`SettingsSectionCompact` 用于单栏小标题分组，`SettingsField` 用于宽控件（输入框/下拉框填满控件列，紧凑控件靠末对齐），`SettingsRow` 用于带尾部操作的单行条目。
- 主题选择使用单选预览卡片，多选项使用 `Select`，开关项使用 `Switch`。字段校验错误通过 `error` 传入（替换说明文字），分区级错误与操作栏通过 `error` 与 `footer` 传入。

## 动效工具类

`src/styles/motion.css` 存放共享 keyframes 与动效类；`src/styles/components/` 存放单个组件的内部样式（不构成包公开接口）。所有动画与动效类均提供 reduced-motion 回退并保留最终状态。

- **Tailwind 工具类**：`animate-draw`（`pathLength="1"` 的 SVG 路径）、`animate-spin-once`（重新挂载以再次旋转）、`live-dot`（运行状态脉冲点）、`qed-mark`（回复结束方块）、`grid-collapse`（`data-open="true"` 展开）。
- **动效类**：`swap-layer`（按 `data-on="true"` 交叉淡入淡出叠层）、`stagger-children`。
- **视图过渡类**（传给 React `<ViewTransition>` 的 `share`/`enter`/`exit`）：`ui-rise`、`ui-from-start`、`ui-from-end`。
- **主题切换**：`html.theme-transition` 为颜色、背景、边框与阴影切换提供过渡。动效 token 提供 `duration-{fast,base,medium,slow,reveal}` 与 `ease-{enter,exit,move,spring}`。

## 约定

- Base UI 通过 `render` prop 组合，不用 `asChild`（`<TooltipTrigger render={<Button size="icon" />}>`）；trigger 本身已渲染为 `button`。
- 包内引入使用 `#primitives/`、`#icons/`、`#hooks/` 与 `#lib/` 别名，`composites/` 内文件彼此用相对路径。合并类名一律从 `#lib/cn` 导入 `cn`，避免 `text-*` 字体角色与 `text-*` 颜色类冲突。
- `.oxlintrc.json` 对 `src/components/**` 放宽限制，允许组件内部重写原语样式、使用任意几何尺寸、通过 `cva` 构建变体以及直接声明 ARIA 角色。

## 新增组件

在 `packages/ui/` 下运行 `npx shadcn add <name>`（写入 `src/components/primitives/`），或运行 `npx shadcn add @animate-ui/icons-lucide-<name>` 并移入 `src/components/icons/`。按上述约定整理生成文件（`cn` 改自 `#lib/cn`、删 `"use client"`、去无用代码、文案改 props、色值/字号/圆角映射至主题角色）；自研组件放入 `src/components/composites/PascalCase.tsx` 并配同级测试；跨端 token 写入 [design/tokens.json](../../design/README.zh.md)（运行 `just design-gen`），Web 专属 token 写入 `src/styles/tokens.css`；最后从 `src/index.ts` 显式导出。
