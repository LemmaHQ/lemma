import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tailwind from "eslint-plugin-tailwindcss";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
    globalIgnores(["dist", "coverage", "src/gen"]),
    {
        files: ["**/*.{ts,tsx}"],
        extends: [
            js.configs.recommended,
            tseslint.configs.recommended,
            reactHooks.configs.flat.recommended,
            reactRefresh.configs.vite,
            tailwind.configs.recommended,
        ],
        languageOptions: {
            parserOptions: {
                tsconfigRootDir: import.meta.dirname,
            },
            globals: globals.browser,
        },
        settings: {
            tailwindcss: {
                cssConfigPath: "src/index.css",
            },
        },
        rules: {
            "tailwindcss/no-custom-classname": [
                "warn",
                {
                    whitelist: ["glass"],
                },
            ],
            "@typescript-eslint/no-unused-vars": [
                "error",
                {
                    argsIgnorePattern: "^_",
                    varsIgnorePattern: "^_",
                    caughtErrorsIgnorePattern: "^_",
                },
            ],
        },
    },
    {
        files: ["src/components/ui/**"],
        rules: {
            "react-refresh/only-export-components": "off",
        },
    },
    {
        files: ["src/lib/utils.ts"],
        rules: {
            "tailwindcss/no-custom-classname": "off",
        },
    },
]);
