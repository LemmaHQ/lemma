# Web UI 样式参考

[English](web-styling.md) | 中文

本文定义 `web/` 的样式归属与组件规则，`web/` 同时也是桌面端的渲染层。主题颜色来自[设计 token](../design/README.zh.md)，其余主题取值位于 [`web/src/index.css`](../web/src/index.css)；本文只命名角色与规则，不重复取值。

## 归属

- [`design/tokens.json`](../design/tokens.json) 拥有主题颜色。设计 token 生成器把两套主题的颜色变量写入 `web/src/tokens.css`，该文件被 Git 忽略，由 `index.css` 导入。
- [`web/src/index.css`](../web/src/index.css) 拥有其余主题与全局样式：[`components.json`](../web/components.json) 中 shadcn 预设的基础 `--radius`，以及颜色、标题字体与圆角刻度的 Tailwind `@theme` 映射。它还包含基础层、桌面端标题栏规则，以及 Streamdown 样式表的导入和让 Tailwind 扫描到 Streamdown 类名的 `@source` 行。字号、字体栈、动效与阴影使用 Tailwind 默认值。
- [`web/src/components/ui/`](../web/src/components/ui/README.zh.md) 拥有共享控件及其变体；`web/src/components/ai-elements/` 拥有聊天组件：输入框面板、消息、推理过程、工具调用、代码块与模型选择器。
- `web/src/app/` 与 `web/src/features/` 中的功能代码组合工具类与控件，不定义全局样式，也不定义主题。

主题是 `<html>` 上的 `dark` 类；没有该类时使用亮色主题。`index.html` 中的内联脚本在首次绘制前设置它，偏好或系统配色变化时由挂载在 `App` 中的 `next-themes` 更新。

## 样式技术栈

Lemma 保留 DeepSeek Harness 样式参考的原则，用 Tailwind CSS v4 与 shadcn/ui 表达；DSH 则使用 CSS Modules，且不使用组件库：

| 原则                                       | Lemma 的写法                                                                            |
| ------------------------------------------ | --------------------------------------------------------------------------------------- |
| 组件使用语义 token，不使用色板值或字面颜色 | 来自主题的语义工具类：`bg-card`、`text-muted-foreground`、`border-border`、`rounded-md` |
| 亮色与暗色的覆盖归主题所有者               | `tokens.json` 为每个颜色角色给出两套取值；功能代码中不出现 `dark:` 变体                 |
| 共享控件集中在一个目录                     | `components/ui/` 中的 shadcn 组件，通过 `cn()` 组合                                     |
| 悬停样式只作用于能悬停的指针设备           | Tailwind v4 已把 `hover:` 编译在 `@media (hover: hover)` 内                             |

## 组件规则

- 先复用控件，再考虑改样式：查阅[组件目录](../web/src/components/ui/README.zh.md#component-catalog)。多个功能都需要的视觉差异做成共享组件的变体，而不是第二份副本。
- 只使用语义工具类。不写十六进制颜色、色板值或任意值，例如 `bg-[#fff]`、`text-[13px]`、`w-[372px]`。任意值只用于刻度无法表达的几何，例如 Base UI 的 CSS 变量（`origin-(--transform-origin)`）以及基于主题取值的 `calc()`。
- 不写 `dark:`。两套主题之间的差异是一个亮暗取值不同的语义 token。
- 使用 Tailwind 的字号刻度（`text-xs`、`text-sm`、`text-xl`）；每个字号自带行高。只使用 400 与 500 两种字重（`font-normal`、`font-medium`）；层级来自字号、字重与两种文字颜色，而不是更多灰色或更粗的字重。
- 保持键盘焦点可见：交互元素在 `focus-visible` 时显示 `ring` 颜色。
- 悬停时才出现的控件（例如列表行的行内操作）在该行内获得键盘焦点时同样出现，并在不支持悬停的设备上始终可见。
- 过渡使用 Tailwind 的时长与缓动工具类，并尊重减弱动效设置：位移包在 `motion-safe:` 中，或在 `motion-reduce:` 下移除。
- 控件的边框、阴影与圆角来自其共享组件；功能代码不额外添加。
- 下拉菜单与选择列表使用 shadcn `default-translucent` 菜单风格的半透明菜单，即弹出层颜色加背景模糊；功能代码不覆盖它。
- 图标来自 Tabler。共享控件内的图标使用控件的默认尺寸；其他位置默认 `size-4`，紧凑行中 `size-3.5`，侧边栏行内操作 `size-3`。每个仅含图标的按钮都有无障碍名称和 `Tooltip`，而不是 `title` 属性。

## 视觉体系

### 颜色

中性灰承担表面与文字。`primary` 与 `ring` 是品牌蓝，因此主要按钮与焦点环使用它；`destructive` 是红色，标记删除操作与错误文字。共享组件自行定义悬停颜色。

| 角色       | 工具类                                  | 用途                                     |
| ---------- | --------------------------------------- | ---------------------------------------- |
| 画布       | `bg-background`                         | 主画布与窗格                             |
| 侧边栏区域 | `bg-sidebar`、`bg-sidebar-accent`       | 会话侧边栏、设置导航，以及其中选中的行   |
| 面板与浮层 | `bg-card`、`bg-popover`                 | 卡片、菜单、选择列表、对话框             |
| 填充       | `bg-secondary`、`bg-muted`、`bg-accent` | 次要按钮、用户气泡、代码、悬停与选中填充 |

文字有两级：`text-foreground` 用于主要文字，`text-muted-foreground` 用于说明、元信息、分组标题与占位文字。每种表面都有对应的 `*-foreground` 颜色。

### 层级

| 级别     | 处理方式                            | 用途                                   |
| -------- | ----------------------------------- | -------------------------------------- |
| 平面     | 无边框、无阴影                      | 正文、助手消息、侧边栏行               |
| 面板     | `bg-card` 或 `bg-background` 加边框 | 卡片、窗格、设置面板                   |
| 填充变化 | `bg-accent` 或 `bg-muted`           | 悬停与选中的行、幽灵按钮、选中的标签页 |
| 浮层     | 共享组件自带的弹出层表面与阴影      | 菜单、选择列表、确认对话框             |
| 焦点     | `focus-visible` 时的 `ring` 颜色    | 获得焦点的控件                         |

工具提示是唯一的反色表面：`bg-foreground` 配 `text-background`，无阴影。

### 字体

文字使用 Tailwind 的字号刻度与系统字体栈（`font-sans`、`font-mono`）。`text-sm` 是默认界面文字：列表、表单、对话消息。`text-xs` 用于说明、元信息与代码；`text-xl` 与 `text-3xl` 用于空状态与页面标题。

## 圆角

[圆角标准](ui-radius.zh.md)定义圆角角色、嵌套与悬停几何。

## 修改体系

颜色在 `design/tokens.json` 中修改。Web 与桌面端的 npm 脚本在运行前重新生成输出，`just design-gen` 用于手动运行生成器。按[组件 README](../web/src/components/ui/README.zh.md) 所述重新运行 shadcn CLI 时，保留它写入 `index.css` 的 `@theme inline` 块与 `--radius`；它写入的颜色变量移入 `tokens.json`。组件使用语义工具类。共享控件的变体或行为变化时，在同一次修改中更新[组件目录](../web/src/components/ui/README.zh.md#component-catalog)。
