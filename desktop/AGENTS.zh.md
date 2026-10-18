# AGENTS.md — 桌面外壳

[English](AGENTS.md) | 中文

这些规则是对仓库级[约定](../AGENTS.zh.md#约定)的补充；[TypeScript 规则](../web/AGENTS.zh.md#typescript)同样适用。

## 引擎与渲染层

- **渲染层就是 Web 客户端。** `npm run build` 以相对 base 构建 `web/`，输出到 `web-dist/`；界面改动在 `web/` 中进行。Git 忽略 `web-dist/`、`out/` 与 `.vite/`。
- **`src/engine.ts` 以子进程方式运行 `lemma-server`**，设置 `LEMMA_LOCAL_MODE=1`，并把 `LEMMA_DATA_DIR` 设为 Electron 的 `userData` 目录。未打包时从 `target/<profile>/` 取可执行文件，`LEMMA_ENGINE_PROFILE` 选择 profile（默认 `debug`）。
- **引擎通过一行 stdout 宣告就绪**：`LEMMA_READY <json>`，携带端口与默认账号凭据。`engine.ts` 与 `crates/server/lemma-server/src/local.rs` 分别负责这次握手的两端，两者一起修改。
- **`src/preload.ts` 向渲染层暴露 `__LEMMA_SERVER_URL__` 与 `lemmaDesktop`**；`web/src/platform/` 是它们唯一的使用方。
- **`src/gen/design-tokens.ts` 提供主题颜色**，由 [design/tokens.json](../design/tokens.json) 生成；`npm run build` 会生成它，Git 忽略它。`src/main.ts` 从中读取标题栏与窗口背景颜色。
- `LEMMA_DEBUG_PORT` 开启 Chromium 远程调试。

## 命令

```sh
just desktop-dev        # 构建 lemma-server，再启动 Electron
just desktop-lint-check # eslint；desktop-lint 应用修复
just desktop-fmt-check  # prettier --check；desktop-fmt 格式化
just desktop-test       # vitest
just desktop-cov        # vitest 覆盖率
just desktop-package    # 构建渲染层、electron-forge 打包
```
