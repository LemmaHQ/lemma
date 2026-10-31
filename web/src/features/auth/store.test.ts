import { create } from "@bufbuild/protobuf";
import { Code, ConnectError } from "@connectrpc/connect";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
    type AuthTokens,
    AuthTokensSchema,
    type User,
    UserSchema,
} from "@/gen/lemma/v1/auth_pb";
import { ErrorInfoSchema, ErrorReason } from "@/gen/lemma/v1/errors_pb";

type Session = {
    tokens?: AuthTokens | undefined;
    user?: User | undefined;
};

type AuthActions = {
    login: (identifier: string, password: string) => Promise<void>;
    signup: (
        username: string,
        email: string,
        password: string,
    ) => Promise<void>;
};

const env = vi.hoisted(() => ({ cookieMode: false }));

const rpc = vi.hoisted(() => ({
    checkAccount:
        vi.fn<(req: { login: string }) => Promise<{ exists: boolean }>>(),
    login: vi.fn<
        (req: { login: string; password: string }) => Promise<Session>
    >(),
    signUp: vi.fn<
        (req: {
            username: string;
            email: string;
            password: string;
        }) => Promise<Session>
    >(),
    logout: vi.fn<(req: { refreshToken?: string }) => Promise<unknown>>(),
    me: vi.fn<(req: object) => Promise<Session>>(),
}));

vi.mock("@/platform/platform", () => ({
    getPlatform: () => ({ auth: { cookieMode: env.cookieMode } }),
}));

vi.mock("@/rpc/clients", () => ({ authClient: rpc }));

function tokens() {
    return create(AuthTokensSchema, {
        accessToken: "access",
        refreshToken: "refresh",
    });
}

function user() {
    return create(UserSchema, { id: "u1", username: "alice" });
}

const loadStore = (cookieMode: boolean) => {
    env.cookieMode = cookieMode;
    vi.resetModules();
    return import("./store");
};

const stored = () => ({
    access: localStorage.getItem("lemma.access_token"),
    refresh: localStorage.getItem("lemma.refresh_token"),
    userId: localStorage.getItem("lemma.user_id"),
});

const withReason = (reason: ErrorReason) =>
    new ConnectError("taken", Code.AlreadyExists, undefined, [
        { desc: ErrorInfoSchema, value: { reason } },
    ]);

beforeEach(() => {
    localStorage.clear();
    vi.resetAllMocks();
});

describe("with bearer tokens", () => {
    it("reports whether an account exists", async () => {
        const { useAuth } = await loadStore(false);
        rpc.checkAccount.mockResolvedValue({ exists: true });

        await expect(useAuth.getState().checkAccount("alice")).resolves.toBe(
            true,
        );
        expect(rpc.checkAccount).toHaveBeenCalledWith({ login: "alice" });
    });

    it.each<[string, (auth: AuthActions) => Promise<void>]>([
        ["signs in", (auth) => auth.login("alice", "pw")],
        ["signs up", (auth) => auth.signup("alice", "a@x.io", "pw")],
    ])("stores the session when it %s", async (_case, act) => {
        const { useAuth } = await loadStore(false);
        rpc.login.mockResolvedValue({ tokens: tokens(), user: user() });
        rpc.signUp.mockResolvedValue({ tokens: tokens(), user: user() });

        await act(useAuth.getState());

        expect(useAuth.getState().user?.username).toBe("alice");
        expect(stored()).toEqual({
            access: "access",
            refresh: "refresh",
            userId: "u1",
        });
    });

    it("rejects a session without tokens", async () => {
        const { useAuth } = await loadStore(false);
        rpc.login.mockResolvedValue({ user: user() });

        await expect(useAuth.getState().login("alice", "pw")).rejects.toThrow(
            "no tokens in response",
        );
        expect(useAuth.getState().user).toBeNull();
        expect(stored().userId).toBeNull();
    });

    it("stays signed out when the session names no user", async () => {
        const { useAuth } = await loadStore(false);
        rpc.login.mockResolvedValue({ tokens: tokens() });

        await useAuth.getState().login("alice", "pw");

        expect(useAuth.getState().user).toBeNull();
        expect(stored().userId).toBeNull();
    });

    it("revokes the refresh token and forgets the session on sign-out", async () => {
        const { useAuth } = await loadStore(false);
        rpc.login.mockResolvedValue({ tokens: tokens(), user: user() });
        rpc.logout.mockRejectedValue(new Error("offline"));
        await useAuth.getState().login("alice", "pw");

        await useAuth.getState().logout();

        expect(rpc.logout).toHaveBeenCalledWith({ refreshToken: "refresh" });
        expect(useAuth.getState().user).toBeNull();
        expect(stored()).toEqual({ access: null, refresh: null, userId: null });
    });

    it("signs out locally without a refresh token", async () => {
        const { useAuth } = await loadStore(false);

        await useAuth.getState().logout();

        expect(rpc.logout).not.toHaveBeenCalled();
    });

    it("skips the session check without a stored access token", async () => {
        const { ensureAuthReady, useAuth } = await loadStore(false);

        await ensureAuthReady();

        expect(rpc.me).not.toHaveBeenCalled();
        expect(useAuth.getState().user).toBeNull();
    });

    it("restores the stored session once", async () => {
        localStorage.setItem("lemma.access_token", "access");
        const { ensureAuthReady, useAuth } = await loadStore(false);
        rpc.me.mockResolvedValue({ user: user() });

        await Promise.all([ensureAuthReady(), ensureAuthReady()]);

        expect(rpc.me).toHaveBeenCalledOnce();
        expect(useAuth.getState().user?.id).toBe("u1");
        expect(stored().userId).toBe("u1");
    });

    it("keeps no user when the session check names none", async () => {
        localStorage.setItem("lemma.access_token", "access");
        const { ensureAuthReady, useAuth } = await loadStore(false);
        rpc.me.mockResolvedValue({});

        await ensureAuthReady();

        expect(useAuth.getState().user).toBeNull();
        expect(stored().userId).toBeNull();
    });

    it("drops stored credentials the server rejects", async () => {
        localStorage.setItem("lemma.access_token", "access");
        localStorage.setItem("lemma.user_id", "u1");
        const { ensureAuthReady } = await loadStore(false);
        rpc.me.mockRejectedValue(new ConnectError("expired"));

        await ensureAuthReady();

        expect(stored()).toEqual({ access: null, refresh: null, userId: null });
    });
});

describe("with session cookies", () => {
    it("keeps no tokens and ends the cookie session on sign-out", async () => {
        const { useAuth } = await loadStore(true);
        rpc.login.mockResolvedValue({ user: user() });

        await useAuth.getState().login("alice", "pw");
        await useAuth.getState().logout();

        expect(rpc.logout).toHaveBeenCalledWith({});
        expect(stored()).toEqual({ access: null, refresh: null, userId: null });
    });

    it("restores the cookie session and discards leftover tokens", async () => {
        localStorage.setItem("lemma.access_token", "stale");
        const { ensureAuthReady, useAuth } = await loadStore(true);
        rpc.me.mockResolvedValue({ user: user() });

        await ensureAuthReady();

        expect(useAuth.getState().user?.id).toBe("u1");
        expect(stored()).toEqual({ access: null, refresh: null, userId: "u1" });
    });

    it.each([
        ["names no user", () => rpc.me.mockResolvedValue({})],
        [
            "fails",
            () => rpc.me.mockRejectedValue(new ConnectError("no session")),
        ],
    ])("stays signed out when the session check %s", async (_case, answer) => {
        const { ensureAuthReady, useAuth } = await loadStore(true);
        answer();

        await ensureAuthReady();

        expect(useAuth.getState().user).toBeNull();
        expect(stored().userId).toBeNull();
    });
});

describe("takenSignUpField", () => {
    it.each([
        [withReason(ErrorReason.USERNAME_TAKEN), "username"],
        [withReason(ErrorReason.EMAIL_TAKEN), "email"],
        [withReason(ErrorReason.SIGNUP_FIELDS_REQUIRED), null],
        [new Error("offline"), null],
    ])("names the field a failure rejected", async (error, field) => {
        const { takenSignUpField } = await loadStore(false);

        expect(takenSignUpField(error)).toBe(field);
    });
});
