import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Window as HappyWindow } from "happy-dom";
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { useSidebar } from "#hooks/use-sidebar";

import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarInput,
    SidebarInset,
    SidebarMenu,
    SidebarMenuAction,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarProvider,
    SidebarRail,
    SidebarTrigger,
} from "./sidebar";

const setViewportWidth = (width: number) => {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- vitest's happy-dom environment adds the happyDOM API to window without typing it
    (window as unknown as HappyWindow).happyDOM.setViewport({ width });
};

const ignoreWidth = () => {};

function Orphan() {
    useSidebar();
    return null;
}

function Shell({
    initialWidth = null,
    onWidthChange = ignoreWidth,
}: {
    initialWidth?: number | null;
    onWidthChange?: (width: number | null) => void;
}) {
    const [open, setOpen] = useState(true);
    const [width, setWidth] = useState(initialWidth);
    return (
        <SidebarProvider
            open={open}
            onOpenChange={setOpen}
            width={width}
            onWidthChange={(next) => {
                setWidth(next);
                onWidthChange(next);
            }}
        >
            <Sidebar label="Sidebar">
                <SidebarHeader>
                    <SidebarInput aria-label="Search" />
                </SidebarHeader>
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
                <SidebarRail aria-label="Resize sidebar" />
            </Sidebar>
            <SidebarInset>
                <SidebarTrigger aria-label="Toggle sidebar" />
            </SidebarInset>
        </SidebarProvider>
    );
}

const sidebarState = () =>
    document.querySelector<HTMLElement>("[data-slot=sidebar]")?.dataset.state;

const rail = () => screen.getByRole("separator", { name: "Resize sidebar" });

const stubBounds = (width: number) => {
    const bounds = vi
        .spyOn(HTMLElement.prototype, "getBoundingClientRect")
        .mockReturnValue(new DOMRect(0, 0, width, 0));
    rail().style.setProperty("--sidebar-width-min", "200");
    rail().style.setProperty("--sidebar-width-max", "400");
    return bounds;
};

afterEach(() => {
    vi.restoreAllMocks();
    setViewportWidth(1024);
});

it("lays out its sections with the active entry marked", () => {
    render(<Shell />);

    expect(screen.getByRole("textbox", { name: "Search" })).toBeDefined();
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

it("resizes from the keyboard within its bounds", () => {
    const onWidthChange = vi.fn<(width: number | null) => void>();
    render(<Shell initialWidth={390} onWidthChange={onWidthChange} />);
    const bounds = stubBounds(390);
    expect(rail().getAttribute("aria-valuenow")).toBe("390");

    fireEvent.keyDown(rail(), { key: "ArrowRight" });
    expect(onWidthChange).toHaveBeenLastCalledWith(400);

    bounds.mockReturnValue(new DOMRect(0, 0, 210, 0));
    fireEvent.keyDown(rail(), { key: "ArrowLeft" });
    expect(onWidthChange).toHaveBeenLastCalledWith(200);

    fireEvent.keyDown(rail(), { key: "Enter" });
    expect(onWidthChange).toHaveBeenCalledTimes(2);

    fireEvent.doubleClick(rail());
    expect(onWidthChange).toHaveBeenLastCalledWith(null);
    expect(rail().hasAttribute("aria-valuenow")).toBe(false);
});

it("resizes by dragging the rail with the primary button", () => {
    const onWidthChange = vi.fn<(width: number | null) => void>();
    render(<Shell onWidthChange={onWidthChange} />);
    stubBounds(300);
    const capture = vi.spyOn(rail(), "setPointerCapture").mockReturnValue();

    fireEvent.pointerMove(rail(), { clientX: 50 });
    fireEvent.pointerDown(rail(), { button: 2, clientX: 0 });
    fireEvent.pointerMove(rail(), { clientX: 50 });
    expect(onWidthChange).not.toHaveBeenCalled();

    fireEvent.pointerDown(rail(), { button: 0, pointerId: 1, clientX: 0 });
    expect(capture).toHaveBeenCalledWith(1);
    expect(
        document.querySelector<HTMLElement>("[data-slot=sidebar-wrapper]")
            ?.dataset.resizing,
    ).toBe("");
    fireEvent.pointerMove(rail(), { clientX: 40 });
    expect(onWidthChange).toHaveBeenLastCalledWith(340);
    fireEvent.pointerMove(rail(), { clientX: 500 });
    expect(onWidthChange).toHaveBeenLastCalledWith(400);

    fireEvent.pointerUp(rail());
    fireEvent.pointerMove(rail(), { clientX: -500 });
    expect(onWidthChange).toHaveBeenCalledTimes(2);

    fireEvent.pointerDown(rail(), { button: 0, pointerId: 2, clientX: 0 });
    fireEvent.pointerCancel(rail());
    fireEvent.pointerMove(rail(), { clientX: 10 });
    expect(onWidthChange).toHaveBeenCalledTimes(2);
});

it("resizes from the smallest width inside the mobile sheet", async () => {
    const user = userEvent.setup();
    const onWidthChange = vi.fn<(width: number | null) => void>();
    setViewportWidth(700);
    render(<Shell onWidthChange={onWidthChange} />);
    await user.click(screen.getByRole("button", { name: "Toggle sidebar" }));
    await screen.findByRole("dialog", { name: "Sidebar" });
    rail().style.setProperty("--sidebar-width-min", "200");
    rail().style.setProperty("--sidebar-width-max", "400");

    fireEvent.keyDown(rail(), { key: "ArrowRight" });

    expect(onWidthChange).toHaveBeenLastCalledWith(200);
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
