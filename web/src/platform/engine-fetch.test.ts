import type { EngineRequest, EngineResponse } from "@lemma/desktop-bridge";
import { describe, expect, it } from "vitest";

import { createEngineFetch, ENGINE_BASE_URL } from "./engine-fetch";

interface Harness {
    fetch: typeof globalThis.fetch;
    requests: EngineRequest[];
    respond(message: EngineResponse): void;
    exit(detail: string): void;
    nextRequest(): Promise<EngineRequest>;
}

const harness = (): Harness => {
    const { port1: page, port2: engine } = new MessageChannel();
    const exit = Promise.withResolvers<string>();
    const requests: EngineRequest[] = [];
    const waiters: ((request: EngineRequest) => void)[] = [];
    engine.addEventListener("message", (event: MessageEvent<EngineRequest>) => {
        requests.push(event.data);
        waiters.shift()?.(event.data);
    });
    engine.start();
    return {
        fetch: createEngineFetch({
            port: Promise.resolve(page),
            exit: exit.promise,
        }),
        requests,
        respond: (message) => {
            engine.postMessage(message, []);
        },
        exit: (detail) => {
            exit.resolve(detail);
        },
        nextRequest: () =>
            new Promise((resolve) => {
                waiters.push(resolve);
            }),
    };
};

const post = (fetch: typeof globalThis.fetch, init?: RequestInit) =>
    fetch(`${ENGINE_BASE_URL}/lemma.v1.AuthService/Login?x=1`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: '{"login":"lemma"}',
        ...init,
    });

const bytes = (text: string) => new TextEncoder().encode(text);

describe("createEngineFetch", () => {
    it("sends the request and streams the response body", async () => {
        const h = harness();
        const response = post(h.fetch);
        const request = await h.nextRequest();

        expect(request).toEqual({
            type: "request",
            id: 1,
            method: "POST",
            path: "/lemma.v1.AuthService/Login?x=1",
            headers: [["content-type", "application/json"]],
            body: bytes('{"login":"lemma"}'),
        });
        h.respond({
            type: "head",
            id: 1,
            status: 200,
            headers: [["content-type", "application/json"]],
        });
        h.respond({ type: "chunk", id: 1, data: bytes('{"ok":') });
        h.respond({ type: "chunk", id: 1, data: bytes("true}") });
        h.respond({ type: "end", id: 1 });

        const resolved = await response;
        expect(resolved.status).toBe(200);
        expect(resolved.headers.get("content-type")).toBe("application/json");
        expect(await resolved.text()).toBe('{"ok":true}');
    });

    it("rejects when the engine fails before the head", async () => {
        const h = harness();
        const response = post(h.fetch);
        await h.nextRequest();
        h.respond({ type: "error", id: 1, reason: "invalid request" });

        await expect(response).rejects.toThrow("invalid request");
    });

    it("errors the body when the engine fails mid-stream", async () => {
        const h = harness();
        const response = post(h.fetch);
        await h.nextRequest();
        h.respond({ type: "head", id: 1, status: 200, headers: [] });
        const resolved = await response;
        h.respond({ type: "chunk", id: 1, data: bytes("partial") });
        h.respond({ type: "error", id: 1, reason: "stream broke" });

        await expect(resolved.text()).rejects.toThrow("stream broke");
    });

    it("cancels the engine request when the caller aborts", async () => {
        const h = harness();
        const abort = new AbortController();
        const response = post(h.fetch, { signal: abort.signal });
        await h.nextRequest();
        abort.abort();

        await expect(response).rejects.toThrow(/abort/iu);
        expect(await h.nextRequest()).toEqual({ type: "cancel", id: 1 });
    });

    it("cancels the engine request when the reader stops early", async () => {
        const h = harness();
        const response = post(h.fetch);
        await h.nextRequest();
        h.respond({ type: "head", id: 1, status: 200, headers: [] });
        const resolved = await response;
        const cancelled = h.nextRequest();
        await resolved.body?.cancel();

        expect(await cancelled).toEqual({ type: "cancel", id: 1 });
    });

    it("fails pending and later requests once the engine stops", async () => {
        const h = harness();
        const response = post(h.fetch);
        await h.nextRequest();
        h.exit("the local engine exited with code 1");

        await expect(response).rejects.toThrow(
            "local engine stopped: the local engine exited with code 1",
        );
        await expect(post(h.fetch)).rejects.toThrow("local engine stopped");
        expect(h.requests).toHaveLength(1);
    });
});
