# AGENTS.md — Rust workspace

English | [中文](AGENTS.zh.md)

These rules supplement the repo-wide [conventions](../AGENTS.md#conventions).

## Code

- **Expression-driven flow:** keep computation chains short and direct.
- **Guards use `let-else`;** complex branching uses an exhaustive `match`.
- **`use` groups** run standard library, external crates, then workspace crates; braces stay compact.
- **Modules** use `foo.rs` beside a `foo/` directory.
- **Pass data by borrow** and avoid copies; write lifetimes only where inference needs them.
- **Workspace lints** deny `missing_docs` and `clippy::unwrap_used` and warn on `clippy::expect_used`; every crate opts in with `[lints] workspace = true`.

## Doc comments

- `//!` appears only at a crate root or a top-level public module, as a compact statement of its role.
- `///` is a compact contract on public APIs and traits.
- An `unsafe` block carries only a compact `// SAFETY: <proof of the preconditions>`.

## Layout

- `shared/` crates build for every runtime, including Android through `lemma-mobile`; `server/` crates build only into `lemma-server`; `server/rpc/` holds one crate per proto service.
- Crates are named `lemma-<concept>` in the singular; existing plural names are renamed over time.
- `lemma-db-sqlite` and `lemma-db-pgsql` each own a `migrations/` directory of reversible `.up.sql` and `.down.sql` pairs; a schema change adds a migration to both.

## Commands

```sh
just rust-lint-check    # clippy over all targets, warnings denied; rust-lint applies fixes
just rust-fmt-check     # cargo fmt --check; rust-fmt formats
just rust-test          # cargo nextest run --workspace
just rust-cov           # llvm-cov summary; `just rust-cov --html --open` opens the report
```
