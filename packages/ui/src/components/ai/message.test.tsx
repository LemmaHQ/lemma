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
import { MessageCodeBlock } from "./message-code-block";

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

it("adds an open-code button in code block headers and renders completionMark", async () => {
    const user = userEvent.setup();
    const onOpenCode = vi.fn<(code: string, language: string) => void>();

    const { container } = render(
        <Message from="assistant">
            <MessageContent>
                <MessageResponse
                    openCodeLabel="Open on right"
                    onOpenCode={onOpenCode}
                    completionMark
                >
                    {
                        "Here is `inline` and:\n\n```ts startLine=5\nconst a = 1;\n```\n\nDone."
                    }
                </MessageResponse>
            </MessageContent>
        </Message>,
    );

    const openButton = await screen.findByRole("button", {
        name: "Open on right",
    });
    await user.click(openButton);
    expect(onOpenCode).toHaveBeenCalledWith("const a = 1;\n", "ts");

    expect(container.querySelector(".qed-mark")).not.toBeNull();
    expect(
        container.querySelector('[data-streamdown="inline-code"]')?.textContent,
    ).toBe("inline");
});

it("respects disabled code controls in MessageCodeBlock", async () => {
    const onOpenCode = vi.fn<(code: string, language: string) => void>();

    render(
        <Message from="assistant">
            <MessageContent>
                <MessageResponse
                    openCodeLabel="Open on right"
                    onOpenCode={onOpenCode}
                    controls={{ code: false }}
                >
                    {"```js\nlet x = 2;\n```"}
                </MessageResponse>
            </MessageContent>
        </Message>,
    );

    expect(
        await screen.findByRole("button", { name: "Open on right" }),
    ).toBeDefined();
});

it("falls back to default Streamdown code component for mermaid blocks", () => {
    const onOpenCode = vi.fn<(code: string, language: string) => void>();

    const { container } = render(
        <Message from="assistant">
            <MessageContent>
                <MessageResponse
                    openCodeLabel="Open on right"
                    onOpenCode={onOpenCode}
                >
                    {"```mermaid\ngraph TD; A-->B;\n```"}
                </MessageResponse>
            </MessageContent>
        </Message>,
    );

    expect(container).toBeDefined();
    expect(screen.queryByRole("button", { name: "Open on right" })).toBeNull();
});

it("extracts code text from a nested element child in MessageCodeBlock", async () => {
    const user = userEvent.setup();
    const onOpenCode = vi.fn<(code: string, language: string) => void>();

    render(
        <MessageCodeBlock
            className={["language", "py"].join("-")}
            data-block="true"
            openCodeLabel="Open on right"
            onOpenCode={onOpenCode}
        >
            <span>print(1)</span>
        </MessageCodeBlock>,
    );

    await user.click(screen.getByRole("button", { name: "Open on right" }));
    expect(onOpenCode).toHaveBeenCalledWith("print(1)", "py");
});

it("covers completionMark without openCode, object code controls, and fallback MessageCodeBlock branches", () => {
    const onOpenCode = vi.fn<(code: string, language: string) => void>();

    const { container } = render(
        <div>
            <MessageResponse completionMark>
                {"Plain completion."}
            </MessageResponse>
            <MessageResponse
                openCodeLabel="Open on right"
                onOpenCode={onOpenCode}
                controls={{ code: { copy: false, download: true } }}
            >
                {"```ts\nconst b = 2;\n```"}
            </MessageResponse>
            <MessageCodeBlock
                data-block="true"
                openCodeLabel="Open missing class"
                onOpenCode={onOpenCode}
            >
                <span>{123}</span>
            </MessageCodeBlock>
            <MessageCodeBlock data-block="true">
                <span>fallback</span>
            </MessageCodeBlock>
        </div>,
    );

    expect(container.querySelector(".qed-mark")).not.toBeNull();
    expect(
        screen.getByRole("button", { name: "Open missing class" }),
    ).toBeDefined();
    expect(screen.getByText("fallback")).toBeDefined();
});
