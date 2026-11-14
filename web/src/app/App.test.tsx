import { create } from "@bufbuild/protobuf";
import { timestampFromDate } from "@bufbuild/protobuf/wkt";
import type { DesktopBridge } from "../../../desktop/src/desktop-bridge";
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
    WebProvider_Kind,
    WebProviderSchema,
} from "@/gen/lemma/v1/provider_pb";

const rpc = vi.hoisted(() => ({
    listSessions: vi.fn<(req: object) => Promise<{ sessions: Session[] }>>(),
    createSession: vi.fn<(req: object) => Promise<{ session?: Session }>>(),
    listMessages: vi.fn<(req: object) => Promise<object>>(),
    setSessionLeaf: vi.fn<(req: object) => Promise<object>>(),
    setMessageLabel: vi.fn<(req: object) => Promise<object>>(),
    listProviders: vi.fn<(req: object) => Promise<{ providers: Provider[] }>>(),
    listWebProviders:
        vi.fn<(req: object) => Promise<{ providers: WebProvider[] }>>(),
    sendMessage: vi.fn<(req: object) => AsyncIterable<object>>(),
}));

vi.mock("@/rpc/clients", () => ({
    sessionClient: {
        listSessions: rpc.listSessions,
        createSession: rpc.createSession,
        listMessages: rpc.listMessages,
        setSessionLeaf: rpc.setSessionLeaf,
        setMessageLabel: rpc.setMessageLabel,
    },
    providerClient: {
        listProviders: rpc.listProviders,
        listWebProviders: rpc.listWebProviders,
    },
    agentClient: { sendMessage: rpc.sendMessage },
}));

const session = (id: string, title: string, directory = "") =>
    create(SessionSchema, {
        id,
        title,
        directory,
        updatedAt: timestampFromDate(new Date()),
    });

const desktopBridge = () => ({
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

const mainArea = () => {
    const element = document.querySelector("main");
    if (!(element instanceof HTMLElement)) {
        throw new TypeError("no main");
    }
    return within(element);
};

const sessionRows = async () => {
    const list = (await within(document.body).findAllByText("Trip plans"))
        .map((element) => element.closest("[data-slot='sidebar-content']"))
        .find((element) => element !== null);
    if (!(list instanceof HTMLElement)) {
        throw new TypeError("no session list");
    }
    return within(list);
};

const atPath = (path: string) =>
    waitFor(() => {
        expect(window.location.pathname).toBe(path);
    });

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
        sessions: [
            session("c1", "Trip plans", "/work/proj"),
            session("c2", ""),
        ],
    });
    rpc.listMessages.mockResolvedValue(create(ListMessagesResponseSchema, {}));
    rpc.setSessionLeaf.mockResolvedValue({});
    rpc.setMessageLabel.mockResolvedValue({});
    rpc.listProviders.mockResolvedValue({ providers: [] });
    rpc.listWebProviders.mockResolvedValue({ providers: [] });
});

afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    delete window.lemmaDesktop;
    setViewportWidth(1024);
});

it("shows the splash, then opens the new-session home without a top shell header", async () => {
    await start("/");

    expect(screen.getByRole("status", { name: "Loading…" })).toBeDefined();
    await sessionRows();
    expect(window.location.pathname).toBe("/");
    expect(document.querySelector("main header")).toBeNull();
    expect(
        await screen.findByRole("textbox", {
            name: "Configure a provider and model to start…",
        }),
    ).toBeDefined();
});

it("sends an unknown path home", async () => {
    await start("/nowhere");

    await sessionRows();
    expect(window.location.pathname).toBe("/");
});

it("opens sessions, starts new ones from sidebar, directory, and Ctrl+N", async () => {
    const user = userEvent.setup();
    await start("/");

    await user.click((await sessionRows()).getByText("Trip plans"));
    await atPath("/sessions/c1");

    await user.click((await sessionRows()).getByText("New session"));
    await atPath("/sessions/c2");

    await user.click(
        within(sidebar()).getAllByRole("button", {
            name: "New session",
        })[0]!,
    );
    await atPath("/");

    await user.click((await sessionRows()).getByText("Trip plans"));
    await atPath("/sessions/c1");

    await user.keyboard("n");
    await user.keyboard("{Control>}a{/Control}");
    expect(window.location.pathname).toBe("/sessions/c1");

    await user.keyboard("{Control>}n{/Control}");
    await atPath("/");

    await user.click((await sessionRows()).getByText("Trip plans"));
    await atPath("/sessions/c1");
    await user.click(
        within(sidebar()).getByRole("button", { name: "New session in proj" }),
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

    await atPath("/sessions/c9");
    expect(rpc.createSession).toHaveBeenCalledWith({});
    expect(rpc.sendMessage.mock.lastCall?.[0]).toMatchObject({
        sessionId: "c9",
        content: "hello",
    });
});

it("remembers a collapsed sidebar and reopens it from the floating trigger", async () => {
    const user = userEvent.setup();
    const view = await start("/sessions/c1");

    await sessionRows();
    await user.click(
        within(sidebar()).getByRole("button", { name: "Collapse sidebar" }),
    );
    expect(localStorage.getItem("lemma.sidebarCollapsed")).toBe("1");
    expect(sidebar().dataset.state).toBe("collapsed");
    expect(
        mainArea().getByRole("button", { name: "Expand sidebar" }),
    ).toBeDefined();
    view.unmount();

    await start("/");
    await sessionRows();
    expect(sidebar().dataset.state).toBe("collapsed");
    await user.click(
        mainArea().getByRole("button", { name: "Expand sidebar" }),
    );
    expect(localStorage.getItem("lemma.sidebarCollapsed")).toBe("0");
});

it("navigates settings with active counts and returns to the active session", async () => {
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
            create(ProviderSchema, {
                id: "p2",
                enabled: false,
                source: {
                    case: "custom",
                    value: {
                        apiFormat: ApiFormat.OPENAI,
                        name: "Disabled",
                        models: [{ id: "m2", toolCalling: true }],
                    },
                },
            }),
        ],
    });
    rpc.listWebProviders.mockResolvedValue({
        providers: [
            create(WebProviderSchema, {
                id: "wp-native",
                kind: WebProvider_Kind.NATIVE,
                name: "Native",
                enabled: true,
            }),
            create(WebProviderSchema, {
                id: "wp-ds",
                kind: WebProvider_Kind.DEEPSEEK,
                name: "DeepSeek",
                enabled: true,
                apiKey: "",
            }),
        ],
    });
    await start("/sessions/c1");
    await sessionRows();

    await user.click(screen.getByRole("link", { name: "App settings" }));
    await atPath("/settings/appearance");
    expect(
        await screen.findByRole("heading", { level: 2, name: "Appearance" }),
    ).toBeDefined();

    const providersLink = screen.getByRole("link", { name: /AI Providers/u });
    expect(within(providersLink).getByText("1")).toBeDefined();
    const webLink = screen.getByRole("link", { name: /Web Search & Fetch/u });
    expect(within(webLink).getByText("1")).toBeDefined();

    await user.click(providersLink);
    await atPath("/settings/providers");
    expect(
        await screen.findByRole("region", { name: "AI Providers" }),
    ).toBeDefined();

    await user.click(webLink);
    await atPath("/settings/web");
    expect(
        await screen.findByRole("heading", {
            level: 2,
            name: "Backends",
        }),
    ).toBeDefined();

    await user.click(screen.getByRole("link", { name: "Back to sessions" }));
    await sessionRows();
    await atPath("/sessions/c1");
});

it("opens provider settings from the empty model picker", async () => {
    const user = userEvent.setup();
    await start("/");
    await sessionRows();

    await user.click(screen.getByRole("button", { name: "Select model" }));
    await user.click(
        await screen.findByRole("button", { name: "Open settings" }),
    );
    await atPath("/settings/providers");
    expect(
        await screen.findByRole("region", { name: "AI Providers" }),
    ).toBeDefined();
    await user.click(screen.getByRole("link", { name: "Back to sessions" }));
    await atPath("/");
    expect(window.location.pathname).toBe("/");
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
    localStorage.setItem("lemma.sidebarCollapsed", "1");
    await start("/settings/appearance");

    await screen.findByRole("link", { name: "Back to sessions" });
    expect(sidebar().dataset.state).toBe("expanded");

    await user.keyboard("{Control>}b{/Control}");
    expect(sidebar().dataset.state).toBe("expanded");
    expect(localStorage.getItem("lemma.sidebarCollapsed")).toBe("1");
});

it("opens and closes the sidebar sheet across mobile routes", async () => {
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
    expect(
        within(sheet).getByRole("button", { name: "Collapse sidebar" }),
    ).toBeDefined();
    await user.click(
        within(sheet).getByRole("button", { name: "New session" }),
    );
    await waitFor(() => {
        expect(screen.queryByRole("dialog")).toBeNull();
    });

    await user.click(screen.getByRole("button", { name: "Expand sidebar" }));
    const settingsSheet = await screen.findByRole("dialog", {
        name: "Sidebar",
    });
    await user.click(
        within(settingsSheet).getByRole("link", { name: "App settings" }),
    );
    await atPath("/settings/appearance");
    await waitFor(() => {
        expect(screen.queryByRole("dialog")).toBeNull();
    });

    await user.click(screen.getByRole("button", { name: "Expand sidebar" }));
    const navSheet = await screen.findByRole("dialog", { name: "Sidebar" });
    await user.click(
        within(navSheet).getByRole("link", { name: /AI Providers/u }),
    );
    await atPath("/settings/providers");
    await waitFor(() => {
        expect(screen.queryByRole("dialog")).toBeNull();
    });

    await user.click(screen.getByRole("button", { name: "Expand sidebar" }));
    const backSheet = await screen.findByRole("dialog", { name: "Sidebar" });
    await user.click(
        within(backSheet).getByRole("link", { name: "Back to sessions" }),
    );
    await atPath("/");
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
