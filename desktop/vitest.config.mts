import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        environment: "node",
        include: ["src/**/*.test.ts"],
        coverage: {
            provider: "v8",
            reporter: ["text", "lcov"],
            include: ["src/**/*.ts"],
            exclude: [
                "src/gen/**",
                "src/main.ts",
                "src/main-window.ts",
                "src/preload.ts",
                "src/engine-host.ts",
                "src/titlebar.ts",
            ],
            thresholds: { 100: true },
        },
    },
});
