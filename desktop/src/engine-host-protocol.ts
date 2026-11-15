/** Messages the main process posts to the engine process. */
export type HostCommand = { type: "connect" } | { type: "stop" };

/** Messages the engine process posts to the main process. */
export type HostEvent = { type: "ready" } | { type: "failed"; reason: string };

/** Returns whether `value` is a valid {@link HostCommand}. */
export const isHostCommand = (value: unknown): value is HostCommand =>
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    (value.type === "connect" || value.type === "stop");

/** Returns whether `value` is a valid {@link HostEvent}. */
export const isHostEvent = (value: unknown): value is HostEvent => {
    if (typeof value !== "object" || value === null || !("type" in value)) {
        return false;
    }
    if (value.type === "failed") {
        return "reason" in value && typeof value.reason === "string";
    }
    return value.type === "ready";
};
