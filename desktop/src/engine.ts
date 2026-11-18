import {
    app,
    MessageChannelMain,
    type MessagePortMain,
    utilityProcess,
    type UtilityProcess,
    type WebContents,
} from "electron";
import path from "node:path";

import { addonFile } from "./engine-addon";
import { type HostCommand, isHostEvent } from "./engine-host-protocol";

const READY_TIMEOUT_MS = 10_000;
const STOP_GRACE_MS = 3_000;

interface Running {
    proc: UtilityProcess;
    exited: Promise<"exited">;
}

/** Lifecycle controller for the Electron utility process hosting the engine. */
export interface EngineProcess {
    /** Calls `listener` when a ready engine exits without being stopped. */
    onExit(listener: (detail: string) => void): void;
    /**
     * Starts the engine process, which opens the engine over the `userData`
     * directory, and resolves once it is ready.
     */
    start(): Promise<void>;
    /**
     * Opens a port between `target` and the engine, or tells `target` that the
     * engine is not running.
     */
    connect(target: Pick<WebContents, "send" | "postMessage">): void;
    /**
     * Asks the engine to close its database and exit, and kills it when it
     * outlives the 3s grace period.
     */
    stop(): Promise<void>;
}
const addonPath = (): string => {
    if (app.isPackaged) {
        return path.join(process.resourcesPath, addonFile());
    }
    const profile = process.env.LEMMA_ENGINE_PROFILE ?? "debug";
    return path.join(__dirname, "../../../target", profile, addonFile());
};

const post = (
    proc: UtilityProcess,
    command: HostCommand,
    ports: MessagePortMain[] = [],
): void => {
    proc.postMessage(command, ports);
};

/** Creates an isolated engine process controller. */
export function createEngineProcess(): EngineProcess {
    let running: Running | null = null;
    let ready = false;
    let exitDetail = "the engine is not running";
    let exitListener: ((detail: string) => void) | null = null;

    return {
        onExit: (listener) => {
            exitListener = listener;
        },
        start: async () => {
            if (running !== null) {
                throw new Error("engine already running");
            }
            const proc = utilityProcess.fork(
                path.join(__dirname, "engine-host.cjs"),
                [addonPath(), app.getPath("userData")],
                { serviceName: "Lemma Engine", stdio: "inherit" },
            );
            const exit = Promise.withResolvers<"exited">();
            running = { proc, exited: exit.promise };
            const readiness = Promise.withResolvers<undefined>();
            const timer = setTimeout(() => {
                readiness.reject(
                    new Error("engine did not report readiness within 10s"),
                );
                proc.kill();
            }, READY_TIMEOUT_MS);

            proc.on("message", (message: unknown) => {
                if (!isHostEvent(message)) {
                    console.error("engine message rejected:", message);
                    return;
                }
                clearTimeout(timer);
                if (message.type === "ready") {
                    readiness.resolve(undefined);
                } else {
                    readiness.reject(new Error(message.reason));
                    proc.kill();
                }
            });
            proc.on("exit", (code) => {
                clearTimeout(timer);
                const wasReady = ready;
                running = null;
                ready = false;
                exitDetail = `the engine exited with code ${code}`;
                exit.resolve("exited");
                readiness.reject(
                    new Error(`engine exited before ready (code ${code})`),
                );
                if (wasReady) {
                    exitListener?.(exitDetail);
                }
            });

            await readiness.promise;
            ready = true;
        },
        connect: (target) => {
            if (running === null || !ready) {
                target.send("engine-exit", exitDetail);
                return;
            }
            const { port1, port2 } = new MessageChannelMain();
            post(running.proc, { type: "connect" }, [port1]);
            target.postMessage("engine-port", null, [port2]);
        },
        stop: async () => {
            const current = running;
            if (current === null) {
                return;
            }
            ready = false;
            post(current.proc, { type: "stop" });
            const grace = Promise.withResolvers<"timeout">();
            const timer = setTimeout(() => {
                grace.resolve("timeout");
            }, STOP_GRACE_MS);
            const outcome = await Promise.race([current.exited, grace.promise]);
            clearTimeout(timer);
            if (outcome === "timeout") {
                current.proc.kill();
            }
        },
    };
}
