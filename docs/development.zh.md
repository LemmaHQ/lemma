# 开发指南

[English](development.md) | 中文

如何在本机配置 Lemma 开发环境并运行各端客户端。完整命令列表以 [justfile](../justfile)（`just --list`）为准。

## 环境搭建

### 前置依赖

- [mise](https://mise.jdx.dev/) 安装 [mise.toml](../mise.toml) 中固定的工具，并通过 [mbx](https://mr-boxington.jdx.dev/) 包装 `cargo`。
- [rustup](https://rustup.rs/) 安装 [rust-toolchain.toml](../rust-toolchain.toml) 中固定的工具链、组件与 Android target。
- 仅 Android 需要：Android SDK（通过 `ANDROID_HOME` 或 `local.properties` 中的 `sdk.dir` 指定），并在 `<sdk>/ndk/` 下装有 NDK。

### Windows

原生 Windows 是主要开发环境。`just` 通过 `sh` 执行 recipe，因此 `PATH` 上需要有 POSIX `sh`（例如 Git for Windows 的 `bin` 目录）。

`mbx` 会把 `target/` 链接到 `%LOCALAPPDATA%\mbx`，这需要开启 Windows 的 Developer Mode（否则 Cargo 退回普通 `target/` 目录，见 [mbx on Windows](https://mr-boxington.jdx.dev/installation#windows)）。编辑器、Android Studio 与编程 agent 只有在用户 `Path` 中 `%LOCALAPPDATA%\mise\command-wrappers\bin` 排在 `%USERPROFILE%\.cargo\bin` 之前时才会用到 mise 的 `cargo` wrapper；修改 `Path` 后需重启这些程序。

### 首次安装

在仓库根目录执行：

```sh
mise install
rustup toolchain install
npm ci
```

### 运行各客户端

- **守护进程与 Web**：先执行 `just web-build`，再执行 `just rust-dev`（`lemma-daemon` 在编译期嵌入 `web/dist`，监听 `http://127.0.0.1:1025`）。Web 热重载开发可配合已启动的守护进程运行 `just web-dev`。
- **桌面端**：`just desktop-dev` 构建 `lemma-napi` 与 Web 渲染层并启动 Electron（[desktop/AGENTS.md](../desktop/AGENTS.md)）。
- **Android**：`just mobile-android-build` 打包 debug APK（加 `-Plemma.rust.profile=release` 构建 release JNI 库，见 [mobile/AGENTS.md](../mobile/AGENTS.md)）。

## 参考

### 环境变量

| 变量                   | 读取方                      | 含义                                                                        |
| ---------------------- | --------------------------- | --------------------------------------------------------------------------- |
| `LEMMA_DATA_DIR`       | `lemma-daemon`              | `lemma.db`、`secrets.json` 与 `workspaces/` 所在的数据目录（默认 `./data`） |
| `LEMMA_PORT`           | `lemma-daemon`              | `lemma-daemon` 在 `127.0.0.1` 上监听的 TCP 端口（默认 `1025`）              |
| `LEMMA_ENGINE_PROFILE` | `desktop/`                  | 未打包桌面端加载 `lemma-napi` 所用的 Cargo profile（默认 `debug`）          |
| `LEMMA_DEBUG_PORT`     | `desktop/`                  | Chromium 远程调试端口                                                       |
| `ANDROID_HOME`         | `mobile/shared` Gradle 构建 | Android SDK 路径（也可写在 `local.properties`）                             |

`lemma-daemon` 会从工作目录或最近的父目录加载 `.env`；进程中已设置的环境变量优先级更高。

### Worktree

并行开发时在主目录旁新建独立 worktree（[AGENTS.md](../AGENTS.md#git)）：

```sh
git worktree add ../lemma-<topic> -b <type>/<topic>
cd ../lemma-<topic>
npm ci --prefer-offline
```

- 每个 worktree 都要单独运行 `npm ci`：Windows 上 `node_modules/@lemma/*` 使用绝对路径 junction，直接复用主目录的 `node_modules/` 会指向错误源码。
- 如需 `.env` 或 `local.properties`，手动从主目录复制；编译 `lemma-daemon` 前先执行 `just web-build`。
- 执行 `git worktree remove ../lemma-<topic>` 后，Windows 会残留 `node_modules/@lemma` junction 及外层目录，需手动删除残留目录。

### 构建缓存

Cargo 通过 `mbx`（由 `mise.toml` 的 `[wrappers.cargo]` 接管）在多 worktree 与 CI 间复用编译产物（`cargo check` 与 `cargo clippy` 构建于 `target/check/`）。可用 `mbx doctor` 检查配置，`mbx explain --last` 查看缓存命中，`MBX_DISABLE=1` 单次跳过缓存。

### CI 工作流

[.github/workflows/](../.github/workflows/) 下的工作流在推送到 `main`、PR 与手动触发（`gh workflow run`）时直接调用同一套 `just` recipe。各工作流的路径过滤、系统矩阵与缓存配置以工作流文件本身为准。
