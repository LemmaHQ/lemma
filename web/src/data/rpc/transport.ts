import type { Interceptor } from "@connectrpc/connect";
import { Code, ConnectError, createClient } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-web";

import { AuthService } from "@/gen/lemma/v1/auth_pb";
import { appPath, resolveBaseUrl, cookieAuth } from "@/platform/environment";
import {
    clearTokens,
    getAccessToken,
    getRefreshToken,
    setTokens,
} from "@/data/credentials";

const cookieMode = cookieAuth();

const bareTransport = createConnectTransport({ baseUrl: resolveBaseUrl() });

async function doRefresh(): Promise<boolean> {
    const auth = createClient(AuthService, bareTransport);
    try {
        if (cookieMode) {
            await auth.refresh({});
            return true;
        }
        const refreshToken = getRefreshToken();
        if (!refreshToken) {
            return false;
        }
        const res = await auth.refresh({ refreshToken });
        if (!res.tokens) {
            return false;
        }
        setTokens(res.tokens.accessToken, res.tokens.refreshToken);
        return true;
    } catch {
        return false;
    }
}

let refreshPromise: Promise<boolean> | null = null;

function tryRefresh(): Promise<boolean> {
    refreshPromise ??= doRefresh().finally(() => {
        refreshPromise = null;
    });
    return refreshPromise;
}

const authInterceptor: Interceptor = (next) => async (req) => {
    if (!cookieMode) {
        const token = getAccessToken();
        if (token) {
            req.header.set("Authorization", `Bearer ${token}`);
        }
    }
    try {
        return await next(req);
    } catch (e) {
        if (
            !(e instanceof ConnectError) ||
            e.code !== Code.Unauthenticated ||
            req.url.includes("AuthService/")
        ) {
            throw e;
        }
        if (!(await tryRefresh())) {
            if (!cookieMode) {
                clearTokens();
            }
            window.location.href = appPath("/login");
            throw e;
        }
        if (!cookieMode) {
            const fresh = getAccessToken();
            if (fresh) {
                req.header.set("Authorization", `Bearer ${fresh}`);
            }
        }
        return await next(req);
    }
};

export const transport = createConnectTransport({
    baseUrl: resolveBaseUrl(),
    interceptors: [authInterceptor],
});
