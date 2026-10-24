# AGENTS.md — Desktop shell

English | [中文](AGENTS.zh.md)

These rules supplement the repo-wide [conventions](../AGENTS.md#conventions); the [TypeScript rules](../web/AGENTS.md#typescript) apply here.

## Engine and renderer

- **The renderer is the web client.** `npm run build` builds `web/` into `web-dist/`, then type-checks the desktop sources with `tsc`; change the UI in `web/`. `main.ts` serves `web-dist/` under `app://lemma/` and answers any path without a file extension with `index.html`, so the web client routes by path as it does in a browser. The window opens while the engine starts; `getSkipCredentials()` and `connectEngine()` wait for it, and a failed start replaces the page with the error. Git ignores `web-dist/`, `out/`, and `.vite/`.
- **`src/engine.ts` runs the engine in an Electron utility process.** `src/engine-host.ts` is that process's entry: it loads the `lemma-desktop` addon, opens the engine over Electron's `userData` directory, and reports `ready` with the default account or `failed` with the reason. Unpackaged builds load the addon from `target/<profile>/`, where `LEMMA_ENGINE_PROFILE` selects the profile (default `debug`); packaged builds load it from the resources directory.
- **The page talks to the engine over the engine port, a `MessagePort` that bypasses the main process.** On `connectEngine()`, `main.ts` opens a `MessageChannelMain` and hands one end to the engine process and the other to the page; `src/serve-engine-port.ts` serves requests on the engine end. When the engine exits, `main.ts` tells the page, whose pending and later requests fail.
- **`src/preload.ts` implements `window.lemmaDesktop`,** whose types live in [`@lemma/desktop-bridge`](../packages/AGENTS.md); `web/src/platform/` is its only consumer.
- **`src/gen/theme-colors.ts` carries the window colors:** the background, sidebar, and foreground of each theme, generated from [design/tokens.json](../design/README.md). Git ignores it; `npm run lint`, `test`, and `build` generate it first. `src/main.ts` reads the titlebar and window background colors from it.
- `LEMMA_DEBUG_PORT` enables Chromium remote debugging.

## Commands

```sh
just desktop-dev        # build the engine addon, then launch Electron
just desktop-lint-check # oxlint; desktop-lint applies fixes
just desktop-fmt-check  # prettier --check; desktop-fmt formats
just desktop-test       # vitest
just desktop-cov        # vitest coverage
just desktop-package    # release engine addon, renderer build, electron-forge package
```
