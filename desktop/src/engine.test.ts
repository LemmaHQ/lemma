import type { WebContents } from "electron";
import { EventEmitter } from "node:events";
import path from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { addonFile } from "./engine-addon";
import { createEngineProcess, type EngineProcess } from "./engine";

type FakeUtility = EventEmitter & {
    postMessage: ReturnType<
        typeof vi.fn<(message: unknown, ports?: unknown[]) => void>
    >;
    kill: ReturnType<typeof vi.fn<() => boolean>>;
};

type ForkMock = (
    modulePath: string,
    args: string[],
    options: { serviceName: string },
) => FakeUtility;

const mocks = vi.hoisted(() => ({
    fork: vi.fn<ForkMock>(),
    app: { isPackaged: false, getPath: (name: string) => `/${name}` },
    MessageChannelMain: class {
        port1 = { name: "engine end" };
        port2 = { name: "window end" };
    },
}));

vi.mock("electron", () => ({
    app: mocks.app,
    utilityProcess: { fork: mocks.fork },
    MessageChannelMain: mocks.MessageChannelMain,
}));

const fakeUtility = (): FakeUtility => {
    // oxlint-disable-next-line unicorn/prefer-event-target -- fakes Electron UtilityProcess, an EventEmitter API
    const emitter = new EventEmitter();
    return Object.assign(emitter, {
        postMessage: vi.fn<(message: unknown, ports?: unknown[]) => void>(),
        kill: vi.fn<() => boolean>(() => {
            emitter.emit("exit", 1);
            return true;
        }),
    });
};

const fakeWindow = () => ({
    send: vi.fn<WebContents["send"]>(),
    postMessage: vi.fn<WebContents["postMessage"]>(),
});

const READY = { type: "ready" };

let proc: FakeUtility;
let engine: EngineProcess;

beforeEach(() => {
    proc = fakeUtility();
    mocks.fork.mockReset().mockReturnValue(proc);
    engine = createEngineProcess();
});

afterEach(() => {
    proc.emit("exit", 0);
    vi.useRealTimers();
    vi.restoreAllMocks();
    delete process.env.LEMMA_ENGINE_PROFILE;
});

it("forks the engine host with the addon of the selected profile and userData", async () => {
    process.env.LEMMA_ENGINE_PROFILE = "release";
    const started = engine.start();
    proc.emit("message", READY);
    await started;

    expect(mocks.fork).toHaveBeenCalledWith(
        expect.stringMatching(/engine-host\.cjs$/u),
        [expect.stringContaining(`${path.sep}release${path.sep}`), "/userData"],
        expect.anything(),
    );
});

it("loads the addon from the resources directory when packaged", async () => {
    mocks.app.isPackaged = true;
    Object.defineProperty(process, "resourcesPath", {
        value: "/resources",
        configurable: true,
    });
    const started = engine.start();
    proc.emit("message", READY);
    await started;
    mocks.app.isPackaged = false;

    expect(mocks.fork).toHaveBeenCalledWith(
        expect.anything(),
        [path.join("/resources", addonFile()), "/userData"],
        expect.anything(),
    );
});

it("rejects and kills the engine when it fails to open", async () => {
    const started = engine.start();
    proc.emit("message", { type: "failed", reason: "open lemma.db: locked" });

    await expect(started).rejects.toThrow("open lemma.db: locked");
    expect(proc.kill).toHaveBeenCalled();
});

it("logs and ignores malformed messages while waiting for readiness", async () => {
    vi.useFakeTimers();
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const started = engine.start();
    proc.emit("message", "ready");
    proc.emit("message", { type: "failed" });
    vi.advanceTimersByTime(10_000);

    await expect(started).rejects.toThrow("within 10s");
    expect(log.mock.calls).toEqual([
        ["engine message rejected:", "ready"],
        ["engine message rejected:", { type: "failed" }],
    ]);
});

it("rejects when the engine exits before announcing readiness", async () => {
    const started = engine.start();
    proc.emit("exit", 3);

    await expect(started).rejects.toThrow(
        "engine exited before ready (code 3)",
    );
});

it("refuses a second start while the engine runs", async () => {
    const first = engine.start();
    proc.emit("message", READY);
    await first;

    await expect(engine.start()).rejects.toThrow("engine already running");
});

it("hands one end of a new channel to the engine and the other to the window", async () => {
    const started = engine.start();
    proc.emit("message", READY);
    await started;
    const target = fakeWindow();

    engine.connect(target);

    expect(proc.postMessage).toHaveBeenCalledWith({ type: "connect" }, [
        { name: "engine end" },
    ]);
    expect(target.postMessage).toHaveBeenCalledWith("engine-port", null, [
        { name: "window end" },
    ]);
});

it("tells a window that connects after a crash that the engine stopped", async () => {
    const supersededExit = vi.fn<(detail: string) => void>();
    engine.onExit(supersededExit);
    const exits: string[] = [];
    engine.onExit((detail) => {
        exits.push(detail);
    });
    const started = engine.start();
    proc.emit("message", READY);
    await started;
    proc.emit("exit", 9);
    const target = fakeWindow();

    engine.connect(target);

    expect(exits).toEqual(["the local engine exited with code 9"]);
    expect(supersededExit).not.toHaveBeenCalled();
    expect(target.send).toHaveBeenCalledWith(
        "engine-exit",
        "the local engine exited with code 9",
    );
    expect(proc.postMessage).not.toHaveBeenCalledWith(
        { type: "connect" },
        expect.anything(),
    );
});

it("asks the engine to stop and does not report the exit as a crash", async () => {
    const exits: string[] = [];
    engine.onExit((detail) => {
        exits.push(detail);
    });
    const started = engine.start();
    proc.emit("message", READY);
    await started;

    const stopped = engine.stop();
    expect(proc.postMessage).toHaveBeenCalledWith({ type: "stop" }, []);
    proc.emit("exit", 0);
    await stopped;

    expect(proc.kill).not.toHaveBeenCalled();
    expect(exits).toEqual([]);
});

it("kills the engine when it outlives the 3s stop grace period", async () => {
    const started = engine.start();
    proc.emit("message", READY);
    await started;
    vi.useFakeTimers();

    const stopped = engine.stop();
    await vi.advanceTimersByTimeAsync(3000);
    await stopped;

    expect(proc.kill).toHaveBeenCalled();
});

it("returns at once when asked to stop an engine that is not running", async () => {
    await engine.stop();

    expect(mocks.fork).not.toHaveBeenCalled();
    expect(proc.postMessage).not.toHaveBeenCalled();
});

it("tells a window that connects before the engine is ready that it is not running", () => {
    const started = engine.start();
    const target = fakeWindow();

    engine.connect(target);

    expect(target.send).toHaveBeenCalledWith(
        "engine-exit",
        "the local engine is not running",
    );
    proc.emit("exit", 0);
    return expect(started).rejects.toThrow("exited before ready");
});
