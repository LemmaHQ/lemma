# 开发

[English](development.md) | 中文

如何为 Lemma 配置开发环境，以及如何运行各个客户端。[根目录 AGENTS.zh.md](../AGENTS.zh.md#命令) 列出日常命令；[justfile](../justfile) 是完整的 recipe 列表。

## 环境搭建教程

### 前置条件

- [mise](https://mise.jdx.dev/) 安装 [mise.toml](../mise.toml) 中固定版本的工具：Node.js、Java、just、buf、protoc、mbx，以及 cargo 工具 `cargo-binstall`、`cargo-llvm-cov` 与 `cargo-nextest`。本地 shell 与 CI 读取同一份版本，Cargo 经由 mbx 运行（[构建缓存](#构建缓存)）。
- 通过 rustup 安装 Rust。[rust-toolchain.toml](../rust-toolchain.toml) 固定 Rust 版本、`rustfmt`、`clippy` 与 `llvm-tools-preview` 组件，以及四个 Android target；每个新版本发布后，Dependabot 会开一个 pull request。Rust 构建需要 `PATH` 上有 `protoc`，用来编译 `proto/`。
- 仅 Android 需要：Android SDK（通过 `ANDROID_HOME` 或 `local.properties` 中的 `sdk.dir` 找到），并在 `<sdk>/ndk/` 下安装 NDK。Gradle 使用其中最新的 NDK。

### Windows

原生 Windows 是主要开发环境。just 用 `sh` 运行每个 recipe，因此 `PATH` 上必须有 POSIX `sh`；Git for Windows 在其 `bin` 目录中提供了它。这样 `./gradlew` 等 recipe 可以原样运行，本教程中的命令也可以在 PowerShell 中运行。

mbx 会把 `target/` 换成一个链接，而 Windows 只在 Developer Mode 下创建这种链接；没有 Developer Mode 时，Cargo 在普通的 `target/` 目录中构建（[mbx 在 Windows 上的说明](https://mr-boxington.jdx.dev/installation#windows)）。执行过 `mise activate` 的 shell 会找到 mise 的 `cargo` wrapper。编辑器、Android Studio 与编程 agent 只有在用户 `Path` 中 `%LOCALAPPDATA%\mise\command-wrappers\bin` 排在 `%USERPROFILE%\.cargo\bin` 之前时才会找到它；修改 `Path` 后需要重启它们。

### 首次搭建

在仓库根目录执行：

```sh
mise install
rustup toolchain install
npm ci
```

`rustup toolchain install` 安装 rust-toolchain.toml 固定的 Rust 版本及其组件与 target。`npm ci` 安装 `web`、`desktop` 与 `packages/*` 这些 workspace。生成的契约代码不提交；Web 的 npm 脚本在 `dev`、`build`、`lint` 与 `test` 之前重新生成它，Gradle 在编译 Kotlin 之前重新生成它（[proto/AGENTS.zh.md](../proto/AGENTS.zh.md)）。

### 运行守护进程与 Web 客户端

```sh
just web-build
just rust-dev
```

`lemma-daemon` 在编译时嵌入 `web/dist`，因此 Rust workspace 编译前要先构建一次 Web 客户端。随后 `just rust-dev` 在 `LEMMA_DATA_DIR`（默认 `./data`）上打开 `Engine`，并在 `127.0.0.1:1025` 上提供 API 与这份构建产物。

开发 Web 时，`just web-dev` 启动带热更新的 Vite，并把 `/lemma.v1.*` 请求代理到 1025 端口的守护进程。

### 运行桌面应用

`just desktop-dev` 以 debug 模式构建 `lemma-napi` addon，把 Web 客户端构建到 `desktop/web-dist/`，再启动 Electron；Electron 在 utility process 中用这个 addon 运行引擎。引擎把数据库、密钥与工作区保存在 Electron 的 `userData` 目录中。引擎进程及其端口见 [desktop/AGENTS.zh.md](../desktop/AGENTS.zh.md)。

### 运行 Android 应用

Android 构建还需要由 mise 安装的 `cargo-ndk`；rust-toolchain.toml 已经列出 Rust 的 Android target。

`just mobile-android-build` 构建 debug APK。编译 Kotlin 之前，Gradle 为宿主机构建 `lemma-uniffi` 以生成 UniFFI Kotlin 绑定；打包之前，再用 `cargo-ndk` 为四种 ABI 交叉编译这个库。`-Plemma.rust.profile=release` 以 release 模式构建这些库。应用直接在 `filesDir` 上运行进程内引擎（[mobile/AGENTS.zh.md](../mobile/AGENTS.zh.md#模块与生成代码)）。

## 参考

### 环境变量

| 变量                   | 读取方                         | 含义                                                                       |
| ---------------------- | ------------------------------ | -------------------------------------------------------------------------- |
| `LEMMA_DATA_DIR`       | `lemma-daemon`                 | 存放 `lemma.db`、`secrets.json` 与 `workspaces/` 的数据目录，默认 `./data` |
| `LEMMA_PORT`           | `lemma-daemon`                 | `lemma-daemon` 在 `127.0.0.1` 上绑定的 TCP 端口，默认 `1025`               |
| `LEMMA_ENGINE_PROFILE` | `desktop/`                     | 未打包运行时 `lemma-napi` addon 的 Cargo profile，默认 `debug`             |
| `LEMMA_DEBUG_PORT`     | `desktop/`                     | Chromium 远程调试端口                                                      |
| `ANDROID_HOME`         | `mobile/shared` 的 Gradle 构建 | Android SDK 位置；也可用 `local.properties`                                |

`lemma-daemon` 从工作目录或最近的含 `.env` 的上级目录加载 `.env`；环境中已设置的变量优先。

### Worktree

Worktree 是同一仓库的另一个工作目录，有自己的分支；何时使用见[根目录 AGENTS.md](../AGENTS.zh.md#git)。在主 worktree 旁创建它，并安装其中的 npm workspace：

```sh
git worktree add ../lemma-<topic> -b <type>/<topic>
cd ../lemma-<topic>
npm ci --prefer-offline
```

- 每个 worktree 各自运行 `npm ci`。`node_modules/@lemma/*` 链接到该 worktree 自己的 workspace 包，在 Windows 上是使用绝对路径的 junction，因此从主 worktree 拿来的 `node_modules/` 会把它们解析到主 worktree 的源码。`--prefer-offline` 从 npm 缓存安装。
- 被 gitignore 的本地文件只留在主 worktree：`lemma-daemon` 需要其中的设置时复制 `.env`，未设置 `ANDROID_HOME` 时复制 `local.properties`。
- 新 worktree 没有 `web/dist`，因此在编译 `lemma-daemon` 的命令之前先运行 `just web-build`。Rust 构建在 worktree 之间复用编译产物（[构建缓存](#构建缓存)）。
- 分支合入后，`git worktree remove ../lemma-<topic>` 删除该 worktree。在 Windows 上，它会留下 `node_modules/@lemma` 中的 junction，其所在目录也因此保留；之后手动删除该目录。

### 构建缓存

[mbx](https://mr-boxington.jdx.dev/) 缓存编译产物，并在 worktree 之间与 CI 运行之间复用。[mise.toml](../mise.toml) 中的 `[wrappers.cargo]` 让 `PATH` 上的 `cargo` 命令经由 mbx 运行，因此 `just` recipe 与调用 Cargo 的 Gradle 任务也会使用它。mbx 恢复输入与缓存结果一致的编译，其余照常编译；直接调用 `~/.cargo/bin/cargo` 会绕过 mbx。

- `target` 是指向 mbx 缓存目录的链接，该目录在 Windows 上是 `%LOCALAPPDATA%\mbx`。`cargo check` 与 `cargo clippy` 在 `target/check/` 中构建，因此可以与构建或测试同时运行。
- mbx 删除已删除 worktree 的 target，并把其余 target 控制在磁盘预算内，预算用 `mbx settings` 修改（[托管的 target 目录](https://mr-boxington.jdx.dev/managed-targets)）。
- 经由 mbx 运行的构建以 `mbx[cache]:` 汇总行结束。`mbx doctor` 检查 Rust toolchain 与缓存目录；即使 mise wrapper 正让 Cargo 经由 mbx 运行，它的 `setup` 项仍会警告 Cargo shim 未安装。
- `just rust-cov` 设置 `MBX_SHARE_OUT_DIR=0`。开启 mbx 的 OUT_DIR 共享时，rustc 把 `lemma-proto` 等生成的源文件记录在 `${target}` 占位路径下，cargo-llvm-cov 不把它识别为 target 目录，会把这些文件报告为未覆盖。
- `mbx explain --last` 解释上一次构建的缓存结果，`MBX_DISABLE=1` 让单条命令不经过 mbx 运行。

### CI 工作流

[.github/workflows/](../.github/workflows/) 下除 mise-upgrade 外的每个工作流都在推送到 `main` 与 pull request 时运行；带路径过滤的工作流只在对应路径变化时运行，且每个路径过滤都包含 `justfile` 与 `mise.toml`。Rust CI 与 Mobile CI 的路径过滤还包含 `rust-toolchain.toml`，因此 Rust 版本升级会触发它们。每个工作流也可以不受路径限制地手动运行，例如 `gh workflow run rust-ci.yml --ref main`。工作流步骤调用 `just` recipe，运行 Cargo 的 job 用 `rustup toolchain install` 安装固定的 Rust 版本。Mobile CI、Android 覆盖率 job 与 CodeQL 的 Kotlin 扫描通过 [.github/actions/setup-mobile](../.github/actions/setup-mobile/action.yml) 安装工具。

结果取决于宿主机操作系统的步骤在 Linux、Windows 与 macOS 上运行：Rust 的 clippy 与测试、桌面端的构建与测试，以及 Android 宿主机测试，后者的 UniFFI 宿主机构建按系统选择库文件。格式检查、clippy 以外的 lint、Web、规范、覆盖率与代码扫描只在 Linux 上运行。

CI 中的 Cargo 同样经由 mbx 运行。Rust 的 clippy、测试与覆盖率 job 以及 setup-mobile 用 [jdx/mr-boxington-action](https://github.com/jdx/mr-boxington-action) 恢复并保存 `target/` 与 Cargo 的下载内容：推送到 `main` 时保存一条缓存，pull request 只恢复、不保存。

Dependabot 每天检查 Cargo、npm、Gradle 与 GitHub Actions 依赖，以及 Rust toolchain。

### 日常命令

根目录的[命令](../AGENTS.zh.md#命令)一节列出 workspace 级 recipe 及其命名方式，各子目录的 `AGENTS.zh.md` 列出各自的 recipe；`just --list` 打印每个 recipe 及其说明。测试分层见 [testing.zh.md](testing.zh.md)。
