import { create } from "@bufbuild/protobuf";
import { timestampFromDate } from "@bufbuild/protobuf/wkt";
import type { DesktopBridge } from "@lemma/desktop-contract";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Window as HappyWindow } from "happy-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { AgentEventSchema } from "@/gen/lemma/v1/agent_pb";
import {
    type Session,
    SessionSchema,
    ListMessagesResponseSchema,
} from "@/gen/lemma/v1/session_pb";
import {
    ApiFormat,
    type Provider,
    ProviderSchema,
    type WebProvider,
} from "@/gen/lemma/v1/provider_pb";

const rpc = vi.hoisted(() => ({
    listSessions: vi.fn<(req: object) => Promise<{ sessions: Session[] }>>(),
    createSession: vi.fn<(req: object) => Promise<{ session?: Session }>>(),
    listMessages: vi.fn<(req: object) => Promise<object>>(),
    listProviders: vi.fn<(req: object) => Promise<{ providers: Provider[] }>>(),
    listWebProviders:
        vi.fn<(req: object) => Promise<{ providers: WebProvider[] }>>(),
    sendMessage: vi.fn<(req: object) => AsyncIterable<object>>(),
    getVersion: vi.fn<(req: object) => Promise<{ version: string }>>(),
}));

vi.mock("@/rpc/clients", () => ({
    sessionClient: {
        listSessions: rpc.listSessions,
        createSession: rpc.createSession,
        listMessages: rpc.listMessages,
    },
    providerClient: {
        listProviders: rpc.listProviders,
        listWebProviders: rpc.listWebProviders,
    },
    agentClient: { sendMessage: rpc.sendMessage },
    systemClient: { getVersion: rpc.getVersion },
}));

const session = (id: string, title: string) =>
    create(SessionSchema, {
        id,
        title,
        updatedAt: timestampFromDate(new Date()),
    });

const desktopBridge = () => ({
    appVersion: "2.1.0",
    titlebarHeight: 40,
    setTitleBar: vi.fn<DesktopBridge["setTitleBar"]>(),
    toggleMaximize: vi.fn<DesktopBridge["toggleMaximize"]>(),
    connectEngine: vi.fn<DesktopBridge["connectEngine"]>(),
    pickDirectory: vi.fn<DesktopBridge["pickDirectory"]>(),
});

const start = async (path: string) => {
    window.history.replaceState(null, "", path);
    vi.resetModules();
    const { i18n } = await import("@/i18n");
    await i18n.changeLanguage("en");
    const { App } = await import("./App");
    return render(<App />);
};

const pageTitle = () => document.querySelector("main header")?.textContent;

const titleBar = () => {
    const element = document.querySelector(".app-titlebar");
    if (element === null) {
        throw new TypeError("no title bar");
    }
    return element;
};

const sidebar = () => {
    const element = document.querySelector("[data-slot=sidebar]");
    if (!(element instanceof HTMLElement)) {
        throw new TypeError("no sidebar");
    }
    return element;
};

const sessionRows = async () => {
    const list = (await within(document.body).findAllByText("Trip plans"))
        .map((element) => element.closest("ul"))
        .find((element) => element !== null);
    if (list === undefined) {
        throw new TypeError("no session list");
    }
    return within(list);
};

const atPath = (path: string) =>
    waitFor(() => {
        expect(window.location.pathname).toBe(path);
    });

const header = () => {
    const element = document.querySelector("main header");
    if (!(element instanceof HTMLElement)) {
        throw new TypeError("no page header");
    }
    return within(element);
};

const doneStream = async function* () {
    await Promise.resolve();
    yield {
        event: create(AgentEventSchema, { kind: { case: "done", value: {} } }),
    };
};

vi.setConfig({ testTimeout: 20_000 });

function setViewportWidth(width: number) {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- vitest's happy-dom environment adds the happyDOM API to window without typing it
    (window as unknown as HappyWindow).happyDOM.setViewport({ width });
}

beforeEach(() => {
    vi.resetAllMocks();
    rpc.listSessions.mockResolvedValue({
        sessions: [session("c1", "Trip plans"), session("c2", "")],
    });
    rpc.listMessages.mockResolvedValue(create(ListMessagesResponseSchema, {}));
    rpc.listProviders.mockResolvedValue({ providers: [] });
    rpc.listWebProviders.mockResolvedValue({ providers: [] });
    rpc.getVersion.mockResolvedValue({ version: "1.0.0" });
});

afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    delete window.lemmaDesktop;
    setViewportWidth(1024);
});

it("shows the splash, then opens an untitled home", async () => {
    await start("/");

    expect(screen.getByRole("status", { name: "Loading…" })).toBeDefined();
    await sessionRows();
    expect(window.location.pathname).toBe("/");
    expect(pageTitle()).toBe("");
});

it("sends an unknown path home", async () => {
    await start("/nowhere");

    await sessionRows();
    expect(window.location.pathname).toBe("/");
});

it("titles an open session, untitled ones as new", async () => {
    const user = userEvent.setup();
    await start("/");

    await user.click((await sessionRows()).getByText("Trip plans"));
    await atPath("/sessions/c1");
    await waitFor(() => {
        expect(pageTitle()).toBe("Trip plans");
    });

    await user.click((await sessionRows()).getByText("New session"));
    await atPath("/sessions/c2");
    await waitFor(() => {
        expect(pageTitle()).toBe("New session");
    });

    await user.click(
        within(sidebar()).getAllByRole("button", {
            name: "New session",
        })[0]!,
    );
    await atPath("/");
});

it("creates a session for the first message and opens it", async () => {
    const user = userEvent.setup();
    rpc.listProviders.mockResolvedValue({
        providers: [
            create(ProviderSchema, {
                id: "p1",
                enabled: true,
                source: {
                    case: "custom",
                    value: {
                        apiFormat: ApiFormat.OPENAI,
                        name: "Acme",
                        models: [{ id: "m1", toolCalling: true }],
                    },
                },
            }),
        ],
    });
    rpc.createSession.mockResolvedValue({
        session: session("c9", ""),
    });
    rpc.sendMessage.mockImplementation(doneStream);
    await start("/");

    const composer = await screen.findByRole("textbox", {
        name: "Message the assistant…",
    });
    await user.type(composer, "hello");
    await user.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => {
        expect(window.location.pathname).toBe("/sessions/c9");
    });
    expect(rpc.createSession).toHaveBeenCalledWith({});
    expect(rpc.sendMessage.mock.lastCall?.[0]).toMatchObject({
        sessionId: "c9",
        content: "hello",
    });
});

it("remembers a collapsed sidebar and starts from the toolbar", async () => {
    const user = userEvent.setup();
    const view = await start("/sessions/c1");

    await sessionRows();
    await user.click(
        within(sidebar()).getByRole("button", { name: "Collapse sidebar" }),
    );
    expect(localStorage.getItem("sidebar-collapsed")).toBe("1");
    expect(sidebar().dataset.state).toBe("collapsed");

    await user.click(header().getByRole("button", { name: "New session" }));
    await atPath("/");
    view.unmount();

    await start("/");
    await sessionRows();
    expect(sidebar().dataset.state).toBe("collapsed");
    await user.click(header().getByRole("button", { name: "Expand sidebar" }));
    expect(localStorage.getItem("sidebar-collapsed")).toBe("0");
});

it("navigates the settings pages from the sidebar", async () => {
    const user = userEvent.setup();
    await start("/");
    await sessionRows();

    await user.click(screen.getByRole("link", { name: "App settings" }));
    await atPath("/settings/appearance");
    expect(await screen.findByText("Server v1.0.0")).toBeDefined();
    expect(
        await screen.findByRole("heading", { level: 1, name: "Appearance" }),
    ).toBeDefined();

    await user.click(screen.getByRole("link", { name: "AI Providers" }));
    await atPath("/settings/providers");
    expect(
        await screen.findByRole("region", { name: "AI Providers" }),
    ).toBeDefined();

    await user.click(screen.getByRole("link", { name: "Web Search & Fetch" }));
    await atPath("/settings/web");
    expect(
        await screen.findByRole("heading", {
            level: 1,
            name: "Web Search & Fetch",
        }),
    ).toBeDefined();

    await user.click(screen.getByRole("link", { name: "Back to home" }));
    await sessionRows();
    await atPath("/");
});

it.each(["/settings", "/settings/unknown", "/settings/Providers"])(
    "opens the appearance settings for %s",
    async (path) => {
        await start(path);

        await waitFor(() => {
            expect(window.location.pathname).toBe("/settings/appearance");
        });
    },
);

it("keeps the sidebar open on settings without storing toggles", async () => {
    const user = userEvent.setup();
    localStorage.setItem("sidebar-collapsed", "1");
    await start("/settings/appearance");

    await screen.findByRole("link", { name: "Back to home" });
    expect(sidebar().dataset.state).toBe("expanded");

    await user.click(
        header().getByRole("button", { name: "Collapse sidebar" }),
    );
    expect(sidebar().dataset.state).toBe("expanded");
    expect(localStorage.getItem("sidebar-collapsed")).toBe("1");
});

it("opens the sidebar as a sheet on a narrow window", async () => {
    const user = userEvent.setup();
    setViewportWidth(500);
    rpc.listSessions.mockResolvedValue({
        sessions: [session("c1", "Trip plans")],
    });
    await start("/");

    await user.click(
        await screen.findByRole("button", { name: "Expand sidebar" }),
    );
    const sheet = await screen.findByRole("dialog", { name: "Sidebar" });
    await user.click(
        within(sheet).getByRole("button", { name: "New session" }),
    );

    await waitFor(() => {
        expect(screen.queryByRole("dialog")).toBeNull();
    });
});

it("paints the desktop title bar for the route and theme", async () => {
    const user = userEvent.setup();
    const bridge = desktopBridge();
    window.lemmaDesktop = bridge;
    localStorage.setItem("lemma.theme", "dark");
    await start("/");

    await sessionRows();
    await waitFor(() => {
        expect(bridge.setTitleBar).toHaveBeenLastCalledWith({
            theme: "dark",
            surface: "sidebar",
        });
    });

    await user.dblClick(titleBar());
    expect(bridge.toggleMaximize).toHaveBeenCalledOnce();
});

it("paints the desktop title bar with the light theme by default", async () => {
    const bridge = desktopBridge();
    window.lemmaDesktop = bridge;
    await start("/");

    await sessionRows();
    await waitFor(() => {
        expect(bridge.setTitleBar).toHaveBeenLastCalledWith({
            theme: "light",
            surface: "sidebar",
        });
    });
});
