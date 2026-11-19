# 测试

[English](testing.md) | 中文

Lemma 如何在仓库各部分组织、运行与度量测试。

## 测试分层

| 区域    | 命令                                                | 放置位置与运行环境                                                                                                                                                                                                                                                                                   |
| ------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rust    | `just rust-test`（`cargo nextest run --workspace`） | 单元测试放在对应源文件末尾的 `#[cfg(test)] mod tests`；公共 API 集成测试放在 `<crate>/tests/`。`nextest` 为每个测试启独立进程且不跑 doctest；`NEXTEST_PROFILE=ci` 按 [.config/nextest.toml](../.config/nextest.toml) 输出 JUnit XML。编译 `lemma-daemon` 前需先构建 `web/dist`（`just web-build`）。 |
| Web     | `just web-test`（`vitest run`）                     | 与模块同目录的 `src/**/*.test.{ts,tsx}`，在 `happy-dom` 下配合 Testing Library 与英文文案运行。                                                                                                                                                                                                      |
| 桌面端  | `just desktop-test`（`vitest run`）                 | 与模块同目录的 `src/**/*.test.ts`，仅 mock `electron`。                                                                                                                                                                                                                                              |
| 共享包  | `just packages-test`（`vitest run`）                | 与模块同目录的 `src/**/*.test.{ts,tsx}`，在 `happy-dom` 下运行。                                                                                                                                                                                                                                     |
| Android | `just mobile-android-test`                          | `:mobile:androidApp` 的 Robolectric 单元测试与 `:mobile:shared` 的 JVM 宿主机测试（`commonTest` + `androidHostTest`），无需真机或模拟器。                                                                                                                                                            |

## 覆盖率

五个区域均强制执行覆盖率门槛（`just rust-cov`、`just web-cov`、`just desktop-cov`、`just packages-cov`、`just mobile-android-cov`）：

- **Web、桌面端、共享包**：语句、分支、函数、行覆盖率低于 100% 即失败（排除项见各自的 `vitest.config.*`）。
- **Rust**：通过 `cargo llvm-cov nextest` 检查，任意未覆盖行或函数即失败（排除项见 [justfile](../justfile)）。
- **Android**：通过 Kover 与 `verifyCoverage` 检查，任意未覆盖行、未调用方法或 Composable 函数外未命中分支即失败（排除项见 `mobile/androidApp/build.gradle.kts`）。

[codecov.yml](../codecov.yml) 在总覆盖率相对基准下降超过 1% 时使项目状态失败，并关闭 patch 覆盖率门禁。

## 优先真实实现，少用 mock

优先运行真实代码，只在模型网络边界做假：

- Rust 存储与工具使用内存 SQLite（`lemma_db::in_memory`）或临时目录，向真实适配器与 `InProcessEngine` 喂入脚本化的厂商 SSE 或本机回环 HTTP 响应。
- Android 在 `MapSettings` 上运行 `SettingsRepository`，并让 `ConnectLemmaClient` 对接宿主机编译的 `lemma-uniffi` 引擎与回环模拟模型服务。
- 依赖时间的 Web 逻辑使用 vitest 假时钟。
