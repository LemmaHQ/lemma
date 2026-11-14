import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import { ComposerBox } from "./composer-box";

it("submits on Enter, preserves Shift+Enter and IME composition, and renders dock/running states", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn<(value: string) => void>();
    const onSubmit = vi.fn<() => void>();
    const onStop = vi.fn<() => void>();

    const { rerender } = render(
        <ComposerBox
            value=""
            onChange={onChange}
            onSubmit={onSubmit}
            placeholder="Ask anything"
            sendLabel="Send"
            dock={<span>Attached file</span>}
            footerStart={<span>Model selector</span>}
        />,
    );

    const textarea = screen.getByRole("textbox", { name: "Ask anything" });
    const sendButton = screen.getByRole("button", { name: "Send" });
    expect(sendButton).toHaveProperty("disabled", true);
    expect(screen.getByText("Attached file")).toBeDefined();
    expect(screen.getByText("Model selector")).toBeDefined();

    await user.type(textarea, "hi");
    expect(onChange).toHaveBeenCalled();

    await user.keyboard("{Enter}");
    expect(onSubmit).not.toHaveBeenCalled();

    rerender(
        <ComposerBox
            value="Hello"
            onChange={onChange}
            onSubmit={onSubmit}
            placeholder="Ask anything"
            sendLabel="Send"
            running={{
                stepLabel: "Thinking",
                startedAtMs: Date.now() - 1500,
                stopLabel: "Stop",
                onStop,
            }}
        />,
    );

    expect(screen.getByText("Thinking")).toBeDefined();
    await user.click(screen.getByRole("button", { name: "Stop" }));
    expect(onStop).toHaveBeenCalledTimes(1);

    fireEvent.compositionStart(textarea);
    fireEvent.keyDown(textarea, { key: "Enter" });
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.compositionEnd(textarea);

    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.keyDown(textarea, { key: "Enter" });
    expect(onSubmit).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(onSubmit).toHaveBeenCalledTimes(2);

    rerender(
        <ComposerBox
            value="Hello"
            onChange={onChange}
            onSubmit={onSubmit}
            placeholder="Ask anything"
            sendLabel="Send"
            running={{
                stepLabel: "Retrying",
                startedAtMs: Date.now(),
                warn: true,
                stopLabel: "Stop",
                onStop,
            }}
        />,
    );
    expect(screen.getByText("Retrying")).toBeDefined();

    rerender(
        <ComposerBox
            value="Hello"
            onChange={onChange}
            placeholder="Ask anything"
            sendLabel="Send"
        />,
    );
    expect(screen.getByRole("button", { name: "Send" })).toHaveProperty(
        "disabled",
        true,
    );
    fireEvent.keyDown(textarea, { key: "Enter" });
    expect(onSubmit).toHaveBeenCalledTimes(2);
});
