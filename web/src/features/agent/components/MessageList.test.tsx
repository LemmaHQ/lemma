import { TooltipProvider } from "@lemma/ui";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import type { AgentItem } from "../agent-item";
import { MessageList } from "./MessageList";

type Props = Parameters<typeof MessageList>[0];

const item = (id: string, patch: Partial<AgentItem> = {}): AgentItem => ({
    id,
    role: "assistant",
    content: `text ${id}`,
    thinking: "",
    status: "done",
    providerId: "p1",
    model: "m1",
    toolCalls: [],
    ...patch,
});

const baseProps: Props = {
    items: [item("a2")],
    conversationId: "c1",
    hasMore: true,
    providerNameById: new Map(),
    onLoadMore: () => Promise.resolve(),
    onPickSuggestion: () => {},
    onRegenerate: () => {},
};

const view = (props: Partial<Props>) => (
    <TooltipProvider>
        <MessageList {...baseProps} {...props} />
    </TooltipProvider>
);

const viewport = (): HTMLDivElement => {
    const element = document.querySelector(
        '[data-slot="scroll-area-viewport"]',
    );
    if (!(element instanceof HTMLDivElement)) {
        throw new TypeError("missing scroll viewport");
    }
    return element;
};

const setScrollHeight = (element: HTMLElement, height: number): void => {
    Object.defineProperty(element, "scrollHeight", {
        value: height,
        configurable: true,
    });
};

const scrollToTop = (): HTMLDivElement => {
    const element = viewport();
    element.scrollTop = 0;
    fireEvent.scroll(element);
    return element;
};

it("names each reply's provider and model when known", () => {
    render(
        view({
            hasMore: false,
            providerNameById: new Map([
                ["p1", "Acme"],
                ["p2", ""],
            ]),
            items: [
                item("a1"),
                item("a2", { providerId: "p2", model: "m2" }),
                item("a3", { providerId: "p3", model: "m3" }),
                item("a4", { model: "" }),
            ],
        }),
    );

    expect(screen.getByText("Acme · m1")).toBeDefined();
    expect(screen.getByText("m2")).toBeDefined();
    expect(screen.getByText("m3")).toBeDefined();
    expect(screen.getAllByRole("button", { name: "Regenerate" })).toHaveLength(
        1,
    );
});

it("keeps the reading position when older messages load at the top", () => {
    const onLoadMore = vi.fn<() => Promise<void>>(() => Promise.resolve());
    const { rerender } = render(view({ onLoadMore }));
    setScrollHeight(viewport(), 500);

    const element = scrollToTop();
    expect(onLoadMore).toHaveBeenCalledOnce();
    rerender(view({ onLoadMore, items: [item("a2"), item("a3")] }));
    setScrollHeight(element, 900);
    rerender(view({ onLoadMore, items: [item("a1"), item("a2"), item("a3")] }));

    expect(element.scrollTop).toBe(400);
});

it("does not move a conversation the user switched to meanwhile", () => {
    const { rerender } = render(view({}));
    setScrollHeight(viewport(), 500);

    scrollToTop();
    rerender(view({ conversationId: "c2", items: [item("b1")] }));
    setScrollHeight(viewport(), 900);
    rerender(view({ conversationId: "c2", items: [item("b0"), item("b1")] }));

    expect(viewport().scrollTop).toBe(0);
});

it("forgets the position when loading older messages fails", async () => {
    const failed = Promise.withResolvers<undefined>();
    const onLoadMore = vi.fn<() => Promise<void>>(() => failed.promise);
    const { rerender } = render(view({ onLoadMore }));
    setScrollHeight(viewport(), 500);

    const element = scrollToTop();
    failed.reject(new Error("offline"));
    await failed.promise.catch(() => {});
    setScrollHeight(element, 900);
    rerender(view({ onLoadMore, items: [item("a1"), item("a2")] }));

    expect(element.scrollTop).toBe(0);
});

it("loads nothing until the viewport reaches the top of a longer history", () => {
    const onLoadMore = vi.fn<() => Promise<void>>(() => Promise.resolve());
    const { rerender } = render(view({ onLoadMore }));

    const element = viewport();
    element.scrollTop = 40;
    fireEvent.scroll(element);
    fireEvent.scroll(firstChild(element));
    fireEvent.scroll(screen.getByText("text a2"));
    rerender(view({ onLoadMore, hasMore: false }));
    scrollToTop();

    expect(onLoadMore).not.toHaveBeenCalled();
});

it("offers no regenerate before any reply exists", () => {
    render(
        view({
            hasMore: false,
            items: [item("u1", { role: "user", model: "" })],
        }),
    );

    expect(screen.getByText("text u1")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Regenerate" })).toBeNull();
});

function firstChild(element: Element): Element {
    const child = element.firstElementChild;
    if (child === null) {
        throw new TypeError("missing child element");
    }
    return child;
}
