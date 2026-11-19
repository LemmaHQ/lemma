import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { DrawerHeader, DrawerLayout } from "./DrawerLayout";

afterEach(() => {
    vi.restoreAllMocks();
});

function requireScrim(container: HTMLElement): HTMLElement {
    const scrim = container.querySelector('[data-slot="drawer-scrim"]');
    if (!(scrim instanceof HTMLElement)) {
        throw new TypeError("Missing drawer scrim");
    }
    return scrim;
}

function Layout({
    drawer,
    onClose,
}: {
    drawer: ReactNode | undefined;
    onClose: () => void;
}) {
    return (
        <div>
            <button type="button">Invoke drawer</button>
            <DrawerLayout drawer={drawer} drawerId="drawer-1" onClose={onClose}>
                <div>Body</div>
            </DrawerLayout>
        </div>
    );
}

it("focuses the open drawer, closes on Escape or scrim click, and restores focus", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn<() => void>();
    const drawer = (
        <DrawerHeader
            verb="tree"
            title="Session tree"
            closeLabel="Close"
            meta={<span>2 paths</span>}
            onClose={onClose}
        >
            <span>Click a question to branch</span>
        </DrawerHeader>
    );

    const { container, rerender } = render(
        <Layout drawer={undefined} onClose={onClose} />,
    );
    const invoker = screen.getByRole("button", { name: "Invoke drawer" });
    invoker.focus();

    rerender(<Layout drawer={drawer} onClose={onClose} />);
    const aside = screen.getByRole("complementary", { name: "Session tree" });
    expect(aside.id).toBe("drawer-1");
    expect(document.activeElement).toBe(aside);
    expect(screen.getByText("2 paths")).toBeDefined();
    expect(screen.getByText("Click a question to branch")).toBeDefined();

    const preventedEscape = new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
    });
    preventedEscape.preventDefault();
    aside.dispatchEvent(preventedEscape);
    await user.keyboard("a");
    expect(onClose).not.toHaveBeenCalled();

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(requireScrim(container));
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(3);

    rerender(<Layout drawer={undefined} onClose={onClose} />);
    expect(document.activeElement).toBe(invoker);
});

it("skips focus restoration when the previous focus is gone", () => {
    const onClose = vi.fn<() => void>();
    vi.spyOn(document, "activeElement", "get").mockReturnValueOnce(null);
    const { rerender } = render(
        <Layout drawer={<div>Drawer</div>} onClose={onClose} />,
    );
    rerender(<Layout drawer={undefined} onClose={onClose} />);
    expect(screen.queryByRole("complementary")).toBeNull();

    screen.getByRole("button", { name: "Invoke drawer" }).focus();
    rerender(<Layout drawer={<div>Drawer</div>} onClose={onClose} />);
    rerender(
        <DrawerLayout drawer={undefined} drawerId="drawer-1" onClose={onClose}>
            <div>Body</div>
        </DrawerLayout>,
    );
    expect(document.activeElement).toBe(document.body);
});
