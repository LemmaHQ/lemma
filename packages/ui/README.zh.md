# 共享 UI 组件

[English](README.md) | 中文

## 概要

`@lemma/ui` 以 TypeScript 源码导出 Lemma 的共享 shadcn/ui 控件与 AI Elements 会话组件。包有两个入口：`@lemma/ui` 导出全部组件、图标、hook 与辅助函数，包自己的 `cn`，以及底层库的 `AnimateIcon` 与 `toast`；`@lemma/ui/styles.css` 加载主题与全部组件样式。功能代码不从包里导入其他路径，也不直接导入这些底层库。该包拥有语义主题以及 Streamdown 样式与插件；它不含界面文字，组件显示或播报的每段文字都由使用方应用翻译后通过属性传入。

`src/components/` 下有三个目录：`primitives/` 存放与业务领域无关的 shadcn 控件与布局部件，`ai/` 存放会话场景的视觉组件，`icons/` 存放 Animate UI 的 Lucide 图标集与品牌标志，其中包括 Lemma 的标志 `LemmaLogo`。Animate UI 未提供的图标使用 `lucide-react` 中同名的静态图标。

<a id="component-catalog"></a>

## 组件目录

在功能代码中编写控件之前先查看此列表，复用合适的控件。

| 模块                 | 用途                                   |
| -------------------- | -------------------------------------- |
| `ai/code-block`      | 语法高亮代码                           |
| `ai/session`         | 跟随滚动的消息记录与滚动到最新控件     |
| `ai/message`         | 消息布局、Markdown 回复与消息操作      |
| `ai/model-picker`    | 按 provider 分组的模型选择菜单         |
| `ai/prompt-input`    | 消息输入表单、字段、工具与提交控件     |
| `ai/reasoning`       | 可折叠的推理文本与流式状态标签         |
| `ai/shimmer`         | 等待状态的扫光文字效果                 |
| `ai/suggestion`      | 建议提示词按钮                         |
| `ai/thinking-loader` | 首个回复 token 到达前的等待指示        |
| `ai/tool`            | 工具调用分组、状态、参数与输出         |
| `primitives/reveal`  | 随 `open` 切换的内容的高度与透明度过渡 |

共享控件还包括 `primitives/` 下的 `button`、`separator`、`tooltip`、行内提示 `alert`、侧边栏及其抽屉、`dropdown-menu`，浮层 `dialog` 与 `alert-dialog`，提示消息容器 `sonner`，布局部件 `avatar`、`collapsible`、`empty`、`item`、`scroll-area` 与 `skeleton`，以及表单控件 `checkbox`、`field`、`input`、`input-group`、`password-input`、`label`、`select`、`switch`、`textarea`、`toggle` 与 `toggle-group`。`useSidebar` 读取侧边栏状态。底层属性与组合方式见 [shadcn 文档](https://ui.shadcn.com/docs/components)。

有两对组件容易混淆：

- **`AlertDialog` 与提示消息。** `AlertDialog` 在操作之前询问，并阻塞直到用户回答。提示消息在操作执行后报告结果，不阻塞任何内容。
- **`Tooltip` 与 `title`。** `Tooltip` 在键盘聚焦时显示并跟随主题；`title` 属性两者都做不到。仅含图标的按钮使用 `Tooltip` 加 `aria-label`。

## 样式

组件与功能代码通过主题的工具类书写样式。颜色角色与圆角来自 [design/tokens.json](../../design/README.zh.md)；`src/styles/tokens.css` 增加字体角色与阴影，并把它们统一映射到 Tailwind。lint 拒绝 Tailwind 的字号刻度、`rounded-xl` 及以上的圆角与任意值圆角，因此每个元素都取自下面的刻度。

| 字体角色       | 字号 / 行高          | 用途                                                |
| -------------- | -------------------- | --------------------------------------------------- |
| `text-caption` | 12 / 16 px           | 时间、分组标签、代码块标签                          |
| `text-small`   | 13 / 20 px           | 列表行、侧边栏项、工具调用行、说明文字、提示框      |
| `text-body`    | 14 / 20 px           | 默认界面文字、按钮、菜单项、`md` 及以上宽度的输入框 |
| `text-reading` | 16 / 26 px           | 消息正文、输入框面板、`md` 以下宽度的输入框         |
| `text-title`   | 16 / 24 px，字重 600 | 页面、分区与对话框标题                              |
| `text-display` | 24 / 32 px，字重 600 | 首页与登录页标题                                    |

- **圆角：** `rounded-sm`（6px）用于徽标、复选框与输入框内的控件；`rounded-md`（8px）用于按钮、输入框、列表行、菜单项、代码块与提示框；`rounded-lg`（12px）用于卡片、弹出层、对话框、输入框面板与主面板；`rounded-full` 用于头像、开关与药丸按钮。
- **尺寸：** 控件高度为 `h-7`、`h-8`（默认）或 `h-9`，`h-6` 只用于输入框内部；同一行只用一种高度。列表行为 `h-8` 加 `text-small`；`Button variant="row"` 绘制列表行，并通过 `data-active` 标出当前行。
- **悬停与选中：** `bg-accent` 是所有行、菜单项以及幽灵按钮与描边按钮的悬停颜色；`bg-selected` 标出当前行与按下的切换按钮。这两种色调上的文字使用 `text-foreground` 或 `text-muted-foreground`。
- **表面：** 内容容器加描边、不加阴影。浮起的表面（菜单、选择框弹出层、模型选择器、提示消息）使用不透明的 `bg-popover`，加描边与 `shadow-overlay`；对话框与抽屉在 `bg-scrim` 之上使用 `shadow-modal`。`shadow-raised` 只用于输入框面板与浮动工具栏。`src/styles/index.css` 的 base 层用 `primary` 为文字选区与光标着色，用 `input` 为滚动条着色。

## 动效工具类

`src/styles/` 包含 token 中心 `tokens.css`、动效中心 `motion.css` 与 `components/`；`components/` 中的文件存放针对单个组件内部部件的样式，文件名取自该组件的文件名。`index.css`（导出为 `@lemma/ui/styles.css`）把它们与 Tailwind 一起加载。组件用 Tailwind 类书写静态样式，所有 keyframe 以及工具类无法表达的共享过渡都放在 `motion.css`，`components/` 中的类属于各自的组件，不属于包的接口。

Tailwind 工具类，可与 `before:` 等变体组合：

| 类名                | 行为                                                       |
| ------------------- | ---------------------------------------------------------- |
| `animate-blur-in`   | 从轻微纵向偏移与模糊状态显示内容                           |
| `animate-draw`      | 延迟 80 ms 后绘制 `pathLength` 为 `1` 的 SVG 路径          |
| `animate-pop`       | 以近似弹簧的缩放过渡显示内容                               |
| `animate-card-in`   | 让卡片从轻微偏移与缩放状态升起                             |
| `animate-grow-y`    | 让元素从零高度向下伸展                                     |
| `animate-morph-in`  | 让变化后的文字带模糊从下方升起                             |
| `animate-ray`       | 循环淡化一条加载射线，按 `--ray-index` 错开                |
| `animate-spin-loop` | 持续旋转                                                   |
| `animate-spin-once` | 旋转一圈；重新挂载元素即可再转一圈                         |
| `text-sweep`        | 在文字上扫过使用主题颜色的高光                             |
| `grid-collapse`     | 在 `0fr` 与 `1fr` 之间过渡；设置 `data-open="true"` 时展开 |

动效类，用于协调状态属性，并覆盖组件自身的过渡：

| 类名               | 行为                                                                    |
| ------------------ | ----------------------------------------------------------------------- |
| `press-scale`      | 按下时把按钮缩小到 `--press-scale`（默认 `0.96`）                       |
| `swap-layer`       | 交叉切换叠放的图层：`data-on="true"` 的图层显示，其余图层缩小并模糊消失 |
| `swap-turn`        | 与 `swap-layer` 相同，另带轻微旋转                                      |
| `stagger-children` | 让子元素依次升起                                                        |

视图过渡类，由应用作为 React `<ViewTransition>` 的 `share`、`enter` 或 `exit` 类传入；旧快照淡出，应用不直接引用 keyframe：

| 类名            | 行为                                       |
| --------------- | ------------------------------------------ |
| `ui-fade`       | 新快照淡入                                 |
| `ui-rise`       | 新快照从略低处淡入                         |
| `ui-from-start` | 新快照从略偏左处淡入                       |
| `ui-from-end`   | 新快照从略偏右处淡入                       |
| `ui-morph`      | 视图组移动并缩放到新位置与尺寸，新快照淡入 |

动效 token 提供五档时长：`duration-fast`（100 ms）、`duration-base`（150 ms）、`duration-medium`（200 ms）、`duration-slow`（300 ms）与 `duration-reveal`（400 ms），以及四条缓动：`ease-enter`、`ease-exit`、`ease-move` 与 `ease-spring`。每个动画与动效类都有减少动态效果的回退，停止移动与循环，同时保留最终状态。

## 约定

- Base UI 通过 `render` 属性组合，而不是 `asChild`：`<TooltipTrigger render={<Button size="icon" />}>`。触发器自身渲染 `button`，因此普通触发器直接接收类名。
- 包内导入使用 `#primitives/`、`#ai/`、`#icons/`、`#hooks/` 与 `#lib/` 别名。外部使用方从 `@lemma/ui` 导入。组件从 `#lib/cn` 导入 `cn`，其配置把字体角色计为字号，因此合并 `text-small` 与 `text-muted-foreground` 时两者都会保留。
- 组件不含文字：每段可见文字与无障碍名称都通过必填属性传入，例如 `closeLabel`、`label` 或有类型的 `labels` 对象；嵌入组件自行计算的值的文字以函数传入，例如 `thoughtFor(duration)`。颜色取自主题角色，不使用 Tailwind 色板。
- [`.oxlintrc.json`](.oxlintrc.json) 中针对 `src/components/**` 的覆盖项允许组件改写所组合控件的样式、为几何尺寸使用任意值、用 `cva` 构造类名，以及直接设置 ARIA 角色。

## 添加组件

在 `packages/ui/` 中运行 `npx shadcn add <name>`，CLI 把文件写入 `src/components/primitives/`。让新文件符合上述规则：从 `#lib/cn` 导入 `cn`，删除 `"use client"`，删掉 Lemma 不用的部分，把其中的文字改为属性，把色板颜色换成主题角色，并把字号与圆角换成[样式](#样式)中的刻度。在同一目录运行 `npx shadcn add @animate-ui/icons-lucide-<name>` 添加 Animate UI Lucide 图标，并把生成的文件移入 `src/components/icons/`。与 Android 共用的颜色、圆角与动效值放入 [`design/tokens.json`](../../design/README.zh.md)，随后运行 `just design-gen`；只有 Web 使用的 token 放入 `src/styles/tokens.css`。然后在 `src/index.ts` 中导出该模块，并把它加入上面的目录。已有组件通过直接编辑来修改；CLI 不再覆盖它们。
