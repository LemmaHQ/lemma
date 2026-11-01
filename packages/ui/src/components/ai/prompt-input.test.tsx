import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, type KeyboardEvent, useState } from "react";
import { expect, it, vi } from "vitest";

import {
    PromptInput,
    PromptInputBody,
    PromptInputButton,
    PromptInputFooter,
    PromptInputSubmit,
    PromptInputTextarea,
    PromptInputTools,
} from "./prompt-input";

function Composer({
    onSubmit,
    disabled = false,
    onKeyDown,
}: {
    onSubmit: (text: string) => void;
    disabled?: boolean;
    onKeyDown?: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
}) {
    const [text, setText] = useState("");
    return (
        <PromptInput
            onSubmit={() => {
                onSubmit(text);
                setText("");
            }}
        >
            <PromptInputBody>
                <PromptInputTextarea
                    aria-label="Message"
                    value={text}
                    onChange={(event) => setText(event.currentTarget.value)}
                    onKeyDown={onKeyDown}
                />
            </PromptInputBody>
            <PromptInputFooter>
                <PromptInputTools>
                    <PromptInputButton aria-label="Attach">+</PromptInputButton>
                    <PromptInputButton>
                        <span>Model</span>
                        <span>v</span>
                    </PromptInputButton>
                </PromptInputTools>
                <PromptInputSubmit aria-label="Send" disabled={disabled} />
            </PromptInputFooter>
        </PromptInput>
    );
}

const field = () => screen.getByRole("textbox", { name: "Message" });

it("submits on Enter and on the send button, then clears", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn<(text: string) => void>();
    render(<Composer onSubmit={onSubmit} />);

    await user.type(field(), "hello{Enter}");
    expect(onSubmit).toHaveBeenLastCalledWith("hello");
    expect(field()).toHaveProperty("value", "");

    await user.type(field(), "again");
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(onSubmit).toHaveBeenLastCalledWith("again");
});

it("inserts a newline on Shift+Enter", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn<(text: string) => void>();
    render(<Composer onSubmit={onSubmit} />);

    await user.type(field(), "one{Shift>}{Enter}{/Shift}two");

    expect(field()).toHaveProperty("value", "one\ntwo");
    expect(onSubmit).not.toHaveBeenCalled();
});

it("submits nothing while an IME composition is confirmed", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn<(text: string) => void>();
    render(<Composer onSubmit={onSubmit} />);
    await user.type(field(), "ni");

    fireEvent.compositionStart(field());
    fireEvent.keyDown(field(), { key: "Enter" });
    fireEvent.compositionEnd(field());
    fireEvent.keyDown(field(), { key: "Enter", isComposing: true });
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.keyDown(field(), { key: "Enter" });
    expect(onSubmit).toHaveBeenCalledWith("ni");
});

it("submits nothing while sending is disabled", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn<(text: string) => void>();
    render(<Composer onSubmit={onSubmit} disabled />);

    await user.type(field(), "hello{Enter}");

    expect(onSubmit).not.toHaveBeenCalled();
    expect(field()).toHaveProperty("value", "hello");
});

it("leaves Enter to a key handler that already handled it", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn<(text: string) => void>();
    render(
        <Composer
            onSubmit={onSubmit}
            onKeyDown={(event) => {
                event.preventDefault();
            }}
        />,
    );

    await user.type(field(), "{Enter}");

    expect(onSubmit).not.toHaveBeenCalled();
});

it("ignores Enter outside a form", async () => {
    const user = userEvent.setup();
    render(<PromptInputTextarea aria-label="Message" />);

    await user.type(field(), "a{Enter}");

    expect(field()).toHaveProperty("value", "a");
});

it("hands the textarea to object and callback refs", () => {
    const objectRef = createRef<HTMLTextAreaElement>();
    const callbackRef = vi.fn<(element: HTMLTextAreaElement | null) => void>();
    const { unmount } = render(
        <>
            <PromptInputTextarea aria-label="First" ref={objectRef} />
            <PromptInputTextarea aria-label="Second" ref={callbackRef} />
        </>,
    );

    expect(objectRef.current).toBe(
        screen.getByRole("textbox", { name: "First" }),
    );
    expect(callbackRef).toHaveBeenLastCalledWith(
        screen.getByRole("textbox", { name: "Second" }),
    );
    unmount();
    expect(objectRef.current).toBeNull();
});

it("swaps the send icon for stop while streaming", () => {
    render(
        <form>
            <PromptInputSubmit aria-label="Stop" status="streaming" />
            <PromptInputSubmit aria-label="Custom">Go</PromptInputSubmit>
        </form>,
    );

    const icons = screen
        .getByRole("button", { name: "Stop" })
        .querySelectorAll<HTMLElement>("[data-on]");
    expect([...icons].map((icon) => icon.dataset.on)).toEqual([
        "false",
        "true",
    ]);
    expect(screen.getByRole("button", { name: "Custom" }).textContent).toBe(
        "Go",
    );
});
