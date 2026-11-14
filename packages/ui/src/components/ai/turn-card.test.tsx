import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

import { TurnCard } from "./turn-card";

it("renders sticky question header, optional time, and children", () => {
    const { container } = render(
        <TurnCard
            turnId="turn-42"
            question="How does routing work?"
            timeLabel="14:02"
        >
            <p>Details here</p>
        </TurnCard>,
    );

    const root = container.querySelector('[data-turn-id="turn-42"]');
    expect(root).not.toBeNull();
    const card = root?.querySelector("[data-say-card]");
    expect(card?.textContent).toContain("How does routing work?");
    expect(screen.getByText("14:02").tagName).toBe("TIME");
    expect(screen.getByText("Details here")).toBeDefined();
});

it("omits time when timeLabel is undefined", () => {
    const { container } = render(<TurnCard turnId="turn-1" question="Hello" />);

    expect(container.querySelector("time")).toBeNull();
});
