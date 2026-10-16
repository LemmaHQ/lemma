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

## Layout

- `src/app/` holds routing, pages, and the application shell; `src/features/<domain>/` holds each domain's components, store, and hooks.
- `src/data/rpc/` creates the ConnectRPC clients and maps errors; `src/data/cache/` is the IndexedDB cache.
- `src/platform/` selects the browser or desktop adapter; code outside it reaches desktop capabilities only through that adapter.
- `src/components/ui/` holds shadcn components, added through the shadcn CLI.
- User-facing text goes through i18next; `src/i18n/locales/en.json` and `zh.json` carry the same keys.

## Styling

- **Feature code takes design values only from tokens.** `src/app/` and `src/features/` use the Tailwind utilities generated from [DESIGN.md](../DESIGN.md) (`bg-card`, `rounded-md`) and write no hex color and no `dark:` variant; light and dark values differ only in `tokens.css`. An off-scale radius is limited to drawing details such as the streaming caret.
- **Controls reuse `src/components/ui/`.** A visual difference that several features need becomes a variant of the shared component, not a restyled copy.
- **Radii follow the role and nesting rules** in [DESIGN.md](../DESIGN.md#shapes).

## Generated files

`src/gen/` comes from `just proto-gen`; `src/styles/tokens.css` comes from [DESIGN.md](../DESIGN.md) through `scripts/gen-tokens.mjs`, which `dev` and `build` run first. Git ignores both; edit their sources.

## Commands

```sh
just web-dev            # Vite dev server
just web-test           # vitest
just web-lint           # eslint
just web-fmt            # prettier --write
just web-cov            # vitest coverage
```
