import { create } from "@bufbuild/protobuf";
import { Code, ConnectError } from "@connectrpc/connect";
import { Toaster, TooltipProvider } from "@lemma/ui";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";

import { AgentEventSchema } from "@/gen/lemma/v1/agent_pb";
import {
    type ListMessagesResponse,
    ListMessagesResponseSchema,
    MessageSchema,
} from "@/gen/lemma/v1/session_pb";

import { useActiveSession } from "../store";
import type { ModelOption } from "../useModelSelection";
import {
    type SessionDirectoryControl,
    type SessionProviderGroup,
    SessionView,
    type SessionViewProps,
} from "./SessionView";

type Stream = AsyncIterable<{ event?: unknown }>;

const rpc = vi.hoisted(() => ({
    listMessages:
        vi.fn<(req: { sessionId: string }) => Promise<ListMessagesResponse>>(),
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
}));

vi.mock("@/rpc/clients", () => ({
    agentClient: { sendMessage: rpc.sendMessage },
    sessionClient: { listMessages: rpc.listMessages },
}));

const defaultOptions: ModelOption[] = [
    { providerId: "p1", model: "m1", providerName: "Acme" },
];

const defaultProviders: SessionProviderGroup[] = [
    {
        id: "p1",
        name: "Acme",
        enabled: true,
        models: [{ id: "m1" }],
    },
];

const defaultDirectoryControl: SessionDirectoryControl = {
    directory: undefined,
    recentDirectories: ["/work/alpha"],
    canPickDirectory: false,
};

const doneStream = async function* () {
    await Promise.resolve();
    yield {
        event: create(AgentEventSchema, { kind: { case: "done", value: {} } }),
    };
};

const renderView = (props: Partial<SessionViewProps> = {}) =>
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
    rpc.listMessages.mockResolvedValue(
        create(ListMessagesResponseSchema, { messages: [] }),
    );
    rpc.sendMessage.mockImplementation(doneStream);
});

it("opens the session, sends a trimmed draft, and closes stale panes on session switch", async () => {
    const user = userEvent.setup();
    rpc.listMessages
        .mockResolvedValueOnce(
            create(ListMessagesResponseSchema, { messages: [] }),
        )
        .mockResolvedValueOnce(
            create(ListMessagesResponseSchema, {
                messages: [
                    create(MessageSchema, {
                        id: "u1",
                        role: "user",
                        content: "hello",
                    }),
                ],
                leafId: "u1",
            }),
        );
    const { rerender } = renderView();

    await waitFor(() => {
        expect(rpc.listMessages).toHaveBeenCalledWith({ sessionId: "c1" });
    });

    await user.type(composer(), "  hello  ");
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByText("hello")).toBeDefined();
    expect(rpc.sendMessage.mock.lastCall?.[0]).toEqual({
        sessionId: "c1",
        content: "hello",
        providerId: "p1",
        model: "m1",
    });
    expect(composer()).toHaveProperty("value", "");

    await user.click(screen.getByRole("button", { name: /Tree/u }));
    expect(await screen.findByText("Session tree")).toBeDefined();

    rerender(
        <TooltipProvider>
            <Toaster />
            <SessionView
                sessionId="c2"
                directoryControl={defaultDirectoryControl}
                modelOptions={defaultOptions}
                providers={defaultProviders}
                onOpenProviders={vi.fn<() => void>()}
                onCreateSession={() => Promise.resolve("new")}
            />
        </TooltipProvider>,
    );
    expect(screen.queryByText("Session tree")).toBeNull();
    await user.click(screen.getByRole("button", { name: /Tree/u }));
    expect(await screen.findByText("Session tree")).toBeDefined();
});

it("keeps draft when Enter is pressed during streaming", async () => {
    const user = userEvent.setup();
    renderView();
    await waitFor(() => {
        expect(rpc.listMessages).toHaveBeenCalled();
    });
    useActiveSession.setState({ streaming: true });

    await user.type(composer(), "follow-up{Enter}");

    expect(rpc.sendMessage).not.toHaveBeenCalled();
    expect(composer()).toHaveProperty("value", "follow-up");
});

it("creates a new session on first send, disables without models, and toasts errors", async () => {
    const user = userEvent.setup();
    const onCreateSession = vi.fn<(directory?: string) => Promise<string>>(() =>
        Promise.resolve("new"),
    );

    const { rerender } = renderView({
        sessionId: null,
        directoryControl: {
            directory: "/work/custom",
            recentDirectories: [],
            canPickDirectory: false,
        },
        onCreateSession,
    });

    await user.type(composer(), "start here");
    await user.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => {
        expect(rpc.sendMessage).toHaveBeenCalled();
    });
    expect(onCreateSession).toHaveBeenCalledWith("/work/custom");
    expect(rpc.sendMessage.mock.lastCall?.[0]).toMatchObject({
        sessionId: "new",
        content: "start here",
    });

    rerender(
        <TooltipProvider>
            <Toaster />
            <SessionView
                sessionId={null}
                directoryControl={defaultDirectoryControl}
                modelOptions={defaultOptions}
                providers={defaultProviders}
                onOpenProviders={vi.fn<() => void>()}
                onCreateSession={() =>
                    Promise.reject(new ConnectError("down", Code.Unavailable))
                }
            />
        </TooltipProvider>,
    );
    await user.type(composer(), "fail create");
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(
        await screen.findByText(
            "Can't reach the server, check your connection and try again",
        ),
    ).toBeDefined();

    rerender(
        <TooltipProvider>
            <Toaster />
            <SessionView
                sessionId={null}
                directoryControl={defaultDirectoryControl}
                modelOptions={[]}
                providers={[]}
                onOpenProviders={vi.fn<() => void>()}
                onCreateSession={onCreateSession}
            />
        </TooltipProvider>,
    );
    expect(
        screen.getByRole("textbox", {
            name: "Configure a provider and model to start…",
        }),
    ).toHaveProperty("disabled", true);
});
