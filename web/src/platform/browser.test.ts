import { afterEach, expect, it, vi } from "vitest";

import { BrowserAdapter } from "./browser";

afterEach(() => {
    vi.unstubAllGlobals();
});

it("talks to its own origin without desktop capabilities", () => {
    const adapter = new BrowserAdapter();

    expect(adapter.baseUrl).toBe("/");
    expect(adapter.directoryPicker).toBeNull();
    expect(adapter.titlebarHeight).toBe(0);
    adapter.window.setTitleBar({ theme: "light", surface: "sidebar" });
    adapter.window.toggleMaximize();
});

it("sends requests through the fetch current at call time", async () => {
    const adapter = new BrowserAdapter();
    const fetch = vi.fn<typeof globalThis.fetch>(() =>
        Promise.resolve(new Response("ok")),
    );
    vi.stubGlobal("fetch", fetch);

    const response = await adapter.fetch("/ping", { method: "POST" });

    expect(await response.text()).toBe("ok");
    expect(fetch).toHaveBeenCalledWith("/ping", { method: "POST" });
});
