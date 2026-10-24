import type { HostCommand, HostEvent } from "./engine-host-protocol";
import { serveEnginePort, type PortEngine } from "./serve-engine-port";

interface Addon {
    open(dataDir: string): Promise<PortEngine & { close(): Promise<void> }>;
}

const isHostCommand = (value: unknown): value is HostCommand =>
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    (value.type === "connect" || value.type === "stop");

const [addonPath, dataDir] = process.argv.slice(2);
const parent = process.parentPort;

const post = (event: HostEvent): void => {
    // oxlint-disable-next-line unicorn/require-post-message-target-origin -- Electron's parentPort takes no target origin
    parent.postMessage(event);
};

const loadAddon = (file: string): Addon => {
    const module = { exports: {} };
    process.dlopen(module, file);
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the addon's exports are declared by lemma-desktop, which this build loads
    return module.exports as Addon;
};

const run = async (): Promise<void> => {
    if (addonPath === undefined || dataDir === undefined) {
        throw new Error(
            "engine host needs the addon path and the data directory",
        );
    }
    const addon = loadAddon(addonPath);
    const engine = await addon.open(dataDir);
    parent.on("message", (event) => {
        const command: unknown = event.data;
        if (!isHostCommand(command)) {
            console.error("engine host command rejected:", command);
            return;
        }
        if (command.type === "stop") {
            void engine.close().finally(() => process.exit(0));
            return;
        }
        const [port] = event.ports;
        if (port !== undefined) {
            serveEnginePort(port, engine);
        }
    });
    post({ type: "ready" });
};

// oxlint-disable-next-line unicorn/prefer-top-level-await -- the engine host is bundled as CommonJS, which has no top-level await
run().catch((err: unknown) => {
    post({
        type: "failed",
        reason: err instanceof Error ? err.message : String(err),
    });
});
