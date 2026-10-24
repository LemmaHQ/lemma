import type {
    EngineHeader,
    EngineRequest,
    EngineResponse,
} from "@lemma/desktop-bridge";

/** The addon's engine, as far as a port needs it. */
export interface PortEngine {
    request(
        method: string,
        path: string,
        headers: { name: string; value: string }[],
        body: Buffer,
    ): Promise<{
        body: number;
        status: number;
        headers: { name: string; value: string }[];
    }>;
    read(body: number): Promise<Uint8Array | null>;
    cancel(body: number): void;
}

/** The `MessagePortMain` surface a port needs. */
export interface EnginePort {
    on(event: "message", listener: (event: { data: unknown }) => void): void;
    postMessage(message: EngineResponse): void;
    start(): void;
}

const isHeader = (value: unknown): value is EngineHeader =>
    Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === "string" &&
    typeof value[1] === "string";

const isEngineRequest = (value: unknown): value is EngineRequest => {
    if (
        typeof value !== "object" ||
        value === null ||
        !("type" in value) ||
        !("id" in value) ||
        typeof value.id !== "number"
    ) {
        return false;
    }
    if (value.type === "cancel") {
        return true;
    }
    return (
        value.type === "request" &&
        "method" in value &&
        typeof value.method === "string" &&
        "path" in value &&
        typeof value.path === "string" &&
        "headers" in value &&
        Array.isArray(value.headers) &&
        value.headers.every(isHeader) &&
        "body" in value &&
        value.body instanceof Uint8Array
    );
};

const errorText = (err: unknown): string =>
    err instanceof Error ? err.message : String(err);

/**
 * Serves the web client's requests on `port` through `engine`: each request
 * answers with its head, then its body chunks as the engine produces them.
 */
export function serveEnginePort(port: EnginePort, engine: PortEngine): void {
    const openBodies = new Map<number, number>();
    const cancelledBeforeHead = new Set<number>();

    const forward = async (
        request: Extract<EngineRequest, { type: "request" }>,
    ): Promise<void> => {
        const { id } = request;
        let headSent = false;
        try {
            const head = await engine.request(
                request.method,
                request.path,
                request.headers.map(([name, value]) => ({ name, value })),
                Buffer.from(request.body),
            );
            if (cancelledBeforeHead.delete(id)) {
                engine.cancel(head.body);
                return;
            }
            openBodies.set(id, head.body);
            headSent = true;
            port.postMessage({
                type: "head",
                id,
                status: head.status,
                headers: head.headers.map(({ name, value }) => [name, value]),
            });
            for (;;) {
                // oxlint-disable-next-line eslint/no-await-in-loop -- chunks are read in order, one at a time, so a slow page holds back the stream
                const chunk = await engine.read(head.body);
                if (!openBodies.has(id)) {
                    return;
                }
                if (chunk === null) {
                    openBodies.delete(id);
                    port.postMessage({ type: "end", id });
                    return;
                }
                port.postMessage({ type: "chunk", id, data: chunk });
            }
        } catch (err) {
            if (cancelledBeforeHead.delete(id)) {
                return;
            }
            if (headSent && !openBodies.has(id)) {
                return;
            }
            openBodies.delete(id);
            port.postMessage({ type: "error", id, reason: errorText(err) });
        }
    };

    const cancel = (id: number): void => {
        const body = openBodies.get(id);
        if (body === undefined) {
            cancelledBeforeHead.add(id);
            return;
        }
        openBodies.delete(id);
        engine.cancel(body);
    };

    port.on("message", (event) => {
        const message = event.data;
        if (!isEngineRequest(message)) {
            console.error("engine port request rejected:", message);
            return;
        }
        if (message.type === "cancel") {
            cancel(message.id);
        } else {
            void forward(message);
        }
    });
    port.start();
}
