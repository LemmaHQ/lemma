# 共享 UI 组件

[English](README.md) | 中文

## 概要

`web/src/components/ui/` 存放 Web 客户端的共享控件：基于 [Base UI](https://base-ui.com/) 原语的 shadcn/ui 组件。它们的第一版由 shadcn CLI 按 [`components.json`](../../../components.json) 中的 `base-nova` 风格写出，此后归 Lemma 所有，直接在原文件上修改。图标来自 Tabler。功能代码从 `@/components/ui/<name>` 导入控件；各组件的属性与组合方式见 [shadcn 文档](https://ui.shadcn.com/docs/components)。样式规则见 [Web 样式参考](../../../../docs/web-styling.zh.md)。

同级目录 `web/src/components/ai-elements/` 存放聊天组件，最初从 [AI Elements](https://ai-sdk.dev/elements) 的 `@ai-elements` 注册表添加，并删减到 Lemma 实际渲染的部分：`message` 通过 Streamdown 渲染 Markdown，`conversation` 让消息记录停在最新消息处，直到读者向上滚动，`prompt-input`、`model-selector`、`reasoning`、`tool`、`code-block`、`suggestion` 与 `shimmer` 覆盖输入框面板与消息记录的其余部分。

<a id="component-catalog"></a>

## 组件目录

在功能代码中编写控件之前先查看此列表，复用合适的控件。

| 模块            | 用途                                                                     |
| --------------- | ------------------------------------------------------------------------ |
| `alert-dialog`  | 破坏性或不可撤销操作之前的确认                                           |
| `avatar`        | 用户或服务商的圆形首字母或图片；`AvatarBadge` 标示状态                   |
| `badge`         | 简短的状态或计数标签                                                     |
| `button`        | 可点击的操作                                                             |
| `button-group`  | 一排相连的控件，例如输入框与其保存按钮                                   |
| `card`          | 带边框的内容卡片                                                         |
| `collapsible`   | 显示与隐藏区域；由调用方绘制触发器                                       |
| `command`       | 可搜索的命令或选项列表；`model-selector` 基于它构建                      |
| `dialog`        | 承载任务、保留下层页面的模态窗口                                         |
| `dropdown-menu` | 锚定在触发器上的操作或选项菜单                                           |
| `empty`         | 含图标、标题、描述与操作的空状态                                         |
| `field`         | 表单布局：标签、控件、描述与错误，可分组与分隔                           |
| `hover-card`    | 悬停时显示的预览卡片                                                     |
| `input`         | 单行文本框                                                               |
| `input-group`   | 附带图标、文字或按钮的文本框                                             |
| `item`          | 列表或设置分组中的一行，含标题、描述与尾部操作                           |
| `label`         | 通过 `htmlFor` 绑定到控件的表单标签                                      |
| `select`        | 表单中从列表里单选                                                       |
| `scroll-area`   | 带主题化覆盖式滚动条的滚动区域；窗格与面板通过它滚动                     |
| `separator`     | 水平或垂直分隔线                                                         |
| `sheet`         | 从屏幕边缘滑入的面板；`sidebar` 在窄屏上使用它                           |
| `sidebar`       | 可折叠的应用导航，含 provider、菜单部件与切换按钮                        |
| `skeleton`      | 内容加载期间显示的占位块                                                 |
| `spinner`       | 按钮或行内的加载动画图标                                                 |
| `sonner`        | 提示消息的宿主，在 `App` 中挂载一次；通过 `sonner` 包的 `toast` 弹出提示 |
| `switch`        | 立即生效的两态开关                                                       |
| `tabs`          | 在面板之间切换的标签列表                                                 |
| `textarea`      | 多行文本框                                                               |
| `toggle`        | 可按下的两态按钮                                                         |
| `toggle-group`  | 设置一个或多个值的一排切换按钮                                           |
| `tooltip`       | 仅含图标的控件的简短标签，在悬停与键盘聚焦时显示                         |

有三对组件容易混淆：

- **`Tabs` 与 `ToggleGroup`。** `Tabs` 切换显示哪个面板，并通过 `TabsContent` 拥有这些面板。`ToggleGroup` 设置一个值，例如主题偏好，不拥有面板。
- **`AlertDialog` 与提示消息。** `AlertDialog` 在操作之前询问，并阻塞直到用户回答。提示消息在操作执行后报告结果，不阻塞任何内容。
- **`Tooltip` 与 `title`。** `Tooltip` 在键盘聚焦时显示并跟随主题；`title` 属性两者都做不到。仅含图标的按钮使用 `Tooltip` 加 `aria-label`。

## 约定

- Base UI 通过 `render` 属性组合，而不是 `asChild`：`<TooltipTrigger render={<Button size="icon" />}>`。触发器自身渲染 `button`，因此普通触发器直接接收类名。
- 主题来自 `next-themes`，在 `App` 中以 `class` 属性与 `lemma.theme` 存储键挂载；`Toaster` 通过 `useTheme` 读取它。
- `useSidebar` 从 [`src/lib/hooks/use-sidebar.ts`](../../lib/hooks/use-sidebar.ts) 读取外层 `SidebarProvider` 的状态，因此 `sidebar.tsx` 只导出组件。
- oxlint 按功能代码的规则检查这两个目录。[`web/.oxlintrc.json`](../../../.oxlintrc.json) 中针对 `src/components/**` 的覆盖项允许它们改写所组合控件的样式、为几何尺寸使用任意值、用 `cva` 构造类名，以及直接设置 ARIA 角色。
- 用户可见文字（包括无障碍名称）取自 i18next；颜色取自主题角色，不使用 Tailwind 色板。

## 添加组件

在 `web/` 中运行 `npx shadcn@latest add <name>`（AI Elements 用 `npx shadcn@latest add @ai-elements/<name>`），并让新文件符合上述规则：从 `cn` 导入 `cn`，删除 `"use client"`，删掉 Lemma 不用的部分，把文字移入语言文件，并把色板颜色换成主题角色。CLI 写入 `src/index.css` 的颜色变量移入 [`design/tokens.json`](../../../../design/README.zh.md)。然后把模块加入上面的目录。已有组件通过直接编辑来修改；CLI 不再覆盖它们。
