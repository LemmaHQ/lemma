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
    ["win32", "lemma_desktop.dll"],
    ["darwin", "liblemma_desktop.dylib"],
    ["linux", "liblemma_desktop.so"],
] as const)("names the %s addon %s", (os, file) => {
    setPlatform(os);

    expect(addonFile()).toBe(file);
});
