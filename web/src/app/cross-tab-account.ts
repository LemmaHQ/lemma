const USER_KEY = "lemma.user_id";

export function installCrossTabGuard(): void {
    window.addEventListener("storage", (event) => {
        if (event.key !== USER_KEY) {
            return;
        }
        const prev = event.oldValue;
        const next = event.newValue;
        if (prev && next && prev !== next) {
            window.location.reload();
        }
    });
}
