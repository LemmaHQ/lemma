import { TooltipProvider } from "@lemma/ui";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import type { AgentItem, ToolCallItem } from "../agent-item";
import { MessageItem } from "./MessageItem";

const assistant = (patch: Partial<AgentItem> = {}): AgentItem => ({
    id: "a1",
    role: "assistant",
    content: "",
    thinking: "",
    status: "done",
    providerId: "p1",
    model: "m1",
    toolCalls: [],
    ...patch,
});

const call = (patch: Partial<ToolCallItem>): ToolCallItem => ({
    id: "call",
    name: "read_file",
    arguments: "{}",
    output: "",
    isError: false,
    state: "done",
    ...patch,
});

const renderItem = (props: Parameters<typeof MessageItem>[0]) =>
    render(
        <TooltipProvider>
            <MessageItem {...props} />
        </TooltipProvider>,
    );

it("renders nothing for a tool result message", () => {
    const { container } = renderItem({
        message: assistant({ role: "tool", content: "output" }),
    });

    expect(container.textContent).toBe("");
});

it("shows a user message as plain text without actions", () => {
    renderItem({ message: assistant({ role: "user", content: "hi *there*" }) });

    expect(screen.getByText("hi *there*")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Copy" })).toBeNull();
});

it("shows a pending indicator before the reply produces anything", () => {
    renderItem({ message: assistant({ status: "streaming" }) });

    expect(screen.getByText("Thinking")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Copy" })).toBeNull();
});

it("shows live reasoning while the model thinks", () => {
    renderItem({
        message: assistant({
            status: "streaming",
            thinking: "weighing options",
            thinkingStartedAt: 1000,
        }),
    });

    expect(screen.getByText("Thinking…")).toBeDefined();
    expect(screen.getByText("weighing options")).toBeDefined();
});

it("summarizes finished reasoning by its duration", () => {
    renderItem({
        message: assistant({
            content: "answer",
            thinking: "weighing options",
            thinkingStartedAt: 1000,
            thinkingFinishedAt: 3500,
        }),
    });

    expect(screen.getByText("Thought for 2.5s")).toBeDefined();
    expect(screen.getByText("answer")).toBeDefined();
});

it.each([
    ["with its message", "rate limited", ["rate limited"]],
    ["without a message", "", []],
])("explains a failed reply %s", (_case, error, extra) => {
    renderItem({ message: assistant({ status: "error", error }) });

    const notice = screen.getByRole("alert");
    expect(notice.textContent).toBe(
        ["The model request failed", ...extra].join(""),
    );
    expect(screen.queryByRole("button", { name: "Copy" })).toBeNull();
});

it("marks a stopped reply", () => {
    renderItem({ message: assistant({ status: "aborted", content: "par" }) });

    expect(screen.getByText("Generation stopped.")).toBeDefined();
});

it("offers regenerate on the last reply and names its source", async () => {
    const user = userEvent.setup();
    const onRegenerate = vi.fn<(id: string) => void>();
    renderItem({
        message: assistant({ content: "answer" }),
        source: "Acme · m1",
        canRegenerate: true,
        onRegenerate,
    });

    await user.click(screen.getByRole("button", { name: "Regenerate" }));

    expect(onRegenerate).toHaveBeenCalledWith("a1");
    expect(screen.getByText("Acme · m1")).toBeDefined();
    expect(screen.getByRole("button", { name: "Copy" })).toBeDefined();
});

it.each([
    [
        "it cannot regenerate",
        { canRegenerate: false, onRegenerate: vi.fn<(id: string) => void>() },
    ],
    ["no handler is given", { canRegenerate: true }],
])("hides regenerate when %s", (_case, props) => {
    renderItem({
        message: assistant({ content: "answer" }),
        source: "",
        ...props,
    });

    expect(screen.queryByRole("button", { name: "Regenerate" })).toBeNull();
    expect(screen.queryByText("·", { exact: false })).toBeNull();
});

it("summarizes running tool calls", () => {
    renderItem({
        message: assistant({
            status: "streaming",
            toolCalls: [call({ id: "c1", state: "running", startedAt: 0 })],
        }),
    });

    expect(
        screen.getByRole("button", { name: /Using 1 tool…/u }),
    ).toBeDefined();
});

it("counts failed tool calls and shows their errors", async () => {
    const user = userEvent.setup();
    renderItem({
        message: assistant({
            toolCalls: [
                call({ id: "c1", output: "contents" }),
                call({
                    id: "c2",
                    name: "bash",
                    isError: true,
                    output: "exit 1",
                }),
                call({ id: "c3", name: "grep", isError: true }),
            ],
        }),
    });

    const group = screen.getByRole("button", { name: /Used 3 tools/u });
    expect(group.textContent).toContain("2 failed");
    await user.click(group);

    expect(screen.getByText("bash failed: exit 1")).toBeDefined();
    expect(
        screen.getByText("grep failed: The tool call failed."),
    ).toBeDefined();
    expect(screen.getByText("read_file finished")).toBeDefined();
});
