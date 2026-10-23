---
name: lemma-code-style
description: Use when writing or reviewing Rust, TypeScript, or Kotlin code in Lemma and a style question goes beyond the standing rules in AGENTS.md — formatting, naming, language-feature choice, or doc-comment form.
---

# Lemma Code Style

Repo-wide rules live in the root [AGENTS.md](../../../AGENTS.md); per-language rules live in [crates/AGENTS.md](../../../crates/AGENTS.md) (Rust), [web/AGENTS.md](../../../web/AGENTS.md) (TypeScript, also for `desktop/`), and [mobile/AGENTS.md](../../../mobile/AGENTS.md) (Kotlin). This skill adds the upstream style guides behind those rules and the order in which they apply.

## Precedence

1. The root `AGENTS.md` and the subtree `AGENTS.md` of the code being changed.
2. Repository formatter and linter configuration: `rustfmt` defaults and the workspace lints in the root `Cargo.toml`, `.prettierrc.json`, the `.oxlintrc.json` files, and ktfmt in kotlinlang style through Spotless in the root `build.gradle.kts`.
3. The upstream guide under `references/`.
4. The style of the surrounding code.

A higher source wins every conflict. Known conflicts:

- **Comments.** Delivered code carries no comments by default; doc comments take only the forms the per-language `AGENTS.md` defines. Upstream requirements for file overviews, implementation comments, or KDoc on every public member do not apply, and neither does the Rust guide's encouragement of `//` implementation comments and TODO lines.
- **Rust documentation.** `missing_docs` is denied, so every public item carries a doc comment, including the trivial ones the Rust guide lets you omit.
- **Rust API design.** All Rust code counts as library code, so the Rust guide's API design rules are binding everywhere; its relaxations for application code do not apply.
- **`#[non_exhaustive]`.** Lemma crates have no consumers outside the workspace, so the Rust guide's `#[non_exhaustive]` rules do not apply, and every `match` stays exhaustive.
- **Indentation.** Four spaces in every language; YAML and `.proto` use two.
- **TypeScript toolchain.** The Google-internal tooling in the TypeScript guide's "Toolchain requirements" section does not apply; Prettier and oxlint as configured in the repository are the formatter and linter.
- **Naming.** Identifiers use plain, standard terms; the Kotlin private backing property `_prop` is the one underscore prefix allowed.

## References

Read only the section the question needs.

| Language   | Reference                                   | Sections                                                                                                                                                                          |
| ---------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rust       | [rustguide.md](references/rustguide.md)     | Code organization; Ownership and borrowing; Function inputs and outputs; Types; Traits; Naming; When and how to write documentation; Other Rust features; Implementation concerns |
| TypeScript | [tsguide.md](references/tsguide.md)         | Source file structure; Language features; Naming; Type system; Comments and documentation; Policies                                                                               |
| Kotlin     | [kotlinguide.md](references/kotlinguide.md) | Source files; Formatting; Naming; Documentation                                                                                                                                   |

Rust and Kotlin formatting is mechanical: run `just rust-fmt` or `just mobile-fmt` instead of applying the guide by hand, and consult the guide for questions the formatter leaves open. The Rust guide builds on the [official Rust Style Guide](https://doc.rust-lang.org/nightly/style-guide/), which `rustfmt` implements and which also covers `Cargo.toml` layout.
