import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import { SessionStage } from "./session-stage";
import { TurnCard } from "./turn-card";

function requireElement(parent: HTMLElement, selector: string): HTMLElement {
    const element = parent.querySelector(selector);
    if (!(element instanceof HTMLElement)) {
        throw new TypeError(`Missing element: ${selector}`);
    }
    return element;
}

it("renders centered turns, scroll shade on stuck card, and turn outline navigation", async () => {
    const user = userEvent.setup();
    const scrollIntoView = vi.fn<() => void>();
    HTMLElement.prototype.scrollIntoView = scrollIntoView;

    const { container } = render(
        <SessionStage
            turns={[
                { id: "t1", label: "First turn" },
                { id: "t2", label: "Second turn" },
            ]}
            outlineLabel="Turns"
            composer={<div>Composer area</div>}
        >
            <TurnCard turnId="t1" question="Question 1">
                <p>Answer 1</p>
            </TurnCard>
            <TurnCard turnId="t2" question="Question 2">
                <p>Answer 2</p>
            </TurnCard>
        </SessionStage>,
    );

    expect(screen.getByText("Composer area")).toBeDefined();
    expect(screen.getByRole("navigation", { name: "Turns" })).toBeDefined();

    const scrollContainer = requireElement(
        container,
        '[data-slot="session-stage-scroll"]',
    );
    const sayCard = requireElement(container, "[data-say-card]");
    vi.spyOn(scrollContainer, "getBoundingClientRect").mockReturnValue({
        top: 0,
        bottom: 500,
        left: 0,
        right: 800,
        width: 800,
        height: 500,
        x: 0,
        y: 0,
        toJSON: () => ({}),
    });
    vi.spyOn(sayCard, "getBoundingClientRect").mockReturnValue({
        top: 5,
        bottom: 45,
        left: 0,
        right: 680,
        width: 680,
        height: 40,
        x: 0,
        y: 5,
        toJSON: () => ({}),
    });
    Object.defineProperty(scrollContainer, "scrollTop", {
        value: 120,
        configurable: true,
    });
    fireEvent.scroll(scrollContainer);

    const shade = requireElement(container, '[data-slot="stage-shade"]');
    expect(shade.dataset.stuck).toBe("");

    await user.click(screen.getByRole("button", { name: "Second turn" }));
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
});

it("hides turn outline while paned and closes drawer on Escape", async () => {
    const user = userEvent.setup();
    const onClosePane = vi.fn<() => void>();

    render(
        <SessionStage
            paned
            turns={[{ id: "t1", label: "First turn" }]}
            rightPane={<div>Detail drawer</div>}
            onClosePane={onClosePane}
        >
            <div>Body</div>
        </SessionStage>,
    );

    expect(screen.queryByRole("navigation")).toBeNull();
    expect(screen.getByText("Detail drawer")).toBeDefined();

    await user.keyboard("a");
    expect(onClosePane).not.toHaveBeenCalled();

    await user.keyboard("{Escape}");
    expect(onClosePane).toHaveBeenCalledTimes(1);
});
