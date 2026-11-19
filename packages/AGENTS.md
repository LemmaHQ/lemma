# AGENTS.md — Shared packages

These rules supplement the repo-wide [conventions](../AGENTS.md#conventions); the [TypeScript rules](../web/AGENTS.md#typescript) apply here.

## Packages

- **Each directory is one private npm workspace package `@lemma/<directory>`**, consumed by `web/` and `desktop/`.
- **A package exports TypeScript source** through `package.json` `exports` with no build step; consumers compile it directly.
- **`ui/` holds shared shadcn controls, Lemma composites (Base UI, Tailwind v4), and the theme.** `src/styles/index.css` (`@lemma/ui/styles.css`) is the sole CSS entry; `src/index.ts` is the sole TS entry. Components hold no interface text; callers pass every string as a prop ([ui/README.md](ui/README.md)).
- **A component belongs in `ui/` only when feature code cannot hold it:** it needs an exemption from web lint rules (restyling a composed control, arbitrary values, explicit ARIA roles, dynamic classes), needs a direct import of a library beneath `@lemma/ui`, or is shared by multiple features. Move only the part that needs the exemption into `ui/` and inject domain elements through slots and accessible labels through props.
- **The [Modern Web Guidance](https://github.com/GoogleChrome/modern-web-guidance) CLI is an on-demand reference for `ui/`.** Use `npx -y modern-web-guidance@latest search "<query>"` and `retrieve "<id>"` when designing behavior, accessibility, or performance; the [styling rules](ui/README.md#styling) and existing components take precedence.
