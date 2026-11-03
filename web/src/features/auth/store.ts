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
    checkAccount: (identifier: string) => Promise<boolean>;
    signIn: (identifier: string, password: string) => Promise<void>;
    signUp: (
        username: string,
        email: string,
        password: string,
    ) => Promise<void>;
    signOut: () => Promise<void>;
}

let authRestored: Promise<void> | undefined;

export const useAuth = create<AuthState>()((set) => ({
    user: null,

    checkAccount: async (identifier) => {
        return (await authClient.checkAccount({ identifier })).exists;
    },

    signIn: async (identifier, password) => {
        const res = await authClient.signIn({ identifier, password });
        set({ user: storeAuth(res) });
    },

    signUp: async (username, email, password) => {
        const res = await authClient.signUp({ username, email, password });
        set({ user: storeAuth(res) });
    },

    signOut: async () => {
        const refreshToken = getRefreshToken();
        const request = cookieMode
            ? authClient.signOut({})
            : refreshToken === null
              ? null
              : authClient.signOut({ refreshToken });
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
