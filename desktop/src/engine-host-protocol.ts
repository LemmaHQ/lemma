/** Messages the main process posts to the engine process. */
export type HostCommand = { type: "connect" } | { type: "stop" };

/** Messages the engine process posts to the main process. */
export type HostEvent = { type: "ready" } | { type: "failed"; reason: string };
