# Web 主题样式

[English](README.md) | 中文

## 概要

`web/src/styles/` 存放 Web 客户端与桌面端渲染层的全局样式表：生成的 token 样式表与手写的主题样式表。[`web/src/index.css`](../index.css) 在 Tailwind 之后加载它们。功能代码使用由此产生的工具类，不定义全局样式（[归属](../../../docs/web-styling.zh.md#归属)）。

## 文件

| 文件                     | 所有者                                                                   | 内容                                                                                       |
| ------------------------ | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| `tokens.css`             | 由 [`design/tokens.json`](../../../design/tokens.json) 生成；被 Git 忽略 | 各主题的语义颜色与阴影、基础 `--radius`，以及颜色、圆角刻度与阴影的 Tailwind `@theme` 映射 |
| [`theme.css`](theme.css) | 手写                                                                     | 滚动条颜色、基础层，以及毛玻璃与菜单材质                                                   |

## theme.css

- **滚动条颜色。** `--scrollbar-thumb` 与 `--scrollbar-thumb-hover` 分别以 18% 与 32% 混合 `--foreground`，因此跟随主题。
- **基础层。** 所有元素默认使用 `border` 颜色；`body` 使用画布颜色、前景色、无衬线字体栈与抗锯齿。
- **毛玻璃材质。** `.glass` 以 `glass` 颜色填充，并对背景做 20px 模糊、1.5 倍饱和度。
- **菜单材质。** 下拉菜单、子菜单与选择列表的内容通过 `data-slot` 属性匹配，以 84% 不透明度的弹出层颜色填充，并使用同样的背景模糊。

## index.css

[`index.css`](../index.css) 依次导入 Tailwind、`tw-animate-css`、`tokens.css` 与 `theme.css`，并定义依赖平台外壳的样式：

- 绑定到 `.dark` 类的 `dark` 自定义变体；
- `.desktop-titlebar`，即桌面端外壳在页面上方渲染的 40px 拖拽区域，以及按其高度偏移 `body`、`h-dvh` 与 `min-h-dvh` 工具类的 `html.desktop` 规则；
- 滚动条几何：细的标准滚动条，以及 8px 宽、滑块圆角 4px 的 WebKit 滚动条。
