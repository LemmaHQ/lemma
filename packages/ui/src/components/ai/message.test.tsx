import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import { TooltipProvider } from "#primitives/tooltip";

import {
    Message,
    MessageActions,
    MessageContent,
    MessageCopyAction,
    MessageRegenerateAction,
    MessageResponse,
} from "./message";

it("renders an assistant reply as markdown with its actions", async () => {
    const user = userEvent.setup();
    const onRegenerate = vi.fn<() => void>();
    render(
        <TooltipProvider>
            <Message from="assistant">
                <MessageContent>
                    <MessageResponse>{"Use **bold** text"}</MessageResponse>
                </MessageContent>
                <MessageActions>
                    <MessageCopyAction
                        text="Use **bold** text"
                        label="Copy"
                        copiedLabel="Copied"
                    />
                    <MessageRegenerateAction
                        label="Regenerate"
                        onRegenerate={onRegenerate}
                    />
                </MessageActions>
            </Message>
        </TooltipProvider>,
    );

    expect((await screen.findByText("bold")).dataset.streamdown).toBe("strong");

    await user.click(screen.getByRole("button", { name: "Copy" }));
    expect(await navigator.clipboard.readText()).toBe("Use **bold** text");
    expect(await screen.findByRole("button", { name: "Copied" })).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Regenerate" }));
    await user.click(screen.getByRole("button", { name: "Regenerate" }));
    expect(onRegenerate).toHaveBeenCalledTimes(2);
});

it("streams a reply behind a caret", () => {
    const { container } = render(
        <Message from="user">
            <MessageContent>
                <MessageResponse isAnimating>
                    {"Partial answer"}
                </MessageResponse>
            </MessageContent>
        </Message>,
    );

    expect(container.querySelector("p")?.textContent).toBe("Partial answer");
    expect(container.querySelectorAll("[data-sd-animate]").length).toBe(2);
});
