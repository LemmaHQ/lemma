import { afterEach, expect, it, vi } from "vitest";

import { agentClient, providerClient, sessionClient } from "./clients";

afterEach(() => {
    vi.unstubAllGlobals();
});

it("wires every service client to the platform transport", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(() =>
        Promise.resolve(
            new Response(JSON.stringify({ sessions: [] }), {
                status: 200,
                headers: { "content-type": "application/json" },
            }),
        ),
    );
    vi.stubGlobal("fetch", fetch);

    expect(agentClient).toBeDefined();
    expect(providerClient).toBeDefined();
    expect(sessionClient).toBeDefined();
    await expect(sessionClient.listSessions({})).resolves.toMatchObject({
        sessions: [],
    });
    expect(fetch).toHaveBeenCalledOnce();
});
