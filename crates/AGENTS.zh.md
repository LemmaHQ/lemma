# AGENTS.md — Rust workspace

[English](AGENTS.md) | 中文

这些规则是对仓库级[约定](../AGENTS.zh.md#约定)的补充。

## 代码

- **表达式驱动：** 计算链条保持简短直接。
- **守卫分支用 `let-else`；** 复杂分支用穷尽的 `match`。
- **`use` 分组** 依次为标准库、外部 crate、workspace 内 crate；大括号内保持紧凑。
- **模块** 采用 `foo.rs` 与同名 `foo/` 目录并列。
- **数据以借用传递**，避免拷贝；生命周期只在推断不足时显式标注。
- **Workspace lint** 禁止 `missing_docs` 与 `clippy::unwrap_used`，对 `clippy::expect_used` 给出警告；每个 crate 通过 `[lints] workspace = true` 启用。

## 文档注释

- `//!` 只出现在 crate 根或顶层公开模块，紧凑说明其定位。
- `///` 是公共 API 与 trait 上的紧凑契约。
- `unsafe` 块只附带紧凑的 `// SAFETY: <前置条件证明>`。

## 布局

- `shared/` 中的 crate 为所有运行时构建，Android 通过 `lemma-mobile` 链接；`server/` 中的 crate 只编入 `lemma-server`；`server/rpc/` 中每个 proto service 对应一个 crate。
- crate 以单数形式命名为 `lemma-<concept>`；现存的复数名称逐步改正。
- `lemma-db-sqlite` 与 `lemma-db-pgsql` 各自拥有 `migrations/` 目录，内含可回滚的 `.up.sql` 与 `.down.sql` 成对文件；schema 变更在两者中各加一个 migration。

## 命令

```sh
just rust-lint          # 对全部 target 运行 clippy
just rust-test          # cargo test --workspace
just rust-fmt           # cargo fmt --all
just rust-cov           # llvm-cov 汇总；rust-cov-html 打开报告
```
