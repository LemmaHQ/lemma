import {
    act,
    fireEvent,
    render,
    screen,
    waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { TooltipProvider } from "#primitives/tooltip";

import {
    Conversation,
    ConversationContent,
    ConversationFollow,
    ConversationScrollButton,
} from "./conversation";

const reducedMotion = vi.hoisted(() => {
    const state = { reduce: false };
    const query = window.matchMedia("(prefers-reduced-motion)");
    Object.defineProperty(query, "matches", { get: () => state.reduce });
    const matchMedia = window.matchMedia.bind(window);
    window.matchMedia = (media: string) =>
        media === "(prefers-reduced-motion)" ? query : matchMedia(media);
    return { state, query };
});

const setReducedMotion = (reduce: boolean) => {
    reducedMotion.state.reduce = reduce;
    reducedMotion.query.dispatchEvent(new Event("change"));
};

const log = (trigger: string | null = null) => (
    <TooltipProvider>
        <Conversation>
            <ConversationContent>
                <p>First message</p>
            </ConversationContent>
            <ConversationFollow trigger={trigger} />
            <ConversationScrollButton label="Scroll to latest" />
        </Conversation>
    </TooltipProvider>
);

const viewport = () => {
    const element = screen
        .getByRole("log")
        .querySelector("[data-slot=scroll-area-viewport]");
    if (!(element instanceof HTMLElement)) {
        throw new TypeError("no scroll viewport");
    }
    return element;
};

const scrollTo = async (top: number) => {
    viewport().scrollTop = top;
    fireEvent.scroll(viewport());
    await act(
        () =>
            new Promise<void>((resolve) => {
                setTimeout(resolve, 5);
            }),
    );
};

const scrollUp = async () => {
    await scrollTo(600);
    await scrollTo(100);
};

beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(
        1000,
    );
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(200);
});

afterEach(() => {
    vi.restoreAllMocks();
    setReducedMotion(false);
});

it("shows the message log without a scroll button at the end", () => {
    render(log());

    expect(screen.getByRole("log").textContent).toContain("First message");
    expect(
        screen.queryByRole("button", { name: "Scroll to latest" }),
    ).toBeNull();
});

it("offers a way back once the reader scrolls up", async () => {
    const user = userEvent.setup();
    render(log());

    await scrollUp();
    const button = await screen.findByRole("button", {
        name: "Scroll to latest",
    });
    await user.click(button);

    await waitFor(() => {
        expect(viewport().scrollTop).toBeGreaterThan(700);
    });
});

it("jumps back without animation under reduced motion", async () => {
    const user = userEvent.setup();
    setReducedMotion(true);
    render(log());

    await scrollUp();
    await user.click(
        await screen.findByRole("button", { name: "Scroll to latest" }),
    );

    expect(viewport().scrollTop).toBeGreaterThan(700);
});

it("follows a new trigger even after the reader scrolled up", async () => {
    const { rerender } = render(log("turn-1"));
    await scrollUp();

    rerender(log("turn-1"));
    expect(viewport().scrollTop).toBe(100);

    rerender(log("turn-2"));
    await waitFor(() => {
        expect(viewport().scrollTop).toBeGreaterThan(700);
    });
});
