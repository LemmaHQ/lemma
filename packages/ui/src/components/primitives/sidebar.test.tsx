import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Window as HappyWindow } from "happy-dom";
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { useSidebar } from "#hooks/use-sidebar";

import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarInset,
    SidebarProvider,
    SidebarTrigger,
} from "./sidebar";
import {
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuAction,
    SidebarMenuButton,
    SidebarMenuItem,
} from "./sidebar-menu";

const setViewportWidth = (width: number) => {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- vitest's happy-dom environment adds the happyDOM API to window without typing it
    (window as unknown as HappyWindow).happyDOM.setViewport({ width });
};

function Orphan() {
    useSidebar();
    return null;
}

function Shell() {
    const [open, setOpen] = useState(true);
    return (
        <SidebarProvider open={open} onOpenChange={setOpen}>
            <Sidebar label="Sidebar">
                <SidebarHeader>Lemma</SidebarHeader>
                <SidebarContent>
                    <SidebarGroup>
                        <SidebarGroupLabel>Today</SidebarGroupLabel>
                        <SidebarGroupContent>
                            <SidebarMenu>
                                <SidebarMenuItem>
                                    <SidebarMenuButton isActive size="sm">
                                        Trip plans
                                    </SidebarMenuButton>
                                    <SidebarMenuAction
                                        showOnHover
                                        aria-label="More actions"
                                    />
                                </SidebarMenuItem>
                                <SidebarMenuItem>
                                    <SidebarMenuButton
                                        render={({ children, ...props }) => (
                                            <a href="/budget" {...props}>
                                                {children}
                                            </a>
                                        )}
                                    >
                                        Budget
                                    </SidebarMenuButton>
                                    <SidebarMenuAction aria-label="Pin" />
                                </SidebarMenuItem>
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                </SidebarContent>
                <SidebarFooter>alice</SidebarFooter>
            </Sidebar>
            <SidebarInset>
                <SidebarTrigger aria-label="Toggle sidebar" />
            </SidebarInset>
        </SidebarProvider>
    );
}

const sidebarState = () =>
    document.querySelector<HTMLElement>("[data-slot=sidebar]")?.dataset.state;

afterEach(() => {
    vi.restoreAllMocks();
    setViewportWidth(1024);
});

it("lays out its sections with the active entry marked", () => {
    render(<Shell />);

    expect(screen.getByText("Lemma")).toBeDefined();
    expect(screen.getByText("Today")).toBeDefined();
    expect(
        screen.getByRole("button", { name: "Trip plans" }).dataset.active,
    ).toBe("");
    expect(screen.getByRole("link", { name: "Budget" }).dataset.active).toBe(
        undefined,
    );
    expect(screen.getByRole("button", { name: "More actions" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Pin" })).toBeDefined();
    expect(screen.getByRole("main").textContent).toBe("");
});

it("collapses and expands from the trigger and Ctrl or Cmd+B", async () => {
    const user = userEvent.setup();
    render(<Shell />);
    expect(sidebarState()).toBe("expanded");

    await user.click(screen.getByRole("button", { name: "Toggle sidebar" }));
    expect(sidebarState()).toBe("collapsed");

    await user.keyboard("{Control>}b{/Control}");
    expect(sidebarState()).toBe("expanded");

    await user.keyboard("{Meta>}b{/Meta}");
    expect(sidebarState()).toBe("collapsed");

    await user.keyboard("b{Control>}k{/Control}");
    expect(sidebarState()).toBe("collapsed");
});

it("becomes a sheet on a narrow window", async () => {
    const user = userEvent.setup();
    setViewportWidth(500);
    render(<Shell />);
    expect(screen.queryByRole("dialog")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Toggle sidebar" }));
    const sheet = await screen.findByRole("dialog", { name: "Sidebar" });
    expect(sheet.textContent).toContain("Trip plans");

    await user.keyboard("{Control>}b{/Control}");
    await waitFor(() => {
        expect(screen.queryByRole("dialog")).toBeNull();
    });
});

it("requires a provider for its state", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => render(<Orphan />)).toThrow(
        "useSidebar must be used within a SidebarProvider.",
    );
});
