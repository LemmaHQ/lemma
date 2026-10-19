import { codecovVitePlugin } from "@codecov/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vitest/config";

const codecovToken = process.env.CODECOV_TOKEN;

export default defineConfig({
    plugins: [
        react(),
        tailwindcss(),
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
        alias: { "@": path.resolve(import.meta.dirname, "src") },
    },
    server: {
        proxy: {
            "/lemma.v1.": "http://127.0.0.1:1025",
        },
    },
    test: {
        environment: "node",
        include: ["src/**/*.test.ts"],
        coverage: {
            provider: "v8",
            reporter: ["text", "lcov"],
            // Focus coverage on handwritten business logic and components.
            exclude: ["src/gen/**", "src/i18n/locales/**"],
        },
    },
});
