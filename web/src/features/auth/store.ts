import { create } from "zustand";

import {
    clearStoredUserId,
    clearTokens,
    getAccessToken,
    getRefreshToken,
    setStoredUserId,
    setTokens,
} from "@/rpc/credentials";
import { authClient } from "@/rpc/clients";
import { errorReason } from "@/rpc/errors";
import type { AuthTokens, User } from "@/gen/lemma/v1/auth_pb";
import { ErrorReason } from "@/gen/lemma/v1/errors_pb";
import { getPlatform } from "@/platform/platform";

const cookieMode = getPlatform().auth.cookieMode;

function storeAuth(res: {
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
    checkAccount: (login: string) => Promise<boolean>;
    login: (identifier: string, password: string) => Promise<void>;
    signup: (
        username: string,
        email: string,
        password: string,
    ) => Promise<void>;
    logout: () => Promise<void>;
}

let authRestored: Promise<void> | undefined;

export const useAuth = create<AuthState>()((set) => ({
    user: null,

    checkAccount: async (login) => {
        return (await authClient.checkAccount({ login })).exists;
    },

    login: async (identifier, password) => {
        const res = await authClient.login({ login: identifier, password });
        set({ user: storeAuth(res) });
    },

    signup: async (username, email, password) => {
        const res = await authClient.signUp({ username, email, password });
        set({ user: storeAuth(res) });
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

/** Resolves once the stored credentials have been checked and `user` holds its result; the first call starts the check. */
export function ensureAuthReady(): Promise<void> {
    authRestored ??= restoreAuth();
    return authRestored;
}

async function restoreAuth(): Promise<void> {
    if (cookieMode) {
        clearTokens();
        try {
            const res = await authClient.me({});
            const user = res.user ?? null;
            if (user !== null) {
                setStoredUserId(user.id);
            }
            useAuth.setState({ user });
        } catch {
            useAuth.setState({ user: null });
        }
    } else if (getAccessToken() !== null) {
        try {
            const res = await authClient.me({});
            const user = res.user ?? null;
            if (user !== null) {
                setStoredUserId(user.id);
            }
            useAuth.setState({ user });
        } catch {
            clearTokens();
            clearStoredUserId();
        }
    }
}

/** The sign-up field whose value the server rejected as taken, from a failed `signup`; `null` for any other failure. */
export function takenSignUpField(error: unknown): "username" | "email" | null {
    switch (errorReason(error)) {
        case ErrorReason.USERNAME_TAKEN:
            return "username";
        case ErrorReason.EMAIL_TAKEN:
            return "email";
        default:
            return null;
    }
}
