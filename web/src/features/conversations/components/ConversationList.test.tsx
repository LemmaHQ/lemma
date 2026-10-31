import { create } from "@bufbuild/protobuf";
import { timestampFromDate } from "@bufbuild/protobuf/wkt";
import { Code, ConnectError } from "@connectrpc/connect";
import { SidebarProvider, Toaster, TooltipProvider } from "@lemma/ui";
import { render, screen } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import {
    type Conversation,
    ConversationSchema,
} from "@/gen/lemma/v1/conversation_pb";

import { clearConversations } from "../useConversations";
import { ConversationList } from "./ConversationList";

type Reply = { conversation?: Conversation | undefined };

const rpc = vi.hoisted(() => ({
    listConversations:
        vi.fn<(req: object) => Promise<{ conversations: Conversation[] }>>(),
    renameConversation:
        vi.fn<(req: { id: string; title: string }) => Promise<Reply>>(),
    deleteConversation: vi.fn<(req: { id: string }) => Promise<object>>(),
}));

vi.mock("@/rpc/clients", () => ({ conversationClient: rpc }));

const NOW = new Date(2026, 9, 31, 12, 0, 0).getTime();
const DAY = 24 * 60 * 60 * 1000;

const conversation = (id: string, title: string, ageMs: number) =>
    create(ConversationSchema, {
        id,
        title,
        updatedAt: timestampFromDate(new Date(NOW - ageMs)),
    });

const renderList = (onOpen = vi.fn<(id: string) => void>()) =>
    render(
        <TooltipProvider>
            <Toaster />
            <SidebarProvider
                open
                onOpenChange={() => {}}
                width={null}
                onWidthChange={() => {}}
            >
                <ConversationList activeId="c1" onOpen={onOpen} />
            </SidebarProvider>
        </TooltipProvider>,
    );

const openActions = async (user: UserEvent, title: string) => {
    const row = (await screen.findByText(title)).closest("li");
    const trigger = row?.querySelector('[aria-label="More actions"]');
    if (!(trigger instanceof HTMLElement)) {
        throw new TypeError(`no actions for ${title}`);
    }
    await user.click(trigger);
};

const startRename = async (user: UserEvent, title: string) => {
    await openActions(user, title);
    await user.click(await screen.findByRole("menuitem", { name: "Rename" }));
    return screen.getByRole("textbox", { name: "Rename" });
};

beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
    clearConversations();
    rpc.listConversations.mockResolvedValue({
        conversations: [
            conversation("c1", "Trip plans", 0),
            conversation("c2", "", DAY),
            conversation("c3", "Budget", 3 * DAY),
            conversation("c4", "Old notes", 30 * DAY),
        ],
    });
    rpc.renameConversation.mockImplementation(({ id, title }) =>
        Promise.resolve({ conversation: conversation(id, title, 0) }),
    );
    rpc.deleteConversation.mockResolvedValue({});
});

afterEach(() => {
    vi.useRealTimers();
});

it("shows placeholders, then conversations grouped by recency", async () => {
    renderList();

    expect(screen.getByRole("status", { name: "Loading…" })).toBeDefined();
    expect(await screen.findByText("Trip plans")).toBeDefined();
    expect(
        screen
            .getAllByText(/^(Today|Yesterday|Last 7 days|Earlier)$/u)
            .map((label) => label.textContent),
    ).toEqual(["Today", "Yesterday", "Last 7 days", "Earlier"]);
    expect(screen.getByText("New conversation")).toBeDefined();
    expect(
        screen.getByText("Trip plans").closest("button")?.dataset["active"],
    ).toBeDefined();
    expect(
        screen.getByText("Budget").closest("button")?.dataset["active"],
    ).toBeUndefined();
});

it("opens a conversation and loads the list only once", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn<(id: string) => void>();
    const { unmount } = renderList(onOpen);

    await user.click(await screen.findByText("Budget"));
    unmount();
    renderList();
    await screen.findByText("Budget");

    expect(onOpen).toHaveBeenCalledWith("c3");
    expect(rpc.listConversations).toHaveBeenCalledOnce();
});

it("renames with Enter and keeps the trimmed title", async () => {
    const user = userEvent.setup();
    renderList();

    const input = await startRename(user, "Budget");
    await user.clear(input);
    await user.type(input, "  2027 budget {Enter}");

    expect(await screen.findByText("2027 budget")).toBeDefined();
    expect(rpc.renameConversation).toHaveBeenCalledWith({
        id: "c3",
        title: "2027 budget",
    });
});

it("renames when the field loses focus", async () => {
    const user = userEvent.setup();
    renderList();

    const input = await startRename(user, "Budget");
    await user.type(input, "!");
    await user.click(screen.getByText("Trip plans"));

    expect(rpc.renameConversation).toHaveBeenCalledWith({
        id: "c3",
        title: "Budget!",
    });
});

it.each([
    ["Escape cancels", "{Escape}"],
    ["an unchanged title", "{Enter}"],
    ["a blank title", "{Control>}a{/Control}{Backspace}  {Enter}"],
])("keeps the title when %s", async (_case, keys) => {
    const user = userEvent.setup();
    renderList();

    const input = await startRename(user, "Budget");
    await user.type(input, keys);

    expect(await screen.findByText("Budget")).toBeDefined();
    expect(rpc.renameConversation).not.toHaveBeenCalled();
});

it("reports a failed rename", async () => {
    const user = userEvent.setup();
    rpc.renameConversation.mockRejectedValue(
        new ConnectError("down", Code.Unavailable),
    );
    renderList();

    const input = await startRename(user, "Budget");
    await user.type(input, "!{Enter}");

    expect(
        await screen.findByText(
            "Can't reach the server, check your connection and try again",
        ),
    ).toBeDefined();
});

it("deletes a conversation once, only after confirmation", async () => {
    const user = userEvent.setup();
    renderList();

    await openActions(user, "Old notes");
    await user.click(
        await screen.findByRole("menuitem", { name: "Delete permanently" }),
    );
    await user.click(await screen.findByRole("button", { name: "Cancel" }));
    expect(rpc.deleteConversation).not.toHaveBeenCalled();

    await openActions(user, "Old notes");
    await user.click(
        await screen.findByRole("menuitem", { name: "Delete permanently" }),
    );
    const confirm = await screen.findByRole("button", {
        name: "Delete permanently",
    });
    const exit = new Animation(
        new KeyframeEffect(document.body, [{ opacity: 1 }, { opacity: 0 }], {
            duration: 60_000,
        }),
    );
    exit.play();
    const animations = vi
        .spyOn(Element.prototype, "getAnimations")
        .mockReturnValue([exit]);
    await user.dblClick(confirm);
    exit.finish();
    animations.mockRestore();

    await vi.waitFor(() => {
        expect(screen.queryByText("Old notes")).toBeNull();
        expect(
            screen.queryByText("Permanently delete this conversation?"),
        ).toBeNull();
    });
    expect(rpc.deleteConversation).toHaveBeenCalledOnce();
    expect(rpc.deleteConversation).toHaveBeenCalledWith({ id: "c4" });
});
