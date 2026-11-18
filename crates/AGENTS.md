# AGENTS.md — Rust workspace

English | [中文](AGENTS.zh.md)

These rules supplement the repo-wide [conventions](../AGENTS.md#conventions) and follow the Google Rust Style Guide in [lemma-code-style](../.agents/skills/lemma-code-style/SKILL.md), which treats all Rust code as library code.

## Code

- **Expression-driven flow:** keep computation chains short and direct; a chain that branches or mutates outside state becomes a `for` loop.
- **Guards use `let-else`;** complex branching uses an exhaustive `match`.
- **Imports:** `use` groups run standard library, external crates, then workspace crates, and each `use` imports from one module. Types and traits are imported and named unqualified; free functions are called through their module (`persist::settle()`); a trait used in one function is imported inside it; the only glob import is `use super::*` in a test module.
- **Modules** use `foo.rs` beside a `foo/` directory. A module with submodules, crate roots included, holds only `mod` declarations, re-exports, and a binary's `fn main`; a leaf file is named after its primary item (`InProcessEngine` lives in `in_process_engine.rs`). A type's methods split across files take one file per resource (`session_service/messages.rs`).
- **Ownership:** pass data by borrow (`&str`, `&[T]`, `Option<&T>`) and avoid copies. `Arc` holds only values that spawned tasks or request handlers share. Parameters are generic instead of `dyn Trait` and take concrete types instead of `impl Into<T>`; `dyn` remains only for heterogeneous collections such as the tool registry and at the UniFFI boundary.
- **Lifetimes** appear only where inference needs them and carry descriptive names (`'conn`, not `'a`).
- **Workspace lints** live in the root `Cargo.toml`; every crate opts in with `[lints] workspace = true`.

## Doc comments

- `//!` appears only at a crate root or a top-level public module, as a compact statement of its role.
- `///` is a compact contract on public APIs and traits.
- A public function returning `Result` adds an `# Errors` section that lists the errors it raises itself; a function that only propagates another call's error names that source in one line. A public function that can panic adds a `# Panics` section.
- An `unsafe` block carries only a compact `// SAFETY: <proof of the preconditions>`.

## Layout

- `shared/` crates build for every runtime, Android included; crates under a host directory (`daemon/`, `desktop/`, `mobile/`) build only into that host.
- Crates are named `lemma-<concept>`.
- `lemma-db` owns the SQLite schema migrations in `crates/shared/lemma-db/migrations/` and applies them when opening a file-backed or in-memory pool (`lemma_db::open`, `lemma_db::in_memory`); `lemma-session` and `lemma-provider` run parameterized `sqlx` queries over `SqlitePool`.

## Commands

```sh
just rust-lint-check    # clippy over all targets, warnings denied; rust-lint applies fixes
just rust-fmt-check     # cargo fmt --check; rust-fmt formats
just rust-test          # cargo nextest run --workspace
just rust-cov           # llvm-cov summary, fails on any uncovered line or function
```
