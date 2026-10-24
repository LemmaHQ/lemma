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
