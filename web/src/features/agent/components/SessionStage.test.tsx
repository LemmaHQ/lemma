import { TooltipProvider } from "@lemma/ui";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";

import { SessionStage } from "./SessionStage";

afterEach(() => {
    vi.restoreAllMocks();
});

it("jumps to a turn from its outline tick and hides the outline while the drawer is open", async () => {
    const user = userEvent.setup();
    const scrollIntoView = vi.fn<(options?: ScrollIntoViewOptions) => void>();
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    const turns = [
        { id: "t1", label: "First question" },
        { id: "t2", label: "Second question" },
    ];
    const stage = (drawer: string | undefined) => (
        <TooltipProvider>
            <SessionStage
                turns={turns}
                followTrigger="t1"
                drawer={drawer}
                drawerId="drawer"
                onCloseDrawer={vi.fn<() => void>()}
                composer={<div>Composer</div>}
            >
                <div data-turn-id="t1">Turn one</div>
                <div data-turn-id="t2">Turn two</div>
            </SessionStage>
        </TooltipProvider>
    );

    const { rerender } = render(stage(undefined));
    expect(screen.getByText("Composer")).toBeDefined();
    expect(screen.getByRole("log")).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Question 2" }));
    expect(scrollIntoView).toHaveBeenCalledWith({
        behavior: "smooth",
        block: "start",
    });
    expect(scrollIntoView.mock.contexts.at(-1)).toBe(
        screen.getByText("Turn two"),
    );

    rerender(stage("Drawer"));
    expect(
        screen.queryByRole("navigation", { name: "Jump to question" }),
    ).toBeNull();
});
