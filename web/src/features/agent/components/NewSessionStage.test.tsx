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
} from "@/gen/lemma/v1/session_pb";

import { useActiveSessionStore } from "../store";
import type { ModelOption } from "../useModelSelection";
import { NewSessionStage, type NewSessionStageProps } from "./NewSessionStage";
import type { SessionProviderGroup } from "./SessionComposer";
import type { SessionDirectoryControl } from "./SessionFolderPicker";

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
            }) => AsyncIterable<{ event?: unknown }>
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
    { id: "p1", name: "Acme", enabled: true, models: [{ id: "m1" }] },
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

const renderStage = (props: Partial<NewSessionStageProps> = {}) =>
    render(
        <TooltipProvider>
            <Toaster />
            <NewSessionStage
                directoryControl={defaultDirectoryControl}
                modelOptions={defaultOptions}
                providers={defaultProviders}
                onOpenProviders={vi.fn<() => void>()}
                onCreateSession={() => Promise.resolve("new")}
                {...props}
            />
        </TooltipProvider>,
    );

beforeEach(() => {
    useActiveSessionStore.getState().reset();
    localStorage.clear();
    vi.resetAllMocks();
    rpc.listMessages.mockResolvedValue(
        create(ListMessagesResponseSchema, { messages: [] }),
    );
    rpc.sendMessage.mockImplementation(doneStream);
});

it("creates a new session without pre-send listMessages, preserves draft on failure, and disables without models", async () => {
    const user = userEvent.setup();
    const onCreateSession = vi.fn<(directory?: string) => Promise<string>>(() =>
        Promise.resolve("new"),
    );

    const { rerender } = renderStage({
        directoryControl: {
            directory: "/work/custom",
            recentDirectories: [],
            canPickDirectory: false,
        },
        onCreateSession,
    });

    const composer = screen.getByRole("textbox", {
        name: "Message the assistant…",
    });
    await user.type(composer, "start here");
    await user.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => {
        expect(rpc.sendMessage).toHaveBeenCalled();
    });
    expect(onCreateSession).toHaveBeenCalledWith("/work/custom");
    expect(rpc.listMessages).toHaveBeenCalledTimes(1);
    expect(rpc.sendMessage.mock.lastCall?.[0]).toMatchObject({
        sessionId: "new",
        content: "start here",
    });

    rerender(
        <TooltipProvider>
            <Toaster />
            <NewSessionStage
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
    const failedComposer = screen.getByRole("textbox", {
        name: "Message the assistant…",
    });
    await user.type(failedComposer, "keep on failure");
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(
        await screen.findByText(
            "Can't reach the server, check your connection and try again",
        ),
    ).toBeDefined();
    expect(failedComposer).toHaveProperty("value", "keep on failure");

    rerender(
        <TooltipProvider>
            <Toaster />
            <NewSessionStage
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
