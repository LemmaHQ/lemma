# 共享 UI 组件

[English](README.md) | 中文

## 概要

`web/src/components/ui/` 存放 Web 客户端的共享控件：基于 [Base UI](https://base-ui.com/) 原语的 shadcn/ui 组件，由 shadcn CLI 按 [`components.json`](../../../components.json) 中的 `base-nova` 风格生成，并按生成结果直接使用。图标来自 Tabler。功能代码从 `@/components/ui/<name>` 导入控件；各组件的属性与组合方式见 [shadcn 文档](https://ui.shadcn.com/docs/components)。样式规则见 [Web 样式参考](../../../../docs/web-styling.zh.md)。

同级目录 `web/src/components/ai-elements/` 存放来自 [AI Elements](https://ai-sdk.dev/elements) 的聊天组件，由同一 CLI 从 `@ai-elements` 注册表添加：`message` 通过 Streamdown 渲染 Markdown，`prompt-input`、`model-selector`、`reasoning`、`tool`、`code-block`、`suggestion` 与 `shimmer` 覆盖输入框面板与消息记录。

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
- 有四处本地修改，重新生成文件时须保留。在桌面端外壳中，`TooltipContent` 的碰撞内边距让工具提示避开标题栏。在 `Toaster` 中，主题类型断言写明三种主题，因为生成的 `ToasterProps["theme"]` 断言无法通过 `exactOptionalPropertyTypes` 检查。`scroll-area` 删除未使用的 `React` 导入，因为 `noUnusedLocals` 不允许它。`Spinner` 接收 Tabler 的 `IconProps`，因为生成的 SVG 属性无法通过 `exactOptionalPropertyTypes` 检查。
- `ai-elements/tool.tsx` 中的状态标签以及参数与结果标题取自 i18next 的 `chat.toolCall`；重新生成该文件时须保留这处修改。
- oxlint 跳过此目录、`src/components/ai-elements/` 以及 `src/lib/hooks/use-mobile.ts`（CLI 随 `sidebar` 添加的断点 hook），因为这些文件保持 CLI 写出的样子；Prettier 负责格式化。

## 添加组件

在 `web/` 中运行 `npx shadcn@latest add <name>`（AI Elements 用 `npx shadcn@latest add @ai-elements/<name>`），用 Prettier 格式化，并把模块加入上面的目录。

## 更换预设

在 `web/` 中运行 `npx shadcn init -b base -p <preset> --force --reinstall --no-rtl`。CLI 会重新生成所有组件，并改写 `components.json`、`src/index.css` 与 `package.json`。保留它写入 `index.css` 的主题块（`@theme inline`、`:root`、`.dark`）；删除它添加的字体导入与 `--font-sans` 行，并撤销它对 `package.json` 与 lockfile 的修改。然后重新应用上文的本地修改，并把 `desktop/src/theme-colors.ts` 更新为新的背景、侧边栏与前景色。
