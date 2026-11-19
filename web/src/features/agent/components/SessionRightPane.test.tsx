import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import type { SessionTreeRow } from "../session-tree";
import type { TurnStep } from "../step-details";
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

it("renders SessionRightPane localized verbs, code/web/output bodies, and ComposerDock fallbacks", async () => {
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
                    id: "s-write",
                    toolName: "write_file",
                    argument: "out.txt",
                    detail: { kind: "output", text: "wrote" },
                }),
            }}
            onSelectTreeRow={onSelectTreeRow}
            onSaveLabel={onSaveLabel}
            onClose={onClose}
        />,
    );
    expect(screen.getByText("write")).toBeDefined();

    rerender(
        <SessionRightPane
            pane={{
                mode: "step",
                step: makeStep({
                    id: "s-fetch",
                    toolName: "web_fetch",
                    argument: "https://example.com",
                    detail: { kind: "output", text: "fetched" },
                }),
            }}
            onSelectTreeRow={onSelectTreeRow}
            onSaveLabel={onSaveLabel}
            onClose={onClose}
        />,
    );
    expect(screen.getByText("fetch")).toBeDefined();

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
                        note: "Search summary",
                        hits: [
                            {
                                title: "Hit",
                                url: "https://h.test",
                                snippet: "",
                            },
                            {
                                title: "Hit 2",
                                url: "https://h.test",
                                snippet: "Second excerpt",
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
    expect(screen.getByText("Search summary")).toBeDefined();
    expect(screen.getByText("Second excerpt")).toBeDefined();

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
        screen.getByRole("heading", { level: 2, name: "Code" }),
    ).toBeDefined();

    const rows: SessionTreeRow[] = [
        {
            id: "u1",
            kind: "question",
            title: "Question",
            label: "tag-1",
            rails: ["tee"],
            hasTopSpine: false,
            hasBottomSpine: true,
            onPath: true,
            isLeaf: false,
        },
        {
            id: "a1",
            kind: "answer",
            title: "",
            meta: "08:09",
            rails: ["bar"],
            hasTopSpine: true,
            hasBottomSpine: false,
            onPath: false,
            isLeaf: true,
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
