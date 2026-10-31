import type { DesktopBridge } from "@lemma/desktop-bridge";
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

    expect(platform.clientVersion).toBeNull();
    expect(platform.titlebarHeight).toBe(0);
    expect(getPlatform()).toBe(platform);
});

it("runs on the desktop engine when the preload exposes its bridge", async () => {
    const connect = vi.fn<DesktopBridge["connectEngine"]>();
    window.lemmaDesktop = {
        appVersion: "2.1.0",
        titlebarHeight: 40,
        setTitleBar: () => {},
        toggleMaximize: () => {},
        connectEngine: connect,
    };
    const { getPlatform } = await loadPlatform();

    const platform = getPlatform();

    expect(platform.clientVersion).toBe("2.1.0");
    expect(platform.titlebarHeight).toBe(40);
    expect(platform.baseUrl).toBe("http://engine.lemma.invalid");
    expect(platform.auth.cookieMode).toBe(false);
    expect(connect).toHaveBeenCalledOnce();
});
