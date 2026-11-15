/** Theme and surface that the window's titlebar overlay follows. */
export interface TitleBarState {
    theme: "light" | "dark";
    surface: "sidebar" | "background";
}

/** The API the desktop preload exposes to the web client as `window.lemmaDesktop`. */
export interface DesktopBridge {
    /** Height in CSS pixels of the titlebar overlay the page lays out under. */
    readonly titlebarHeight: number;
    setTitleBar(state: TitleBarState): void;
    toggleMaximize(): void;
    /**
     * Asks for a port to the local engine. The preload answers with an
     * {@link EnginePortHandoff}, or with an {@link EngineExitNotice} when the
     * engine is not running. Each call opens a new port.
     */
    connectEngine(): void;
    /** Shows the native directory picker; resolves the chosen absolute path, or `null` when canceled. */
    pickDirectory(): Promise<string | null>;
}

/** Window message carrying the engine port in `event.ports[0]`. */
export interface EnginePortHandoff {
    type: "lemma-engine-port";
}

/** Window message announcing that the engine has stopped; requests fail from then on. */
export interface EngineExitNotice {
    type: "lemma-engine-exit";
    detail: string;
}

/** A header name and value. */
export type EngineHeader = [name: string, value: string];

/** Messages the web client posts on the engine port. */
export type EngineRequest =
    | {
          type: "request";
          id: number;
          method: string;
          path: string;
          headers: EngineHeader[];
          body: Uint8Array;
      }
    | { type: "cancel"; id: number };

/**
 * Messages the engine posts on the engine port: one `head`, then any number
 * of `chunk`s and one `end`, or an `error` at any point.
 */
export type EngineResponse =
    | { type: "head"; id: number; status: number; headers: EngineHeader[] }
    | { type: "chunk"; id: number; data: Uint8Array }
    | { type: "end"; id: number }
    | { type: "error"; id: number; reason: string };

const isHeader = (value: unknown): value is EngineHeader =>
    Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === "string" &&
    typeof value[1] === "string";

const isHeaders = (value: unknown): value is EngineHeader[] =>
    Array.isArray(value) && value.every(isHeader);

const hasEnvelope = (
    value: unknown,
): value is { id: number; type: unknown } & Record<string, unknown> =>
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "number" &&
    "type" in value;

/** Returns whether `value` is a valid {@link EngineRequest}. */
export const isEngineRequest = (value: unknown): value is EngineRequest => {
    if (!hasEnvelope(value)) {
        return false;
    }
    if (value.type === "cancel") {
        return true;
    }
    return (
        value.type === "request" &&
        typeof value.method === "string" &&
        typeof value.path === "string" &&
        isHeaders(value.headers) &&
        value.body instanceof Uint8Array
    );
};

/** Returns whether `value` is a valid {@link EngineResponse}. */
export const isEngineResponse = (value: unknown): value is EngineResponse => {
    if (!hasEnvelope(value)) {
        return false;
    }
    switch (value.type) {
        case "head":
            return typeof value.status === "number" && isHeaders(value.headers);
        case "chunk":
            return value.data instanceof Uint8Array;
        case "end":
            return true;
        case "error":
            return typeof value.reason === "string";
        default:
            return false;
    }
};
