import { create } from "@bufbuild/protobuf";
import { SidebarProvider } from "@lemma/ui";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, expect, it, vi } from "vitest";

import { UserSchema } from "@/gen/lemma/v1/auth_pb";

import { useAuth } from "../store";
import { AccountMenu } from "./AccountMenu";

const rpc = vi.hoisted(() => ({
    logout: vi.fn<(req: object) => Promise<object>>(),
}));

vi.mock("@/platform/platform", () => ({
    getPlatform: () => ({ auth: { cookieMode: true } }),
}));

vi.mock("@/rpc/clients", () => ({ authClient: rpc }));

const renderMenu = () =>
    render(
        <MemoryRouter initialEntries={["/"]}>
            <SidebarProvider
                open
                onOpenChange={() => {}}
                width={null}
                onWidthChange={() => {}}
            >
                <Routes>
                    <Route
                        path="/"
                        element={<AccountMenu settingsPath="/settings" />}
                    />
                    <Route path="/settings" element={<p>Settings page</p>} />
                </Routes>
            </SidebarProvider>
        </MemoryRouter>,
    );

beforeEach(() => {
    vi.resetAllMocks();
    rpc.logout.mockResolvedValue({});
    useAuth.setState({
        user: create(UserSchema, { id: "u1", username: "alice" }),
    });
});

it("opens the app settings from the account menu", async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByRole("button", { name: /alice/u }));
    await user.click(
        await screen.findByRole("menuitem", { name: "App settings" }),
    );

    expect(await screen.findByText("Settings page")).toBeDefined();
});

it("signs out from the account menu", async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByRole("button", { name: /alice/u }));
    await user.click(await screen.findByRole("menuitem", { name: "Sign out" }));

    await vi.waitFor(() => {
        expect(useAuth.getState().user).toBeNull();
    });
    expect(rpc.logout).toHaveBeenCalledWith({});
});
