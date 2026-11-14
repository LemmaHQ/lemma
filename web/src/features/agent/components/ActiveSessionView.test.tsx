import { create, type MessageInitShape } from "@bufbuild/protobuf";
import { timestampFromDate } from "@bufbuild/protobuf/wkt";
import { Code, ConnectError } from "@connectrpc/connect";
import { toast, Toaster, TooltipProvider } from "@lemma/ui";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";

import { AgentEventSchema } from "@/gen/lemma/v1/agent_pb";
import {
    type ListMessagesResponse,
    ListMessagesResponseSchema,
    type MessageSchema,
    MessageStatus,
    SetMessageLabelResponseSchema,
} from "@/gen/lemma/v1/session_pb";

import { useActiveSession } from "../store";
import type { ModelOption } from "../useModelSelection";
import {
    type SessionDirectoryControl,
    type SessionProviderGroup,
    SessionView,
    type SessionViewProps,
} from "./SessionView";

type MessageInit = MessageInitShape<typeof MessageSchema>;
type MessageExtra = Omit<
    Extract<MessageInit, { $typeName?: never }>,
    "$typeName"
>;

type Stream = AsyncIterable<{ event?: unknown }>;

const firstButton = (name: string): HTMLElement => {
    const [button] = screen.getAllByRole("button", { name });
    if (button === undefined) {
        throw new TypeError(`missing ${name} button`);
    }
    return button;
};

const rpc = vi.hoisted(() => ({
    listMessages:
        vi.fn<(req: { sessionId: string }) => Promise<ListMessagesResponse>>(),
    setSessionLeaf:
        vi.fn<
            (req: { sessionId: string; leafId?: string }) => Promise<unknown>
        >(),
    setMessageLabel:
        vi.fn<
            (req: {
                sessionId: string;
                messageId: string;
                label: string;
            }) => Promise<unknown>
        >(),
    sendMessage:
        vi.fn<
            (req: {
                sessionId: string;
                content: string;
                providerId: string;
                model: string;
                parentId?: string;
            }) => Stream
        >(),
    abortMessage: vi.fn<(req: { messageId: string }) => Promise<unknown>>(),
}));

vi.mock("@/rpc/clients", () => ({
    agentClient: {
        sendMessage: rpc.sendMessage,
        abortMessage: rpc.abortMessage,
    },
    sessionClient: {
        listMessages: rpc.listMessages,
        setSessionLeaf: rpc.setSessionLeaf,
        setMessageLabel: rpc.setMessageLabel,
    },
}));

const defaultOptions: ModelOption[] = [
    { providerId: "p1", model: "m1", providerName: "Acme" },
];

const defaultProviders: SessionProviderGroup[] = [
    { id: "p1", name: "Acme", enabled: true, models: [{ id: "m1" }] },
];

const defaultDirectoryControl: SessionDirectoryControl = {
    directory: undefined,
    recentDirectories: [],
    canPickDirectory: false,
};

const protoMessage = (
    id: string,
    role: string,
    content: string,
    extra: MessageExtra = {},
): MessageInit => ({
    id,
    role,
    content,
    status: MessageStatus.DONE,
    providerId: role === "assistant" ? "p1" : "",
    model: role === "assistant" ? "m1" : "",
    createdAt: timestampFromDate(new Date(2026, 9, 31, 9, 5)),
    ...extra,
});

const history = (messages: MessageInit[], leafId = ""): ListMessagesResponse =>
    create(ListMessagesResponseSchema, {
        messages: messages.toReversed(),
        leafId,
    });

const doneStream = async function* () {
    await Promise.resolve();
    yield {
        event: create(AgentEventSchema, { kind: { case: "done", value: {} } }),
    };
};

const renderActive = (props: Partial<SessionViewProps> = {}) =>
    render(
        <TooltipProvider>
            <Toaster />
            <SessionView
                sessionId="c1"
                directoryControl={defaultDirectoryControl}
                modelOptions={defaultOptions}
                providers={defaultProviders}
                onOpenProviders={vi.fn<() => void>()}
                onCreateSession={() => Promise.resolve("new")}
                {...props}
            />
        </TooltipProvider>,
    );

const composer = () =>
    screen.getByRole("textbox", { name: "Message the assistant…" });

beforeEach(() => {
    useActiveSession.setState(useActiveSession.getInitialState());
    localStorage.clear();
    vi.resetAllMocks();
    toast.dismiss();
    rpc.listMessages.mockResolvedValue(history([]));
    rpc.sendMessage.mockImplementation(doneStream);
    rpc.abortMessage.mockResolvedValue({});
    rpc.setSessionLeaf.mockResolvedValue({});
    rpc.setMessageLabel.mockImplementation(({ label }) =>
        Promise.resolve(
            create(SetMessageLabelResponseSchema, {
                message: protoMessage("u1", "user", "q", { label }),
            }),
        ),
    );
});

it("inspects timeline steps and markdown code blocks in the right pane", async () => {
    const user = userEvent.setup();
    rpc.listMessages.mockResolvedValue(
        history(
            [
                protoMessage("u1", "user", "Explain code"),
                protoMessage("a1", "assistant", "", {
                    parentId: "u1",
                    thinking: "Checking files",
                    thinkingStartedAt: timestampFromDate(new Date(1000)),
                    thinkingFinishedAt: timestampFromDate(new Date(2200)),
                    toolCalls: [
                        {
                            id: "tc1",
                            name: "read_file",
                            arguments: '{"path":"src/app.ts"}',
                        },
                        {
                            id: "tc2",
                            name: "bash",
                            arguments: '{"command":"npm test"}',
                        },
                        {
                            id: "tc3",
                            name: "web_search",
                            arguments: '{"query":"lemma"}',
                        },
                    ],
                }),
                protoMessage("t1", "tool", '"const x = 1;"', {
                    parentId: "a1",
                    toolResult: { toolCallId: "tc1", isError: false },
                }),
                protoMessage("t2", "tool", '{"stderr":"boom","exit_code":1}', {
                    parentId: "t1",
                    toolResult: { toolCallId: "tc2", isError: true },
                }),
                protoMessage(
                    "t3",
                    "tool",
                    JSON.stringify({
                        provider: "brave",
                        results: [
                            {
                                title: "Lemma Docs",
                                url: "https://lemma.example",
                                snippet: "Docs summary",
                            },
                        ],
                    }),
                    {
                        parentId: "t2",
                        toolResult: { toolCallId: "tc3", isError: false },
                    },
                ),
                protoMessage(
                    "a2",
                    "assistant",
                    "Here it is:\n\n```ts\nconst answer = 42;\n```\n",
                    { parentId: "t3" },
                ),
            ],
            "a2",
        ),
    );

    renderActive();
    await user.click(
        await screen.findByRole("button", { name: /Thought 1\.2s/u }),
    );
    await user.click(screen.getByRole("button", { name: /Checking files/u }));
    expect(
        await screen.findByRole("heading", { level: 2, name: "Thought" }),
    ).toBeDefined();

    await user.click(screen.getByRole("button", { name: /src\/app\.ts/u }));
    expect(
        await screen.findByRole("heading", { level: 2, name: "src/app.ts" }),
    ).toBeDefined();
    expect(screen.getByText("const x = 1;")).toBeDefined();

    await user.click(screen.getByRole("button", { name: /^bash\s*npm test/u }));
    expect(screen.getAllByText("Failed · fixed later")).toHaveLength(2);
    expect(screen.getByText(/boom/u)).toBeDefined();

    await user.click(screen.getByRole("button", { name: /lemma/u }));
    expect(screen.getByRole("link", { name: /Lemma Docs/u })).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("heading", { level: 2 })).toBeNull();

    await user.click(
        await screen.findByRole("button", { name: "Open on right" }),
    );
    expect(
        await screen.findByRole("heading", { level: 2, name: "ts" }),
    ).toBeDefined();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("heading", { level: 2, name: "ts" })).toBeNull();
});

it("toggles tree with Ctrl+K, switches branches, rewinds, restores, and labels nodes", async () => {
    const user = userEvent.setup();
    rpc.listMessages.mockResolvedValue(
        history(
            [
                protoMessage("u1", "user", "First question"),
                protoMessage("a1", "assistant", "First reply", {
                    parentId: "u1",
                }),
                protoMessage("a1b", "assistant", "Alt reply", {
                    parentId: "u1",
                }),
            ],
            "a1",
        ),
    );

    renderActive();
    expect(await screen.findByText("First reply")).toBeDefined();

    fireEvent.keyDown(window, { key: "k", ctrlKey: true, altKey: true });
    expect(screen.queryByText("Session tree")).toBeNull();

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(await screen.findByText("Session tree")).toBeDefined();
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    expect(screen.queryByText("Session tree")).toBeNull();

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    await user.click(await screen.findByRole("button", { name: /Alt reply/u }));
    await waitFor(() => {
        expect(rpc.setSessionLeaf).toHaveBeenCalledWith({
            sessionId: "c1",
            leafId: "a1b",
        });
    });

    rpc.setMessageLabel.mockRejectedValueOnce(new Error("label failed"));
    await user.click(firstButton("Label"));
    await user.type(
        screen.getByRole("textbox", { name: "Label…" }),
        "important{Enter}",
    );
    expect(
        await screen.findByText("Something went wrong, please try again"),
    ).toBeDefined();

    rpc.setSessionLeaf.mockRejectedValueOnce(new Error("leaf failed"));
    await user.click(screen.getByRole("button", { name: /First reply/u }));
    await waitFor(() => {
        expect(rpc.setSessionLeaf).toHaveBeenCalledTimes(2);
    });

    await user.click(screen.getByRole("button", { name: /First question/u }));
    expect(screen.queryByText("Session tree")).toBeNull();
    expect(composer()).toHaveProperty("value", "First question");

    await user.click(screen.getByRole("button", { name: "Restore branch" }));
    expect(composer()).toHaveProperty("value", "");

    await user.click(screen.getByRole("button", { name: /Tree/u }));
    expect(await screen.findByText("Session tree")).toBeDefined();
    await user.click(screen.getByRole("button", { name: /Tree/u }));
    expect(screen.queryByText("Session tree")).toBeNull();
    await user.click(screen.getByRole("button", { name: /Tree/u }));
    useActiveSession.setState({ streaming: true });
    await user.click(
        await screen.findByRole("button", { name: /First question/u }),
    );
    expect(composer()).toHaveProperty("value", "");
    useActiveSession.setState({ streaming: false });
    await user.click(screen.getByRole("button", { name: "Close" }));
});

it("retries failed turns with or without selected model and handles retry errors", async () => {
    const user = userEvent.setup();
    rpc.listMessages.mockResolvedValue(
        history(
            [
                protoMessage("u0", "user", "First"),
                protoMessage("a0", "assistant", "Done", { parentId: "u0" }),
                protoMessage("u1", "user", "Run task", { parentId: "a0" }),
                protoMessage("a1", "assistant", "", {
                    parentId: "u1",
                    status: MessageStatus.ERROR,
                    error: "Upstream 500",
                    providerId: "p-err",
                    model: "m-err",
                }),
            ],
            "a1",
        ),
    );

    const { rerender } = renderActive({ modelOptions: [], providers: [] });
    expect(await screen.findByText("Upstream 500")).toBeDefined();

    rpc.sendMessage.mockImplementationOnce(() => ({
        [Symbol.asyncIterator]: () => ({
            next: () =>
                Promise.reject(new ConnectError("down", Code.Unavailable)),
        }),
    }));
    await user.click(screen.getByRole("button", { name: "Retry with m-err" }));
    await waitFor(() => {
        expect(rpc.sendMessage).toHaveBeenCalledWith(
            expect.objectContaining({
                sessionId: "c1",
                content: "Run task",
                providerId: "p-err",
                model: "m-err",
                parentId: "a0",
            }),
            expect.anything(),
        );
    });
    expect(
        await screen.findByText(
            "Can't reach the server, check your connection and try again",
        ),
    ).toBeDefined();

    rerender(
        <TooltipProvider>
            <Toaster />
            <SessionView
                sessionId="c1"
                directoryControl={defaultDirectoryControl}
                modelOptions={defaultOptions}
                providers={defaultProviders}
                onOpenProviders={vi.fn<() => void>()}
                onCreateSession={() => Promise.resolve("new")}
            />
        </TooltipProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Switch model" }));
    expect(
        await screen.findByRole("searchbox", { name: "Search models…" }),
    ).toBeDefined();
    await user.keyboard("{Escape}");

    await user.click(screen.getByRole("button", { name: "Retry with m1" }));
    await waitFor(() => {
        expect(rpc.sendMessage).toHaveBeenLastCalledWith(
            expect.objectContaining({
                providerId: "p1",
                model: "m1",
                parentId: "a0",
            }),
            expect.anything(),
        );
    });

    useActiveSession.setState({
        send: () => Promise.reject(new Error("retry boom")),
    });
    await user.click(screen.getByRole("button", { name: "Retry with m1" }));
    expect(
        await screen.findByText("Something went wrong, please try again"),
    ).toBeDefined();

    await useActiveSession.getState().open("c1");
    rpc.listMessages.mockResolvedValueOnce(
        history(
            [
                protoMessage("u0", "user", "First"),
                protoMessage("a0", "assistant", "", {
                    parentId: "u0",
                    status: MessageStatus.ERROR,
                    error: "Root error",
                    providerId: "p-err",
                    model: "m-err",
                }),
            ],
            "a0",
        ),
    );
    await useActiveSession.getState().open("c2");
    expect(await screen.findByText("Root error")).toBeDefined();
    useActiveSession.setState({
        send: vi.fn<() => Promise<void>>(() => Promise.resolve()),
    });
    await user.click(screen.getByRole("button", { name: "Retry with m1" }));
    expect(useActiveSession.getState().send).toHaveBeenCalledWith(
        "p1",
        "m1",
        "First",
        "",
    );
});

it("renders streaming step, abort button, and reconnect indicators", async () => {
    const user = userEvent.setup();
    renderActive();
    await waitFor(() => {
        expect(rpc.listMessages).toHaveBeenCalled();
    });

    const abort = vi.fn<() => Promise<void>>(() => Promise.resolve());
    useActiveSession.setState({
        abort,
        streaming: true,
        turnStartedAtMs: null,
        currentStep: { kind: "tool", name: "bash" },
        reconnectingOffset: null,
    });
    expect(await screen.findByText("Running bash…")).toBeDefined();
    await user.click(screen.getByRole("button", { name: "Stop" }));
    expect(abort).toHaveBeenCalledOnce();

    useActiveSession.setState({
        streaming: true,
        turnStartedAtMs: Date.now(),
        currentStep: { kind: "thinking" },
        reconnectingOffset: 12,
    });
    expect(
        await screen.findAllByText(
            "Connection interrupted, resuming from event 12…",
        ),
    ).toHaveLength(2);
});
