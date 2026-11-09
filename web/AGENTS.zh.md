# AGENTS.md — Web 客户端

[English](AGENTS.md) | 中文

这些规则是对仓库级[约定](../AGENTS.zh.md#约定)的补充。TypeScript 规则同样适用于 [packages/](../packages/AGENTS.zh.md)。

## TypeScript

- **默认用 `const`；** 只有会被重新赋值的变量用 `let`。一条声明只声明一个变量。
- **语句末尾显式书写分号。**
- **相等判断用 `===` 与 `!==`。**
- **所有控制流语句体（`if`、`for`、`while`）都加大括号。**
- **模块使用 ES 命名导出；** 类型通过 `import type` 与 `export type` 导入导出。
- **未知输入标注为 `unknown`**，再收窄为具体类型。
- **JSDoc** 是导出公共接口上的紧凑契约，不写 JSDoc 类型注解。传入多个同类型实参的调用可以内联标注参数名：`/* paramName= */`。
- **所有 TypeScript 项目共用的编译选项放在根目录 `tsconfig.base.json`；** 各项目的 `tsconfig` 继承它，只补充运行环境需要的设置：DOM、JSX、模块解析、`types`、路径别名。`scripts/`、`design/` 与 `i18n/` 中的仓库脚本是由 Node 直接运行的 `.ts` 文件，由 `just scripts-type-check` 做类型检查。
- **lint 工具是 oxlint，开启类型感知规则。** 根目录 `.oxlintrc.json` 存放所有 TypeScript 项目共用的规则，`just scripts-lint-check` 用它检查 `scripts/`、`design/` 与 `i18n/`。`web/.oxlintrc.json` 与每个包的 `.oxlintrc.json` 继承它，再加上各自运行环境的插件。抑制只针对一条规则并写明原因：`// oxlint-disable-next-line <rule> -- <reason>`。

## 布局

- 依赖只朝一个方向：`src/platform/` → `src/rpc/` → `src/features/` → `src/app/`。`src/i18n/` 存放语言文件与 `error-text.ts`，后者把失败的请求转成本地化文字。
- `src/platform/` 导出 `getPlatform()`，它返回浏览器适配器，提供 `baseUrl`（服务端 base URL）、`fetch` 与 `auth.cookieMode`。
- `src/rpc/` 存放传输层、ConnectRPC 客户端、已保存的凭据，以及读取失败原因 `ErrorReason` 的 `errors.ts`。
- `src/features/<domain>/` 采用同一布局：`index.ts` 导出该功能公开的组件与 hook，`store.ts` 是唯一调用 RPC 并把 proto 消息转换成视图类型的模块，逻辑模块及其测试与它并列，所有组件放在 `components/` 中。功能之外的代码通过 `@/features/<domain>` 导入它。
- `src/app/` 在 `router.tsx` 中存放路由表，在 `route-paths.ts` 中存放路径，并为每个布局路由设一个目录：`auth/`、`session/` 与 `settings/`，各自包含只负责编排功能组件的页面。`shell/` 存放 `SignedInLayout` 与 `ShellFrame`：前者守卫登录后的路由并持有侧边栏状态，后者由两个登录后布局填入各自的侧边栏、工具栏操作与标题。功能组件以属性接收路径，不直接引用路由。登录用户一变化，`account-data.ts` 就清空持有账号数据的功能 store；新增这类 store 时也在这里清空。
- oxlint 负责守住边界：在 `src/app/` 与 `src/features/` 中，越过功能 `index.ts` 的导入、在 `store.ts` 之外导入 `src/rpc/` 中 `errors.ts` 以外的模块、导入 `@lemma/ui` 底层的库，都会让 `just web-lint-check` 失败。
- 共享 shadcn 控件与 AI Elements 聊天组件位于 `@lemma/ui`；功能代码只从 `@lemma/ui` 导入它们、图标以及 `AnimateIcon`、`cn` 与 `toast`（[组件 README](../packages/ui/README.zh.md)）。
- 面向用户的文本经由 i18next，包括 `@lemma/ui` 组件以属性接收的文字；[i18n/README.md](../i18n/README.zh.md) 定义源条目，其生成器要求每个条目都有两种语言，因此生成的 `src/i18n/locales/en.json` 与 `zh.json` 拥有相同的键。

## 样式

- **功能代码只使用 shadcn 主题的语义工具类，**不写十六进制颜色、任意值或 `dark:` 变体；主题的角色与刻度见[样式规则](../packages/ui/README.zh.md#样式)。
- **工具负责执行类名规则：** Prettier 对 Tailwind 类名排序；oxlint-tailwindcss 拒绝冲突、矛盾、重复与已弃用的类名，并在整个 `src/` 中拒绝 `dark:` 变体、Tailwind 的字号刻度、`rounded-xl` 及以上的圆角、任意值圆角、数字时长、默认缓动、阴影刻度以及黑白颜色；`@shadcn/lint` 拒绝未知类名、原始颜色、任意值、内联样式与动态类名字符串，也拒绝改写 shadcn 组件的颜色、间距、字体排印或形状。宽度、flex、外边距等布局类仍可用在组件上。
- **控件复用 `@lemma/ui`；** 先查阅[组件目录](../packages/ui/README.zh.md#component-catalog)。多个功能都需要的视觉差异做成共享组件的变体，而不是复制一份再改样式。

## 生成文件

`src/gen/` 由 `proto/` 经 `gen:proto` 生成；`gen:tokens` 把 [design/tokens.json](../design/README.zh.md) 的主题变量写入 `@lemma/ui`；`gen:i18n` 根据 [i18n 源文件](../i18n/README.zh.md) 生成 `src/i18n/locales/en.json` 与 `zh.json`。`src/index.css` 通过 `@lemma/ui/styles.css` 加载 token。`gen` 脚本运行这三个生成器，`dev`、`build`、`lint` 与 `test` 会先运行它，`format` 先运行 `gen:tokens`。所有输出都被 Git 忽略；修改 `proto/`、`design/tokens.json` 或 `i18n/`。

`vite.config.ts` 向 `index.html` 注入一段内联脚本，在首次绘制前应用已保存的主题；脚本由 `src/features/preferences/theme.ts` 中的 `THEME_STORAGE_KEY` 与 `DEFAULT_THEME` 生成，`ThemeProvider` 读取的也是这两个常量；修改主题存储方式时改那里。它还注入两套主题的页面背景色与文字颜色，取自 [design/tokens.json](../design/README.zh.md)，使 `index.html` 中的启动标记在任何样式表加载之前就能正确绘制；这段标记用内联样式复现 `src/app/SplashScreen.tsx`，两者需要一起修改。

## 命令

```sh
just web-dev            # Vite 开发服务器
just web-test           # vitest
just web-lint-check     # oxlint；web-lint 应用修复
just web-fmt-check      # prettier --check；web-fmt 格式化
just web-cov            # vitest 覆盖率
```
