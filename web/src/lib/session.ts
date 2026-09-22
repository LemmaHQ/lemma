const ACCESS_KEY = "lemma.access_token";

// Decodes the JWT payload without verifying the signature; used only to
// tell which user a token belongs to, never for authorization.
function userIdOf(token: string): string | null {
    try {
        const raw = token.split(".")[1] ?? "";
        const b64 = raw.replace(/-/g, "+").replace(/_/g, "/");
        const payload = JSON.parse(
            atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4)),
        ) as { sub?: string };
        return payload.sub ?? null;
    } catch {
        return null;
    }
}

/**
 * Reloads this tab when another tab signs in as a different user. The
 * storage event only fires in tabs that did not make the change, so the
 * signing-in tab keeps running. The reload re-opens the per-user cache
 * database and drops all in-memory state of the previous account.
 */
export function installCrossTabGuard(): void {
    window.addEventListener("storage", (event) => {
        if (event.key !== ACCESS_KEY) return;
        const prev = event.oldValue ? userIdOf(event.oldValue) : null;
        const next = event.newValue ? userIdOf(event.newValue) : null;
        if (prev && next && prev !== next) window.location.reload();
    });
}
