# AGENTS.md — Desktop shell

English | [中文](AGENTS.zh.md)

These rules supplement the repo-wide [conventions](../AGENTS.md#conventions); the [TypeScript rules](../web/AGENTS.md#typescript) apply here.

## Engine and renderer

- **The renderer is the web client.** `npm run build` builds `web/` with a relative base into `web-dist/`, then type-checks the desktop sources with `tsc`; change the UI in `web/`. Git ignores `web-dist/`, `out/`, and `.vite/`.
- **`src/engine.ts` runs `lemma-server` as a child process** with `LEMMA_LOCAL_MODE=1` and `LEMMA_DATA_DIR` set to Electron's `userData` directory. Unpackaged builds take the binary from `target/<profile>/`, where `LEMMA_ENGINE_PROFILE` selects the profile (default `debug`).
- **The engine announces readiness** with one stdout line, `LEMMA_READY <json>`, carrying the port and the default account credentials. `engine.ts` and `crates/server/lemma-server/src/local_mode.rs` own the two ends of this handshake and change together.
- **`src/preload.ts` exposes `__LEMMA_SERVER_URL__` and `lemmaDesktop`** to the renderer; `web/src/platform/` is their only consumer.
- **`src/gen/theme-colors.ts` carries the window colors:** the background, sidebar, and foreground of each theme, generated from [design/tokens.json](../design/README.md). Git ignores it; `npm run lint`, `test`, and `build` generate it first. `src/main.ts` reads the titlebar and window background colors from it.
- `LEMMA_DEBUG_PORT` enables Chromium remote debugging.

## Commands

```sh
just desktop-dev        # build lemma-server, then launch Electron
just desktop-lint-check # oxlint; desktop-lint applies fixes
just desktop-fmt-check  # prettier --check; desktop-fmt formats
just desktop-test       # vitest
just desktop-cov        # vitest coverage
just desktop-package    # renderer build, electron-forge package
```
