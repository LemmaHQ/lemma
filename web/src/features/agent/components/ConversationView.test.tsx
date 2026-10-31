import { create } from "@bufbuild/protobuf";
import { Code, ConnectError } from "@connectrpc/connect";
import { Toaster, TooltipProvider } from "@lemma/ui";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, expect, it, vi } from "vitest";

import { AgentEventSchema } from "@/gen/lemma/v1/agent_pb";
import {
    type ListMessagesResponse,
    ListMessagesResponseSchema,
} from "@/gen/lemma/v1/conversation_pb";

import { clearActiveConversation, useActiveConversation } from "../store";
import type { ModelOption } from "../useModelSelection";
import { ConversationView } from "./ConversationView";

type Stream = AsyncIterable<{ event?: unknown }>;

const rpc = vi.hoisted(() => ({
    listMessages:
        vi.fn<
            (req: { conversationId: string }) => Promise<ListMessagesResponse>
        >(),
    sendMessage:
        vi.fn<
            (req: {
                conversationId: string;
                content: string;
                providerId: string;
                model: string;
            }) => Stream
        >(),
}));

vi.mock("@/rpc/clients", () => ({
    agentClient: { sendMessage: rpc.sendMessage },
    conversationClient: { listMessages: rpc.listMessages },
}));

const options: ModelOption[] = [
    { providerId: "p1", model: "m1", providerName: "Acme" },
];

const doneStream = async function* () {
    await Promise.resolve();
    yield {
        event: create(AgentEventSchema, { kind: { case: "done", value: {} } }),
    };
};

const renderView = (
    props: Partial<Parameters<typeof ConversationView>[0]> = {},
) =>
    render(
        <MemoryRouter>
            <TooltipProvider>
                <Toaster />
                <ConversationView
                    conversationId="c1"
                    modelOptions={options}
                    providerNames={new Map([["p1", "Acme"]])}
                    providersPath="/settings/providers"
                    onCreateConversation={() => Promise.resolve("new")}
                    {...props}
                />
            </TooltipProvider>
        </MemoryRouter>,
    );

const history = (
    messages: { id: string; role: string; content: string }[],
): ListMessagesResponse =>
    create(ListMessagesResponseSchema, { messages: messages.toReversed() });

const composer = () =>
    screen.getByRole("textbox", { name: "Message the assistant…" });

beforeEach(() => {
    clearActiveConversation();
    localStorage.clear();
    vi.resetAllMocks();
    rpc.listMessages.mockResolvedValue(history([]));
    rpc.sendMessage.mockImplementation(doneStream);
});

it("opens the conversation and sends the trimmed draft with the chosen model", async () => {
    const user = userEvent.setup();
    renderView();

    expect(await screen.findByText("How can I help you today?")).toBeDefined();
    expect(rpc.listMessages).toHaveBeenCalledWith(
        expect.objectContaining({ conversationId: "c1" }),
    );
    await user.type(composer(), "  hello  ");
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByText("hello")).toBeDefined();
    expect(rpc.sendMessage.mock.lastCall?.[0]).toEqual({
        conversationId: "c1",
        content: "hello",
        providerId: "p1",
        model: "m1",
    });
    expect(composer()).toHaveProperty("value", "");
});

it("keeps the draft when Enter is pressed while a reply streams", async () => {
    const user = userEvent.setup();
    renderView();
    await screen.findByText("How can I help you today?");
    useActiveConversation.setState({ streaming: true });

    await user.type(composer(), "follow-up{Enter}");

    expect(rpc.sendMessage).not.toHaveBeenCalled();
    expect(composer()).toHaveProperty("value", "follow-up");
});

it("fills the composer with a picked suggestion", async () => {
    const user = userEvent.setup();
    renderView();

    await user.click(
        await screen.findByRole("button", {
            name: "Help me debug an issue",
        }),
    );

    expect(composer()).toHaveProperty("value", "Help me debug an issue");
    expect(document.activeElement).toBe(composer());
});

it("creates a conversation from the home composer before sending", async () => {
    const user = userEvent.setup();
    const onCreateConversation = vi.fn<() => Promise<string>>(() =>
        Promise.resolve("new"),
    );
    renderView({ conversationId: null, onCreateConversation });

    await user.type(composer(), "start here");
    await user.click(screen.getByRole("button", { name: "Send" }));

    await vi.waitFor(() => {
        expect(rpc.sendMessage).toHaveBeenCalled();
    });
    expect(onCreateConversation).toHaveBeenCalledOnce();
    expect(rpc.sendMessage.mock.lastCall?.[0]).toMatchObject({
        conversationId: "new",
        content: "start here",
    });
});

it("shows a toast when the conversation cannot be created", async () => {
    const user = userEvent.setup();
    renderView({
        conversationId: null,
        onCreateConversation: () =>
            Promise.reject(new ConnectError("down", Code.Unavailable)),
    });

    await user.type(composer(), "start here");
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(
        await screen.findByText(
            "Can't reach the server, check your connection and try again",
        ),
    ).toBeDefined();
    expect(rpc.sendMessage).not.toHaveBeenCalled();
});

it("holds a home send while an earlier reply still streams", async () => {
    const user = userEvent.setup();
    const onCreateConversation = vi.fn<() => Promise<string>>(() =>
        Promise.resolve("new"),
    );
    useActiveConversation.setState({ streaming: true });
    renderView({ conversationId: null, onCreateConversation });

    await user.type(composer(), "next");
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(onCreateConversation).not.toHaveBeenCalled();
});

it("points to the provider settings without a model", () => {
    renderView({ conversationId: null, modelOptions: [] });

    expect(composer()).toHaveProperty("disabled", true);
    expect(
        screen.getByText("Open settings").closest("a")?.getAttribute("href"),
    ).toBe("/settings/providers");
});

it("regenerates the last reply from the user message before it", async () => {
    const user = userEvent.setup();
    rpc.listMessages.mockResolvedValue(
        history([
            { id: "u1", role: "user", content: "first question" },
            { id: "a1", role: "assistant", content: "calling a tool" },
            { id: "a2", role: "assistant", content: "final answer" },
        ]),
    );
    renderView();

    await user.click(await screen.findByRole("button", { name: "Regenerate" }));

    await vi.waitFor(() => {
        expect(rpc.sendMessage.mock.lastCall?.[0]).toMatchObject({
            content: "first question",
        });
    });
    expect(screen.getAllByRole("button", { name: "Regenerate" })).toHaveLength(
        1,
    );
});

it("cannot regenerate without a model", async () => {
    const user = userEvent.setup();
    rpc.listMessages.mockResolvedValue(
        history([
            { id: "u1", role: "user", content: "question" },
            { id: "a1", role: "assistant", content: "answer" },
        ]),
    );
    renderView({ modelOptions: [] });

    await user.click(await screen.findByRole("button", { name: "Regenerate" }));

    expect(rpc.sendMessage).not.toHaveBeenCalled();
});

it("stops a streaming reply from the composer", async () => {
    const user = userEvent.setup();
    const abort = vi.fn<() => Promise<void>>(() => Promise.resolve());
    useActiveConversation.setState({ abort });
    rpc.listMessages.mockReturnValue(Promise.withResolvers<never>().promise);
    renderView();
    useActiveConversation.setState({
        conversationId: "c1",
        streaming: true,
        items: [
            {
                id: "a1",
                role: "assistant",
                content: "partial",
                thinking: "",
                status: "streaming",
                providerId: "p1",
                model: "m1",
                toolCalls: [],
            },
        ],
    });

    await user.click(
        await screen.findByRole("button", { name: "Stop generating" }),
    );

    expect(abort).toHaveBeenCalledOnce();
});
