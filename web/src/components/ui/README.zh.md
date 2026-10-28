# 共享 UI 组件

[English](README.md) | 中文

## 概要

`web/src/components/ui/` 存放 Web 客户端的共享控件：基于 [Base UI](https://base-ui.com/) 原语的 shadcn/ui 组件。它们的第一版由 shadcn CLI 按 [`components.json`](../../../components.json) 中的 `base-nova` 风格写出，此后归 Lemma 所有，直接在原文件上修改。图标来自 Tabler。功能代码从 `@/components/ui/<name>` 导入控件；各组件的属性与组合方式见 [shadcn 文档](https://ui.shadcn.com/docs/components)。

同级目录 `web/src/components/ai-elements/` 存放会话组件，最初从 [AI Elements](https://ai-sdk.dev/elements) 的 `@ai-elements` 注册表添加，并删减到 Lemma 实际渲染的部分：`message` 通过 Streamdown 渲染 Markdown，`conversation` 让消息记录停在最新消息处，直到读者向上滚动，`tool` 显示每次工具调用并把一条回复的调用归为一组，`prompt-input`、`model-selector`、`reasoning`、`code-block`、`suggestion` 与 `shimmer` 覆盖输入框面板与消息记录的其余部分。

<a id="component-catalog"></a>

## 组件目录

在功能代码中编写控件之前先查看此列表，复用合适的控件。

| 模块           | 用途                                                   |
| -------------- | ------------------------------------------------------ |
| `alert-dialog` | 破坏性或不可撤销操作之前的确认                         |
| `avatar`       | 用户或服务商的圆形首字母或图片；`AvatarBadge` 标示状态 |
| `badge`        | 简短的状态或计数标签                                   |
| `collapsible`  | 显示与隐藏区域；由调用方绘制触发器                     |
| `command`      | 可搜索的命令或选项列表；`model-selector` 基于它构建    |
| `dialog`       | 承载任务、保留下层页面的模态窗口                       |
| `empty`        | 含图标、标题、描述与操作的空状态                       |
| `item`         | 列表或设置分组中的一行，含标题、描述与尾部操作         |
| `select`       | 表单中从列表里单选                                     |
| `scroll-area`  | 带主题化覆盖式滚动条的滚动区域；窗格与面板通过它滚动   |
| `skeleton`     | 已知布局的内容加载时显示的脉动占位块                   |
| `switch`       | 立即生效的两态开关                                     |
| `toggle`       | 可按下的两态按钮                                       |
| `toggle-group` | 设置一个或多个值的一排切换按钮                         |

`button`、`separator`、`tooltip`、侧边栏及其抽屉、`dropdown-menu`，以及表单控件 `field`、`input`、`input-group`、`password-input`、`label` 与 `textarea` 来自 `@lemma/ui`：导入 `@lemma/ui/components/<name>` 与 `@lemma/ui/hooks/use-sidebar`；Animate UI 的 Lucide 图标从 `@lemma/ui/icons/<name>` 导入，品牌标志从 `@lemma/ui/components/brand/<name>` 导入。`web/src/app/shell/` 中的 `AppShell` 为登录后的页面组装侧边栏，`web/src/app/` 中的 `AppTooltipProvider` 让所有提示气泡避开桌面标题栏。提示消息的宿主 `sonner` 也在 `@lemma/ui` 中；`web/src/app/` 中的 `AppToaster` 带上主题和标题栏偏移挂载一次，代码通过 `sonner` 包的 `toast` 弹出提示。

有两对组件容易混淆：

- **`AlertDialog` 与提示消息。** `AlertDialog` 在操作之前询问，并阻塞直到用户回答。提示消息在操作执行后报告结果，不阻塞任何内容。
- **`Tooltip` 与 `title`。** `Tooltip` 在键盘聚焦时显示并跟随主题；`title` 属性两者都做不到。仅含图标的按钮使用 `Tooltip` 加 `aria-label`。

## 约定

- Base UI 通过 `render` 属性组合，而不是 `asChild`：`<TooltipTrigger render={<Button size="icon" />}>`。触发器自身渲染 `button`，因此普通触发器直接接收类名。
- 主题来自 `next-themes`，在 `App` 中以 `class` 属性与 `lemma.theme` 存储键挂载；`Toaster` 通过 `useTheme` 读取它。
- oxlint 按功能代码的规则检查这两个目录。[`web/.oxlintrc.json`](../../../.oxlintrc.json) 中针对 `src/components/**` 的覆盖项允许它们改写所组合控件的样式、为几何尺寸使用任意值、用 `cva` 构造类名，以及直接设置 ARIA 角色。
- 用户可见文字（包括无障碍名称）取自 i18next；颜色取自主题角色，不使用 Tailwind 色板。

## 添加组件

在 `web/` 中运行 `npx shadcn@latest add <name>`（AI Elements 用 `npx shadcn@latest add @ai-elements/<name>`），并让新文件符合上述规则：从 `cn` 导入 `cn`，删除 `"use client"`，删掉 Lemma 不用的部分，把文字移入语言文件，并把色板颜色换成主题角色。CLI 写入 `src/index.css` 的颜色变量移入 [`design/tokens.json`](../../../../design/README.zh.md)。然后把模块加入上面的目录。已有组件通过直接编辑来修改；CLI 不再覆盖它们。
