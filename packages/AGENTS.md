# AGENTS.md — Shared packages

These rules supplement the repo-wide [conventions](../AGENTS.md#conventions); the [TypeScript rules](../web/AGENTS.md#typescript) apply here.

## Packages

- **Each directory is one npm workspace package named `@lemma/<directory>`**, private, consumed by the web and desktop clients. The applications stay in `web/` and `desktop/`.
- **A package exports its TypeScript source** through `exports` in its `package.json`, with no build step; consumers compile it as part of their own build.
- **`ui/` holds the shared shadcn controls, the components Lemma composes from them (Base UI, Tailwind v4), and their theme.** `src/styles/index.css`, exported as `@lemma/ui/styles.css`, is the package's only CSS entry: `tokens.css` maps the [design tokens](../design/README.md) into Tailwind and holds the tokens only the web uses, `motion.css` holds the shared motion utilities, including the view transition classes, and `components/` holds the styles that target one component's internal parts. The components hold no interface text; the consuming app passes every string as a prop. See the [component catalog](ui/README.md#component-catalog).
- **A component belongs in `ui/` only when feature code cannot hold it:** it needs an exemption from the web lint rules (restyling a composed control, an arbitrary value, an ARIA role in place of a native element, a dynamic class) or a direct import of a library beneath `@lemma/ui`, or several features share it. Only the part that needs the exemption moves into `ui/` and the rest stays in the feature; a component that meets neither condition lives in the feature that uses it or in `web/src/app/`. A shared component takes semantic slots and the accessible labels it needs, never a feature's text table or selectors; the caller injects domain elements, such as the mark that ends a reply, through a slot.
- **The [Modern Web Guidance](https://github.com/GoogleChrome/modern-web-guidance) CLI is an on-demand reference for `ui/`.** Before writing a shared component's behavior, accessibility, or performance logic, `npx -y modern-web-guidance@latest search "<query>"` finds a guide and `retrieve "<id>"` prints it; the [styling rules](ui/README.md#styling) and existing components take precedence over a guide.

## Commands

```sh
just packages-type-check # tsc in every package
just packages-lint-check # oxlint; packages-lint applies fixes
just packages-fmt-check  # prettier --check; packages-fmt formats
just packages-test      # vitest in the packages that have tests
just packages-cov       # vitest coverage
```
