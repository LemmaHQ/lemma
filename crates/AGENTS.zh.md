# AGENTS.md — Rust workspace

[English](AGENTS.md) | 中文

这些规则是对仓库级[约定](../AGENTS.zh.md#约定)的补充，遵循 [lemma-code-style](../.agents/skills/lemma-code-style/SKILL.md) 中的 Google Rust Style Guide，并把全部 Rust 代码视为库代码。

## 代码

- **表达式驱动：** 计算链条保持简短直接；含分支或修改外部状态的链条改写为 `for` 循环。
- **守卫分支用 `let-else`；** 复杂分支用穷尽的 `match`。
- **导入：** `use` 分组依次为标准库、外部 crate、workspace 内 crate，每条 `use` 只从一个模块导入。类型与 trait 导入后不加限定直接使用；自由函数通过所在模块调用（`persist::settle()`）；只在一个函数中使用的 trait 在该函数内导入；唯一允许的 glob 导入是测试模块中的 `use super::*`。
- **模块** 采用 `foo.rs` 与同名 `foo/` 目录并列。含子模块的模块（包括 crate 根）只包含 `mod` 声明、re-export 以及二进制的 `fn main`；叶子文件以其主要条目命名（`AuthService` 位于 `auth_service.rs`）。一个类型的方法拆到多个文件时，每个资源一个文件（`session_service/messages.rs`）。
- **所有权：** 数据以借用传递（`&str`、`&[T]`、`Option<&T>`），避免拷贝。`Arc` 只持有由派生任务或请求处理器共享的值。参数用泛型而非 `dyn Trait`，取具体类型而非 `impl Into<T>`；`dyn` 只保留给工具注册表这类异构集合以及 UniFFI 边界。
- **生命周期** 只在推断不足时显式标注，并使用描述性名称（`'conn`，而非 `'a`）。
- **Workspace lint** 定义在根 `Cargo.toml`；每个 crate 通过 `[lints] workspace = true` 启用。

## 文档注释

- `//!` 只出现在 crate 根或顶层公开模块，紧凑说明其定位。
- `///` 是公共 API 与 trait 上的紧凑契约。
- 返回 `Result` 的公共函数添加 `# Errors` 小节，列出自身产生的错误；只传递其他调用错误的函数用一行说明错误来源。可能 panic 的公共函数添加 `# Panics` 小节。
- `unsafe` 块只附带紧凑的 `// SAFETY: <前置条件证明>`。

## 布局

- `shared/` 中的 crate 为所有运行时构建，包括 Android；`rpc/` 中每个 proto service 对应一个 crate，另有 `lemma-host`；宿主目录（`server/`、`desktop/`、`mobile/`）下的 crate 只编入该宿主；`test/` 中的 crate 只作为 dev-dependency 使用。
- `lemma-desktop` 是 GPUI Kit 应用。它的构建脚本用 Node 运行 `i18n/` 与 `design/` 的生成器，因此构建前需要 Node 和 `npm ci`；在 Linux 上还需要[桌面构建 action](../.github/actions/setup-desktop-build/action.yml) 安装的 GPUI 系统库。它的视图通过 `EngineRuntime::spawn` 在引擎的 tokio 运行时上执行客户端调用，测试用 `#[gpui_kit::test]` 以无窗口方式打开真实窗口。
- `vendor/gpui-pre-windows/` 是 GPUI Kit 的 Windows 平台 crate 在 `Cargo.lock` 所记版本的副本，经 `[patch.crates-io]` 引入；唯一的改动让 `direct_write.rs` 的 `rendering_mode` 对所有字号都不做 hinting（`NATURAL_SYMMETRIC`，关闭网格对齐）。升级 GPUI Kit 后若 cargo 提示补丁未被使用，复制新版本的源码并重新应用这处改动。
- crate 命名为 `lemma-<concept>`。
- `lemma-auth`、`lemma-session` 与 `lemma-provider` 在各自的 `src/migration/` 中拥有自己的表及其 SeaORM migration；`lemma-host` 按名称顺序运行它们。新增时用 `sea-orm-cli migrate init -d <tmp>` 与 `migrate generate <name> -d <tmp>` 在临时目录中生成骨架，再把文件移进来。

## 命令

```sh
just rust-lint-check    # 对全部 target 运行 clippy，拒绝警告；rust-lint 应用修复
just rust-fmt-check     # cargo fmt --check；rust-fmt 格式化
just rust-test          # cargo nextest run --workspace
just rust-cov           # llvm-cov 汇总，存在未覆盖的行或函数时失败
```
