import { app } from "electron";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import path from "node:path";

export interface SkipCredentials {
    port: number;
    username: string;
    password: string;
}

interface ReadyPayload {
    port: number;
    default_username: string;
    default_password: string;
}

const READY_PREFIX = "LEMMA_READY ";
const READY_TIMEOUT_MS = 10_000;
const STOP_GRACE_MS = 3_000;

let child: ChildProcessWithoutNullStreams | null = null;
let skipCredentials: SkipCredentials | null = null;
let exitWatcher: Promise<number | null> | null = null;

const engineBinary = (): string => {
    const name = process.platform === "win32" ? "lemma-server.exe" : "lemma-server";
    if (app.isPackaged) {
        return path.join(process.resourcesPath, name);
    }
    const profile = process.env.LEMMA_ENGINE_PROFILE ?? "debug";
    return path.join(__dirname, "../../../target", profile, name);
};

export function getSkipCredentials(): SkipCredentials | null {
    return skipCredentials;
}

export async function start(): Promise<SkipCredentials> {
    if (child) {
        throw new Error("engine already running");
    }

    const binary = engineBinary();
    const proc = spawn(binary, [], {
        env: {
            ...process.env,
            LEMMA_LOCAL_MODE: "1",
            LEMMA_DATA_DIR: app.getPath("userData"),
        },
        stdio: ["pipe", "pipe", "inherit"],
    });

    child = proc;
    const exit = Promise.withResolvers<number | null>();
    proc.on("exit", (code) => {
        child = null;
        skipCredentials = null;
        exit.resolve(code);
    });
    exitWatcher = exit.promise;

    const ready = Promise.withResolvers<ReadyPayload>();
    let buffer = "";
    const timer = setTimeout(() => {
        proc.kill();
        ready.reject(new Error("engine did not report readiness within 10s"));
    }, READY_TIMEOUT_MS);

    proc.on("error", (err) => {
        clearTimeout(timer);
        child = null;
        ready.reject(new Error(`cannot start engine: ${err.message}`));
    });
    proc.on("exit", (code) => {
        clearTimeout(timer);
        ready.reject(new Error(`engine exited before ready (code ${code})`));
    });
    proc.stdout.on("data", (chunk: Buffer) => {
        buffer += chunk.toString();
        const index = buffer.indexOf("\n");
        if (index === -1) {
            return;
        }
        const line = buffer.slice(0, index).trim();
        if (!line.startsWith(READY_PREFIX)) {
            return;
        }
        clearTimeout(timer);
        try {
            const payload = JSON.parse(line.slice(READY_PREFIX.length)) as ReadyPayload;
            if (
                typeof payload.port !== "number" ||
                typeof payload.default_username !== "string" ||
                typeof payload.default_password !== "string"
            ) {
                throw new Error("invalid ready payload");
            }
            ready.resolve(payload);
        } catch (err) {
            proc.kill();
            ready.reject(
                err instanceof Error
                    ? err
                    : new Error("engine ready payload unparseable"),
            );
        }
    });

    const payload = await ready.promise;
    skipCredentials = {
        port: payload.port,
        username: payload.default_username,
        password: payload.default_password,
    };
    return skipCredentials;
}

export const serverUrl = (): string | null =>
    skipCredentials ? `http://127.0.0.1:${skipCredentials.port}` : null;

export async function stop(): Promise<void> {
    const proc = child;
    if (!proc) {
        return;
    }
    child = null;
    proc.stdin.end();
    const grace = Promise.withResolvers<void>();
    setTimeout(grace.resolve, STOP_GRACE_MS);
    await Promise.race([exitWatcher, grace.promise]);
    if (!proc.killed) {
        proc.kill();
    }
}
