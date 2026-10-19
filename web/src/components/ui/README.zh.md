# 共享 UI 组件

[English](README.md) | 中文

## 概要

`web/src/components/ui/` 存放 Web 客户端的共享控件：基于 [Base UI](https://base-ui.com/) 原语的 shadcn/ui 组件，由 shadcn CLI 按 [`components.json`](../../../components.json) 中的 `base-rhea` 风格生成，并按生成结果直接使用。图标来自 Tabler。功能代码从 `@/components/ui/<name>` 导入控件；各组件的属性与组合方式见 [shadcn 文档](https://ui.shadcn.com/docs/components)。样式规则见 [Web 样式参考](../../../../docs/web-styling.zh.md)。

<a id="component-catalog"></a>

## 组件目录

在功能代码中编写控件之前先查看此列表，复用合适的控件。

| 模块            | 用途                                                                     |
| --------------- | ------------------------------------------------------------------------ |
| `alert-dialog`  | 破坏性或不可撤销操作之前的确认                                           |
| `button`        | 可点击的操作                                                             |
| `card`          | 带边框的内容卡片                                                         |
| `collapsible`   | 显示与隐藏区域；由调用方绘制触发器                                       |
| `dropdown-menu` | 锚定在触发器上的操作或选项菜单                                           |
| `input`         | 单行文本框                                                               |
| `label`         | 通过 `htmlFor` 绑定到控件的表单标签                                      |
| `select`        | 表单中从列表里单选                                                       |
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
- `TooltipContent` 是唯一的本地修改：在桌面端外壳中，它的碰撞内边距让工具提示避开标题栏。重新生成该文件时保留这处修改。
- oxlint 跳过此目录，因为文件保持 CLI 写出的样子；Prettier 负责格式化。

## 添加组件

在 `web/` 中运行 `npx shadcn@latest add <name>`，用 Prettier 格式化，并把模块加入上面的目录。
