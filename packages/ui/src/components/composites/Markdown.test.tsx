import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import { Markdown } from "./Markdown";

it("renders emphasis, inline code, and plain code blocks", async () => {
    const { container } = render(
        <Markdown>
            {"Use **bold** and `inline`.\n\n```ts\nconst a = 1;\n```"}
        </Markdown>,
    );

    expect((await screen.findByText("bold")).dataset.streamdown).toBe("strong");
    expect(screen.getByText("inline").dataset.streamdown).toBe("inline-code");
    expect(
        container.querySelector('[data-streamdown="code-block"]'),
    ).not.toBeNull();
});

it("fades streaming text in behind a caret", () => {
    const { container } = render(
        <Markdown streaming>{"Partial answer"}</Markdown>,
    );

    expect(container.querySelector("p")?.textContent).toBe("Partial answer");
    expect(container.querySelectorAll("[data-sd-animate]").length).toBe(2);
});

it("follows the last paragraph with the end mark", () => {
    render(
        <Markdown endMark={<span data-testid="end-mark" />}>
            {"First.\n\nLast."}
        </Markdown>,
    );

    const mark = screen.getByTestId("end-mark");
    expect(mark.parentElement?.previousElementSibling?.textContent).toBe(
        "First.Last.",
    );
});

it("adds code actions beside the copy button of fenced code blocks", async () => {
    const onOpen = vi.fn<(code: string, language: string) => void>();

    render(
        <Markdown
            renderCodeActions={(block) => (
                <button
                    type="button"
                    onClick={() => onOpen(block.code, block.language)}
                >
                    Open
                </button>
            )}
        >
            {[
                "```ts startLine=5",
                "const a = 1;",
                "```",
                "",
                "```py noLineNumbers",
                "print(1)",
                "```",
                "",
                "```",
                "plain",
                "```",
                "",
                "```txt",
                "```",
                "",
                "```mermaid",
                "graph TD; A-->B;",
                "```",
            ].join("\n")}
        </Markdown>,
    );

    const opens = await screen.findAllByRole("button", { name: "Open" });
    for (const open of opens) {
        expect(open.parentElement?.querySelectorAll("button")).toHaveLength(2);
        fireEvent.click(open);
    }
    expect(onOpen.mock.calls).toEqual([
        ["const a = 1;\n", "ts"],
        ["print(1)\n", "py"],
        ["plain\n", ""],
        ["", "txt"],
    ]);
});
