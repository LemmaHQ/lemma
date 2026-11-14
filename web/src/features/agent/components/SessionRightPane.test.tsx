import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import type { TurnStep } from "../step-details";
import type { FlatTreeRow } from "../tree";
import { ComposerDock } from "./ComposerDock";
import { SessionRightPane } from "./SessionRightPane";

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

it("renders SessionRightPane and ComposerDock fallback branches", async () => {
    const user = userEvent.setup();
    const onSelectTreeRow = vi.fn<(id: string) => void>();
    const onSaveLabel = vi.fn<(id: string, label: string) => void>();
    const onClose = vi.fn<() => void>();

    const { rerender } = render(
        <SessionRightPane
            pane={{
                mode: "step",
                step: makeStep({
                    id: "s-code-nolang",
                    toolName: "read_file",
                    argument: "",
                    detail: { kind: "code", code: "hello" },
                }),
            }}
            onSelectTreeRow={onSelectTreeRow}
            onSaveLabel={onSaveLabel}
            onClose={onClose}
        />,
    );
    expect(
        screen.getByRole("heading", { level: 2, name: "read_file" }),
    ).toBeDefined();

    rerender(
        <SessionRightPane
            pane={{
                mode: "step",
                step: makeStep({
                    id: "s-web-nosnip",
                    toolName: undefined,
                    argument: "",
                    via: "ddg",
                    detail: {
                        kind: "web",
                        hits: [
                            {
                                title: "Hit",
                                url: "https://h.test",
                                snippet: "",
                            },
                        ],
                    },
                }),
            }}
            onSelectTreeRow={onSelectTreeRow}
            onSaveLabel={onSaveLabel}
            onClose={onClose}
        />,
    );
    expect(screen.getByText("ddg")).toBeDefined();

    rerender(
        <SessionRightPane
            pane={{
                mode: "step",
                step: makeStep({
                    id: "s-custom",
                    toolName: "grep",
                    argument: "foo",
                    isError: true,
                    detail: { kind: "output", text: "err" },
                }),
            }}
            onSelectTreeRow={onSelectTreeRow}
            onSaveLabel={onSaveLabel}
            onClose={onClose}
        />,
    );
    expect(screen.getByText("grep")).toBeDefined();
    expect(screen.getByText("Failed")).toBeDefined();

    rerender(
        <SessionRightPane
            pane={{
                mode: "step",
                step: makeStep({
                    id: "s-ok",
                    toolName: "bash",
                    argument: "pwd",
                    isError: false,
                    detail: { kind: "output", text: "/work" },
                }),
            }}
            onSelectTreeRow={onSelectTreeRow}
            onSaveLabel={onSaveLabel}
            onClose={onClose}
        />,
    );
    expect(screen.getByText("/work")).toBeDefined();
    rerender(
        <SessionRightPane
            pane={{ mode: "code", code: "plain", language: "" }}
            onSelectTreeRow={onSelectTreeRow}
            onSaveLabel={onSaveLabel}
            onClose={onClose}
        />,
    );
    expect(
        screen.getByRole("heading", { level: 2, name: "Open on right" }),
    ).toBeDefined();

    const rows: FlatTreeRow[] = [
        {
            id: "u1",
            role: "user",
            text: "Question",
            label: "tag-1",
            rails: [{ type: "tee", last: false, active: true }],
            hasParentSpine: false,
            hasChildSpine: true,
            onPath: true,
            isLeaf: false,
        },
        {
            id: "a1",
            role: "assistant",
            text: "",
            createdAtMs: new Date(2026, 9, 31, 8, 9).getTime(),
            rails: [{ type: "bar", active: false }],
            hasParentSpine: true,
            hasChildSpine: false,
            onPath: false,
            isLeaf: true,
        },
        {
            id: "a2",
            role: "assistant",
            text: "",
            model: "m1",
            rails: [{ type: "empty", active: false }],
            hasParentSpine: true,
            hasChildSpine: false,
            onPath: false,
            isLeaf: true,
        },
        {
            id: "a3",
            role: "assistant",
            text: "Bare",
            rails: [{ type: "empty", active: false }],
            hasParentSpine: true,
            hasChildSpine: false,
            onPath: false,
            isLeaf: false,
        },
    ];
    rerender(
        <SessionRightPane
            pane={{ mode: "tree", rows, pathCount: 2 }}
            onSelectTreeRow={onSelectTreeRow}
            onSaveLabel={onSaveLabel}
            onClose={onClose}
        />,
    );
    expect(screen.getByText("08:09")).toBeDefined();
    await user.click(
        screen.getByRole("button", { name: /^Question\s*tag-1/u }),
    );
    expect(onSelectTreeRow).toHaveBeenCalledWith("u1");

    rerender(
        <ComposerDock
            state={{
                kind: "error",
                error: "",
                retryModel: "m1",
                onRetry: vi.fn<() => void>(),
                onSwitchModel: vi.fn<() => void>(),
            }}
        />,
    );
    expect(screen.getByText("The model request failed")).toBeDefined();
});
