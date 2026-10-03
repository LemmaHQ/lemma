const ACCESS_KEY = "lemma.access_token";
const REFRESH_KEY = "lemma.refresh_token";
const USER_KEY = "lemma.user_id";

export function getAccessToken(): string | null {
    return localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_KEY);
}

export function setTokens(accessToken: string, refreshToken: string): void {
    localStorage.setItem(ACCESS_KEY, accessToken);
    localStorage.setItem(REFRESH_KEY, refreshToken);
}

export function clearTokens(): void {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
}

export function setStoredUserId(userId: string): void {
    localStorage.setItem(USER_KEY, userId);
}

export function clearStoredUserId(): void {
    localStorage.removeItem(USER_KEY);
}
