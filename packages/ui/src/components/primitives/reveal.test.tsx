import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { Reveal } from "./reveal";

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

const REDUCED_MOTION_NOTICE = "You have Reduced Motion enabled on your device";

const muteReducedMotionNotice = () => {
    const warn = console.warn.bind(console);
    vi.spyOn(console, "warn").mockImplementation((...args: unknown[]) => {
        if (!String(args[0]).startsWith(REDUCED_MOTION_NOTICE)) {
            warn(...args);
        }
    });
};

const setMotionTokens = (duration: string, easing: string) => {
    const root = document.documentElement.style;
    root.setProperty("--motion-duration-slow", duration);
    root.setProperty("--motion-easing-move", easing);
};

afterEach(() => {
    vi.restoreAllMocks();
    setReducedMotion(false);
    document.documentElement.removeAttribute("style");
});

const expectRevealCycle = async () => {
    const { rerender } = render(
        <Reveal open={false}>
            <p>Details</p>
        </Reveal>,
    );
    expect(screen.queryByText("Details")).toBeNull();

    rerender(
        <Reveal open>
            <p>Details</p>
        </Reveal>,
    );
    expect(screen.getByText("Details")).toBeDefined();

    rerender(
        <Reveal open={false}>
            <p>Details</p>
        </Reveal>,
    );
    await waitFor(() => {
        expect(screen.queryByText("Details")).toBeNull();
    });
};

it("shows content open at first render", () => {
    render(
        <Reveal open>
            <p>Details</p>
        </Reveal>,
    );

    expect(screen.getByText("Details")).toBeDefined();
});

it.each([
    ["millisecond", "60ms", "cubic-bezier(0.2, 0, 0, 1)"],
    ["second", "0.06s", "cubic-bezier(0.2, 0, 0, 1)"],
    ["missing", "", ""],
])(
    "reveals and removes content with %s motion tokens",
    async (_, duration, easing) => {
        setMotionTokens(duration, easing);

        await expectRevealCycle();

        expect(screen.queryByText("Details")).toBeNull();
    },
);

it("reveals and removes content without motion when reduced", async () => {
    muteReducedMotionNotice();
    setReducedMotion(true);

    await expectRevealCycle();

    expect(screen.queryByText("Details")).toBeNull();
});
