import { EventEmitter } from "node:events";
import path from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { getSkipCredentials, serverUrl, start, stop } from "./engine";

const mocks = vi.hoisted(() => ({
    spawn: vi.fn(),
    app: { isPackaged: false, getPath: (name: string) => `/${name}` },
}));

vi.mock("electron", () => ({ app: mocks.app }));
vi.mock("node:child_process", () => ({ spawn: mocks.spawn }));

class FakeProcess extends EventEmitter {
    stdout = new EventEmitter();
    stdin = { end: vi.fn() };
    killed = false;
    kill = vi.fn(() => {
        this.killed = true;
        return true;
    });

    print(text: string): void {
        this.stdout.emit("data", Buffer.from(text));
    }
}

const READY_LINE =
    'LEMMA_READY {"port":4100,"default_username":"local","default_password":"secret"}\n';

let proc: FakeProcess;

beforeEach(() => {
    proc = new FakeProcess();
    mocks.spawn.mockReset().mockReturnValue(proc);
});

afterEach(() => {
    proc.emit("exit", null);
    vi.useRealTimers();
    delete process.env.LEMMA_ENGINE_PROFILE;
});

it("resolves the credentials announced on the ready line", async () => {
    const started = start();
    proc.print(READY_LINE);

    await expect(started).resolves.toEqual({
        port: 4100,
        username: "local",
        password: "secret",
    });
    expect(serverUrl()).toBe("http://127.0.0.1:4100");
    expect(getSkipCredentials()?.port).toBe(4100);
});

it("assembles a ready line split across chunks", async () => {
    const started = start();
    proc.print(READY_LINE.slice(0, 20));
    proc.print(READY_LINE.slice(20));

    await expect(started).resolves.toMatchObject({ port: 4100 });
});

it("starts the engine in local mode with the userData directory", async () => {
    const started = start();
    proc.print(READY_LINE);
    await started;

    const [, , options] = mocks.spawn.mock.calls[0];
    expect(options.env).toMatchObject({
        LEMMA_LOCAL_MODE: "1",
        LEMMA_DATA_DIR: "/userData",
    });
});

it("takes an unpackaged binary from the selected cargo profile", async () => {
    process.env.LEMMA_ENGINE_PROFILE = "release";
    const started = start();
    proc.print(READY_LINE);
    await started;

    const [binary] = mocks.spawn.mock.calls[0];
    expect(path.dirname(binary)).toMatch(/target[\\/]release$/);
});

it("rejects and kills the engine on a payload missing a field", async () => {
    const started = start();
    proc.print('LEMMA_READY {"port":4100,"default_username":"local"}\n');

    await expect(started).rejects.toThrow("invalid ready payload");
    expect(proc.kill).toHaveBeenCalled();
    expect(serverUrl()).toBeNull();
});

it("rejects and kills the engine on an unparseable payload", async () => {
    const started = start();
    proc.print("LEMMA_READY {not json\n");

    await expect(started).rejects.toThrow(SyntaxError);
    expect(proc.kill).toHaveBeenCalled();
});

it("rejects and kills the engine when readiness takes over 10s", async () => {
    vi.useFakeTimers();
    const started = start();
    const outcome = expect(started).rejects.toThrow("within 10s");

    vi.advanceTimersByTime(9_999);
    expect(proc.kill).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);

    await outcome;
    expect(proc.kill).toHaveBeenCalled();
});

it("rejects when the engine exits before announcing readiness", async () => {
    const started = start();
    proc.emit("exit", 3);

    await expect(started).rejects.toThrow("exited before ready (code 3)");
});

it("allows a new start after the engine fails to spawn", async () => {
    const started = start();
    proc.emit("error", new Error("ENOENT"));
    await expect(started).rejects.toThrow("cannot start engine: ENOENT");

    proc = new FakeProcess();
    mocks.spawn.mockReturnValue(proc);
    const restarted = start();
    proc.print(READY_LINE);
    await expect(restarted).resolves.toMatchObject({ port: 4100 });
});

it("refuses a second start while the engine runs", async () => {
    const started = start();
    proc.print(READY_LINE);
    await started;

    await expect(start()).rejects.toThrow("engine already running");
});

it("closes stdin on stop and clears credentials once the engine exits", async () => {
    const started = start();
    proc.print(READY_LINE);
    await started;

    const stopped = stop();
    expect(proc.stdin.end).toHaveBeenCalled();
    proc.emit("exit", 0);
    await stopped;

    expect(serverUrl()).toBeNull();
});

it("kills the engine when it outlives the 3s stop grace period", async () => {
    vi.useFakeTimers();
    const started = start();
    proc.print(READY_LINE);
    await started;

    const stopped = stop();
    await vi.advanceTimersByTimeAsync(2_999);
    expect(proc.kill).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await stopped;

    expect(proc.kill).toHaveBeenCalled();
});
