# 开发

[English](development.md) | 中文

如何为 Lemma 配置开发环境，以及如何运行各个客户端。[根目录 AGENTS.zh.md](../AGENTS.zh.md#命令) 列出日常命令；[justfile](../justfile) 是完整的 recipe 列表。

## 环境搭建教程

### 前置条件

- [mise](https://mise.jdx.dev/) 安装 [mise.toml](../mise.toml) 中固定版本的工具：Node.js、Java、just、buf、protoc，以及 cargo 工具 `cargo-binstall`、`sqlx-cli`、`cargo-llvm-cov` 与 `cargo-nextest`。本地 shell、CI 与 Dockerfile 读取同一份版本。
- 通过 rustup 安装 stable 版 Rust；[rust-toolchain.toml](../rust-toolchain.toml) 会加上 `rustfmt`、`clippy` 与 `llvm-tools-preview`。Rust 构建需要 `PATH` 上有 `protoc`，用来编译 `proto/`。
- Docker，用于 PostgreSQL 与完整栈镜像。
- 仅 Android 需要：Android SDK（通过 `ANDROID_HOME` 或 `local.properties` 中的 `sdk.dir` 找到），并在 `<sdk>/ndk/` 下安装 NDK。Gradle 使用其中最新的 NDK。

### Windows

原生 Windows 是主要开发环境。just 用 `sh` 运行每个 recipe，因此 `PATH` 上必须有 POSIX `sh`；Git for Windows 在其 `bin` 目录中提供了它。这样 `./gradlew` 等 recipe 可以原样运行，本教程中的命令也可以在 PowerShell 中运行。

### 首次搭建

在仓库根目录执行：

```sh
mise install
npm ci
just proto-gen
cp .env.example .env
```

`npm ci` 安装 `web` 与 `desktop` 两个 workspace。生成的契约代码不提交，因此每次克隆后、每次修改 `.proto` 后都要运行 `just proto-gen`（[proto/AGENTS.zh.md](../proto/AGENTS.zh.md)）。在 `.env` 中，让 `LEMMA_DB_PASSWORD` 与 `DATABASE_URL` 使用同一个数据库密码，并替换两个密钥。

### 运行服务端与 Web 客户端

```sh
docker compose up -d
just web-build
just rust-dev
```

`docker compose up -d` 只启动 PostgreSQL 容器，端口 5432；服务端容器属于 `full` profile。`lemma-server` 在编译时嵌入 `web/dist`，因此 Rust workspace 编译前要先构建一次 Web 客户端。随后 `just rust-dev` 在 1025 端口提供 API 与这份构建产物，并在启动时运行迁移。

开发 Web 时，`just web-dev` 启动带热更新的 Vite，并把 `/lemma.v1.*` 请求代理到 1025 端口的服务端。把 `DATABASE_URL` 设为 `sqlite:` 时，同一个服务端在 SQLite 上运行，无需 Docker。

`just docker-up` 启动服务端容器（镜像不存在时先由 Dockerfile 构建）与数据库；`just docker-down` 停止它们。

### 运行桌面应用

`just desktop-dev` 以 debug 模式构建 `lemma-server`，把 Web 客户端构建到 `desktop/web-dist/`，再启动 Electron；Electron 把服务端作为本地引擎运行。引擎把数据库与密钥保存在 Electron 的 `userData` 目录中，不需要 `.env`。引擎握手见 [desktop/AGENTS.zh.md](../desktop/AGENTS.zh.md)。

### 运行 Android 应用

Android 构建还需要 Rust 的 Android target 与 `cargo-ndk`：

```sh
rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
cargo binstall cargo-ndk
```

`just mobile-android-build` 构建 debug APK。编译 Kotlin 之前，Gradle 为宿主机构建 `lemma-mobile` 以生成 UniFFI Kotlin 绑定，并用 `cargo-ndk` 为四种 ABI 交叉编译；`-Plemma.rust.profile=release` 以 release 模式构建这些库。APK 可以在本地模式下运行而无需服务端，也可以在远程模式下连接在应用中填写的服务端地址（[mobile/AGENTS.zh.md](../mobile/AGENTS.zh.md#模块与生成代码)）。

## 参考

### 环境变量

| 变量 | 读取方 | 含义 |
|---|---|---|
| `DATABASE_URL` | `lemma-server`，服务端模式 | `postgres://` 或 `postgresql://` 选择 PostgreSQL；`sqlite:` 选择指定路径上的 SQLite |
| `LEMMA_JWT_SECRET` | `lemma-server`，服务端模式 | 签名并校验访问令牌 |
| `LEMMA_SECRET_KEY` | `lemma-server`，服务端模式 | 派生用于加密 provider API key 的密钥；更换后已存储的 key 无法读取 |
| `LEMMA_DB`、`LEMMA_DB_USER`、`LEMMA_DB_PASSWORD` | `docker-compose.yml` | PostgreSQL 容器的数据库名、用户与密码；密码必填 |
| `LEMMA_LOCAL_MODE`、`LEMMA_DATA_DIR` | `lemma-server` | 作为本地引擎运行，SQLite 与密钥都放在数据目录中；由 Electron 设置 |
| `LEMMA_ENGINE_PROFILE` | `desktop/` | 未打包运行时引擎可执行文件的 Cargo profile，默认 `debug` |
| `LEMMA_DEBUG_PORT` | `desktop/` | Chromium 远程调试端口 |
| `ANDROID_HOME` | `mobile/shared` 的 Gradle 构建 | Android SDK 位置；也可用 `local.properties` |

`lemma-server` 从工作目录或最近的含 `.env` 的上级目录加载 `.env`；环境中已设置的变量优先。

### CI 工作流

[.github/workflows/](../.github/workflows/) 下除 mise-upgrade 外的每个工作流都在推送到 `main` 与 pull request 时运行；带路径过滤的工作流只在对应路径变化时运行。Rust CI、Web CI 与 Spec CI 都以一个 `check` job 收尾，其中任一 job 失败它就失败。

| 工作流 | 路径 | 运行内容 |
|---|---|---|
| Rust CI | `Cargo.toml`、`Cargo.lock`、`crates/`、`proto/` | 先为嵌入构建 `web/dist`，再运行 `cargo fmt --check`、拒绝警告的 clippy，以及带 PostgreSQL 服务的 `cargo nextest` |
| Web CI | `web/`、`design/`、根目录 `package.json`、`package-lock.json` | proto 与 token 生成、prettier 检查、eslint、构建、vitest |
| Spec CI | `proto/`、`design/`、`docs/`、`scripts/`、所有 Markdown 文件与配对记录、markdownlint 与 autocorrect 配置 | `buf lint` 与 `buf build`、token 生成器的检查、文档 lint、双语配对检查 |
| Coverage | 全部 | Rust 与 Web 覆盖率，上传到 Codecov（[testing.zh.md](testing.zh.md#覆盖率)） |
| CodeQL | 全部，另有每周定时 | 对 Rust、JavaScript/TypeScript 与 GitHub Actions 做代码扫描 |
| mise-upgrade | 每日定时 | 升级 `mise.toml` 中的固定版本，同步 Dockerfile 的 Node 版本，并开一个 pull request |

Dependabot 每天检查 Cargo、npm、Gradle、GitHub Actions 与 Docker 依赖。没有工作流构建 `desktop/` 或 `mobile/`。

### 日常命令

根目录的[命令](../AGENTS.zh.md#命令)一节列出 workspace 级 recipe，各子目录的 `AGENTS.zh.md` 列出各自的 recipe；`just --list` 打印每个 recipe 及其说明。`just check` 运行静态检查，`just verify` 再加上 Rust 与 Web 测试。测试分层见 [testing.zh.md](testing.zh.md)。
