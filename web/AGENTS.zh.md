# AGENTS.md — Web 客户端

[English](AGENTS.md) | 中文

这些规则是对仓库级[约定](../AGENTS.zh.md#约定)的补充。TypeScript 规则同样适用于 [desktop/](../desktop/AGENTS.zh.md)。

## TypeScript

- **默认用 `const`；** 只有会被重新赋值的变量用 `let`。一条声明只声明一个变量。
- **语句末尾显式书写分号。**
- **相等判断用 `===` 与 `!==`。**
- **所有控制流语句体（`if`、`for`、`while`）都加大括号。**
- **模块使用 ES 命名导出；** 类型通过 `import type` 与 `export type` 导入导出。
- **未知输入标注为 `unknown`**，再收窄为具体类型。
- **JSDoc** 是导出公共接口上的紧凑契约，不写 JSDoc 类型注解。传入多个同类型实参的调用可以内联标注参数名：`/* paramName= */`。
- **所有 TypeScript 项目共用的编译选项放在根目录 `tsconfig.base.json`；** 各项目的 `tsconfig` 继承它，只补充运行环境需要的设置：DOM、JSX、模块解析、`types`、路径别名。`scripts/` 与 `design/` 中的仓库脚本是由 Node 直接运行的 `.ts` 文件，由 `just scripts-type-check` 做类型检查。

## 布局

- `src/app/` 存放路由、页面与应用外壳；`src/features/<domain>/` 存放各领域的组件、store 与 hook。
- `src/data/rpc/` 创建 ConnectRPC 客户端并映射错误；`src/data/cache/` 是 IndexedDB 缓存。
- `src/platform/` 选择浏览器或桌面适配器；它之外的代码只通过该适配器使用桌面能力。
- `src/components/ui/` 存放 shadcn 组件，通过 shadcn CLI 添加。
- 面向用户的文本经由 i18next；`src/i18n/locales/en.json` 与 `zh.json` 拥有相同的键，由 `src/i18n/locales.test.ts` 检查。

## 样式

- **样式遵循 [web-styling.md](../docs/web-styling.zh.md)**，圆角遵循 [ui-radius.md](../docs/ui-radius.zh.md)。功能代码只使用由 [design/tokens.json](../design/tokens.json) 生成的语义工具类，不写十六进制颜色、任意值或 `dark:` 变体。
- **控件复用 `src/components/ui/`；** 先查阅其[组件目录](src/components/ui/README.zh.md#component-catalog)。多个功能都需要的视觉差异做成共享组件的变体，而不是复制一份再改样式。

## 生成文件

`src/gen/` 由 `proto/` 经 `gen:proto` 脚本生成，`dev`、`build`、`lint` 与 `test` 会先运行它；`src/styles/tokens.css` 由 [design/tokens.json](../design/tokens.json) 经 `design/gen-tokens.ts` 生成，`dev` 与 `build` 会先运行它。两者都被 Git 忽略；修改其来源。

## 命令

```sh
just web-dev            # Vite 开发服务器
just web-test           # vitest
just web-lint-check     # eslint；web-lint 应用修复
just web-fmt-check      # prettier --check；web-fmt 格式化
just web-cov            # vitest 覆盖率
```
