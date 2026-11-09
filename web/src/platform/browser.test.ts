import { afterEach, expect, it, vi } from "vitest";

import { BrowserAdapter } from "./browser";

afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
});

it("talks to its own origin in cookie mode by default", () => {
    const adapter = new BrowserAdapter();

    expect(adapter.baseUrl).toBe("/");
    expect(adapter.auth.cookieMode).toBe(true);
});

it("uses bearer tokens for a configured server on another origin", () => {
    localStorage.setItem("lemma.serverUrl", "https://api.example.com");

    const adapter = new BrowserAdapter();

    expect(adapter.baseUrl).toBe("https://api.example.com");
    expect(adapter.auth.cookieMode).toBe(false);
});

it("treats an empty configured server as its own origin", () => {
    localStorage.setItem("lemma.serverUrl", "");

    expect(new BrowserAdapter().baseUrl).toBe("/");
});

it("falls back to bearer tokens when the configured server is not a URL", () => {
    localStorage.setItem("lemma.serverUrl", "http://[");

    expect(new BrowserAdapter().auth.cookieMode).toBe(false);
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
