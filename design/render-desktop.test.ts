import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { isRecord } from "../i18n/type-guards.ts";
import { readRadii, readThemes, readTokenFile } from "./read-tokens.ts";
import { generateDesktopTheme } from "./render-desktop.ts";

interface ThemeConfigFixture {
    mode: string;
    "font.size": number;
    "font.family"?: string;
    radius: number;
    "radius.lg": number;
    colors: Record<string, string>;
}

function configs(): ThemeConfigFixture[] {
    const tokensPath = path.join(import.meta.dirname, "tokens.json");
    const tokens = readTokenFile(tokensPath);
    const { themes } = readThemes(tokens, tokensPath);
    const output: unknown = JSON.parse(
        generateDesktopTheme(themes, readRadii(tokens, tokensPath)),
    );
    if (
        !isRecord(output) ||
        !Array.isArray(output.themes) ||
        !output.themes.every(isThemeConfig)
    ) {
        throw new TypeError("generated desktop theme has an invalid shape");
    }
    return output.themes;
}

function isThemeConfig(value: unknown): value is ThemeConfigFixture {
    return (
        isRecord(value) &&
        typeof value.mode === "string" &&
        typeof value["font.size"] === "number" &&
        (value["font.family"] === undefined ||
            typeof value["font.family"] === "string") &&
        typeof value.radius === "number" &&
        typeof value["radius.lg"] === "number" &&
        isRecord(value.colors) &&
        Object.values(value.colors).every((color) => typeof color === "string")
    );
}

void test("generates native light and dark themes with Lemma typography and radii", () => {
    const [light, dark] = configs();
    assert.equal(light?.mode, "light");
    assert.equal(dark?.mode, "dark");
    for (const config of [light, dark]) {
        assert.equal(config?.["font.size"], 14);
        assert.equal(config?.["font.family"], undefined);
        assert.equal(config?.radius, 8);
        assert.equal(config?.["radius.lg"], 12);
    }
});

void test("maps surfaces, status colors, and interaction states to Lemma roles", () => {
    const [light, dark] = configs();
    assert.equal(light?.colors.background, "#ffffff");
    assert.equal(dark?.colors.background, "#1c1c1f");
    assert.equal(light?.colors["title_bar.background"], "#fafafa");
    assert.equal(dark?.colors["sidebar.background"], "#141416");
    assert.equal(light?.colors["primary.background"], "#0a66e8");
    assert.equal(light?.colors["primary.hover.background"], "#0958cc");
    assert.equal(light?.colors["primary.active.background"], "#0958cc");
    assert.equal(light?.colors["info.background"], "#0a66e8");
    assert.equal(light?.colors["danger.background"], "#c81d30");
    assert.equal(light?.colors["success.background"], "#15803d");
    assert.equal(light?.colors["warning.background"], "#b45309");
    assert.equal(light?.colors["success.hover.background"], "#137337");
    assert.equal(light?.colors["warning.active.background"], "#a24b08");
    assert.equal(light?.colors["selection.background"], "#00000012");
});
