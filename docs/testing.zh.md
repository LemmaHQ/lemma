# 测试

[English](testing.md) | 中文

Lemma 如何测试仓库的各个部分、测试套件在本地与 CI 中如何运行，以及覆盖率如何度量。命令见根目录 [AGENTS.zh.md](../AGENTS.zh.md#命令) 与各子目录的 `AGENTS.zh.md`；CI 概要见 [development.zh.md](development.zh.md#ci-工作流)。

## 分层

- **Rust**（`just rust-test`，在本地与 CI 中都运行 `cargo nextest run --workspace`）：这一层覆盖 provider 适配器的请求编码与流解析器；针对本机回环地址上 HTTP 服务器运行的 `ReqwestTransport`；针对临时目录运行的工作区工具；`lemma-crypto` 中的凭据加密；以及 `lemma-auth` 中的认证服务、`lemma-provider` 中的 provider 服务、`lemma-session` 中的会话服务与 `lemma-agent-loop` 中的 turn 循环，它们通过 `lemma-test-db` 在内存 SQLite 上运行，并在 `LEMMA_TEST_POSTGRES_URL` 指向 PostgreSQL 服务器时，再到该服务器上的一个全新数据库中运行一遍。Connect 服务在 `lemma-host` 的 `tests/` 中端到端运行：每个测试在临时数据目录上打开本地引擎，通过 `InProcessTransport` 发送 Connect 请求，turn 调用模型时由本机回环地址上按脚本应答的厂商服务响应。`lemma-server` 的 `tests/` 针对 `web/dist` 中的 Web 构建产物运行它的 HTTP 应用。单元测试写在被测源文件底部的 `#[cfg(test)] mod tests` 中；集成测试放在 crate 的 `tests/` 目录，只使用其公开 API。
- **Web**（`just web-test`，即在 `web/` 中运行 `vitest run`）：测试是与被测模块并列的 `src/**/*.test.ts` 与 `src/**/*.test.tsx` 文件，在 vitest 的 `happy-dom` 环境中以英文界面文本运行。这一层覆盖数据、缓存与逻辑模块，在 mock 的 RPC 客户端上运行的 feature store，以及用 Testing Library 渲染、用 `user-event` 操作的 feature 组件。`src/app/App.test.tsx` 在 mock 的 RPC 客户端上用浏览器路由渲染整个应用，走过登录、登录后的外壳、设置分区与桌面端标题栏。
- **桌面端**（`just desktop-test`，即在 `desktop/` 中运行 `vitest run`）：测试是与被测模块并列的 `src/**/*.test.ts` 文件。这一层在 mock 掉 `electron` 的情况下覆盖引擎进程生命周期、addon 文件名、应用版本参数与引擎端口上的请求转发。
- **Packages**（`just packages-test`，即在每个有测试的包中运行 `vitest run`）：`packages/ui` 在 `happy-dom` 中运行 `src/**/*.test.{ts,tsx}`，覆盖聊天组件、以应用实际渲染的组合方式覆盖基础组件，并用一个表驱动测试覆盖全部图标。
- **Android**（`just mobile-android-test`）：`androidApp` 的 debug 单元测试，加上 `:mobile:shared` 的宿主机测试，后者包含 `commonTest` 源集；以及 SQLDelight 迁移校验，它对已提交的结构快照执行 `.sqm` 迁移，再与 `LemmaDatabase.sq` 比对。它们在 JVM 上运行，不需要设备，本地与 Mobile CI 都运行。宿主机测试覆盖在 fake `LemmaClient` 上运行的 ViewModel 及其逻辑、设置与消息仓库、认证拦截器、从 Connect 错误到本地化文本的转换，以及针对本地引擎运行的 `ConnectLemmaClient`，另有一项检查英文与中文字符串资源拥有相同的键与格式参数。`AppTest` 在 Robolectric 下针对 fake `LemmaClient` 渲染整个应用，走过连接设置、登录、provider 页面与退出登录；页面测试以同样方式渲染会话页与 provider 页面。

## 覆盖率

`just web-cov`、`just desktop-cov` 与 `just packages-cov` 在语句、分支、函数与行覆盖率低于 100% 时失败；`just rust-cov` 在存在未覆盖的行或函数时失败，只报告 region 覆盖率；`just mobile-android-cov` 在存在未覆盖的行、从未调用的方法或 Composable 函数之外未走到的分支时失败。

- **Rust**：`just rust-cov` 打印 `cargo llvm-cov nextest` 摘要，`just rust-cov --html --open` 打开 HTML 报告。它排除 `lemma-proto`、Node-API addon `lemma-desktop`、UniFFI facade `lemma-mobile`、只供测试使用的 `lemma-test-db`、`lemma-server` 的二进制文件 `main.rs`、`config.rs` 与 `server_mode.rs`、`lemma-server` 中只含 `rust-embed` derive 的 `web_dist.rs`，以及 `entity/` 下的 SeaORM entity 文件。
- **Web**：`just web-cov` 以 v8 覆盖率对 `src/` 下的所有文件运行 vitest，排除 `src/gen/`、`src/i18n/locales/` 与入口 `src/main.tsx`。
- **桌面端**：`just desktop-cov` 以 v8 覆盖率对 `src/` 下的所有文件运行 vitest，排除 `src/gen/`、Electron 入口 `src/main.ts`、`src/preload.ts`、`src/engine-host.ts` 与常量文件 `src/titlebar.ts`。
- **Packages**：`just packages-cov` 以 v8 覆盖率对 `packages/ui/src/` 下的所有文件运行 vitest。
- **Android**：`just mobile-android-cov` 为 `androidApp` 与 `shared` 生成 Kover HTML 与 XML 报告，排除生成代码：契约代码、SQLDelight、UniFFI 绑定、Compose 资源、`BuildConfig`、`LemmaPalette`，以及 `@Serializable` 声明，它们的构造函数里是序列化插件加入的代码。随后由 `verifyCoverage` 任务检查 XML 报告；Composable 函数中的分支不参与这项检查，因为 Compose 编译器会加入测试无法到达的分支。

Coverage 工作流运行这些 recipe，把报告以 `rust`、`web`、`desktop`、`packages` 与 `mobile` 标记上传到 Codecov，并上传 Rust、Web、桌面端与 packages 的 JUnit 结果。其 Rust job 把 `LEMMA_TEST_POSTGRES_URL` 指向一个 PostgreSQL 服务，因此数据库测试在那里也会在 PostgreSQL 上运行。[codecov.yml](../codecov.yml) 在总覆盖率比基准提交下降超过 1% 时让 project 状态失败，并关闭 patch 状态。

## 测试如何运行

`cargo nextest` 让每个 Rust 测试在独立进程中运行，不运行 doctest。[.config/nextest.toml](../.config/nextest.toml) 中的 `ci` profile 把 JUnit XML 写到 `target/nextest/ci/junit.xml`；Coverage 工作流通过 `NEXTEST_PROFILE=ci` 选用它。

编译 workspace 会编译嵌入 `web/dist` 的 `lemma-server`；因此 Rust CI 与 Coverage 工作流的 Rust job 都先构建 Web 客户端。

## 用真实实现代替 mock

只替换模型这一边界，用写在测试中的厂商输出代替；边界之后全部运行交付代码，需要存储时使用内存后端：

- provider 适配器测试把写在测试中的厂商 SSE 载荷以字节流形式送入适配器的解析器，并比对完整的 `StreamEvent` 序列。
- Android 仓库层测试在 `JdbcSqliteDriver.IN_MEMORY` 上运行真实的 SQLDelight schema，设置测试使用 `MapSettings`。Robolectric 没有 AndroidKeyStore，令牌存储测试因此注册一个在内存中保存密钥的 `AndroidKeyStore` provider。
- Android 客户端测试在临时数据目录上打开 `lemma-mobile` 宿主机构建的本地引擎，通过 `ConnectLemmaClient` 调用它；本机回环地址上的 MockWebServer 作为 OpenAI 兼容的厂商应答模型调用。
- 依赖时间的 Web 逻辑用 vitest 的 fake timers 固定时钟。
