# Web UI 样式参考

[English](web-styling.md) | 中文

本文定义 `web/` 的样式归属与组件规则，`web/` 同时也是桌面端的渲染层。Token 取值位于 [`design/tokens.json`](../design/tokens.json)（[格式](../design/README.zh.md)）；本文只命名角色与规则，不重复取值。

## 归属

- [`design/tokens.json`](../design/tokens.json) 拥有静态色板、各主题的语义别名、字体角色、圆角、动效、字体栈与层级阴影。生成器把它们转换为 `web/src/styles/tokens.css`。
- [`web/src/styles/`](../web/src/styles/README.zh.md) 拥有全局样式：字体声明、基础层、毛玻璃与菜单材质，以及滚动条颜色。
- [`web/src/components/ui/`](../web/src/components/ui/README.zh.md) 拥有共享控件及其变体。
- `web/src/app/` 与 `web/src/features/` 中的功能代码组合工具类与控件，不定义全局样式，也不定义主题。

主题是 `<html>` 上的 `data-theme` 属性，取值 `light` 或 `dark`。`index.html` 中的内联脚本在首次绘制前设置它，偏好或系统配色变化时由 `features/preferences/theme.ts` 更新。

## 样式技术栈

Lemma 保留 DeepSeek Harness 样式参考的原则，用 Tailwind CSS v4 与 shadcn/ui 表达；DSH 则使用 CSS Modules，且不使用组件库：

| 原则 | Lemma 的写法 |
|---|---|
| 组件使用语义 token，不使用色板值或字面颜色 | 由 token 生成的语义工具类：`bg-card`、`text-muted-foreground`、`border-border`、`rounded-md` |
| 亮色与暗色的覆盖归主题所有者 | `tokens.css` 包含两套主题；功能代码与 `components/ui/` 中不出现 `dark:` 变体 |
| 共享控件集中在一个目录 | `components/ui/` 中的 shadcn 组件，通过 `cn()` 组合 |
| 悬停样式只作用于能悬停的指针设备 | Tailwind v4 已把 `hover:` 编译在 `@media (hover: hover)` 内 |

## 组件规则

- 先复用控件，再考虑改样式：查阅[组件目录](../web/src/components/ui/README.zh.md#component-catalog)。多个功能都需要的视觉差异做成共享组件的变体，而不是第二份副本。
- 只使用语义工具类。不写十六进制颜色、色板值或任意值，例如 `bg-[#fff]`、`text-[13px]`、`w-[372px]`。任意值只用于刻度无法表达的几何，例如 Radix 的 CSS 变量（`origin-(--radix-…)`）以及基于主题取值的 `calc()`。
- 不写 `dark:`。两套主题之间的差异是一个亮暗取值不同的语义 token。
- 使用字体角色工具类（`text-sm`、`text-caption`、`text-mono`）；每个角色自带行高。只使用 400 与 500 两种字重（`font-normal`、`font-medium`）；层级来自字号、字重与两种文字颜色，而不是更多灰色或更粗的字重。
- 保持键盘焦点可见：交互元素在 `focus-visible` 时显示 `ring` 颜色。
- 悬停时才出现的控件（例如列表行的行内操作）在该行内获得键盘焦点时同样出现，并在不支持悬停的设备上始终可见。
- 过渡使用动效 token，并尊重减弱动效设置：位移包在 `motion-safe:` 中，或在 `motion-reduce:` 下移除。
- 平面表面之间用细线边框分隔：中性边框（`border-border`、`border-input`）绘制为 0.5px。虚线提示与状态色边框保持 1px。
- 浮起的表面（菜单、选择列表、确认对话框、输入框面板）使用 `border-0` 与层级阴影（`shadow-md`、`shadow-composer`），阴影的第一层就是 0.5px 细线描边。中性边框绝不与层级阴影同时使用。
- 下拉菜单与选择列表使用 `styles/theme.css` 拥有的半透明菜单材质，即弹出层颜色加背景模糊；功能代码不覆盖它。确认对话框的遮罩保持深色半透明，不加模糊。
- 在支持 `corner-shape` 的引擎上，圆角使用超椭圆曲线；全圆形状把 `rounded-full` 与 `corner-shape: round` 配对。
- 图标来自 Lucide：默认 `size-4`，紧凑行中 `size-3.5`，侧边栏行内操作 `size-3`。每个仅含图标的按钮都有无障碍名称和 `Tooltip`，而不是 `title` 属性。

## 视觉体系

### 颜色

蓝色 `primary` 是唯一的彩色强调色。它只标记主按钮、焦点环、链接强调与已就绪的发送按钮。`destructive` 标记删除操作与错误文字。悬停通过透明度加深（`hover:bg-primary/90`），因此不存在悬停颜色 token。

中性色是固定透明度阶上的黑或白，两套主题共享同一层级：

| 角色 | 工具类 | 用途 |
|---|---|---|
| 画布 | `bg-background` | 主画布与窗格 |
| 侧边栏区域 | `bg-sidebar`、`bg-sidebar-accent` | 会话侧边栏、设置导航，以及其中选中的行 |
| 面板与浮层 | `bg-card`、`bg-popover` | 卡片、菜单、选择列表、对话框 |
| 毛玻璃 | `.glass` | 会话顶栏、侧边栏展开按钮、输入框面板：`glass` 颜色加背景模糊 |
| 填充 | `bg-secondary`、`bg-muted`、`bg-accent` | 次要按钮、用户气泡、悬停与选中填充 |
| 代码 | `bg-code`、`border-code-border` | 代码块与行内代码 |

文字有两级：`text-foreground` 用于主要文字，`text-muted-foreground` 用于说明、元信息、分组标题与占位文字。每种表面都有对应的 `*-foreground` 颜色。

### 层级

| 级别 | 处理方式 | 用途 |
|---|---|---|
| 平面 | 无边框、无阴影 | 正文、助手消息、侧边栏行 |
| 面板 | `bg-card` 或 `bg-background` 加细线边框 | 卡片、窗格、设置面板 |
| 填充变化 | `bg-accent` 或 `bg-muted` | 悬停与选中的行、幽灵按钮、选中的标签页 |
| 浮层 | 菜单材质或 `bg-popover`、`border-0`、层级阴影 | 菜单、选择列表、确认对话框、输入框面板 |
| 焦点 | `focus-visible` 时的 `ring` 颜色 | 获得焦点的控件 |

工具提示是唯一的反色表面：`bg-foreground` 配 `text-background`，无阴影。

### 字体角色

| 角色 | 用途 |
|---|---|
| `display-xl`、`display-lg`、`display-md` | 保留给落地页 |
| `headline` | 页面级标题 |
| `card-title` | 卡片与空状态的标题 |
| `subhead` | 引导段落 |
| `body-lg`、`body` | 强调正文与默认长篇正文 |
| `body-sm`（`text-sm`） | 默认界面文字：列表、表单、对话消息 |
| `caption` | 说明、元信息、分组标题 |
| `button` | 按钮与标签页文字 |
| `eyebrow` | 大写的分类标签 |
| `mono`、`mono-sm` | 代码块；模型 ID 与行内代码 |

Sarasa UI SC 承载全部界面文字，包括中文；Maple Mono NF CN 承载机器文本。两者都是自托管字体。字距随字号增大而收紧，从 `body-sm` 往下为零；只有 `eyebrow` 使用正字距。

## 圆角

[圆角标准](ui-radius.zh.md)定义圆角角色、嵌套与悬停几何。

## 修改体系

在 [`design/tokens.json`](../design/tokens.json) 中新增或修改取值：新颜色是同一次修改中的一个色板条目，加上两套主题中的语义别名。组件使用语义工具类。共享控件的变体或行为变化时，在同一次修改中更新[组件目录](../web/src/components/ui/README.zh.md#component-catalog)。
