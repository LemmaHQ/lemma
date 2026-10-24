# AGENTS.md — 共享包

[English](AGENTS.md) | 中文

这些规则是对仓库级[约定](../AGENTS.zh.md#约定)的补充；[TypeScript 规则](../web/AGENTS.zh.md#typescript)同样适用于这里。

## 包

- **每个目录是一个 npm workspace 包，命名为 `@lemma/<目录名>`**，标记为 private，供 Web 与桌面客户端使用。应用本身留在 `web/` 与 `desktop/`。
- **包通过 `package.json` 中的 `exports` 导出 TypeScript 源码**，没有构建步骤；使用方在自己的构建中一并编译它。
- **`desktop-bridge/` 存放桌面端 preload 以 `window.lemmaDesktop` 暴露的 API 类型。** `desktop/src/preload.ts` 实现这些类型，`desktop/src/main.ts` 响应它们的 IPC 调用，`web/src/platform/` 使用它们；桥接口的变更在同一次改动中更新这三处。

## 命令

```sh
just packages-type-check # 对每个包运行 tsc
just packages-lint-check # oxlint；packages-lint 应用修复
just packages-fmt-check  # prettier --check；packages-fmt 格式化
```
