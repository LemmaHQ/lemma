# AGENTS.md — Rust workspace

[English](AGENTS.md) | 中文

这些规则是对仓库级[约定](../AGENTS.zh.md#约定)的补充，遵循 [lemma-code-style](../.agents/skills/lemma-code-style/SKILL.md) 中的 Google Rust Style Guide，并把全部 Rust 代码视为库代码。

## 代码

- **表达式驱动：** 计算链条保持简短直接；含分支或修改外部状态的链条改写为 `for` 循环。
- **守卫分支用 `let-else`；** 复杂分支用穷尽的 `match`。
- **导入：** `use` 分组依次为标准库、外部 crate、workspace 内 crate，每条 `use` 只从一个模块导入。类型与 trait 导入后不加限定直接使用；自由函数通过所在模块调用（`persist::settle()`）；只在一个函数中使用的 trait 在该函数内导入；唯一允许的 glob 导入是测试模块中的 `use super::*`。
- **模块** 采用 `foo.rs` 与同名 `foo/` 目录并列。含子模块的模块（包括 crate 根）只包含 `mod` 声明、re-export 以及二进制的 `fn main`；叶子文件以其主要条目命名（`AuthService` 位于 `auth_service.rs`）。
- **所有权：** 数据以借用传递（`&str`、`&[T]`、`Option<&T>`），避免拷贝。`Arc` 只持有由派生任务或请求处理器共享的值。参数用泛型而非 `dyn Trait`，取具体类型而非 `impl Into<T>`；`dyn` 只保留给工具注册表这类异构集合以及 UniFFI 边界。
- **生命周期** 只在推断不足时显式标注，并使用描述性名称（`'conn`，而非 `'a`）。
- **Workspace lint** 定义在根 `Cargo.toml`，禁止 `missing_docs`、`clippy::unwrap_used` 以及落实本风格指南的 clippy lint，对 `clippy::expect_used` 给出警告；每个 crate 通过 `[lints] workspace = true` 启用。

## 文档注释

- `//!` 只出现在 crate 根或顶层公开模块，紧凑说明其定位。
- `///` 是公共 API 与 trait 上的紧凑契约。
- 返回 `Result` 的公共函数添加 `# Errors` 小节，列出自身产生的错误；只传递其他调用错误的函数用一行说明错误来源。可能 panic 的公共函数添加 `# Panics` 小节。
- `unsafe` 块只附带紧凑的 `// SAFETY: <前置条件证明>`。

## 布局

- `shared/` 中的 crate 为所有运行时构建，Android 通过 `lemma-mobile` 链接。`rpc/` 中每个 proto service 对应一个 crate，另有 `lemma-host` 把它们组装成一个路由。宿主目录下的 crate 只编入该宿主：`server/` 编入 `lemma-server`，`mobile/` 编入 Android 应用。
- crate 以单数形式命名为 `lemma-<concept>`；现存的复数名称逐步改正。
- `lemma-db-sqlite` 与 `lemma-db-pgsql` 各自拥有 `migrations/` 目录，内含可回滚的 `.up.sql` 与 `.down.sql` 成对文件；schema 变更在两者中各加一个 migration。

## 命令

```sh
just rust-lint-check    # 对全部 target 运行 clippy，拒绝警告；rust-lint 应用修复
just rust-fmt-check     # cargo fmt --check；rust-fmt 格式化
just rust-test          # cargo nextest run --workspace
just rust-cov           # llvm-cov 汇总；`just rust-cov --html --open` 打开报告
```
