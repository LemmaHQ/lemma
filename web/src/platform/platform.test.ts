import type { DesktopBridge } from "../../../desktop/src/desktop-bridge";
import { afterEach, expect, it, vi } from "vitest";

const loadPlatform = () => {
    vi.resetModules();
    return import("./platform");
};

afterEach(() => {
    delete window.lemmaDesktop;
});

it("runs as the browser client without a desktop bridge", async () => {
    const { getPlatform } = await loadPlatform();

    const platform = getPlatform();

    expect(platform.directoryPicker).toBeNull();
    expect(platform.titlebarHeight).toBe(0);
    expect(getPlatform()).toBe(platform);
});

it("runs on the desktop engine when the preload exposes its bridge", async () => {
    const connect = vi.fn<DesktopBridge["connectEngine"]>();
    window.lemmaDesktop = {
        titlebarHeight: 40,
        setTitleBar: () => {},
        toggleMaximize: () => {},
        connectEngine: connect,
        pickDirectory: () => Promise.resolve("C:\\work\\project"),
    };
    const { getPlatform } = await loadPlatform();

    const platform = getPlatform();

    expect(platform.titlebarHeight).toBe(40);
    expect(platform.baseUrl).toBe("http://engine.lemma.invalid");
    await expect(platform.directoryPicker?.pick()).resolves.toBe(
        "C:\\work\\project",
    );
    expect(connect).toHaveBeenCalledOnce();
});
