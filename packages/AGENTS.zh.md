# AGENTS.md — 共享包

[English](AGENTS.md) | 中文

这些规则是对仓库级[约定](../AGENTS.zh.md#约定)的补充；[TypeScript 规则](../web/AGENTS.zh.md#typescript)同样适用于这里。

## 包

- **每个目录是一个 npm workspace 包，命名为 `@lemma/<目录名>`**，标记为 private，供 Web 与桌面客户端使用。应用本身留在 `web/` 与 `desktop/`。
- **包通过 `package.json` 中的 `exports` 导出 TypeScript 源码**，没有构建步骤；使用方在自己的构建中一并编译它。
- **`ui/` 存放共享 shadcn 控件、Lemma 用它们组合出的组件、聊天组件（Base UI、Tailwind v4）及其主题。** `src/styles/index.css` 是包唯一的 CSS 入口，导出为 `@lemma/ui/styles.css`：`tokens.css` 把[设计 token](../design/README.zh.md) 映射到 Tailwind，并存放只有 Web 使用的 token，`motion.css` 存放共享动效工具类（包括视图过渡类），`components/` 存放针对单个组件内部部件的样式。组件不含界面文字，使用方应用通过属性传入每段文字。参见[组件目录](ui/README.zh.md#component-catalog)。
- **只有功能代码放不下的组件才进入 `ui/`：** 它需要豁免 Web 的 lint 规则（改写所组合控件的样式、任意值、用 ARIA 角色代替原生元素、动态类名），或需要直接导入 `@lemma/ui` 下层的库，或被多个功能共用。只有需要豁免的部分移入 `ui/`，其余留在功能中；两项条件都不满足的组件放在使用它的功能或 `web/src/app/` 中。共享组件只接收语义插槽与所需的无障碍标签，不接收某个功能的文案表或选择器；回复末尾的标记这类领域元素由调用方通过插槽注入。
- **[Modern Web Guidance](https://github.com/GoogleChrome/modern-web-guidance) CLI 是 `ui/` 的按需参考。** 编写共享组件的行为、无障碍或性能逻辑之前，用 `npx -y modern-web-guidance@latest search "<查询>"` 查找指南，再用 `retrieve "<id>"` 输出全文；[样式规则](ui/README.zh.md#styling)与现有组件优先于指南。

## 命令

```sh
just packages-type-check # 对每个包运行 tsc
just packages-lint-check # oxlint；packages-lint 应用修复
just packages-fmt-check  # prettier --check；packages-fmt 格式化
just packages-test      # 在有测试的包中运行 vitest
just packages-cov       # vitest 覆盖率
```
