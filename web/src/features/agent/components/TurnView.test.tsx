import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import type { ConversationTurn } from "../active-path";
import type { AgentItem } from "../agent-item";
import type { TurnStep } from "../step-details";
import { TurnView } from "./TurnView";

const paragraphText =
    (text: string) =>
    (_content: string, element: Element | null): boolean =>
        element?.tagName === "P" && element.textContent === text;

const baseItem = (
    id: string,
    role: AgentItem["role"],
    patch: Partial<AgentItem> = {},
): AgentItem => ({
    id,
    role,
    content: "",
    thinking: "",
    status: "done",
    providerId: role === "assistant" ? "p1" : "",
    model: role === "assistant" ? "m1" : "",
    toolCalls: [],
    ...patch,
});

const makeStep = (patch: Partial<TurnStep>): TurnStep => ({
    id: "s1",
    kind: "tool",
    toolName: "bash",
    argument: "ls",
    plainArgument: false,
    isError: false,
    selfHealed: false,
    warn: false,
    state: "done",
    detail: { kind: "output", text: "ok" },
    ...patch,
});

it("renders TurnView summaries, step variants, settled actions, streaming, aborted, and empty reply branches", async () => {
    const user = userEvent.setup();
    const onInspectStep = vi.fn<(step: TurnStep) => void>();
    const onInspectCode = vi.fn<(code: string, language: string) => void>();
    const onRegenerate =
        vi.fn<(turn: ConversationTurn, reply: AgentItem) => void>();

    const multiToolTurn: ConversationTurn = {
        id: "t1",
        userMessage: baseItem("u1", "user", {
            content: "Check project",
            createdAtMs: 1000,
        }),
        finalReply: baseItem("a1", "assistant", {
            content: "All done",
            status: "done",
            model: "gpt-5",
            createdAtMs: 3400,
        }),
        steps: [
            makeStep({
                id: "s-think-empty",
                kind: "thinking",
                argument: "",
                plainArgument: true,
                detail: { kind: "prose", text: "" },
            }),
            makeStep({
                id: "s-read",
                toolName: "read_file",
                argument: "",
            }),
            makeStep({
                id: "s-write",
                toolName: "write_file",
                argument: "src/out.ts",
            }),
            makeStep({
                id: "s-write-empty",
                toolName: "write_file",
                argument: "",
            }),
            makeStep({
                id: "s-bash-empty",
                toolName: "bash",
                argument: "",
                isError: true,
                warn: true,
            }),
            makeStep({
                id: "s-search-1",
                toolName: "web_search",
                argument: "q",
                plainArgument: true,
                via: "tavily",
            }),
            makeStep({
                id: "s-search-2",
                toolName: "web_search",
                argument: "q2",
                plainArgument: true,
            }),
            makeStep({
                id: "s-fetch",
                toolName: "web_fetch",
                argument: "https://example.com",
            }),
            makeStep({
                id: "s-custom",
                toolName: "custom_tool",
                argument: "arg",
            }),
        ],
    };

    const { rerender } = render(
        <TurnView
            turn={multiToolTurn}
            activePaneStepId="s-read"
            onInspectStep={onInspectStep}
            onInspectCode={onInspectCode}
            onRegenerate={onRegenerate}
        />,
    );
    expect(screen.getByText("gpt-5 · 2.4s")).toBeDefined();
    await user.click(screen.getByRole("button", { name: "Regenerate" }));
    expect(onRegenerate).toHaveBeenCalledWith(
        multiToolTurn,
        multiToolTurn.finalReply,
    );
    const summaryBtn = screen.getByRole("button", {
        name: /Thought · read read_file · wrote out\.ts · wrote write_file · ran bash · searched the web · fetched page · custom_tool/u,
    });
    expect(screen.getByText("9 steps")).toBeDefined();
    await user.click(summaryBtn);
    expect(screen.getByText("Failed")).toBeDefined();
    expect(screen.getByText("tavily")).toBeDefined();
    await user.click(
        screen.getByRole("button", { name: /^custom_tool\s*arg/u }),
    );
    expect(onInspectStep).toHaveBeenCalledTimes(1);

    rerender(
        <TurnView
            turn={{
                id: "t2",
                userMessage: baseItem("u2", "user", {
                    content: "Aborted turn",
                    createdAtMs: new Date(2026, 9, 31, 14, 5).getTime(),
                }),
                finalReply: baseItem("a2", "assistant", {
                    content: "",
                    status: "aborted",
                }),
                steps: [
                    makeStep({
                        id: "s-think-run",
                        kind: "thinking",
                        argument: "Analyzing",
                        plainArgument: true,
                        state: "running",
                        detail: { kind: "prose", text: "Analyzing" },
                    }),
                    makeStep({
                        id: "s-nameless",
                        toolName: undefined,
                        argument: "",
                    }),
                ],
            }}
            activePaneStepId={undefined}
            onInspectStep={onInspectStep}
            onInspectCode={onInspectCode}
        />,
    );
    expect(screen.getByText("14:05")).toBeDefined();
    expect(screen.getByText("Generation stopped.")).toBeDefined();
    expect(screen.getByRole("button", { name: /Thinking…/u })).toBeDefined();

    rerender(
        <TurnView
            turn={{
                id: "t3",
                userMessage: baseItem("u3", "user", { content: "Fallback" }),
                finalReply: baseItem("a3", "assistant", {
                    content: "Streaming reply",
                    status: "streaming",
                }),
                steps: [
                    makeStep({
                        id: "s-only-nameless",
                        toolName: undefined,
                        argument: "",
                    }),
                ],
            }}
            activePaneStepId={undefined}
            onInspectStep={onInspectStep}
            onInspectCode={onInspectCode}
        />,
    );
    expect(screen.getByText(paragraphText("Streaming reply"))).toBeDefined();
    expect(screen.getAllByText("1 step").length).toBeGreaterThanOrEqual(1);

    rerender(
        <TurnView
            turn={{
                id: "t4",
                userMessage: baseItem("u4", "user", { content: "Steps only" }),
                finalReply: undefined,
                steps: [
                    makeStep({
                        id: "s-only",
                        toolName: "bash",
                        argument: "pwd",
                    }),
                ],
            }}
            activePaneStepId={undefined}
            onInspectStep={onInspectStep}
            onInspectCode={onInspectCode}
        />,
    );
    expect(screen.getByRole("button", { name: /ran pwd/u })).toBeDefined();

    rerender(
        <TurnView
            turn={{
                id: "t5",
                userMessage: baseItem("u5", "user", { content: "No reply" }),
                finalReply: undefined,
                steps: [],
            }}
            activePaneStepId={undefined}
            onInspectStep={onInspectStep}
            onInspectCode={onInspectCode}
        />,
    );
    expect(screen.getByText("No reply")).toBeDefined();

    rerender(
        <TurnView
            turn={{
                id: "t6",
                userMessage: baseItem("u6", "user", {
                    content: "Empty settled",
                }),
                finalReply: baseItem("a6", "assistant", {
                    content: "",
                    status: "done",
                    model: "",
                }),
                steps: [],
            }}
            activePaneStepId={undefined}
            onInspectStep={onInspectStep}
            onInspectCode={onInspectCode}
        />,
    );
    expect(screen.getByText("Empty settled")).toBeDefined();
});
