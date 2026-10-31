import { afterEach, expect, it } from "vitest";

import { BrowserAdapter } from "./browser";

afterEach(() => {
    localStorage.clear();
});

it("talks to its own origin with session cookies by default", () => {
    const adapter = new BrowserAdapter();

    expect(adapter.baseUrl).toBe("/");
    expect(adapter.auth.cookieMode).toBe(true);
    expect(adapter.clientVersion).toBeNull();
    expect(adapter.titlebarHeight).toBe(0);
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
