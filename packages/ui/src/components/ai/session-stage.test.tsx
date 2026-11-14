import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
    type ComponentProps,
    createContext,
    type ReactNode,
    type RefObject,
    useContext,
    useMemo,
    useRef,
} from "react";
import { afterEach, expect, it, vi } from "vitest";

import { DetailPane } from "./detail-pane";
import { SessionStage } from "./session-stage";
import { TurnCard } from "./turn-card";

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

it("renders log stage, scroll shade, follow trigger, scroll-to-latest button, and outline navigation", async () => {
    const user = userEvent.setup();
    const scrollIntoView = vi.fn<(arg?: ScrollIntoViewOptions) => void>();
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    mockStick.isAtBottom = false;

    const { container, rerender } = render(
        <SessionStage
            turns={[
                { id: "t1", label: "First turn", ariaLabel: "Question 1" },
                { id: "t2", label: "Second turn" },
            ]}
            outlineLabel="Jump to question"
            scrollToBottomLabel="Scroll to latest"
            followTrigger="t1"
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

    expect(screen.getByRole("log")).toBeDefined();
    expect(screen.getByText("Composer area")).toBeDefined();
    expect(
        screen.getByRole("navigation", { name: "Jump to question" }),
    ).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Scroll to latest" }));
    expect(mockStick.scrollToBottom).toHaveBeenCalledWith("smooth");

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
    expect(scrollIntoView).toHaveBeenCalledWith({
        behavior: "smooth",
        block: "start",
    });

    mockStick.reducedMotion = true;
    mockStick.isAtBottom = true;
    rerender(
        <SessionStage
            turns={[{ id: "t1", label: "First turn" }]}
            outlineLabel="Jump to question"
            scrollToBottomLabel="Scroll to latest"
            followTrigger="t2"
        >
            <TurnCard turnId="t1" question="Question 1" />
        </SessionStage>,
    );
    expect(mockStick.scrollToBottom).toHaveBeenLastCalledWith("instant");
    await user.click(screen.getByRole("button", { name: "First turn" }));
    expect(scrollIntoView).toHaveBeenLastCalledWith({
        behavior: "instant",
        block: "start",
    });
});

it("manages drawer focus, local Escape guard, scrim click, and focus restoration", async () => {
    const user = userEvent.setup();
    const onClosePane = vi.fn<() => void>();

    const { container, rerender } = render(
        <div>
            <button type="button">Invoke drawer</button>
            <SessionStage
                paned={false}
                drawerId="drawer-1"
                turns={[{ id: "t1", label: "First turn" }]}
                onClosePane={onClosePane}
            >
                <div>Body</div>
            </SessionStage>
        </div>,
    );

    const invoker = screen.getByRole("button", { name: "Invoke drawer" });
    invoker.focus();
    expect(document.activeElement).toBe(invoker);

    rerender(
        <div>
            <button type="button">Invoke drawer</button>
            <SessionStage
                paned
                drawerId="drawer-1"
                turns={[{ id: "t1", label: "First turn" }]}
                rightPane={
                    <DetailPane
                        verb="tree"
                        title="Session tree"
                        closeLabel="Close"
                        onClose={onClosePane}
                        body={{
                            kind: "prose",
                            content: <input aria-label="Inner input" />,
                        }}
                    />
                }
                onClosePane={onClosePane}
            >
                <div>Body</div>
            </SessionStage>
        </div>,
    );

    expect(screen.queryByRole("navigation")).toBeNull();
    const drawer = screen.getByRole("complementary", { name: "Session tree" });
    expect(document.activeElement).toBe(drawer);

    const preventedEscape = new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
    });
    preventedEscape.preventDefault();
    drawer.dispatchEvent(preventedEscape);
    expect(onClosePane).not.toHaveBeenCalled();

    await user.keyboard("a");
    expect(onClosePane).not.toHaveBeenCalled();

    await user.keyboard("{Escape}");
    expect(onClosePane).toHaveBeenCalledTimes(1);

    fireEvent.click(requireElement(container, '[data-slot="drawer-scrim"]'));
    expect(onClosePane).toHaveBeenCalledTimes(2);

    rerender(
        <div>
            <button type="button">Invoke drawer</button>
            <SessionStage paned={false} onClosePane={onClosePane}>
                <div>Body</div>
            </SessionStage>
        </div>,
    );
    expect(document.activeElement).toBe(invoker);

    invoker.focus();
    rerender(
        <div>
            <button type="button">Invoke drawer</button>
            <SessionStage paned rightPane={<div>No close handler</div>}>
                <div>Body</div>
            </SessionStage>
        </div>,
    );
    rerender(
        <div>
            <SessionStage paned={false}>
                <div>Body</div>
            </SessionStage>
        </div>,
    );

    vi.spyOn(document, "activeElement", "get").mockReturnValueOnce(null);
    rerender(
        <SessionStage paned rightPane={<div>No close handler</div>}>
            <div>Body</div>
        </SessionStage>,
    );
    rerender(
        <SessionStage paned={false}>
            <div>Body</div>
        </SessionStage>,
    );
});
