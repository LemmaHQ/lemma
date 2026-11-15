import { describe, expect, it } from "vitest";

import { isHostCommand, isHostEvent } from "./engine-host-protocol";

describe("isHostCommand", () => {
    it("accepts connect and stop commands", () => {
        expect(isHostCommand({ type: "connect" })).toBe(true);
        expect(isHostCommand({ type: "stop" })).toBe(true);
    });

    it("rejects non-objects, missing types, and unknown commands", () => {
        expect(isHostCommand(null)).toBe(false);
        expect(isHostCommand("connect")).toBe(false);
        expect(isHostCommand({})).toBe(false);
        expect(isHostCommand({ type: "restart" })).toBe(false);
    });
});

describe("isHostEvent", () => {
    it("accepts ready and failed events with string reasons", () => {
        expect(isHostEvent({ type: "ready" })).toBe(true);
        expect(isHostEvent({ type: "failed", reason: "locked" })).toBe(true);
    });

    it("rejects non-objects, malformed failed events, and unknown events", () => {
        expect(isHostEvent(null)).toBe(false);
        expect(isHostEvent("ready")).toBe(false);
        expect(isHostEvent({})).toBe(false);
        expect(isHostEvent({ type: "failed" })).toBe(false);
        expect(isHostEvent({ type: "failed", reason: 1 })).toBe(false);
        expect(isHostEvent({ type: "other" })).toBe(false);
    });
});
