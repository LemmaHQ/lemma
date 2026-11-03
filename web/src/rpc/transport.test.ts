import { Code, ConnectError } from "@connectrpc/connect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface Call {
    path: string;
    authorization: string | null;
    body: unknown;
}

type Route = () => Response;

const json = (status: number, body: unknown): Response =>
    new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
    });

const unauthenticated = (): Response =>
    json(401, { code: "unauthenticated", message: "token expired" });

let calls: Call[];
let routes: Map<string, Route[]>;

const route = (path: string, ...responses: Route[]): void => {
    routes.set(path, responses);
};

const fakeFetch = async (
    input: string,
    init?: RequestInit,
): Promise<Response> => {
    const path = new URL(input, "http://localhost").pathname;
    const text = await new Response(init?.body).text();
    const body: unknown = JSON.parse(text === "" ? "{}" : text);
    calls.push({
        path,
        authorization: new Headers(init?.headers).get("Authorization"),
        body,
    });
    const next = routes.get(path)?.shift();
    if (next === undefined) {
        throw new Error(`unexpected request ${path}`);
    }
    return next();
};

const loadClients = async () => {
    vi.resetModules();
    const { authClient, systemClient } = await import("./clients");
    return { system: systemClient, auth: authClient };
};

const VERSION = "/lemma.v1.SystemService/GetVersion";
const REFRESH = "/lemma.v1.AuthService/Refresh";
const LOGIN = "/lemma.v1.AuthService/Login";

beforeEach(() => {
    calls = [];
    routes = new Map();
    window.history.replaceState(null, "", "/");
    localStorage.clear();
    vi.stubGlobal("fetch", vi.fn(fakeFetch));
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe("with bearer tokens on another origin", () => {
    beforeEach(() => {
        localStorage.setItem("lemma.serverUrl", "https://api.example.com");
    });

    it("sends the stored access token as a bearer", async () => {
        localStorage.setItem("lemma.access_token", "a1");
        route(VERSION, () => json(200, { version: "1.2.0" }));
        const { system } = await loadClients();

        const res = await system.getVersion({});

        expect(res.version).toBe("1.2.0");
        expect(calls).toEqual([
            { path: VERSION, authorization: "Bearer a1", body: {} },
        ]);
    });

    it("sends no bearer without a stored access token", async () => {
        localStorage.setItem("lemma.access_token", "");
        route(VERSION, () => json(200, { version: "1.2.0" }));
        const { system } = await loadClients();

        await system.getVersion({});

        expect(calls[0]?.authorization).toBeNull();
    });

    it("refreshes an expired token once and retries with the new one", async () => {
        localStorage.setItem("lemma.access_token", "a1");
        localStorage.setItem("lemma.refresh_token", "r1");
        route(
            VERSION,
            unauthenticated,
            unauthenticated,
            () => json(200, { version: "1" }),
            () => json(200, { version: "2" }),
        );
        route(REFRESH, () =>
            json(200, { tokens: { accessToken: "a2", refreshToken: "r2" } }),
        );
        const { system } = await loadClients();

        const results = await Promise.all([
            system.getVersion({}),
            system.getVersion({}),
        ]);

        expect(results.map((r) => r.version).toSorted()).toEqual(["1", "2"]);
        expect(calls.filter((c) => c.path === REFRESH)).toEqual([
            {
                path: REFRESH,
                authorization: null,
                body: { refreshToken: "r1" },
            },
        ]);
        expect(calls.slice(-2).map((c) => c.authorization)).toEqual([
            "Bearer a2",
            "Bearer a2",
        ]);
        expect(localStorage.getItem("lemma.refresh_token")).toBe("r2");
    });

    it.each([
        ["no refresh token is stored", () => {}],
        [
            "the stored refresh token is empty",
            () => {
                localStorage.setItem("lemma.refresh_token", "");
            },
        ],
    ])(
        "signs out without asking the server when %s",
        async (_case, storeRefreshToken) => {
            localStorage.setItem("lemma.access_token", "a1");
            storeRefreshToken();
            route(VERSION, unauthenticated);
            const { system } = await loadClients();

            await expect(system.getVersion({})).rejects.toMatchObject({
                code: Code.Unauthenticated,
            });

            expect(calls.map((c) => c.path)).toEqual([VERSION]);
            expect(localStorage.getItem("lemma.access_token")).toBeNull();
            expect(window.location.pathname).toBe("/signin");
        },
    );

    it.each([
        ["answers without tokens", () => json(200, {})],
        ["rejects the refresh token", unauthenticated],
    ])("signs out when the refresh %s", async (_case, refreshResponse) => {
        localStorage.setItem("lemma.access_token", "a1");
        localStorage.setItem("lemma.refresh_token", "r1");
        route(VERSION, unauthenticated);
        route(REFRESH, refreshResponse);
        const { system } = await loadClients();

        await expect(system.getVersion({})).rejects.toBeInstanceOf(
            ConnectError,
        );

        expect(localStorage.getItem("lemma.refresh_token")).toBeNull();
        expect(window.location.pathname).toBe("/signin");
    });

    it("passes an auth service failure through without refreshing", async () => {
        localStorage.setItem("lemma.refresh_token", "r1");
        route(LOGIN, unauthenticated);
        const { auth } = await loadClients();

        await expect(
            auth.login({ login: "lemma", password: "wrong" }),
        ).rejects.toMatchObject({ code: Code.Unauthenticated });

        expect(calls.map((c) => c.path)).toEqual([LOGIN]);
        expect(window.location.pathname).toBe("/");
    });

    it("passes other failures through without refreshing", async () => {
        route(VERSION, () =>
            json(503, { code: "unavailable", message: "down" }),
        );
        const { system } = await loadClients();

        await expect(system.getVersion({})).rejects.toMatchObject({
            code: Code.Unavailable,
        });

        expect(calls.map((c) => c.path)).toEqual([VERSION]);
    });
});

describe("in cookie mode on the same origin", () => {
    it("refreshes the auth cookies and retries without a bearer", async () => {
        localStorage.setItem("lemma.access_token", "stale");
        route(VERSION, unauthenticated, () => json(200, { version: "3" }));
        route(REFRESH, () => json(200, {}));
        const { system } = await loadClients();

        const res = await system.getVersion({});

        expect(res.version).toBe("3");
        expect(calls).toEqual([
            { path: VERSION, authorization: null, body: {} },
            { path: REFRESH, authorization: null, body: {} },
            { path: VERSION, authorization: null, body: {} },
        ]);
    });

    it("signs out but keeps stored tokens when the auth cookies cannot refresh", async () => {
        localStorage.setItem("lemma.access_token", "stale");
        route(VERSION, unauthenticated);
        route(REFRESH, unauthenticated);
        const { system } = await loadClients();

        await expect(system.getVersion({})).rejects.toBeInstanceOf(
            ConnectError,
        );

        expect(localStorage.getItem("lemma.access_token")).toBe("stale");
        expect(window.location.pathname).toBe("/signin");
    });
});
