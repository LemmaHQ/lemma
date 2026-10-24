# AGENTS.md — Shared packages

English | [中文](AGENTS.zh.md)

These rules supplement the repo-wide [conventions](../AGENTS.md#conventions); the [TypeScript rules](../web/AGENTS.md#typescript) apply here.

## Packages

- **Each directory is one npm workspace package named `@lemma/<directory>`**, private, consumed by the web and desktop clients. The applications stay in `web/` and `desktop/`.
- **A package exports its TypeScript source** through `exports` in its `package.json`, with no build step; consumers compile it as part of their own build.
- **`desktop-bridge/` holds the types of the API the desktop preload exposes as `window.lemmaDesktop`.** `desktop/src/preload.ts` implements them, `desktop/src/main.ts` answers their IPC calls, and `web/src/platform/` consumes them; a change to the bridge updates all three in the same change.

## Commands

```sh
just packages-type-check # tsc in every package
just packages-lint-check # oxlint; packages-lint applies fixes
just packages-fmt-check  # prettier --check; packages-fmt formats
```
