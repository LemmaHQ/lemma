# 测试

[English](testing.md) | 中文

Lemma 如何测试仓库的各个部分、测试套件在本地与 CI 中如何运行，以及覆盖率如何度量。命令见根目录 [AGENTS.zh.md](../AGENTS.zh.md#命令) 与各子目录的 `AGENTS.zh.md`；CI 概要见 [development.zh.md](development.zh.md#ci-工作流)。

## 分层

- **Rust**（`just rust-test`，即 `cargo test --workspace`）：单元测试写在被测源文件底部的 `#[cfg(test)] mod tests` 中；集成测试放在 crate 的 `tests/` 目录，只使用其公开 API。CI 用 `cargo nextest run --workspace` 运行同一批测试。
- **真实 provider**（只在本地运行）：调用厂商真实 API 的测试从环境变量读取 key，并标注 `#[ignore]`，因此 `just rust-test` 与 CI 都会跳过它们；用 `cargo test --workspace -- --ignored` 运行。每种 provider 类型有一个冒烟测试：发送一条提示，期望收到 `Done` 且文本非空；另有一个完成一次工具调用的测试。
- **Web**（`just web-test`，即在 `web/` 中运行 `vitest run`）：测试是与被测模块并列的 `src/**/*.test.ts` 文件，在 vitest 的 `node` 环境中运行。这一层覆盖数据、缓存与逻辑模块，另有一项检查 `en.json` 与 `zh.json` 拥有相同的键；没有测试渲染 React 组件。
- **Android**（`just mobile-android-test`）：`androidApp` 的 debug 单元测试，加上 `:mobile:shared` 的宿主机测试，后者包含 `commonTest` 源集。它们在 JVM 上运行，不需要设备。`just verify` 与 CI 都不运行这一层。

## 存储测试

两个存储后端运行同一组针对存储 trait 编写的测试用例，因此只给一个后端加迁移会让测试失败。SQLite 存储测试打开 `lemma_db_sqlite::connect_in_memory()` 并运行迁移。PostgreSQL 存储测试连接 `DATABASE_URL` 指向的服务器，每个测试使用一个新数据库；未设置 `DATABASE_URL` 时跳过。Rust CI 的测试 job 与 Coverage job 会设置它。

## 覆盖率

覆盖率门槛作用于 Rust 与 Web；Android 没有门槛。

- **Rust**：`just rust-cov` 打印 `cargo llvm-cov` 摘要，`just rust-cov-html` 打开 HTML 报告。两者都排除 `lemma-server`、`lemma-core` 与 `lemma-proto`。Coverage 工作流以相同的排除项运行 `cargo llvm-cov nextest`，行覆盖率低于 85% 时失败。
- **Web**：`just web-cov` 以 v8 覆盖率运行 vitest，排除 `src/gen/` 与 `src/i18n/locales/`。`web/vite.config.ts` 设置了 90% 的行覆盖率门槛，因此本地运行与 CI 同样执行它。

Coverage 工作流把两份报告及其 JUnit 结果以 `rust` 与 `web` 标记上传到 Codecov。[codecov.yml](../codecov.yml) 在总覆盖率比基准提交下降超过 1% 时让 project 状态失败，并关闭 patch 状态。

## 测试如何运行

`cargo nextest` 让每个 Rust 测试在独立进程中运行。[.config/nextest.toml](../.config/nextest.toml) 中的 `ci` profile 把 JUnit XML 写到 `target/nextest/ci/junit.xml`；Coverage 工作流通过 `NEXTEST_PROFILE=ci` 选用它。

编译 workspace 会编译嵌入 `web/dist` 的 `lemma-server`；因此 Rust CI 在 clippy 与测试之前先构建 Web 客户端。

## 用真实实现代替 mock

只替换模型这一边界，用录制的 provider 输出代替；边界之后全部运行交付代码，需要存储时使用内存后端：

- provider 适配器测试把录制的厂商 SSE 载荷以字节流形式送入适配器的解析器，并比对完整的 `StreamEvent` 序列。
- Web 缓存测试在 `fake-indexeddb` 上运行真实的 Dexie 数据库。
- Android 仓库层测试在 `JdbcSqliteDriver.IN_MEMORY` 上运行真实的 SQLDelight schema，设置测试使用 `MapSettings`。
- 依赖时间的 Web 逻辑用 vitest 的 fake timers 固定时钟。
