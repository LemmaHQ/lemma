/** Values the sign-up form starts with. */
export interface SignUpPrefill {
    username?: string;
    email?: string;
}

/** The prefill for an account sign-in did not find: an email when `identifier` contains `@`, else a username. */
export function prefillFromIdentifier(identifier: string): SignUpPrefill {
    return identifier.includes("@")
        ? { email: identifier }
        : { username: identifier };
}

/** The prefill carried in navigation `state`; empty when `state` holds none. */
export function readSignUpPrefill(state: unknown): SignUpPrefill {
    if (typeof state !== "object" || state === null) {
        return {};
    }
    if ("username" in state && typeof state.username === "string") {
        return { username: state.username };
    }
    if ("email" in state && typeof state.email === "string") {
        return { email: state.email };
    }
    return {};
}
