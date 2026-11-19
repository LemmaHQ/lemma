import { create } from "@bufbuild/protobuf";
import { timestampFromDate } from "@bufbuild/protobuf/wkt";
import { Code, ConnectError } from "@connectrpc/connect";
import { SidebarProvider, Toaster, TooltipProvider } from "@lemma/ui";
import { act, render, screen } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { SessionSchema, type Session } from "@/gen/lemma/v1/session_pb";

import { useSessionStore } from "../store";
import { SessionList, type SessionListProps } from "./SessionList";

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

const session = (
    id: string,
    title: string,
    ageMs?: number,
    directory?: string,
    extra?: { activeMessageId?: string },
) =>
    create(SessionSchema, {
        id,
        title,
        ...(ageMs === undefined
            ? {}
            : { updatedAt: timestampFromDate(new Date(NOW - ageMs)) }),
        ...(directory === undefined ? {} : { directory }),
        ...extra,
    });

const renderList = (props: Partial<SessionListProps> = {}) =>
    render(
        <TooltipProvider>
            <Toaster />
            <SidebarProvider open onOpenChange={() => {}}>
                <SessionList
                    activeSessionId="c1"
                    onSelectSession={vi.fn<(id: string) => void>()}
                    {...props}
                />
            </SidebarProvider>
        </TooltipProvider>,
    );
const rowOf = (title: string) => screen.getByText(title).closest("button");

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
    useSessionStore.setState(useSessionStore.getInitialState());
    rpc.listSessions.mockResolvedValue({
        sessions: [
            session("c1", "Trip plans", 0, "/work/alpha"),
            session("c2", "", DAY),
            session("c3", "Budget", 3 * DAY, "/work/alpha"),
            session("c4", "Old notes", 30 * DAY),
        ],
    });
    rpc.renameSession.mockImplementation(({ id, title }) =>
        Promise.resolve({ session: session(id, title, 0, "/work/alpha") }),
    );
    rpc.deleteSession.mockResolvedValue({});
});

afterEach(() => {
    vi.useRealTimers();
});

it("shows placeholders, then sessions grouped by directory with active markers", async () => {
    renderList();

    expect(screen.getByRole("status", { name: "Loading…" })).toBeDefined();
    expect(await screen.findByText("Trip plans")).toBeDefined();
    expect(
        screen
            .getAllByRole("button", { expanded: true })
            .map((button) => button.textContent),
    ).toEqual(["alpha", "Default workspace"]);
    expect(screen.getByText("New session")).toBeDefined();
    expect(
        screen.getByText("Trip plans").closest("button")?.dataset["active"],
    ).toBeDefined();
    expect(
        screen.getByText("Budget").closest("button")?.dataset["active"],
    ).toBeUndefined();
});

it("highlights the active new-session directory header and starts new sessions in directories", async () => {
    const user = userEvent.setup();
    const onNewInDirectory = vi.fn<(dir: string | undefined) => void>();
    renderList({
        activeSessionId: undefined,
        activeNewDirectory: "/work/alpha",
        isNewSessionView: true,
        onNewInDirectory,
    });

    const alphaToggle = await screen.findByRole("button", { name: "alpha" });
    const defaultToggle = screen.getByRole("button", {
        name: "Default workspace",
    });
    expect(alphaToggle.className).toContain("text-foreground");
    expect(defaultToggle.className).toContain("text-muted-foreground");

    await user.click(
        screen.getByRole("button", { name: "New session in alpha" }),
    );
    await user.click(
        screen.getByRole("button", {
            name: "New session in Default workspace",
        }),
    );

    expect(onNewInDirectory).toHaveBeenNthCalledWith(1, "/work/alpha");
    expect(onNewInDirectory).toHaveBeenNthCalledWith(2, undefined);
});

it("highlights Default workspace when new-session directory is undefined", async () => {
    renderList({
        activeSessionId: undefined,
        isNewSessionView: true,
    });

    const defaultToggle = await screen.findByRole("button", {
        name: "Default workspace",
    });
    expect(defaultToggle.className).toContain("text-foreground");
});

it("collapses and expands directory groups and reveals overflow sessions", async () => {
    const user = userEvent.setup();
    rpc.listSessions.mockResolvedValue({
        sessions: [
            session("s1", "One", 1000, "/work/many"),
            session("s2", "Two", 2000, "/work/many"),
            session("s3", "Three", 3000, "/work/many"),
            session("s4", "Four", 4000, "/work/many"),
            session("s5", "Five", 5000, "/work/many"),
            session("s6", "Six", 6000, "/work/many"),
        ],
    });
    renderList({ activeSessionId: undefined });

    expect(await screen.findByText("One")).toBeDefined();
    expect(screen.queryByText("Five")).toBeNull();
    const moreButton = screen.getByRole("button", { name: "2 more" });
    await user.click(moreButton);
    expect(screen.getByText("Five")).toBeDefined();
    expect(screen.getByText("Six")).toBeDefined();
    expect(screen.queryByRole("button", { name: "2 more" })).toBeNull();

    const toggle = screen.getByRole("button", { name: "many" });
    await user.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    await user.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
});

it("renders live, error, unseen-done, and hover-time trailing indicators", async () => {
    rpc.listSessions.mockResolvedValue({
        sessions: [
            session("live", "Live", 0, "/work/s", { activeMessageId: "m1" }),
            session("err", "Errored", 0, "/work/s"),
            session("done", "Unseen", 0, "/work/s"),
            session("activeDone", "ActiveDone", 0, "/work/s"),
            session("timed", "Timed", 0, "/work/t"),
            session("notime", "NoTime", undefined, "/work/t"),
        ],
    });

    renderList({ activeSessionId: "activeDone" });
    expect(await screen.findByText("Live")).toBeDefined();

    act(() => {
        const store = useSessionStore.getState();
        store.markTurnFinished("err", "error", false);
        store.markTurnFinished("done", "done", false);
        store.markTurnFinished("activeDone", "done", false);
    });

    expect(rowOf("Live")?.querySelector(".live-dot")).not.toBeNull();
    expect(
        rowOf("Errored")?.querySelector('[data-slot="session-error-dot"]'),
    ).not.toBeNull();
    expect(rowOf("Unseen")?.querySelector(".bg-completion")).not.toBeNull();
    expect(rowOf("ActiveDone")?.querySelector(".bg-completion")).toBeNull();
    expect(rowOf("Timed")?.textContent).toContain("12:00");
    expect(rowOf("NoTime")?.querySelector(".tabular-nums")).toBeNull();
});

it("opens a session, clears markers, and loads the list only once", async () => {
    const user = userEvent.setup();
    const onSelectSession = vi.fn<(id: string) => void>();
    const { unmount } = renderList({ onSelectSession });

    await screen.findByText("Budget");
    act(() => {
        useSessionStore.getState().markTurnFinished("c3", "done", false);
    });
    expect(
        screen
            .getByText("Budget")
            .closest("button")
            ?.querySelector(".bg-completion"),
    ).not.toBeNull();

    await user.click(screen.getByText("Budget"));
    expect(
        screen
            .getByText("Budget")
            .closest("button")
            ?.querySelector(".bg-completion"),
    ).toBeNull();

    unmount();
    renderList();
    await screen.findByText("Budget");

    expect(onSelectSession).toHaveBeenCalledWith("c3");
    expect(rpc.listSessions).toHaveBeenCalledOnce();
});

it("renames via dialog and keeps the trimmed title", async () => {
    const user = userEvent.setup();
    renderList();

    const input = await startRename(user, "Budget");
    await user.clear(input);
    await user.type(input, "  2027 budget ");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("2027 budget")).toBeDefined();
    expect(rpc.renameSession).toHaveBeenCalledWith({
        id: "c3",
        title: "2027 budget",
    });
});

it("keeps the title when Cancel closes rename", async () => {
    const user = userEvent.setup();
    renderList();

    await startRename(user, "Budget");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(await screen.findByText("Budget")).toBeDefined();
    expect(rpc.renameSession).not.toHaveBeenCalled();
});

it("keeps the title when unchanged title submits", async () => {
    const user = userEvent.setup();
    renderList();

    const input = await startRename(user, "Budget");
    await user.type(input, "{Enter}");

    expect(await screen.findByText("Budget")).toBeDefined();
    expect(rpc.renameSession).not.toHaveBeenCalled();
});

it("disables save when rename input is blank", async () => {
    const user = userEvent.setup();
    renderList();

    const input = await startRename(user, "Budget");
    await user.clear(input);
    await user.type(input, "   ");
    expect(screen.getByRole("button", { name: "Save" })).toHaveProperty(
        "disabled",
        true,
    );
    await user.type(input, "{Escape}");

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
        await screen.findByText("Connection failed, try again"),
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
