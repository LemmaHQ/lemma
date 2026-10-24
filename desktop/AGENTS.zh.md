# AGENTS.md — 桌面外壳

[English](AGENTS.md) | 中文

这些规则是对仓库级[约定](../AGENTS.zh.md#约定)的补充；[TypeScript 规则](../web/AGENTS.zh.md#typescript)同样适用。

## 引擎与渲染层

- **渲染层就是 Web 客户端。** `npm run build` 把 `web/` 构建到 `web-dist/`，再用 `tsc` 对桌面端源码做类型检查；界面改动在 `web/` 中进行。`main.ts` 在 `app://lemma/` 下提供 `web-dist/`，没有扩展名的路径都返回 `index.html`，因此 Web 客户端像在浏览器中一样按路径路由。窗口在引擎启动期间就打开；`getSkipCredentials()` 与 `connectEngine()` 会等待引擎就绪，启动失败时页面换成错误页。Git 忽略 `web-dist/`、`out/` 与 `.vite/`。
- **`src/engine.ts` 在 Electron utility process 中运行引擎。** `src/engine-host.ts` 是这个进程的入口：它加载 `lemma-desktop` addon，在 Electron 的 `userData` 目录上打开引擎，然后报告 `ready` 并附上默认账号，或报告 `failed` 并附上原因。未打包时从 `target/<profile>/` 加载 addon，`LEMMA_ENGINE_PROFILE` 选择 profile（默认 `debug`）；打包后从资源目录加载。
- **页面经引擎端口与引擎通信；引擎端口是一个不经过主进程的 `MessagePort`。** 页面调用 `connectEngine()` 时，`main.ts` 创建一个 `MessageChannelMain`，一端交给引擎进程，另一端交给页面；`src/serve-engine-port.ts` 在引擎一端处理请求。引擎退出时，`main.ts` 通知页面，页面上未完成与之后的请求都会失败。
- **`src/preload.ts` 实现 `window.lemmaDesktop`**，其类型定义在 [`@lemma/desktop-bridge`](../packages/AGENTS.zh.md) 中；`web/src/platform/` 是它唯一的使用方。
- **`src/gen/theme-colors.ts` 提供窗口颜色：** 即每套主题的背景、侧边栏与前景色，由 [design/tokens.json](../design/README.zh.md) 生成。它被 Git 忽略；`npm run lint`、`test` 与 `build` 会先生成它。`src/main.ts` 从中读取标题栏与窗口背景颜色。
- `LEMMA_DEBUG_PORT` 开启 Chromium 远程调试。

## 命令

```sh
just desktop-dev        # 构建引擎 addon，再启动 Electron
just desktop-lint-check # oxlint；desktop-lint 应用修复
just desktop-fmt-check  # prettier --check；desktop-fmt 格式化
just desktop-test       # vitest
just desktop-cov        # vitest 覆盖率
just desktop-package    # 构建 release 引擎 addon 与渲染层，再用 electron-forge 打包
```
