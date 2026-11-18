# 共享 UI 组件

[English](README.md) | 中文

## 概要

`@lemma/ui` 以 TypeScript 源码导出 Lemma 的共享 shadcn/ui 控件，以及 Lemma 用它们组合出的组件。包有两个入口：`@lemma/ui` 导出全部在用的组件、图标、hook 与辅助函数，包自己的 `cn`，以及底层库的 `AnimateIcon` 与 `toast`；`@lemma/ui/styles.css` 加载主题与全部组件样式。功能代码不从包里导入其他路径，也不直接导入这些底层库。该包拥有语义主题以及 Streamdown 样式与插件；它不含界面文字，组件显示或播报的每段文字都由使用方应用翻译后通过属性传入。

`src/components/` 下有三个目录。`primitives/` 存放 shadcn CLI 生成的控件与布局部件，`icons/` 存放 Animate UI 的 Lucide 图标集，两者保留上游布局与 kebab-case 文件名。`composites/` 存放 Lemma 用它们组合出的组件，`PascalCase.tsx` 文件以其导出的主组件命名，由 `just source-check` 按仓库的源文件规则检查。`src/hooks/` 存放 shadcn CLI 生成的 hook。哪些组件应放进本包由 [packages/AGENTS.md](../AGENTS.zh.md#包) 决定。

<a id="component-catalog"></a>

## 组件目录

在功能代码中编写控件之前先查看此列表，复用合适的控件。

| 模块                         | 用途                                                                             |
| ---------------------------- | -------------------------------------------------------------------------------- |
| `composites/AnchoredPicker`  | 340 px 锚定可搜索弹出选择器，带分组选项与键盘导航                                |
| `composites/CodeBlock`       | Markdown 之外的语法高亮代码块，带行号，顶栏有操作插槽                            |
| `composites/CopyButton`      | 复制文字的幽灵图标按钮，复制后画出对勾，提示改为已复制                           |
| `composites/DrawerLayout`    | 主栏与右侧 480 px 滑入抽屉（管理焦点），以及抽屉的 52 px 顶栏 `DrawerHeader`     |
| `composites/FollowScroll`    | 跟随新内容滚动的实时日志，带回到底部按钮、吸顶阴影、浮层插槽与 `useFollowScroll` |
| `composites/Markdown`        | 流式渲染的 Markdown，带语法高亮代码、行内结尾标记插槽与代码块操作插槽            |
| `composites/PasswordInput`   | 带有无障碍名称的显示与隐藏切换按钮的密码输入组                                   |
| `composites/SettingsField`   | [设置页](#设置页)的字段与行                                                      |
| `composites/SettingsPage`    | [设置页](#设置页)的滚动页面                                                      |
| `composites/SettingsSection` | [设置页](#设置页)的两类分区                                                      |
| `composites/Wordmark`        | 使用 `NewCM` 字体的品牌词标（`default` 19 px 或 `splash` 24 px）与圆点           |

共享控件还包括 `primitives/` 下的 `button`、`tooltip`、侧边栏及其抽屉、`dropdown-menu`，浮层 `dialog` 与 `alert-dialog`，提示消息容器 `sonner`，布局部件 `collapsible`、`empty` 与 `skeleton`，以及表单控件 `checkbox`、`input`、`input-group`、`select` 与 `switch`。`useSidebar` 读取侧边栏状态，`formatDuration` 与 `formatClockTime` 格式化耗时与本地 `HH:mm` 时间，`isShortcutIgnored` 在可编辑控件或输入法组合态下屏蔽全局快捷键。底层属性与组合方式见 [shadcn 文档](https://ui.shadcn.com/docs/components)。

有两对组件容易混淆：

- **`AlertDialog` 与提示消息。** `AlertDialog` 在操作之前询问，并阻塞直到用户回答。提示消息在操作执行后报告结果，不阻塞任何内容。
- **`Tooltip` 与 `title`。** `Tooltip` 在键盘聚焦时显示并跟随主题；`title` 属性两者都做不到。仅含图标的按钮使用 `Tooltip` 加 `aria-label`。

## 样式

组件与功能代码通过主题的工具类书写样式。颜色角色、圆角与字体角色来自 [design/tokens.json](../../design/README.zh.md)；`src/styles/tokens.css` 增加字体栈与阴影，并把它们统一映射到 Tailwind。lint 拒绝 Tailwind 的字号刻度、`rounded-xl` 及以上的圆角与任意值圆角，因此每个元素都取自下面的刻度。

| 字体角色               | 字号 / 行高          | 用途                                                |
| ---------------------- | -------------------- | --------------------------------------------------- |
| `text-caption`         | 12 / 18 px           | 时间、分组标签、代码块标签                          |
| `text-small`           | 13 / 20 px           | 列表行、侧边栏项、工具调用行、说明文字              |
| `text-body`            | 14 / 22 px           | 默认界面文字、按钮、菜单项、`md` 及以上宽度的输入框 |
| `text-reading`         | 15.5 / 27 px         | 消息正文、输入框面板、`md` 以下宽度的输入框         |
| `text-title`           | 15 / 24 px，字重 600 | 分区与对话框标题                                    |
| `text-display`         | 17 / 24 px，字重 600 | 首页与设置页标题                                    |
| `text-wordmark`        | 19 / 24 px           | 侧边栏品牌词标                                      |
| `text-wordmark-splash` | 24 / 32 px           | 首屏启动与过渡页品牌词标                            |

- **品牌字体：** `font-brand` 为词标与品牌标题设置 `"NewCM"`（回退到衬线字体）；其余文字都使用界面无衬线字体。
- **圆角：** `rounded-sm`（6px）用于徽标、复选框与输入框内的控件；`rounded-md`（8px）用于按钮、输入框、列表行、菜单项与代码块；`rounded-lg`（10px）用于卡片、弹出层、对话框、输入框面板与主面板；`rounded-full` 用于头像、开关与药丸按钮。
- **尺寸：** 控件高度为 `h-7`、`h-8`（默认）或 `h-9`，`h-6` 只用于输入框内部；同一行只用一种高度。列表行为 `h-8` 加 `text-small`；`Button variant="row"` 绘制列表行，并通过 `data-active` 标出当前行。
- **悬停与选中：** `bg-accent` 是所有行、菜单项以及幽灵按钮与描边按钮的悬停颜色；`bg-selected` 标出当前行与按下的过滤胶囊。这两种色调上的文字使用 `text-foreground` 或 `text-muted-foreground`。
- **表面：** 内容容器加描边、不加阴影。浮起的表面（菜单、选择框弹出层、锚定选择器、提示消息）使用不透明的 `bg-popover`，加描边与 `shadow-overlay`；对话框与抽屉在 `bg-scrim` 之上使用 `shadow-modal`。`shadow-raised` 只用于输入框面板与浮动工具栏。`src/styles/index.css` 的 base 层用 `brand` 为文字选区与光标着色，用 `input` 为滚动条着色。
- **主题预览：** 在任意子树上设置 `[data-theme-preview="light"]` 或 `[data-theme-preview="dark"]`，即可将该模式的语义令牌限定作用于其后代节点。

## 设置页

每个设置页都由 `composites/SettingsPage`、`composites/SettingsSection` 与 `composites/SettingsField` 中的五个部件组合而成。部件固定页面的几何尺寸：功能代码只向它们传入文字与控件，不在其外另加间距、描边或宽度。

| 部件                     | 作用                                                                                                          |
| ------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `SettingsPage`           | 可滚动的页面：一条居中的 760 px 列，或带 220 px 粘性 `index` 目录栏的 840 px 双栏工作台                       |
| `SettingsSection`        | 两列细线分隔分组（`200px` 左侧说明栏承载 `title`、`description`、`meta` 与 `actions`，右侧为堆叠行）          |
| `SettingsSectionCompact` | 单列细线分隔分组，在堆叠行上方渲染紧凑小标题栏（`title` 与 `actions`）                                        |
| `SettingsField`          | 带宽控件的一项设置：标签与说明位于最宽 320 px 的控件列旁；窄容器下上下堆叠，支持 `align`（`center` 或 `top`） |
| `SettingsRow`            | 单行细线条目：一个标签，行尾是紧凑的操作，例如列表中的一个模型及其移除按钮                                    |

- **对齐：** 页面标题、分区标题或说明以及每一行的文字共用 760 px 列边距，行与分区之间使用细线分隔。
- **节奏：** 分区之间以顶部细线和 `py-7` 间距分隔（首组省略顶部细线与顶部内边距）。字段使用 `py-3.5`，单行条目使用 `py-2.5`。
- **控件：** 主题选择用单选预览块，更长的选择用 `Select`，开关类设置用 `Switch`。输入框与选择框填满控件列；其他控件保持自身宽度并靠列尾。
- **反馈：** 字段的校验错误通过 `error` 属性替换其说明。分区的 `error` 与 `footer`（承载该分区未保存更改的操作条）跟在行列表之后，相距 12 px。
- **窄宽度：** 两列分区在 `lg` 以下堆叠为单列，紧凑小标题的操作在需要时换行，页面标题先于其操作被截断。
- **索引与详情：** 列出实体的页面（例如 provider）把 220 px 宽的目录栏通过 `index` 属性传给 `SettingsPage`。

## 动效工具类

`src/styles/` 包含 token 中心 `tokens.css`、动效中心 `motion.css` 与 `components/`；`components/` 中的文件存放针对单个组件内部部件的样式，文件名取自该组件的文件名。`index.css`（导出为 `@lemma/ui/styles.css`）把它们与 Tailwind 一起加载。组件用 Tailwind 类书写静态样式，所有 keyframe 以及工具类无法表达的共享过渡都放在 `motion.css`，`components/` 中的类属于各自的组件，不属于包的接口。

Tailwind 工具类，可与 `before:` 等变体组合：

| 类名                | 行为                                                       |
| ------------------- | ---------------------------------------------------------- |
| `animate-draw`      | 延迟 80 ms 后绘制 `pathLength` 为 `1` 的 SVG 路径          |
| `animate-spin-once` | 旋转一圈；重新挂载元素即可再转一圈                         |
| `live-dot`          | 6×6 px 的 `brand` 圆点，温和呼吸脉冲用于活跃状态指示       |
| `qed-mark`          | 7×7 px 的 `completion` 方块，带弹簧弹出动效用于回复结尾    |
| `grid-collapse`     | 在 `0fr` 与 `1fr` 之间过渡；设置 `data-open="true"` 时展开 |

动效类，用于协调状态属性，并覆盖组件自身的过渡：

| 类名               | 行为                                                                    |
| ------------------ | ----------------------------------------------------------------------- |
| `swap-layer`       | 交叉切换叠放的图层：`data-on="true"` 的图层显示，其余图层缩小并模糊消失 |
| `stagger-children` | 让子元素依次升起                                                        |

视图过渡类，由应用作为 React `<ViewTransition>` 的 `share`、`enter` 或 `exit` 类传入；旧快照淡出，应用不直接引用 keyframe：

| 类名            | 行为                 |
| --------------- | -------------------- |
| `ui-rise`       | 新快照从略低处淡入   |
| `ui-from-start` | 新快照从略偏左处淡入 |
| `ui-from-end`   | 新快照从略偏右处淡入 |

`html.theme-transition` 在切换主题时提供 240 ms 的文字、背景、边框与阴影过渡。动效 token 提供五档时长：`duration-fast`（120 ms）、`duration-base`（150 ms）、`duration-medium`（240 ms）、`duration-slow`（280 ms）与 `duration-reveal`（280 ms），以及四条缓动：`ease-enter`、`ease-exit`、`ease-move` 与 `ease-spring`。每个动画与动效类都有减少动态效果的回退，停止移动与循环，同时保留最终状态。

## 约定

- Base UI 通过 `render` 属性组合，而不是 `asChild`：`<TooltipTrigger render={<Button size="icon" />}>`。触发器自身渲染 `button`，因此普通触发器直接接收类名。
- 包内导入使用 `#primitives/`、`#icons/`、`#hooks/` 与 `#lib/` 别名，`composites/` 中的文件之间用相对路径互相导入。外部使用方从 `@lemma/ui` 导入。组件从 `#lib/cn` 导入 `cn`，其配置把字体角色计为字号，因此合并 `text-small` 与 `text-muted-foreground` 时两者都会保留。
- 组件不含文字：每段可见文字与无障碍名称都通过必填属性传入，例如 `closeLabel` 或 `label`；回复末尾的标记这类领域元素通过插槽传入。颜色取自主题角色，不使用 Tailwind 色板。
- [`.oxlintrc.json`](.oxlintrc.json) 中针对 `src/components/**` 的覆盖项允许组件改写所组合控件的样式、为几何尺寸使用任意值、用 `cva` 构造类名，以及直接设置 ARIA 角色。

## 添加组件

在 `packages/ui/` 中运行 `npx shadcn add <name>`，CLI 把文件写入 `src/components/primitives/`。让新文件符合上述规则：从 `#lib/cn` 导入 `cn`，删除 `"use client"`，删掉 Lemma 不用的部分，把其中的文字改为属性，把色板颜色换成主题角色，并把字号与圆角换成[样式](#样式)中的刻度。在同一目录运行 `npx shadcn add @animate-ui/icons-lucide-<name>` 添加 Animate UI Lucide 图标，并把生成的文件移入 `src/components/icons/`。Lemma 自己编写的组件以 `PascalCase.tsx` 放入 `src/components/composites/`，测试放在旁边；它需要的 hook 以 `useThing.ts` 放在它旁边，`src/hooks/` 只用于 shadcn CLI 生成的 hook。与桌面端和 Android 共用的颜色、圆角、字号与动效值放入 [`design/tokens.json`](../../design/README.zh.md)，随后运行 `just design-gen`；只有 Web 使用的 token 放入 `src/styles/tokens.css`。然后在 `src/index.ts` 中显式导出被消费的符号，并把该模块加入上面的目录。已有组件通过直接编辑来修改；CLI 不再覆盖它们。
