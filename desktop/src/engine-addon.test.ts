import { afterEach, expect, it } from "vitest";

import { addonFile } from "./engine-addon";

const platform = process.platform;

const setPlatform = (value: NodeJS.Platform): void => {
    Object.defineProperty(process, "platform", { value, configurable: true });
};

afterEach(() => {
    setPlatform(platform);
});

it.each([
    ["win32", "lemma_napi.dll"],
    ["darwin", "liblemma_napi.dylib"],
    ["linux", "liblemma_napi.so"],
] as const)("names the %s addon %s", (os, file) => {
    setPlatform(os);

    expect(addonFile()).toBe(file);
});
