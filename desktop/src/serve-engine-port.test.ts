import type { EngineResponse } from "@lemma/desktop-bridge";
import { EventEmitter } from "node:events";
import { expect, it, vi } from "vitest";

import {
    serveEnginePort,
    type EnginePort,
    type PortEngine,
} from "./serve-engine-port";

// oxlint-disable-next-line unicorn/prefer-event-target -- fakes Electron MessagePortMain, an EventEmitter API
class FakePort extends EventEmitter implements EnginePort {
    sent: EngineResponse[] = [];

    postMessage(message: EngineResponse): void {
        this.sent.push(message);
    }

    start(): void {}

    deliver(data: unknown): void {
        this.emit("message", { data });
    }
}

const fakeEngine = (chunks: (Uint8Array | null)[]) => {
    const reads = [...chunks];
    const engine = {
        request: vi.fn<PortEngine["request"]>(() =>
            Promise.resolve({
                body: 7,
                status: 200,
                headers: [{ name: "content-type", value: "application/json" }],
            }),
        ),
        read: vi.fn<PortEngine["read"]>(() =>
            Promise.resolve(reads.shift() ?? null),
        ),
        cancel: vi.fn<PortEngine["cancel"]>(),
    };
    return engine;
};

const request = (id: number) => ({
    type: "request",
    id,
    method: "POST",
    path: "/lemma.v1.AuthService/Login",
    headers: [["content-type", "application/json"]],
    body: new TextEncoder().encode("{}"),
});

it("answers with the head, every chunk, and the end", async () => {
    const port = new FakePort();
    const engine = fakeEngine([
        new TextEncoder().encode("a"),
        new TextEncoder().encode("b"),
    ]);
    serveEnginePort(port, engine);

    port.deliver(request(1));
    await vi.waitFor(() => {
        expect(port.sent.at(-1)).toEqual({ type: "end", id: 1 });
    });

    expect(engine.request).toHaveBeenCalledWith(
        "POST",
        "/lemma.v1.AuthService/Login",
        [{ name: "content-type", value: "application/json" }],
        Buffer.from("{}"),
    );
    expect(port.sent).toEqual([
        {
            type: "head",
            id: 1,
            status: 200,
            headers: [["content-type", "application/json"]],
        },
        { type: "chunk", id: 1, data: new TextEncoder().encode("a") },
        { type: "chunk", id: 1, data: new TextEncoder().encode("b") },
        { type: "end", id: 1 },
    ]);
});

it("reports a failed request as an error", async () => {
    const port = new FakePort();
    const engine = fakeEngine([]);
    engine.request.mockRejectedValueOnce(new Error("invalid request: method"));
    serveEnginePort(port, engine);

    port.deliver(request(4));
    await vi.waitFor(() => {
        expect(port.sent).toEqual([
            { type: "error", id: 4, reason: "invalid request: method" },
        ]);
    });
});

it("closes the body and stops forwarding once the page cancels", async () => {
    const port = new FakePort();
    const engine = fakeEngine([]);
    const pendingRead = Promise.withResolvers<Uint8Array | null>();
    engine.read.mockReturnValueOnce(pendingRead.promise);
    serveEnginePort(port, engine);

    port.deliver(request(2));
    await vi.waitFor(() => {
        expect(port.sent).toHaveLength(1);
    });
    port.deliver({ type: "cancel", id: 2 });
    pendingRead.resolve(new TextEncoder().encode("late"));
    await Promise.resolve();

    expect(engine.cancel).toHaveBeenCalledWith(7);
    expect(port.sent.map((m) => m.type)).toEqual(["head"]);
});

it("closes the body of a request cancelled before its head", async () => {
    const port = new FakePort();
    const engine = fakeEngine([]);
    const head =
        Promise.withResolvers<Awaited<ReturnType<PortEngine["request"]>>>();
    engine.request.mockReturnValueOnce(head.promise);
    serveEnginePort(port, engine);

    port.deliver(request(3));
    port.deliver({ type: "cancel", id: 3 });
    head.resolve({ body: 9, status: 200, headers: [] });
    await vi.waitFor(() => {
        expect(engine.cancel).toHaveBeenCalledWith(9);
    });

    expect(port.sent).toEqual([]);
});

it("rejects a malformed message without calling the engine", () => {
    const port = new FakePort();
    const engine = fakeEngine([]);
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    serveEnginePort(port, engine);

    port.deliver({ type: "request", id: 5, method: "POST" });

    expect(engine.request).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalled();
    error.mockRestore();
});
