import { TooltipProvider } from "@lemma/ui";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { beforeEach, expect, it, vi } from "vitest";

import { useActiveSessionStore } from "../store";
import { SessionComposer } from "./SessionComposer";

type Props = ComponentProps<typeof SessionComposer>;

const renderComposer = (props: Partial<Props>) => {
    const base: Props = {
        sessionKey: "s1",
        streaming: false,
        model: { providerId: "p1", model: "m1" },
        providers: [],
        modelPickerOpen: false,
        onModelPickerOpenChange: vi.fn<(open: boolean) => void>(),
        onSelectModel: vi.fn<Props["onSelectModel"]>(),
        onOpenProviders: vi.fn<() => void>(),
        directorySlot: <span>Directory</span>,
    };
    const element = (next: Partial<Props>) => (
        <TooltipProvider>
            <SessionComposer {...base} {...next} />
        </TooltipProvider>
    );
    const view = render(element(props));
    return {
        rerender: (next: Partial<Props>) => view.rerender(element(next)),
    };
};

beforeEach(() => {
    useActiveSessionStore.getState().reset();
});

it("submits the trimmed draft on Enter and holds it during Shift+Enter and IME composition", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn<(text: string) => void>();
    const { rerender } = renderComposer({
        onSubmit,
        trailingFooter: <span>Tree</span>,
    });

    const textarea = screen.getByRole("textbox", {
        name: "Message the assistant…",
    });
    expect(screen.getByRole("button", { name: "Send" })).toHaveProperty(
        "disabled",
        true,
    );
    expect(screen.getByText("Directory")).toBeDefined();
    expect(screen.getByText("Tree")).toBeDefined();

    fireEvent.keyDown(textarea, { key: "Enter" });
    await user.type(textarea, "  hello  ");
    expect(useActiveSessionStore.getState().drafts.s1).toBe("  hello  ");

    fireEvent.compositionStart(textarea);
    fireEvent.keyDown(textarea, { key: "Enter" });
    fireEvent.compositionEnd(textarea);
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.keyDown(textarea, { key: "Enter" });
    expect(onSubmit).toHaveBeenLastCalledWith("hello");

    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(onSubmit).toHaveBeenCalledTimes(2);

    rerender({});
    fireEvent.keyDown(textarea, { key: "Enter" });
    expect(onSubmit).toHaveBeenCalledTimes(2);
});

it("focuses the input when the focus trigger changes and shows the dock and running bar", async () => {
    const user = userEvent.setup();
    const onStop = vi.fn<() => void>();
    const { rerender } = renderComposer({ focusTrigger: 0 });
    const textarea = screen.getByRole("textbox", {
        name: "Message the assistant…",
    });
    expect(document.activeElement).not.toBe(textarea);

    rerender({
        focusTrigger: 1,
        streaming: true,
        dock: <span>Retry dock</span>,
        running: {
            stepLabel: "Thinking",
            startedAtMs: Date.now() - 1500,
            warn: false,
            stopLabel: "Stop",
            onStop,
        },
    });
    expect(document.activeElement).toBe(textarea);
    expect(screen.getByText("Retry dock")).toBeDefined();
    expect(screen.getByText("Thinking")).toBeDefined();
    expect(screen.getByText(/^\d+\.\ds$/u)).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Stop" }));
    expect(onStop).toHaveBeenCalledTimes(1);

    rerender({
        running: {
            stepLabel: "Reconnecting",
            warn: true,
            stopLabel: "Stop",
            onStop,
        },
    });
    expect(screen.getByText("Reconnecting")).toBeDefined();
    expect(screen.queryByText(/^\d+\.\ds$/u)).toBeNull();
});

it("disables the input without a model", () => {
    useActiveSessionStore.getState().setDraft("s1", "hello");
    renderComposer({ model: null });

    const textarea = screen.getByRole("textbox", {
        name: "Configure a provider and model to start…",
    });
    expect(textarea).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "Send" })).toHaveProperty(
        "disabled",
        true,
    );
});
