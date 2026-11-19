---
name: lemma-code-style
description: Use when writing or reviewing Rust, TypeScript, or Kotlin code in Lemma and a style question goes beyond the standing rules in AGENTS.md — naming, language-feature choice, doc-comment form — or when creating, splitting, naming, or placing source and test files.
---

# Lemma Code Style

Repo-wide rules live in the root [AGENTS.md](../../../AGENTS.md); per-language rules live in [crates/AGENTS.md](../../../crates/AGENTS.md) (Rust), [web/AGENTS.md](../../../web/AGENTS.md) (TypeScript, also for `desktop/`), and [mobile/AGENTS.md](../../../mobile/AGENTS.md) (Kotlin). Formatting is owned by `rustfmt`, `.prettierrc.json`, `.oxlintrc.json`, `.editorconfig`, and Spotless (`ktfmt`). This skill holds source-file organization rules, upstream style guides, and precedence.

## Precedence

1. Root `AGENTS.md` and the subtree `AGENTS.md` for the code being changed.
2. Repository formatter and linter configs (`Cargo.toml` workspace lints, `rustfmt`, `.prettierrc.json`, `.oxlintrc.json`, Spotless/Detekt in `build.gradle.kts`).
3. The upstream guide under `references/`.
4. Surrounding code.

Known overrides over the upstream guides:

- **Comments:** delivered code carries no comments by default; doc comments use only the per-language `AGENTS.md` forms. Upstream requirements for file overviews, implementation comments, KDoc on every public member, and `TODO` lines do not apply.
- **Rust docs & API rules:** `missing_docs` is denied workspace-wide (narrow internal items to `pub(crate)` instead of writing filler docs); all Rust crates follow the guide's library API rules; `#[non_exhaustive]` rules do not apply because Lemma crates have no external consumers.
- **TypeScript toolchain:** Prettier and oxlint replace the guide's Google-internal tooling.
- **Naming:** plain standard terms; Kotlin's private backing property `_prop` is the only allowed underscore prefix.

## Source files

Applies to tracked Rust, TypeScript, JavaScript, Kotlin, Python, and Protobuf files (including `packages/ui/src/components/primitives/` and `icons/`, which keep kebab-case filenames; `.agents/` and `packages/ui/src/hooks/` keep upstream layout). `just source-check` (`scripts/repo-check/verify-source-files.ts`) enforces the 300-line limit (tests and `*.config.*`/`*.gradle.kts`/`build.rs` exempt), filename conventions (`snake_case` for Rust/Python/Proto, `PascalCase.kt` for Kotlin, `PascalCase.tsx` for React components, `useThing.ts` for hooks, `kebab-case.ts` for other TS modules), the TypeScript re-export-only ban (except `package.json` `exports` entries and web feature `index.ts`), TypeScript sibling test placement (`<name>.test.ts(x)`), and Rust `#[cfg(test)] mod tests` at file end.

Rules `just source-check` cannot enforce mechanically:

- **Splitting:** split oversized files by responsibility named after content; never create `utils`, `helpers`, `misc`, or `common`.
- **One primary item per file:** Rust leaf files name their primary item and parent modules hold only `mod` declarations and re-exports; TypeScript files export one primary component, hook, store, or closely related type group (file-local types stay in the file); Kotlin files holding one top-level declaration match its name and shared data types get their own file.
- **Top-down order:** higher-level code comes first, private helpers below in order of first use (imports and constants at top; Python `if __name__ == "__main__":` and Rust `#[cfg(test)] mod tests` last).
- **Test placement:** Rust public-API integration tests live in `tests/`; Kotlin unit tests live in `commonTest`, `androidHostTest`, or the app unit test set named `<Subject>Test.kt`.

## Singular and plural

- **Singular:** names for one concept — crates, modules, packages, feature directories, proto files and messages, i18n namespaces — and noun modifiers: `lemma-provider`, `features/provider/`, `provider.proto`, `ProviderPanel`, `useProviderStore`.
- **Plural:** names for a collection — directories of entries of one kind, collection values/fields, `repeated` fields, multi-item functions, database tables, collection URL segments: `crates/`, `components/`, `messages: Vec<Message>`, `list_messages`, `messages` table, `/sessions/:id`.
- **Upstream form:** framework/tool-fixed names (`tests/`, `migrations/`, `.github/workflows/`, `res/values/`), vendor/RPC names (`AnthropicMessages`, `FetchModels`), and plural-only words (`settings`, `preferences`).

## References

Read only the section a question needs:

| Language   | Reference                                   | Sections                                                                                                                                                                          |
| ---------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rust       | [rustguide.md](references/rustguide.md)     | Code organization; Ownership and borrowing; Function inputs and outputs; Types; Traits; Naming; When and how to write documentation; Other Rust features; Implementation concerns |
| TypeScript | [tsguide.md](references/tsguide.md)         | Source file structure; Language features; Naming; Type system; Comments and documentation; Policies                                                                               |
| Kotlin     | [kotlinguide.md](references/kotlinguide.md) | Source files; Formatting; Naming; Documentation                                                                                                                                   |
