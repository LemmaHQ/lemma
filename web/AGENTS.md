# AGENTS.md — Web client

These rules supplement the repo-wide [conventions](../AGENTS.md#conventions). The TypeScript rules also govern [desktop/](../desktop/AGENTS.md) and [packages/](../packages/AGENTS.md).

## TypeScript

- **Modules use ES named exports;** types move through `import type` and `export type`.
- **Unknown input is typed `unknown`** and narrowed to a concrete type.
- **JSDoc** is a compact contract on exported public interfaces, without JSDoc type annotations. A call passing several arguments of one type may label them inline: `/* paramName= */`.
- **Compiler options** shared across TypeScript projects live in the root `tsconfig.base.json`; each project extends it with only runtime-specific settings. Scripts under `scripts/` run directly on Node.
- **oxlint** (type-aware) uses the root `.oxlintrc.json` extended by per-project `.oxlintrc.json`. Any suppression names one rule and a reason: `// oxlint-disable-next-line <rule> -- <reason>`.

## Layout

- Dependencies point one way: `src/platform/` → `src/rpc/` → `src/store/` → `src/features/` → `src/app/`. `src/i18n/` holds generated locales and `error-text.ts`.
- `src/platform/` exports the `platform` adapter for browser or desktop; code outside it reaches desktop capabilities only through that adapter.
- `src/features/<domain>/` keeps one layout: `index.ts` exports public components and hooks, `store.ts` is the sole RPC caller and proto-to-view mapper, logic modules and tests sit beside it, and components live in `components/`. Outside code imports features only via `@/features/<domain>`. Features take route paths as props instead of naming routes.
- `src/app/` owns the router, layout shells, and pages assembling feature components.
- oxlint enforces feature boundaries, `store.ts`-only RPC access (other than `src/rpc/errors.ts`), and `@lemma/ui`-only imports of underlying UI libraries.
- Shared controls, icons, `AnimateIcon`, `cn`, and `toast` come from `@lemma/ui` ([packages/ui/README.md](../packages/ui/README.md)). User-facing text goes through i18next from [i18n/](../i18n/README.md).

## Styling

- **Feature code uses only semantic theme utilities** — no hex colors, arbitrary values, or `dark:` variants; oxlint and `@shadcn/lint` enforce the rules in `.oxlintrc.json` ([packages/ui/README.md](../packages/ui/README.md#styling)).
- **Reuse `@lemma/ui` controls** before writing new ones (`packages/ui/src/index.ts`); promote shared visual differences to a variant instead of restyling a copy.
- **Settings pages** compose `SettingsPage`, `SettingsSection`, `SettingsSectionCompact`, `SettingsField`, and `SettingsRow` without adding outer layout ([settings rules](../packages/ui/README.md#settings-pages)).

## Boot sync and generated files

`src/gen/`, `src/i18n/locales/`, and `@lemma/ui`'s generated tokens are Git-ignored and regenerated automatically by npm scripts; edit `proto/`, `design/tokens.json`, or `i18n/` instead.

`vite.config.ts` injects the pre-first-paint theme script (using `THEME_STORAGE_KEY` and `DEFAULT_THEME` from `src/features/preferences/theme.ts`) and theme colors (from `design/tokens.json`) into `index.html`. The boot markup in `index.html` mirrors `src/app/shell/SplashScreen.tsx` with inline styles and must change together with it.
