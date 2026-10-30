# 共享 UI 组件

[English](README.md) | 中文

## 概要

`@lemma/ui` 以 TypeScript 源码导出 Lemma 的共享 shadcn/ui 控件与 AI Elements 会话组件。功能代码从 `@lemma/ui/components/<name>` 导入控件，从 `@lemma/ui/components/ai-elements/<name>` 导入会话组件。该包拥有它们的语义主题、Streamdown 样式与 `ui` i18next 命名空间；使用方应用注册来自 `@lemma/ui/locales/<language>.json` 的语言文件。

图标来自 Animate UI 的 Lucide 集合，从 `@lemma/ui/icons/<name>` 导入。该集合未提供的图标使用 `lucide-react` 中同名的静态图标。品牌标志从 `@lemma/ui/components/brand/<name>` 导入。

<a id="component-catalog"></a>

## 组件目录

在功能代码中编写控件之前先查看此列表，复用合适的控件。

| 模块                       | 用途                               |
| -------------------------- | ---------------------------------- |
| `badge`                    | 简短的状态或计数标签               |
| `ai-elements/code-block`   | 语法高亮代码                       |
| `ai-elements/conversation` | 跟随滚动的消息记录与滚动到最新控件 |
| `ai-elements/message`      | 消息布局、Markdown 回复与消息操作  |
| `ai-elements/model-picker` | 按 provider 分组的模型选择菜单     |
| `ai-elements/prompt-input` | 消息输入表单、字段、工具与提交控件 |
| `ai-elements/reasoning`    | 可折叠的推理文本与流式状态标签     |
| `ai-elements/shimmer`      | 等待状态的扫光文字效果             |
| `ai-elements/suggestion`   | 建议提示词按钮                     |
| `ai-elements/tool`         | 工具调用分组、状态、参数与输出     |

共享控件还包括 `button`、`separator`、`tooltip`、侧边栏及其抽屉、`dropdown-menu`，浮层 `dialog` 与 `alert-dialog`，布局部件 `avatar`、`collapsible`、`empty`、`item`、`scroll-area` 与 `skeleton`，以及表单控件 `checkbox`、`field`、`input`、`input-group`、`password-input`、`label`、`select`、`switch`、`textarea`、`toggle` 与 `toggle-group`。侧边栏状态从 `@lemma/ui/hooks/use-sidebar` 导入。底层属性与组合方式见 [shadcn 文档](https://ui.shadcn.com/docs/components)。

有两对组件容易混淆：

- **`AlertDialog` 与提示消息。** `AlertDialog` 在操作之前询问，并阻塞直到用户回答。提示消息在操作执行后报告结果，不阻塞任何内容。
- **`Tooltip` 与 `title`。** `Tooltip` 在键盘聚焦时显示并跟随主题；`title` 属性两者都做不到。仅含图标的按钮使用 `Tooltip` 加 `aria-label`。

## 动效工具类

`src/styles/motion.css` 定义共享动画类。`globals.css` 为包使用方导入这些类，Web 的 CSS 入口则直接导入 `@lemma/ui/motion.css`。

| 类名              | 行为                                                       |
| ----------------- | ---------------------------------------------------------- |
| `animate-blur-in` | 从轻微纵向偏移与模糊状态显示内容                           |
| `animate-draw`    | 延迟 80 ms 后绘制 `pathLength` 为 `1` 的 SVG 路径          |
| `animate-pop`     | 以近似弹簧的缩放过渡显示内容                               |
| `text-sweep`      | 在文字上扫过使用主题颜色的高光                             |
| `grid-collapse`   | 在 `0fr` 与 `1fr` 之间过渡；设置 `data-open="true"` 时展开 |

动效 token 还提供 `duration-reveal`、`duration-settle`、`ease-morph` 与 `ease-spring`。每个共享动画都有减少动态效果的回退，停止移动与循环，同时保留最终状态。

## 约定

- Base UI 通过 `render` 属性组合，而不是 `asChild`：`<TooltipTrigger render={<Button size="icon" />}>`。触发器自身渲染 `button`，因此普通触发器直接接收类名。
- 包内组件与图标导入使用 `#components/` 与 `#icons/` 别名。外部使用方通过 `@lemma/ui` 的导出导入。
- 用户可见文字（包括无障碍名称）使用 `useTranslation("ui")`；中英文语言文件拥有相同的键。颜色取自主题角色，不使用 Tailwind 色板。
- [`.oxlintrc.json`](.oxlintrc.json) 中针对 `src/components/**` 的覆盖项允许组件改写所组合控件的样式、为几何尺寸使用任意值、用 `cva` 构造类名，以及直接设置 ARIA 角色。

## 添加组件

在 `packages/ui/` 中运行 `npx shadcn add <name>`，并让新文件符合上述规则：从 `cn` 导入 `cn`，删除 `"use client"`，删掉 Lemma 不用的部分，把文字移入 `ui` 语言文件，并把色板颜色换成主题角色。在同一目录运行 `npx shadcn add @animate-ui/icons-lucide-<name>` 添加 Animate UI Lucide 图标。颜色与动效变量放入 [`design/tokens.json`](../../design/README.zh.md)，随后运行 `just design-gen`。然后把模块加入上面的目录。已有组件通过直接编辑来修改；CLI 不再覆盖它们。
