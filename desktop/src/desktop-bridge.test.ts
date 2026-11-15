import { describe, expect, it } from "vitest";

import { isEngineRequest, isEngineResponse } from "./desktop-bridge";

describe("isEngineRequest", () => {
    it("accepts valid request and cancel messages", () => {
        expect(isEngineRequest({ type: "cancel", id: 1 })).toBe(true);
        expect(
            isEngineRequest({
                type: "request",
                id: 2,
                method: "POST",
                path: "/rpc",
                headers: [["content-type", "application/json"]],
                body: new Uint8Array(),
            }),
        ).toBe(true);
    });

    it("rejects malformed request messages", () => {
        expect(isEngineRequest(null)).toBe(false);
        expect(isEngineRequest("cancel")).toBe(false);
        expect(isEngineRequest({ type: "cancel" })).toBe(false);
        expect(isEngineRequest({ type: "cancel", id: "1" })).toBe(false);
        expect(isEngineRequest({ id: 1 })).toBe(false);
        expect(isEngineRequest({ type: "other", id: 1 })).toBe(false);
        expect(isEngineRequest({ type: "request", id: 1 })).toBe(false);
        expect(
            isEngineRequest({
                type: "request",
                id: 1,
                method: "POST",
                path: 123,
            }),
        ).toBe(false);
        expect(
            isEngineRequest({
                type: "request",
                id: 1,
                method: "POST",
                path: "/rpc",
                headers: [["only-one"]],
                body: new Uint8Array(),
            }),
        ).toBe(false);
        expect(
            isEngineRequest({
                type: "request",
                id: 1,
                method: "POST",
                path: "/rpc",
                headers: [["k", 1]],
                body: new Uint8Array(),
            }),
        ).toBe(false);
        expect(
            isEngineRequest({
                type: "request",
                id: 1,
                method: "POST",
                path: "/rpc",
                headers: [[1, "v"]],
                body: new Uint8Array(),
            }),
        ).toBe(false);
        expect(
            isEngineRequest({
                type: "request",
                id: 1,
                method: "POST",
                path: "/rpc",
                headers: ["bad"],
                body: new Uint8Array(),
            }),
        ).toBe(false);
        expect(
            isEngineRequest({
                type: "request",
                id: 1,
                method: "POST",
                path: "/rpc",
                headers: "bad",
                body: new Uint8Array(),
            }),
        ).toBe(false);
        expect(
            isEngineRequest({
                type: "request",
                id: 1,
                method: "POST",
                path: "/rpc",
                headers: [],
                body: "not-bytes",
            }),
        ).toBe(false);
    });
});

describe("isEngineResponse", () => {
    it("accepts valid head, chunk, end, and error messages", () => {
        expect(
            isEngineResponse({
                type: "head",
                id: 1,
                status: 200,
                headers: [["content-type", "application/json"]],
            }),
        ).toBe(true);
        expect(
            isEngineResponse({
                type: "chunk",
                id: 1,
                data: new Uint8Array([1]),
            }),
        ).toBe(true);
        expect(isEngineResponse({ type: "end", id: 1 })).toBe(true);
        expect(
            isEngineResponse({ type: "error", id: 1, reason: "failed" }),
        ).toBe(true);
    });

    it("rejects malformed response messages", () => {
        expect(isEngineResponse(null)).toBe(false);
        expect(isEngineResponse({ type: "end", id: "1" })).toBe(false);
        expect(isEngineResponse({ type: "unknown", id: 1 })).toBe(false);
        expect(
            isEngineResponse({
                type: "head",
                id: 1,
                status: "200",
                headers: [],
            }),
        ).toBe(false);
        expect(
            isEngineResponse({
                type: "head",
                id: 1,
                status: 200,
                headers: "bad",
            }),
        ).toBe(false);
        expect(isEngineResponse({ type: "chunk", id: 1, data: "bytes" })).toBe(
            false,
        );
        expect(isEngineResponse({ type: "error", id: 1, reason: 42 })).toBe(
            false,
        );
    });
});
