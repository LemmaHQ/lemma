import { codecovVitePlugin } from "@codecov/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

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
    } catch {}
})();`;

function themeBootScript(): Plugin {
    return {
        name: "lemma-theme-boot-script",
        transformIndexHtml: () => [
            { tag: "script", children: THEME_BOOT_SCRIPT, injectTo: "head" },
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
