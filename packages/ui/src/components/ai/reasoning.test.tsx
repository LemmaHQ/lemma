import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";

import {
    Reasoning,
    ReasoningContent,
    type ReasoningLabels,
    ReasoningTrigger,
} from "./reasoning";

const labels: ReasoningLabels = {
    thinking: "Thinking",
    thought: "Thought",
    thoughtFor: (duration) => `Thought for ${duration}`,
};

const reasoning = (props: Parameters<typeof Reasoning>[0]) => (
    <Reasoning {...props}>
        <ReasoningTrigger labels={labels} />
        <ReasoningContent>{"Considering **options**"}</ReasoningContent>
    </Reasoning>
);

const trigger = () => screen.getByRole("button", { name: /Thought|Thinking/u });

afterEach(() => {
    vi.useRealTimers();
});

it("shows live thinking time while streaming", () => {
    render(reasoning({ isStreaming: true, startedAt: Date.now() - 1500 }));

    expect(trigger().textContent).toMatch(/^Thinking1\.\ds$/u);
});

it("shows thinking without a time when the start is unknown", () => {
    render(reasoning({ isStreaming: true }));

    expect(trigger().textContent).toBe("Thinking");
});

it("states how long a finished thought took", () => {
    render(reasoning({ startedAt: 0, finishedAt: 2300 }));

    expect(trigger().textContent).toBe("Thought for 2.3s");
});

it("toggles the thought text from the trigger", async () => {
    const user = userEvent.setup();
    render(reasoning({}));
    expect(trigger().textContent).toBe("Thought");
    expect(trigger().getAttribute("aria-expanded")).toBe("false");

    await user.click(trigger());

    expect(trigger().getAttribute("aria-expanded")).toBe("true");
    expect((await screen.findByText("options")).dataset.streamdown).toBe(
        "strong",
    );
});

it("closes an initially open thought a second after streaming ends, once", () => {
    vi.useFakeTimers();
    const { rerender } = render(
        reasoning({ defaultOpen: true, isStreaming: true }),
    );
    act(() => {
        vi.advanceTimersByTime(5000);
    });
    expect(trigger().getAttribute("aria-expanded")).toBe("true");

    rerender(reasoning({ defaultOpen: true }));
    act(() => {
        vi.advanceTimersByTime(999);
    });
    expect(trigger().getAttribute("aria-expanded")).toBe("true");
    act(() => {
        vi.advanceTimersByTime(1);
    });
    expect(trigger().getAttribute("aria-expanded")).toBe("false");

    act(() => {
        trigger().click();
    });
    act(() => {
        vi.advanceTimersByTime(5000);
    });
    expect(trigger().getAttribute("aria-expanded")).toBe("true");
});
