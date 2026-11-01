import { create } from "@bufbuild/protobuf";
import { timestampFromDate } from "@bufbuild/protobuf/wkt";
import type { DesktopBridge } from "@lemma/desktop-contract";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Window as HappyWindow } from "happy-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { AgentEventSchema } from "@/gen/lemma/v1/agent_pb";
import { type User, UserSchema } from "@/gen/lemma/v1/auth_pb";
import {
    type Conversation,
    ConversationSchema,
    ListMessagesResponseSchema,
} from "@/gen/lemma/v1/conversation_pb";
import {
    type Provider,
    ProviderKind,
    ProviderSchema,
} from "@/gen/lemma/v1/provider_pb";

const rpc = vi.hoisted(() => ({
    me: vi.fn<(req: object) => Promise<{ user?: User }>>(),
    logout: vi.fn<(req: object) => Promise<object>>(),
    listConversations:
        vi.fn<(req: object) => Promise<{ conversations: Conversation[] }>>(),
    createConversation:
        vi.fn<(req: object) => Promise<{ conversation?: Conversation }>>(),
    listMessages: vi.fn<(req: object) => Promise<object>>(),
    listProviders: vi.fn<(req: object) => Promise<{ providers: Provider[] }>>(),
    sendMessage: vi.fn<(req: object) => AsyncIterable<object>>(),
    getVersion: vi.fn<(req: object) => Promise<{ version: string }>>(),
}));

vi.mock("@/rpc/clients", () => ({
    authClient: { me: rpc.me, logout: rpc.logout },
    conversationClient: {
        listConversations: rpc.listConversations,
        createConversation: rpc.createConversation,
        listMessages: rpc.listMessages,
    },
    providerClient: { listProviders: rpc.listProviders },
    agentClient: { sendMessage: rpc.sendMessage },
    systemClient: { getVersion: rpc.getVersion },
}));

const conversation = (id: string, title: string) =>
    create(ConversationSchema, {
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
});

const start = async (path: string) => {
    window.history.replaceState(null, "", path);
    vi.resetModules();
    const { i18n } = await import("@/i18n");
    await i18n.changeLanguage("en");
    const { App } = await import("./App");
    return render(<App />);
};

const signIn = () => {
    rpc.me.mockResolvedValue({
        user: create(UserSchema, { id: "u1", username: "alice" }),
    });
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

const conversationRows = async () => {
    const list = (await within(document.body).findAllByText("Trip plans"))
        .map((element) => element.closest("ul"))
        .find((element) => element !== null);
    if (list === undefined) {
        throw new TypeError("no conversation list");
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
    rpc.me.mockResolvedValue({});
    rpc.logout.mockResolvedValue({});
    rpc.listConversations.mockResolvedValue({
        conversations: [
            conversation("c1", "Trip plans"),
            conversation("c2", ""),
        ],
    });
    rpc.listMessages.mockResolvedValue(create(ListMessagesResponseSchema, {}));
    rpc.listProviders.mockResolvedValue({ providers: [] });
    rpc.getVersion.mockResolvedValue({ version: "1.0.0" });
});

afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    delete window.lemmaDesktop;
    setViewportWidth(1024);
});

it("shows the splash, then sends a signed-out visitor to sign-in", async () => {
    await start("/");

    expect(screen.getByRole("status", { name: "Loading…" })).toBeDefined();
    expect(
        await screen.findByRole("heading", { name: "Sign in to Lemma" }),
    ).toBeDefined();
    expect(window.location.pathname).toBe("/signin");
    expect(screen.getByLabelText("GitHub").getAttribute("href")).toBe(
        "https://github.com/LemmaHQ/lemma",
    );
});

it("switches from sign-in to sign-up in a view transition", async () => {
    const user = userEvent.setup();
    await start("/signin");
    const viewTransition = vi.spyOn(document, "startViewTransition");

    await user.click(await screen.findByRole("link", { name: "Sign up" }));

    expect(
        await screen.findByRole("heading", {
            name: "Create your Lemma account",
        }),
    ).toBeDefined();
    expect(window.location.pathname).toBe("/signup");
    expect(viewTransition).toHaveBeenCalledOnce();
});

it("sends a signed-in user from sign-in to an untitled home", async () => {
    signIn();
    await start("/signin");

    await conversationRows();
    expect(window.location.pathname).toBe("/");
    expect(pageTitle()).toBe("");
});

it("sends an unknown path home", async () => {
    signIn();
    await start("/nowhere");

    await conversationRows();
    expect(window.location.pathname).toBe("/");
});

it("titles an open conversation, untitled ones as new", async () => {
    const user = userEvent.setup();
    signIn();
    await start("/");

    await user.click((await conversationRows()).getByText("Trip plans"));
    await atPath("/conversations/c1");
    await waitFor(() => {
        expect(pageTitle()).toBe("Trip plans");
    });

    await user.click((await conversationRows()).getByText("New conversation"));
    await atPath("/conversations/c2");
    await waitFor(() => {
        expect(pageTitle()).toBe("New conversation");
    });

    await user.click(
        within(sidebar()).getAllByRole("button", {
            name: "New conversation",
        })[0]!,
    );
    await atPath("/");
});

it("creates a conversation for the first message and opens it", async () => {
    const user = userEvent.setup();
    signIn();
    rpc.listProviders.mockResolvedValue({
        providers: [
            create(ProviderSchema, {
                id: "p1",
                kind: ProviderKind.OPENAI,
                name: "Acme",
                models: ["m1"],
                enabled: true,
            }),
        ],
    });
    rpc.createConversation.mockResolvedValue({
        conversation: conversation("c9", ""),
    });
    rpc.sendMessage.mockImplementation(doneStream);
    await start("/");

    const composer = await screen.findByRole("textbox", {
        name: "Message the assistant…",
    });
    await user.type(composer, "hello");
    await user.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => {
        expect(window.location.pathname).toBe("/conversations/c9");
    });
    expect(rpc.sendMessage.mock.lastCall?.[0]).toMatchObject({
        conversationId: "c9",
        content: "hello",
    });
});

it("remembers a collapsed sidebar and starts from the toolbar", async () => {
    const user = userEvent.setup();
    signIn();
    const view = await start("/conversations/c1");

    await conversationRows();
    await user.click(
        within(sidebar()).getByRole("button", { name: "Collapse sidebar" }),
    );
    expect(localStorage.getItem("sidebar-collapsed")).toBe("1");
    expect(sidebar().dataset.state).toBe("collapsed");

    await user.click(
        header().getByRole("button", { name: "New conversation" }),
    );
    await atPath("/");
    view.unmount();

    await start("/");
    await conversationRows();
    expect(sidebar().dataset.state).toBe("collapsed");
    await user.click(header().getByRole("button", { name: "Expand sidebar" }));
    expect(localStorage.getItem("sidebar-collapsed")).toBe("0");
});

it("navigates the settings sections from the account menu", async () => {
    const user = userEvent.setup();
    signIn();
    await start("/");

    await user.click(await screen.findByRole("button", { name: /alice/u }));
    await user.click(
        await screen.findByRole("menuitem", { name: "App settings" }),
    );
    await atPath("/settings/appearance");
    await waitFor(() => {
        expect(pageTitle()).toBe("Appearance");
    });

    await user.click(screen.getByRole("link", { name: "AI Providers" }));
    await atPath("/settings/providers");
    await waitFor(() => {
        expect(pageTitle()).toBe("AI Providers");
    });

    await user.click(screen.getByRole("link", { name: "Back to home" }));
    await conversationRows();
    await atPath("/");
});

it.each(["/settings", "/settings/unknown", "/settings/Providers"])(
    "opens the appearance settings for %s",
    async (path) => {
        signIn();
        await start(path);

        await waitFor(() => {
            expect(window.location.pathname).toBe("/settings/appearance");
        });
    },
);

it("keeps the sidebar open on settings without storing toggles", async () => {
    const user = userEvent.setup();
    signIn();
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

it("returns to sign-in after signing out", async () => {
    const user = userEvent.setup();
    signIn();
    await start("/");

    await user.click(await screen.findByRole("button", { name: /alice/u }));
    await user.click(await screen.findByRole("menuitem", { name: "Sign out" }));

    expect(
        await screen.findByRole("heading", { name: "Sign in to Lemma" }),
    ).toBeDefined();
    expect(window.location.pathname).toBe("/signin");
});

it("opens the sidebar as a sheet on a narrow window", async () => {
    const user = userEvent.setup();
    setViewportWidth(500);
    rpc.listConversations.mockResolvedValue({
        conversations: [conversation("c1", "Trip plans")],
    });
    signIn();
    await start("/");

    await user.click(
        await screen.findByRole("button", { name: "Expand sidebar" }),
    );
    const sheet = await screen.findByRole("dialog", { name: "Sidebar" });
    await user.click(
        within(sheet).getByRole("button", { name: "New conversation" }),
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
    await start("/signin");

    await screen.findByRole("heading", { name: "Sign in to Lemma" });
    await waitFor(() => {
        expect(bridge.setTitleBar).toHaveBeenLastCalledWith({
            theme: "dark",
            surface: "background",
        });
    });

    await user.dblClick(titleBar());
    expect(bridge.toggleMaximize).toHaveBeenCalledOnce();
});

it("paints the desktop title bar as the sidebar once signed in", async () => {
    const bridge = desktopBridge();
    window.lemmaDesktop = bridge;
    localStorage.setItem("lemma.access_token", "access");
    signIn();
    await start("/");

    await conversationRows();
    await waitFor(() => {
        expect(bridge.setTitleBar).toHaveBeenLastCalledWith({
            theme: "light",
            surface: "sidebar",
        });
    });
});
