import { expect, it, vi } from "vitest";

import { loadServerVersion } from "./store";

const getVersion = vi.hoisted(() =>
    vi.fn<() => Promise<{ version: string }>>(),
);

vi.mock("@/rpc/clients", () => ({
    systemClient: { getVersion },
}));

it("reports no version when the server is unreachable", async () => {
    getVersion.mockRejectedValue(new Error("offline"));

    expect(await loadServerVersion()).toBeNull();
});
