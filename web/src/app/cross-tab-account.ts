const USER_KEY = "lemma.user_id";

/**
 * Reloads this tab when another tab signs in as a different user. The
 * storage event only fires in tabs that did not make the change, so the
 * signing-in tab keeps running. The reload re-opens the per-user cache
 * database and drops all in-memory state of the previous account.
 */
export function installCrossTabGuard(): void {
    window.addEventListener("storage", (event) => {
        if (event.key !== USER_KEY) return;
        const prev = event.oldValue;
        const next = event.newValue;
        if (prev && next && prev !== next) window.location.reload();
    });
}
