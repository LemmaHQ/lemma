import type { PlatformAdapter, WindowCapabilities } from "./types";

function ignoreWindowCommand(): void {}

export class BrowserAdapter implements PlatformAdapter {
    readonly baseUrl = "/";
    readonly fetch: typeof globalThis.fetch = (input, init) =>
        globalThis.fetch(input, init);

    readonly directoryPicker = null;

    readonly window: WindowCapabilities = {
        setTitleBar: ignoreWindowCommand,
        toggleMaximize: ignoreWindowCommand,
    };

    readonly titlebarHeight = 0;
}
