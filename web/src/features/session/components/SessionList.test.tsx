import { create } from "@bufbuild/protobuf";
import { timestampFromDate } from "@bufbuild/protobuf/wkt";
import { Code, ConnectError } from "@connectrpc/connect";
import { SidebarProvider, Toaster, TooltipProvider } from "@lemma/ui";
import { render, screen } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { type Session, SessionSchema } from "@/gen/lemma/v1/session_pb";

import { clearSessions } from "../useSessions";
import { SessionList } from "./SessionList";

type Reply = { session?: Session | undefined };

const rpc = vi.hoisted(() => ({
    listSessions: vi.fn<(req: object) => Promise<{ sessions: Session[] }>>(),
    renameSession:
        vi.fn<(req: { id: string; title: string }) => Promise<Reply>>(),
    deleteSession: vi.fn<(req: { id: string }) => Promise<object>>(),
}));

vi.mock("@/rpc/clients", () => ({ sessionClient: rpc }));

const NOW = new Date(2026, 9, 31, 12, 0, 0).getTime();
const DAY = 24 * 60 * 60 * 1000;

const session = (id: string, title: string, ageMs: number) =>
    create(SessionSchema, {
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
                <SessionList activeId="c1" onOpen={onOpen} />
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
    clearSessions();
    rpc.listSessions.mockResolvedValue({
        sessions: [
            session("c1", "Trip plans", 0),
            session("c2", "", DAY),
            session("c3", "Budget", 3 * DAY),
            session("c4", "Old notes", 30 * DAY),
        ],
    });
    rpc.renameSession.mockImplementation(({ id, title }) =>
        Promise.resolve({ session: session(id, title, 0) }),
    );
    rpc.deleteSession.mockResolvedValue({});
});

afterEach(() => {
    vi.useRealTimers();
});

it("shows placeholders, then sessions grouped by recency", async () => {
    renderList();

    expect(screen.getByRole("status", { name: "Loading…" })).toBeDefined();
    expect(await screen.findByText("Trip plans")).toBeDefined();
    expect(
        screen
            .getAllByText(/^(Today|Yesterday|Last 7 days|Earlier)$/u)
            .map((label) => label.textContent),
    ).toEqual(["Today", "Yesterday", "Last 7 days", "Earlier"]);
    expect(screen.getByText("New session")).toBeDefined();
    expect(
        screen.getByText("Trip plans").closest("button")?.dataset["active"],
    ).toBeDefined();
    expect(
        screen.getByText("Budget").closest("button")?.dataset["active"],
    ).toBeUndefined();
});

it("opens a session and loads the list only once", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn<(id: string) => void>();
    const { unmount } = renderList(onOpen);

    await user.click(await screen.findByText("Budget"));
    unmount();
    renderList();
    await screen.findByText("Budget");

    expect(onOpen).toHaveBeenCalledWith("c3");
    expect(rpc.listSessions).toHaveBeenCalledOnce();
});

it("renames with Enter and keeps the trimmed title", async () => {
    const user = userEvent.setup();
    renderList();

    const input = await startRename(user, "Budget");
    await user.clear(input);
    await user.type(input, "  2027 budget {Enter}");

    expect(await screen.findByText("2027 budget")).toBeDefined();
    expect(rpc.renameSession).toHaveBeenCalledWith({
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

    expect(rpc.renameSession).toHaveBeenCalledWith({
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
    expect(rpc.renameSession).not.toHaveBeenCalled();
});

it("reports a failed rename", async () => {
    const user = userEvent.setup();
    rpc.renameSession.mockRejectedValue(
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

it("deletes a session once, only after confirmation", async () => {
    const user = userEvent.setup();
    renderList();

    await openActions(user, "Old notes");
    await user.click(
        await screen.findByRole("menuitem", { name: "Delete permanently" }),
    );
    await user.click(await screen.findByRole("button", { name: "Cancel" }));
    expect(rpc.deleteSession).not.toHaveBeenCalled();

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
            screen.queryByText("Permanently delete this session?"),
        ).toBeNull();
    });
    expect(rpc.deleteSession).toHaveBeenCalledOnce();
    expect(rpc.deleteSession).toHaveBeenCalledWith({ id: "c4" });
});
