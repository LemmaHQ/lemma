import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import { VersionTags } from "./VersionTags";

const getVersion = vi.hoisted(() =>
    vi.fn<() => Promise<{ version: string }>>(),
);

vi.mock("@/rpc/clients", () => ({
    systemClient: { getVersion },
}));

it("shows the server version", async () => {
    getVersion.mockResolvedValue({ version: "0.4.0" });

    render(<VersionTags />);

    expect(await screen.findByText("Server v0.4.0")).toBeDefined();
});
