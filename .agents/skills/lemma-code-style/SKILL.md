---
name: lemma-code-style
description: Use when writing or reviewing Rust, TypeScript, or Kotlin code in Lemma and a style question goes beyond the standing rules in AGENTS.md — formatting, naming, language-feature choice, or doc-comment form.
---

# Lemma Code Style

Repo-wide rules live in the root [AGENTS.md](../../../AGENTS.md); per-language rules live in [crates/AGENTS.md](../../../crates/AGENTS.md) (Rust), [web/AGENTS.md](../../../web/AGENTS.md) (TypeScript, also for `desktop/`), and [mobile/AGENTS.md](../../../mobile/AGENTS.md) (Kotlin). This skill adds the upstream style guides behind those rules and the order in which they apply.

## Precedence

1. The root `AGENTS.md` and the subtree `AGENTS.md` of the code being changed.
2. Repository formatter and linter configuration: `rustfmt` defaults, `.prettierrc.json`, `web/.prettierrc.json`, and the ESLint configs.
3. The upstream guide under `references/`.
4. The style of the surrounding code.

A higher source wins every conflict. Known conflicts:

- **Comments.** Delivered code carries no comments by default; doc comments take only the forms the per-language `AGENTS.md` defines. Upstream requirements for file overviews, implementation comments, or KDoc on every public member do not apply.
- **Indentation.** Four spaces in every language; YAML and `.proto` use two.
- **TypeScript toolchain.** The Google-internal tooling in the TypeScript guide's "Toolchain requirements" section does not apply; Prettier and ESLint as configured in the repository are the formatter and linter.
- **Naming.** Identifiers use plain, standard terms; the Kotlin private backing property `_prop` is the one underscore prefix allowed.

## References

Read only the section the question needs.

| Language | Reference | Sections |
| --- | --- | --- |
| Rust | [rustguide.md](references/rustguide.md) | Formatting conventions; Items; Statements; Expressions; Types and Bounds; Other style advice; `Cargo.toml` conventions |
| TypeScript | [tsguide.md](references/tsguide.md) | Source file structure; Language features; Naming; Type system; Comments and documentation; Policies |
| Kotlin | [kotlinguide.md](references/kotlinguide.md) | Source files; Formatting; Naming; Documentation |

Rust formatting is mechanical: run `cargo fmt` instead of applying the guide by hand, and consult the guide for questions `rustfmt` leaves open.
