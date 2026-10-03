import { create } from "zustand";

import type { User } from "@/gen/lemma/v1/auth_pb";
import { authClient } from "@/data/rpc/clients";
import { cookieAuth } from "@/platform/environment";
import {
    clearStoredUserId,
    clearTokens,
    getAccessToken,
    getRefreshToken,
    setStoredUserId,
    setTokens,
} from "@/data/credentials";

const cookieMode = cookieAuth();

interface AuthState {
    user: User | null;
    ready: boolean;
    bootstrap: () => Promise<void>;
    login: (identifier: string, password: string) => Promise<void>;
    signup: (
        username: string,
        email: string,
        password: string,
    ) => Promise<void>;
    logout: () => Promise<void>;
}

export const useAuth = create<AuthState>()((set) => ({
    user: null,
    ready: false,

    bootstrap: async () => {
        if (cookieMode) {
            clearTokens();
            try {
                const res = await authClient.me({});
                const user = res.user ?? null;
                if (user) setStoredUserId(user.id);
                set({ user });
            } catch {
                set({ user: null });
            }
        } else if (getAccessToken()) {
            // A stored token restores the session via me(); any failure
            // means the session is gone and the tokens are dropped.
            try {
                const res = await authClient.me({});
                const user = res.user ?? null;
                if (user) setStoredUserId(user.id);
                set({ user });
            } catch {
                clearTokens();
                clearStoredUserId();
            }
        }
        set({ ready: true });
    },

    login: async (identifier, password) => {
        // The login target is an email when it contains @, else a username.
        const req = identifier.includes("@")
            ? { email: identifier, password }
            : { username: identifier, password };
        const res = await authClient.login(req);
        if (!cookieMode) {
            if (!res.tokens) throw new Error("no tokens in response");
            setTokens(res.tokens.accessToken, res.tokens.refreshToken);
        }
        const user = res.user ?? null;
        if (user) setStoredUserId(user.id);
        set({ user });
    },

    signup: async (username, email, password) => {
        const res = await authClient.signUp({ username, email, password });
        if (!cookieMode) {
            if (!res.tokens) throw new Error("no tokens in response");
            setTokens(res.tokens.accessToken, res.tokens.refreshToken);
        }
        const user = res.user ?? null;
        if (user) setStoredUserId(user.id);
        set({ user });
    },

    logout: async () => {
        try {
            if (cookieMode) {
                await authClient.logout({});
            } else {
                const refreshToken = getRefreshToken();
                if (refreshToken) await authClient.logout({ refreshToken });
            }
        } catch {
            // Revoking the refresh token is best-effort: local logout must
            // succeed even when the server is unreachable.
        }
        clearTokens();
        clearStoredUserId();
        set({ user: null });
    },
}));
