import type { CustomScheme } from "electron";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { beforeEach, expect, it, vi } from "vitest";

import {
    APP_ORIGIN,
    isAppUrl,
    registerAppScheme,
    serveApp,
    serveWebFile,
} from "./app-protocol";

const mocks = vi.hoisted(() => ({
    fetch: vi.fn<(url: string) => Promise<Response>>(),
    handle: vi.fn<
        (
            scheme: string,
            handler: (request: Request) => Response | Promise<Response>,
        ) => void
    >(),
    registerSchemesAsPrivileged:
        vi.fn<(customSchemes: CustomScheme[]) => void>(),
}));

vi.mock("electron", () => ({
    net: { fetch: mocks.fetch },
    protocol: {
        handle: mocks.handle,
        registerSchemesAsPrivileged: mocks.registerSchemesAsPrivileged,
    },
}));

beforeEach(() => {
    mocks.fetch.mockReset();
    mocks.handle.mockReset();
    mocks.registerSchemesAsPrivileged.mockReset();
});

it("registers the app scheme as standard and secure", () => {
    registerAppScheme();

    expect(mocks.registerSchemesAsPrivileged).toHaveBeenCalledWith([
        { scheme: "app", privileges: { standard: true, secure: true } },
    ]);
});

it("serves app protocol requests through the web file handler", () => {
    serveApp();

    expect(mocks.handle).toHaveBeenCalledWith("app", serveWebFile);
});

it("recognizes only URLs on the lemma app origin", () => {
    expect(isAppUrl(`${APP_ORIGIN}/sessions`)).toBe(true);
    expect(isAppUrl("https://lemma/sessions")).toBe(false);
    expect(isAppUrl("app://other/sessions")).toBe(false);
});

it("serves a file from web-dist", async () => {
    const response = new Response("app code");
    mocks.fetch.mockResolvedValue(response);

    const result = await serveWebFile(
        new Request(`${APP_ORIGIN}/assets/app.js`),
    );

    const target = path.join(__dirname, "../../web-dist/assets/app.js");
    expect(mocks.fetch).toHaveBeenCalledWith(pathToFileURL(target).href);
    expect(result).toBe(response);
});

it("serves index.html for a path without an extension", async () => {
    const response = new Response("app page");
    mocks.fetch.mockResolvedValue(response);

    const result = await serveWebFile(new Request(`${APP_ORIGIN}/sessions/1`));

    const target = path.join(__dirname, "../../web-dist/index.html");
    expect(mocks.fetch).toHaveBeenCalledWith(pathToFileURL(target).href);
    expect(result).toBe(response);
});

it("rejects a path that escapes web-dist", async () => {
    const response = await serveWebFile(
        new Request(`${APP_ORIGIN}/%2E%2E%2Foutside.txt`),
    );

    expect(response.status).toBe(404);
    expect(mocks.fetch).not.toHaveBeenCalled();
});
