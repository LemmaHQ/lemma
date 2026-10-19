# AGENTS.md — Web client

English | [中文](AGENTS.zh.md)

These rules supplement the repo-wide [conventions](../AGENTS.md#conventions). The TypeScript rules also govern [desktop/](../desktop/AGENTS.md).

## TypeScript

- **`const` by default;** `let` only for a variable that is reassigned. One variable per declaration.
- **Statements end with an explicit semicolon.**
- **Equality uses `===` and `!==`.**
- **Every control-flow body (`if`, `for`, `while`) takes braces.**
- **Modules use ES named exports;** types move through `import type` and `export type`.
- **Unknown input is typed `unknown`** and narrowed to a concrete type.
- **JSDoc** is a compact contract on exported public interfaces, without JSDoc type annotations. A call passing several arguments of one type may label them inline: `/* paramName= */`.
- **Compiler options shared by every TypeScript project live in the root `tsconfig.base.json`;** a project's `tsconfig` extends it and adds only what its runtime needs: DOM, JSX, module resolution, `types`, path aliases. Repository scripts in `scripts/` and `design/` are `.ts` files that Node runs directly, type-checked by `just scripts-type-check`.
- **oxlint is the linter, with type-aware rules.** The root `.oxlintrc.json` holds the rules shared by every TypeScript project, and `just scripts-lint-check` applies it to `scripts/` and `design/`. `web/.oxlintrc.json` and `desktop/.oxlintrc.json` extend it with their runtime's plugins. A suppression names one rule and a reason: `// oxlint-disable-next-line <rule> -- <reason>`.

## Layout

- `src/app/` holds routing, pages, and the application shell; `src/features/<domain>/` holds each domain's components, store, and hooks.
- `src/data/rpc/` creates the ConnectRPC clients and maps errors; `src/data/cache/` is the IndexedDB cache.
- `src/platform/` selects the browser or desktop adapter; code outside it reaches desktop capabilities only through that adapter.
- `src/components/ui/` holds shadcn components, added through the shadcn CLI.
- User-facing text goes through i18next; `src/i18n/locales/en.json` and `zh.json` carry the same keys, which `src/i18n/locales.test.ts` checks.

## Styling

- **Styling follows [web-styling.md](../docs/web-styling.md)** and radii follow [ui-radius.md](../docs/ui-radius.md). Feature code uses only the semantic utilities of the shadcn theme in `src/index.css`, with no hex color, no arbitrary value, and no `dark:` variant.
- **Tooling enforces the class rules:** Prettier sorts Tailwind classes, and oxlint-tailwindcss rejects unknown, conflicting, deprecated, and hard-coded color classes, plus arbitrary values and `dark:` variants in `src/app/` and `src/features/`.
- **Controls reuse `src/components/ui/`;** check its [component catalog](src/components/ui/README.md#component-catalog) first. A visual difference that several features need becomes a variant of the shared component, not a restyled copy.

## Generated files

`src/gen/` comes from `proto/` through the `gen:proto` script, which `dev`, `build`, `lint`, and `test` run first. Git ignores it; edit `proto/`.

## Commands

```sh
just web-dev            # Vite dev server
just web-test           # vitest
just web-lint-check     # oxlint; web-lint applies fixes
just web-fmt-check      # prettier --check; web-fmt formats
just web-cov            # vitest coverage
```
