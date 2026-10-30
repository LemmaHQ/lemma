---
name: lemma-code-style
description: Use when writing or reviewing Rust, TypeScript, or Kotlin code in Lemma and a style question goes beyond the standing rules in AGENTS.md — formatting, naming, language-feature choice, doc-comment form — or when creating, splitting, naming, or placing source and test files.
---

# Lemma Code Style

Repo-wide rules live in the root [AGENTS.md](../../../AGENTS.md); per-language rules live in [crates/AGENTS.md](../../../crates/AGENTS.md) (Rust), [web/AGENTS.md](../../../web/AGENTS.md) (TypeScript, also for `desktop/`), and [mobile/AGENTS.md](../../../mobile/AGENTS.md) (Kotlin). This skill holds the source file rules, the upstream style guides behind the per-language rules, and the order in which they apply.

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

## Source files

These rules cover every tracked Rust, TypeScript, JavaScript, Kotlin, Python, and Protobuf file. Files under `.agents/` and the shadcn-owned directories (`packages/ui/src/components/`, `packages/ui/src/hooks/`) keep their upstream layout. `just source-check` (`scripts/verify-source-files.ts`) enforces the length limit, file names, the re-export ban, TypeScript test placement, and the Rust test module position.

### Length

- A source file stays within **300 lines**, counting every physical line, blank lines and comments included. A Rust `#[cfg(test)] mod tests` counts toward its file.
- Tests (Rust `tests/` directories, `*.test.ts`, Kotlin test source sets) and build configuration (`*.gradle.kts`, `*.config.ts`, `*.config.mts`, `build.rs`) have no limit.
- Split an oversized file by responsibility into files named after their content; `utils`, `helpers`, `misc`, and `common` are not names.

### One primary item per file

- **Rust:** a leaf file is named after its primary item; a module with submodules holds only `mod` declarations and re-exports ([crates/AGENTS.md](../../../crates/AGENTS.md#code)).
- **TypeScript:** a file exports one primary component, hook, store, or closely related type group. Types used by one module stay in it.
- **Kotlin:** a file holding one top-level class, object, interface, or Composable is named after it; a file of several top-level declarations takes a PascalCase name that describes them. A data type used by several files gets its own file.
- **No re-export-only modules** in TypeScript: import from the defining module. A package entry named in `package.json` `exports` or a web feature's public `index.ts` is the exception.

### Order inside a file

Higher-level code comes first, details below it.

- **Rust:** `//!` where allowed, `mod` declarations, `use` groups, constants and statics, the primary item and its `impl` blocks, other public items, private items in order of first use, `#[cfg(test)] mod tests` last.
- **TypeScript:** imports (packages, then `@/` aliases, then relative paths), module-level constants and types, the primary export, then the private functions and components it uses in order of first use.
- **Kotlin:** `package`, imports, private top-level constants, the primary declaration, then private helpers in order of first use.
- **Python:** imports, constants, public functions, private helpers, the `if __name__ == "__main__":` block last.

### File names

| Language                 | Name                                                                             |
| ------------------------ | -------------------------------------------------------------------------------- |
| Rust, Python, Protobuf   | `snake_case`; a Cargo binary under `src/bin/` takes the binary's kebab-case name |
| Kotlin                   | `PascalCase.kt`                                                                  |
| TypeScript component     | `PascalCase.tsx`, exporting the component of that name                           |
| TypeScript hook          | `useThing.ts`                                                                    |
| Other TypeScript modules | `kebab-case.ts`                                                                  |

### Test placement

- **Rust:** unit tests live in one `#[cfg(test)] mod tests`, the last item of the file whose code they test; tests that go through a crate's public API live in its `tests/` directory.
- **TypeScript:** `<name>.test.ts` sits beside `<name>.ts`, `<name>.tsx`, or the `<name>/` directory it tests.
- **Kotlin:** tests live in a test source set (`commonTest`, `androidHostTest`, or the app module's unit test set) under the package of the code they test, named `<Subject>Test.kt`.

## References

Read only the section the question needs.

| Language   | Reference                                   | Sections                                                                                                                                                                          |
| ---------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rust       | [rustguide.md](references/rustguide.md)     | Code organization; Ownership and borrowing; Function inputs and outputs; Types; Traits; Naming; When and how to write documentation; Other Rust features; Implementation concerns |
| TypeScript | [tsguide.md](references/tsguide.md)         | Source file structure; Language features; Naming; Type system; Comments and documentation; Policies                                                                               |
| Kotlin     | [kotlinguide.md](references/kotlinguide.md) | Source files; Formatting; Naming; Documentation                                                                                                                                   |

Rust and Kotlin formatting is mechanical: run `just rust-fmt` or `just mobile-fmt` instead of applying the guide by hand, and consult the guide for questions the formatter leaves open. The Rust guide builds on the [official Rust Style Guide](https://doc.rust-lang.org/nightly/style-guide/), which `rustfmt` implements and which also covers `Cargo.toml` layout.
