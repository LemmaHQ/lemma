# AGENTS.md — Desktop shell

These rules supplement the repo-wide [conventions](../AGENTS.md#conventions); the [TypeScript rules](../web/AGENTS.md#typescript) apply here.

## Engine and renderer

- **The renderer is the web client.** `npm run build` builds `web/` into `web-dist/` and type-checks desktop sources; edit UI in `web/`. `src/app-protocol.ts` serves `web-dist/` under `app://lemma/` and falls back extensionless paths to `index.html` for client-side routing. The window opens while the engine starts; `connectEngine()` waits for it, and a failed start replaces the page with the error.
- **`src/engine.ts` runs the engine in an Electron utility process.** `src/engine-host.ts` loads the `lemma-napi` addon, opens `Engine` over Electron's `userData` directory, and reports `ready` or `failed`. Unpackaged runs load the addon from `target/<profile>/` (`LEMMA_ENGINE_PROFILE`, default `debug`); packaged builds load it from the resources directory.
- **The page talks to the engine over a `MessagePort` bypassing the main process.** On `connectEngine()`, `main.ts` creates a `MessageChannelMain` between the utility process (`src/serve-engine-port.ts`) and the renderer. When the engine exits, `main.ts` notifies the page so pending and future requests fail.
- **`src/preload.ts` implements `window.lemmaDesktop`,** typed in `src/desktop-bridge.ts` and consumed only by `web/src/platform/`. `pickDirectory()` opens the native directory dialog through main and returns the absolute path or `null`.
- `LEMMA_DEBUG_PORT` enables Chromium remote debugging.
