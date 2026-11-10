import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

import { VersionTags } from "./VersionTags";

const mocks = vi.hoisted(() => ({
    getVersion: vi.fn<() => Promise<{ version: string }>>(),
    clientVersion: null as string | null,
}));

vi.mock("@/rpc/clients", () => ({
    systemClient: { getVersion: mocks.getVersion },
}));

vi.mock("@/platform/platform", () => ({
    getPlatform: () => ({ clientVersion: mocks.clientVersion }),
}));

beforeEach(() => {
    mocks.getVersion.mockReset();
    mocks.clientVersion = null;
});

it("shows the server version in the browser", async () => {
    mocks.getVersion.mockResolvedValue({ version: "0.4.0" });

    render(<VersionTags />);

    expect(await screen.findByText("Server v0.4.0")).toBeDefined();
    expect(screen.queryByText(/^Client/u)).toBeNull();
});

it("shows only the client version when the server is unreachable", async () => {
    mocks.clientVersion = "1.2.0";
    const failed = Promise.withResolvers<never>();
    mocks.getVersion.mockReturnValue(failed.promise);

    render(<VersionTags />);
    failed.reject(new Error("offline"));

    expect(await screen.findByText("Client v1.2.0")).toBeDefined();
    await vi.waitFor(() => {
        expect(mocks.getVersion).toHaveBeenCalledOnce();
    });
    expect(screen.queryByText(/^Server/u)).toBeNull();
});
