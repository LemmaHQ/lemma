import { codecovVitePlugin } from "@codecov/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

import { readThemes } from "../scripts/design-token/read-theme.ts";
import { readTokenFile } from "../scripts/design-token/token-tree.ts";
import {
    DEFAULT_THEME,
    THEME_STORAGE_KEY,
} from "./src/features/preferences/theme.ts";

const codecovToken = process.env.CODECOV_TOKEN;

const THEME_BOOT_SCRIPT = `(() => {
    try {
        const theme = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)}) || ${JSON.stringify(DEFAULT_THEME)};
        const dark = theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
        document.documentElement.classList.toggle("dark", dark);
        document.documentElement.style.colorScheme = dark ? "dark" : "light";
    } catch {}
})();`;
const TOKENS_PATH = fileURLToPath(
    new URL("../design/tokens.json", import.meta.url),
);
const { themes } = readThemes(readTokenFile(TOKENS_PATH), TOKENS_PATH);

const BOOT_STYLE = `body { margin: 0; }
html { background: ${themes.light.get("background")}; color: ${themes.light.get("foreground")}; }
html.dark { background: ${themes.dark.get("background")}; color: ${themes.dark.get("foreground")}; }`;

/** Applies the stored theme and its page colors before the first paint, so the boot markup in `index.html` matches the app before any stylesheet loads. */
function themeBootScript(): Plugin {
    return {
        name: "lemma-theme-boot-script",
        transformIndexHtml: () => [
            { tag: "script", children: THEME_BOOT_SCRIPT, injectTo: "head" },
            { tag: "style", children: BOOT_STYLE, injectTo: "head" },
        ],
    };
}

export default defineConfig({
    plugins: [
        react(),
        tailwindcss(),
        themeBootScript(),
        // Uploads bundle stats to Codecov during `vite build` when provided
        // with an upload token.
        codecovVitePlugin({
            enableBundleAnalysis: codecovToken !== undefined,
            bundleName: "lemma-web",
            ...(codecovToken === undefined
                ? {}
                : { uploadToken: codecovToken }),
        }),
    ],
    resolve: {
        tsconfigPaths: true,
    },
    server: {
        proxy: {
            "/lemma.v1.": "http://127.0.0.1:1025",
        },
    },
    test: {
        environment: "happy-dom",
        isolate: true,
        include: ["src/**/*.test.{ts,tsx}"],
        setupFiles: ["./vitest.setup.ts"],
        coverage: {
            provider: "v8",
            reporter: ["text", "lcov"],
            include: ["src/**/*.{ts,tsx}"],
            exclude: ["src/gen/**", "src/i18n/locales/**", "src/main.tsx"],
            thresholds: { 100: true },
        },
    },
});
