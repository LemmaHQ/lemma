# AGENTS.md — Shared packages

English | [中文](AGENTS.zh.md)

These rules supplement the repo-wide [conventions](../AGENTS.md#conventions); the [TypeScript rules](../web/AGENTS.md#typescript) apply here.

## Packages

- **Each directory is one npm workspace package named `@lemma/<directory>`**, private, consumed by the web client. The application stays in `web/`.
- **A package exports its TypeScript source** through `exports` in its `package.json`, with no build step; consumers compile it as part of their own build.
- **`ui/` holds the shared shadcn controls, AI Elements chat components (Base UI, Tailwind v4), and their theme.** `src/styles/index.css`, exported as `@lemma/ui/styles.css`, is the package's only CSS entry: `tokens.css` maps the [design tokens](../design/README.md) into Tailwind and holds the tokens only the web uses, `motion.css` holds the shared motion utilities, including the view transition classes, and `components/` holds the styles that target one component's internal parts. The components hold no interface text; the consuming app passes every string as a prop. See the [component catalog](ui/README.md#component-catalog).

## Commands

```sh
just packages-type-check # tsc in every package
just packages-lint-check # oxlint; packages-lint applies fixes
just packages-fmt-check  # prettier --check; packages-fmt formats
just packages-test      # vitest in the packages that have tests
just packages-cov       # vitest coverage
```
