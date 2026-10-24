import type { WebContents } from "electron";
import { EventEmitter } from "node:events";
import path from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { connect, getSkipCredentials, onExit, start, stop } from "./engine";

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

const READY = {
    type: "ready",
    account: { username: "lemma", password: "secret" },
};

let proc: FakeUtility;

beforeEach(() => {
    proc = fakeUtility();
    mocks.fork.mockReset().mockReturnValue(proc);
});

afterEach(() => {
    proc.emit("exit", 0);
    vi.useRealTimers();
    delete process.env.LEMMA_ENGINE_PROFILE;
});

it("resolves the default account the engine announces", async () => {
    const started = start();
    proc.emit("message", READY);

    await expect(started).resolves.toEqual(READY.account);
    expect(getSkipCredentials()).toEqual(READY.account);
});

it("forks the engine host with the addon of the selected profile and userData", async () => {
    process.env.LEMMA_ENGINE_PROFILE = "release";
    const started = start();
    proc.emit("message", READY);
    await started;

    expect(mocks.fork).toHaveBeenCalledWith(
        expect.stringMatching(/engine-host\.cjs$/u),
        [expect.stringContaining(`${path.sep}release${path.sep}`), "/userData"],
        expect.anything(),
    );
});

it("rejects and kills the engine when it fails to open", async () => {
    const started = start();
    proc.emit("message", { type: "failed", reason: "open lemma.db: locked" });

    await expect(started).rejects.toThrow("open lemma.db: locked");
    expect(proc.kill).toHaveBeenCalled();
});

it("ignores a malformed message while waiting for readiness", async () => {
    vi.useFakeTimers();
    const started = start();
    proc.emit("message", { type: "ready", account: { username: "lemma" } });
    vi.advanceTimersByTime(10_000);

    await expect(started).rejects.toThrow("within 10s");
});

it("rejects when the engine exits before announcing readiness", async () => {
    const started = start();
    proc.emit("exit", 3);

    await expect(started).rejects.toThrow(
        "engine exited before ready (code 3)",
    );
    expect(getSkipCredentials()).toBeNull();
});

it("refuses a second start while the engine runs", async () => {
    const first = start();
    proc.emit("message", READY);
    await first;

    await expect(start()).rejects.toThrow("engine already running");
});

it("hands one end of a new channel to the engine and the other to the window", async () => {
    const started = start();
    proc.emit("message", READY);
    await started;
    const target = fakeWindow();

    connect(target);

    expect(proc.postMessage).toHaveBeenCalledWith({ type: "connect" }, [
        { name: "engine end" },
    ]);
    expect(target.postMessage).toHaveBeenCalledWith("engine-port", null, [
        { name: "window end" },
    ]);
});

it("tells a window that connects after a crash that the engine stopped", async () => {
    const exits: string[] = [];
    onExit((detail) => {
        exits.push(detail);
    });
    const started = start();
    proc.emit("message", READY);
    await started;
    proc.emit("exit", 9);
    const target = fakeWindow();

    connect(target);

    expect(exits).toEqual(["the local engine exited with code 9"]);
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
    onExit((detail) => {
        exits.push(detail);
    });
    const started = start();
    proc.emit("message", READY);
    await started;

    const stopped = stop();
    expect(proc.postMessage).toHaveBeenCalledWith({ type: "stop" }, []);
    proc.emit("exit", 0);
    await stopped;

    expect(proc.kill).not.toHaveBeenCalled();
    expect(exits).toEqual([]);
});

it("kills the engine when it outlives the 3s stop grace period", async () => {
    const started = start();
    proc.emit("message", READY);
    await started;
    vi.useFakeTimers();

    const stopped = stop();
    await vi.advanceTimersByTimeAsync(3000);
    await stopped;

    expect(proc.kill).toHaveBeenCalled();
});
