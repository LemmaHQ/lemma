import type {
    DesktopBridge,
    EngineRequest,
    EngineResponse,
} from "@lemma/desktop-bridge";

/** Base URL of the desktop engine; its requests never reach the network. */
export const ENGINE_BASE_URL = "http://engine.lemma.invalid";

/** The engine port and the engine's exit, as the desktop preload announces them. */
export interface EngineConnection {
    port: Promise<MessagePort>;
    exit: Promise<string>;
}

interface Pending {
    head: PromiseWithResolvers<Response>;
    body: ReadableStreamDefaultController<Uint8Array> | null;
}

const exitError = (detail: string): TypeError =>
    new TypeError(`local engine stopped: ${detail}`);

/** Asks the desktop preload for an engine port and listens for its answer. */
export function connectEngine(
    target: Window,
    bridge: DesktopBridge,
): EngineConnection {
    const port = Promise.withResolvers<MessagePort>();
    const exit = Promise.withResolvers<string>();
    target.addEventListener("message", (event: MessageEvent<unknown>) => {
        const data = event.data;
        if (
            event.source !== target ||
            typeof data !== "object" ||
            data === null ||
            !("type" in data)
        ) {
            return;
        }
        if (data.type === "lemma-engine-port") {
            const [received] = event.ports;
            if (received !== undefined) {
                port.resolve(received);
            }
        } else if (data.type === "lemma-engine-exit") {
            exit.resolve(
                "detail" in data && typeof data.detail === "string"
                    ? data.detail
                    : "",
            );
        }
    });
    bridge.connectEngine();
    return { port: port.promise, exit: exit.promise };
}

/**
 * A `fetch` that sends each request over the engine port: the response
 * resolves on the engine's head and streams the body chunks that follow.
 * Once the engine stops, pending and later requests fail.
 */
export function createEngineFetch(
    connection: EngineConnection,
): typeof globalThis.fetch {
    const pending = new Map<number, Pending>();
    let nextId = 1;
    let stopped: TypeError | null = null;

    const fail = (entry: Pending, error: unknown): void => {
        if (entry.body === null) {
            entry.head.reject(error);
        } else {
            entry.body.error(error);
        }
    };

    const receive = (port: MessagePort, message: EngineResponse): void => {
        const entry = pending.get(message.id);
        if (entry === undefined) {
            return;
        }
        switch (message.type) {
            case "head": {
                const body = new ReadableStream<Uint8Array>({
                    start: (controller) => {
                        entry.body = controller;
                    },
                    cancel: () => {
                        if (pending.delete(message.id)) {
                            const cancel: EngineRequest = {
                                type: "cancel",
                                id: message.id,
                            };
                            port.postMessage(cancel);
                        }
                    },
                });
                entry.head.resolve(
                    new Response(body, {
                        status: message.status,
                        headers: message.headers,
                    }),
                );
                break;
            }
            case "chunk": {
                entry.body?.enqueue(message.data);
                break;
            }
            case "end": {
                pending.delete(message.id);
                entry.body?.close();
                break;
            }
            case "error": {
                pending.delete(message.id);
                fail(entry, new TypeError(message.reason));
                break;
            }
        }
    };

    const listen = async (): Promise<void> => {
        const port = await connection.port;
        port.addEventListener(
            "message",
            (event: MessageEvent<EngineResponse>) => {
                receive(port, event.data);
            },
        );
        port.start();
    };
    const failOnExit = async (): Promise<void> => {
        stopped = exitError(await connection.exit);
        for (const entry of pending.values()) {
            fail(entry, stopped);
        }
        pending.clear();
    };
    void listen();
    void failOnExit();

    return async (input, init) => {
        if (stopped !== null) {
            throw stopped;
        }
        const request = new Request(input, init);
        const signal = init?.signal ?? null;
        signal?.throwIfAborted();
        const body = new Uint8Array(await request.arrayBuffer());
        const port = await Promise.race([
            connection.port,
            connection.exit.then((detail) => {
                throw exitError(detail);
            }),
        ]);
        const url = new URL(request.url);
        const id = nextId;
        nextId += 1;
        const entry: Pending = {
            head: Promise.withResolvers<Response>(),
            body: null,
        };
        pending.set(id, entry);
        signal?.addEventListener(
            "abort",
            () => {
                if (pending.delete(id)) {
                    const cancel: EngineRequest = { type: "cancel", id };
                    port.postMessage(cancel);
                    fail(entry, signal.reason);
                }
            },
            { once: true },
        );
        const message: EngineRequest = {
            type: "request",
            id,
            method: request.method,
            path: `${url.pathname}${url.search}`,
            headers: [...request.headers],
            body,
        };
        port.postMessage(message, [body.buffer]);
        return entry.head.promise;
    };
}
