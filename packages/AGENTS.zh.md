# AGENTS.md — 共享包

[English](AGENTS.md) | 中文

这些规则是对仓库级[约定](../AGENTS.zh.md#约定)的补充；[TypeScript 规则](../web/AGENTS.zh.md#typescript)同样适用于这里。

## 包

- **每个目录是一个 npm workspace 包，命名为 `@lemma/<目录名>`**，标记为 private，供 Web 与桌面客户端使用。应用本身留在 `web/` 与 `desktop/`。
- **包通过 `package.json` 中的 `exports` 导出 TypeScript 源码**，没有构建步骤；使用方在自己的构建中一并编译它。
- **`desktop-bridge/` 存放桌面端 preload 以 `window.lemmaDesktop` 暴露的 API 类型。** `desktop/src/preload.ts` 实现这些类型，`desktop/src/main.ts` 响应它们的 IPC 调用，`web/src/platform/` 使用它们；桥接口的变更在同一次改动中更新这三处。
- **`ui/` 存放共享 shadcn 控件、AI Elements 聊天组件（Base UI、Tailwind v4）及其主题。** `src/styles/index.css` 是包唯一的 CSS 入口，导出为 `@lemma/ui/styles.css`：`tokens.css` 把[设计 token](../design/README.zh.md) 映射到 Tailwind，并存放只有 Web 使用的 token，`motion.css` 存放共享动效工具类（包括视图过渡工具类），`components/` 存放针对单个组件内部部件的样式。组件不含界面文字，使用方应用通过属性传入每段文字。参见[组件目录](ui/README.zh.md#component-catalog)。

## 命令

```sh
just packages-type-check # 对每个包运行 tsc
just packages-lint-check # oxlint；packages-lint 应用修复
just packages-fmt-check  # prettier --check；packages-fmt 格式化
just packages-test      # 在有测试的包中运行 vitest
just packages-cov       # vitest 覆盖率
```
