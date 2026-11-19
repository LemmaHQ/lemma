import { fireEvent, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
    createContext,
    useContext,
    useMemo,
    useRef,
    type ComponentProps,
    type ReactNode,
    type RefObject,
} from "react";
import { afterEach, expect, it, vi } from "vitest";

import { TooltipProvider } from "#primitives/tooltip";

import { FollowScroll } from "./FollowScroll";
import { useFollowScroll } from "./useFollowScroll";

interface MockStickContextValue {
    scrollRef: RefObject<HTMLDivElement | null>;
    contentRef: RefObject<HTMLDivElement | null>;
    isAtBottom: boolean;
    scrollToBottom: (animation?: unknown) => Promise<boolean>;
}

const mockStick = vi.hoisted(() => ({
    isAtBottom: true,
    scrollToBottom: vi.fn<(animation?: unknown) => Promise<boolean>>(() =>
        Promise.resolve(true),
    ),
    reducedMotion: false,
}));

const StickContext = createContext<MockStickContextValue | null>(null);

function MockStickToBottom({
    children,
    initial: _initial,
    resize: _resize,
    ...props
}: ComponentProps<"div"> & {
    initial?: unknown;
    resize?: unknown;
    children?: ReactNode;
}) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const isAtBottom = mockStick.isAtBottom;
    const value = useMemo(
        () => ({
            scrollRef,
            contentRef,
            isAtBottom,
            scrollToBottom: mockStick.scrollToBottom,
        }),
        [isAtBottom],
    );
    return (
        <StickContext.Provider value={value}>
            <div {...props}>{children}</div>
        </StickContext.Provider>
    );
}

function useMockStickContext(): MockStickContextValue {
    const ctx = useContext(StickContext);
    if (ctx === null) {
        throw new Error("missing StickToBottom");
    }
    return ctx;
}

vi.mock("use-stick-to-bottom", () => ({
    StickToBottom: MockStickToBottom,
    useStickToBottomContext: useMockStickContext,
}));

vi.mock("motion/react", async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        useReducedMotion: () => mockStick.reducedMotion,
    };
});

afterEach(() => {
    mockStick.isAtBottom = true;
    mockStick.reducedMotion = false;
    mockStick.scrollToBottom.mockClear();
    vi.restoreAllMocks();
});

function requireElement(parent: HTMLElement, selector: string): HTMLElement {
    const element = parent.querySelector(selector);
    if (!(element instanceof HTMLElement)) {
        throw new TypeError(`Missing element: ${selector}`);
    }
    return element;
}

function rect(top: number): DOMRect {
    return {
        top,
        bottom: top + 40,
        left: 0,
        right: 680,
        width: 680,
        height: 40,
        x: 0,
        y: top,
        toJSON: () => ({}),
    };
}

function JumpButton({ selector }: { selector: string }) {
    const { scrollIntoView } = useFollowScroll();
    return (
        <button type="button" onClick={() => scrollIntoView(selector)}>
            Jump
        </button>
    );
}

function Log({ followTrigger }: { followTrigger: string }) {
    return (
        <TooltipProvider>
            <FollowScroll
                followTrigger={followTrigger}
                scrollToBottomLabel="Scroll to latest"
                overlay={<JumpButton selector='[data-turn-id="t2"]' />}
            >
                <div data-follow-sticky="">Question 1</div>
                <div data-turn-id="t2">Question 2</div>
            </FollowScroll>
        </TooltipProvider>
    );
}

it("follows the trigger, scrolls to the end, shades stuck headers, and scrolls overlay targets into view", async () => {
    const user = userEvent.setup();
    const scrollIntoView = vi.fn<(arg?: ScrollIntoViewOptions) => void>();
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    mockStick.isAtBottom = false;
    const { container, rerender } = render(<Log followTrigger="t1" />);
    expect(screen.getByRole("log")).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Scroll to latest" }));
    expect(mockStick.scrollToBottom).toHaveBeenCalledWith("smooth");

    const scroller = requireElement(container, '[data-slot="follow-scroll"]');
    const sticky = requireElement(container, "[data-follow-sticky]");
    vi.spyOn(scroller, "getBoundingClientRect").mockReturnValue(rect(0));
    vi.spyOn(sticky, "getBoundingClientRect").mockReturnValue(rect(5));
    Object.defineProperty(scroller, "scrollTop", {
        value: 120,
        configurable: true,
    });
    fireEvent.scroll(scroller);
    const shade = requireElement(
        container,
        '[data-slot="follow-scroll-shade"]',
    );
    expect(shade.dataset.stuck).toBe("");

    await user.click(screen.getByRole("button", { name: "Jump" }));
    expect(scrollIntoView).toHaveBeenCalledWith({
        behavior: "smooth",
        block: "start",
    });
    expect(scrollIntoView.mock.contexts.at(-1)).toBe(
        screen.getByText("Question 2"),
    );

    mockStick.reducedMotion = true;
    mockStick.isAtBottom = true;
    rerender(<Log followTrigger="t2" />);
    expect(mockStick.scrollToBottom).toHaveBeenLastCalledWith("instant");
    expect(
        screen.queryByRole("button", { name: "Scroll to latest" }),
    ).toBeNull();
});

it("rejects useFollowScroll outside a FollowScroll", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => renderHook(() => useFollowScroll())).toThrow(
        "useFollowScroll is called outside a FollowScroll",
    );
});
