# AGENTS.md — Web client

English | [中文](AGENTS.zh.md)

These rules supplement the repo-wide [conventions](../AGENTS.md#conventions). The TypeScript rules also govern [desktop/](../desktop/AGENTS.md) and [packages/](../packages/AGENTS.md).

## TypeScript

- **`const` by default;** `let` only for a variable that is reassigned. One variable per declaration.
- **Statements end with an explicit semicolon.**
- **Equality uses `===` and `!==`.**
- **Every control-flow body (`if`, `for`, `while`) takes braces.**
- **Modules use ES named exports;** types move through `import type` and `export type`.
- **Unknown input is typed `unknown`** and narrowed to a concrete type.
- **JSDoc** is a compact contract on exported public interfaces, without JSDoc type annotations. A call passing several arguments of one type may label them inline: `/* paramName= */`.
- **Compiler options shared by every TypeScript project live in the root `tsconfig.base.json`;** a project's `tsconfig` extends it and adds only what its runtime needs: DOM, JSX, module resolution, `types`, path aliases. Repository scripts in `scripts/` and `design/` are `.ts` files that Node runs directly, type-checked by `just scripts-type-check`.
- **oxlint is the linter, with type-aware rules.** The root `.oxlintrc.json` holds the rules shared by every TypeScript project, and `just scripts-lint-check` applies it to `scripts/` and `design/`. `web/.oxlintrc.json`, `desktop/.oxlintrc.json`, and each package's `.oxlintrc.json` extend it, adding their runtime's plugins. A suppression names one rule and a reason: `// oxlint-disable-next-line <rule> -- <reason>`.

## Layout

- Dependencies point one way: `src/platform/` → `src/rpc/` → `src/features/` → `src/app/`. `src/i18n/` holds the locale files and `error-text.ts`, which turns a failed request into localized text.
- `src/platform/` exports the `platform` adapter for the browser or the desktop engine; code outside it reaches desktop capabilities only through that adapter.
- `src/rpc/` holds the transport, the ConnectRPC clients, the stored credentials, and `errors.ts`, which reads the `ErrorReason` of a failure.
- `src/features/<domain>/` follows one layout: `index.ts` exports the feature's public components and hooks, `store.ts` is the only module that calls RPC and turns proto messages into view types, logic modules and their tests sit beside it, and every component lives in `components/`. Code outside a feature imports it through `@/features/<domain>`.
- `src/app/` holds the route table in `router.tsx`, the paths in `route-paths.ts`, and one directory per layout route: `auth/`, `session/`, and `settings/`, each with the pages that only arrange feature components. `shell/` holds `SignedInLayout`, which guards the signed-in routes and owns the sidebar state, and `ShellFrame`, which both signed-in layouts fill with their sidebar, toolbar actions, and title. Features take paths as props instead of naming routes. `account-data.ts` empties the feature stores that hold account data whenever the signed-in user changes; a store added to that set is cleared there.
- oxlint enforces the boundaries: in `src/app/` and `src/features/`, an import past a feature's `index.ts`, an import of `src/rpc/` other than `errors.ts` outside a `store.ts`, and any import of the libraries beneath `@lemma/ui` fail `just web-lint-check`.
- Shared shadcn controls and AI Elements chat components live in `@lemma/ui`; feature code imports them, the icons, and `AnimateIcon`, `cn`, and `toast` from `@lemma/ui` alone ([component README](../packages/ui/README.md)).
- User-facing text goes through i18next, including the labels `@lemma/ui` components take as props; `src/i18n/locales/en.json` and `zh.json` carry the same keys, which `src/i18n/locales.test.ts` checks.

## Styling

- **Feature code uses only the semantic utilities of the shadcn theme,** with no hex color, no arbitrary value, and no `dark:` variant; the theme colors come from [design/tokens.json](../design/README.md).
- **Tooling enforces the class rules:** Prettier sorts Tailwind classes; oxlint-tailwindcss rejects conflicting, contradicting, duplicate, and deprecated classes, and across `src/` also `dark:` variants, Tailwind's numeric durations, default easings, shadow scale, and black and white colors; `@shadcn/lint` rejects unknown classes, raw colors, arbitrary values, inline styles, and dynamic class strings, and restyling a shadcn component's color, spacing, typography, or shape. Layout classes such as width, flex, and margin stay allowed on components.
- **Controls reuse `@lemma/ui`;** check the [component catalog](../packages/ui/README.md#component-catalog) first. A visual difference that several features need becomes a variant of the shared component, not a restyled copy.

## Generated files

`src/gen/` comes from `proto/` through the `gen:proto` script, and the `gen:tokens` script writes the theme variables of [design/tokens.json](../design/README.md) into `@lemma/ui`, which `src/index.css` loads through `@lemma/ui/styles.css`. The `gen` script runs both, and `dev`, `build`, `lint`, and `test` run it first; `format` runs `gen:tokens` first. Git ignores both outputs; edit `proto/` or `design/tokens.json`.

`vite.config.ts` injects into `index.html` the inline script that applies the stored theme before the first paint, built from `THEME_STORAGE_KEY` and `DEFAULT_THEME` in `src/features/preferences/theme.ts`, the constants `ThemeProvider` also reads; change the theme storage there.

## Commands

```sh
just web-dev            # Vite dev server
just web-test           # vitest
just web-lint-check     # oxlint; web-lint applies fixes
just web-fmt-check      # prettier --check; web-fmt formats
just web-cov            # vitest coverage
```
