# AGENTS.md — Web 客户端

[English](AGENTS.md) | 中文

这些规则是对仓库级[约定](../AGENTS.zh.md#约定)的补充。TypeScript 规则同样适用于 [desktop/](../desktop/AGENTS.zh.md) 与 [packages/](../packages/AGENTS.zh.md)。

## TypeScript

- **默认用 `const`；** 只有会被重新赋值的变量用 `let`。一条声明只声明一个变量。
- **语句末尾显式书写分号。**
- **相等判断用 `===` 与 `!==`。**
- **所有控制流语句体（`if`、`for`、`while`）都加大括号。**
- **模块使用 ES 命名导出；** 类型通过 `import type` 与 `export type` 导入导出。
- **未知输入标注为 `unknown`**，再收窄为具体类型。
- **JSDoc** 是导出公共接口上的紧凑契约，不写 JSDoc 类型注解。传入多个同类型实参的调用可以内联标注参数名：`/* paramName= */`。
- **所有 TypeScript 项目共用的编译选项放在根目录 `tsconfig.base.json`；** 各项目的 `tsconfig` 继承它，只补充运行环境需要的设置：DOM、JSX、模块解析、`types`、路径别名。`scripts/` 与 `design/` 中的仓库脚本是由 Node 直接运行的 `.ts` 文件，由 `just scripts-type-check` 做类型检查。
- **lint 工具是 oxlint，开启类型感知规则。** 根目录 `.oxlintrc.json` 存放所有 TypeScript 项目共用的规则，`just scripts-lint-check` 用它检查 `scripts/` 与 `design/`。`web/.oxlintrc.json`、`desktop/.oxlintrc.json` 与每个包的 `.oxlintrc.json` 继承它，再加上各自运行环境的插件。抑制只针对一条规则并写明原因：`// oxlint-disable-next-line <rule> -- <reason>`。

## 布局

- `src/app/` 存放路由、页面与应用外壳；`src/features/<domain>/` 存放各领域的组件、store 与 hook。
- `src/data/rpc/` 创建 ConnectRPC 客户端并映射错误。
- `src/platform/` 选择浏览器或桌面适配器；它之外的代码只通过该适配器使用桌面能力。
- `src/components/ui/` 存放 shadcn 组件，`src/components/ai-elements/` 存放 AI Elements 聊天组件。它们的第一版由 shadcn CLI 写出，此后是受同样 lint 与 i18n 规则约束的自有代码，直接在原文件上修改（[组件 README](src/components/ui/README.zh.md)）。
- 面向用户的文本经由 i18next；`src/i18n/locales/en.json` 与 `zh.json` 拥有相同的键，由 `src/i18n/locales.test.ts` 检查。

## 样式

- **样式遵循 [web-styling.md](../docs/web-styling.zh.md)**，圆角遵循 [ui-radius.md](../docs/ui-radius.zh.md)。功能代码只使用 shadcn 主题的语义工具类，不写十六进制颜色、任意值或 `dark:` 变体；主题颜色来自 [design/tokens.json](../design/README.zh.md)。
- **工具负责执行类名规则：** Prettier 对 Tailwind 类名排序；oxlint-tailwindcss 拒绝冲突、矛盾、重复与已弃用的类名，并在整个 `src/` 中拒绝 `dark:` 变体、Tailwind 的数字时长、默认缓动、阴影刻度以及黑白颜色；`@shadcn/lint` 拒绝未知类名、原始颜色、任意值、内联样式与动态类名字符串，也拒绝改写 shadcn 组件的颜色、间距、字体排印或形状。宽度、flex、外边距等布局类仍可用在组件上。
- **控件复用 `src/components/ui/` 与 `src/components/ai-elements/`；** 先查阅[组件目录](src/components/ui/README.zh.md#component-catalog)。多个功能都需要的视觉差异做成共享组件的变体，而不是复制一份再改样式。

## 生成文件

`src/gen/` 由 `proto/` 经 `gen:proto` 脚本生成，`src/tokens.css` 由 [design/tokens.json](../design/README.zh.md) 经 `gen:tokens` 脚本生成；`gen` 脚本运行两者，`dev`、`build`、`lint` 与 `test` 会先运行它，`format` 先运行 `gen:tokens`。两者都被 Git 忽略；修改 `proto/` 或 `design/tokens.json`。

## 命令

```sh
just web-dev            # Vite 开发服务器
just web-test           # vitest
just web-lint-check     # oxlint；web-lint 应用修复
just web-fmt-check      # prettier --check；web-fmt 格式化
just web-cov            # vitest 覆盖率
```
