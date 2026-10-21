import { create } from "zustand";

import {
    clearStoredUserId,
    clearTokens,
    getAccessToken,
    getRefreshToken,
    setStoredUserId,
    setTokens,
} from "@/data/credentials";
import { authClient } from "@/data/rpc/clients";
import type { AuthTokens, User } from "@/gen/lemma/v1/auth_pb";
import { getPlatform } from "@/platform";

const cookieMode = getPlatform().auth.cookieMode;

function openSession(res: {
    tokens?: AuthTokens | undefined;
    user?: User | undefined;
}): User | null {
    if (!cookieMode) {
        if (res.tokens === undefined) {
            throw new Error("no tokens in response");
        }
        setTokens(res.tokens.accessToken, res.tokens.refreshToken);
    }
    const user = res.user ?? null;
    if (user !== null) {
        setStoredUserId(user.id);
    }
    return user;
}

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
                if (user !== null) {
                    setStoredUserId(user.id);
                }
                set({ user });
            } catch {
                set({ user: null });
            }
        } else if (getAccessToken() !== null) {
            try {
                const res = await authClient.me({});
                const user = res.user ?? null;
                if (user !== null) {
                    setStoredUserId(user.id);
                }
                set({ user });
            } catch {
                clearTokens();
                clearStoredUserId();
            }
        }
        set({ ready: true });
    },

    login: async (identifier, password) => {
        const res = await authClient.login({ login: identifier, password });
        set({ user: openSession(res) });
    },

    signup: async (username, email, password) => {
        const res = await authClient.signUp({ username, email, password });
        set({ user: openSession(res) });
    },

    logout: async () => {
        const refreshToken = getRefreshToken();
        const request = cookieMode
            ? authClient.logout({})
            : refreshToken === null
              ? null
              : authClient.logout({ refreshToken });
        await request?.catch(() => {});
        clearTokens();
        clearStoredUserId();
        set({ user: null });
    },
}));
