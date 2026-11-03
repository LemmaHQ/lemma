import { create } from "@bufbuild/protobuf";
import { Code, ConnectError } from "@connectrpc/connect";
import { Toaster, TooltipProvider } from "@lemma/ui";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";

import {
    type Provider,
    ProviderKind,
    ProviderSchema,
} from "@/gen/lemma/v1/provider_pb";

import { clearProviders } from "../useProviders";
import { ProviderPanel } from "./ProviderPanel";

type Reply = { provider?: Provider | undefined };
type UpdateRequest = {
    id: string;
    name?: string | undefined;
    apiKey?: string | undefined;
    baseUrl?: string | undefined;
    apiPath?: string | undefined;
    enabled?: boolean | undefined;
    models?: { models: string[] } | undefined;
};

const rpc = vi.hoisted(() => ({
    listProviders: vi.fn<(req: object) => Promise<{ providers: Provider[] }>>(),
    createProvider: vi.fn<(req: object) => Promise<Reply>>(),
    updateProvider: vi.fn<(req: UpdateRequest) => Promise<Reply>>(),
    deleteProvider: vi.fn<(req: { id: string }) => Promise<object>>(),
    fetchModels:
        vi.fn<(req: { id: string }) => Promise<{ models: string[] }>>(),
    checkProvider: vi.fn<(req: object) => Promise<{ error: string }>>(),
}));

vi.mock("@/rpc/clients", () => ({ providerClient: rpc }));

const provider = (id: string, name: string, patch = {}) =>
    create(ProviderSchema, {
        id,
        kind: ProviderKind.OPENAI,
        identifier: id,
        name,
        baseUrl: "https://api.example.com",
        models: ["m1"],
        enabled: true,
        ...patch,
    });

const renderPanel = () =>
    render(
        <TooltipProvider>
            <Toaster />
            <ProviderPanel />
        </TooltipProvider>,
    );

const offline = () => new ConnectError("down", Code.Unavailable);

const OFFLINE_TEXT =
    "Can't reach the server, check your connection and try again";

beforeEach(() => {
    vi.resetAllMocks();
    clearProviders();
    rpc.listProviders.mockResolvedValue({
        providers: [
            provider("acme", "Acme"),
            provider("beta", "Beta", { enabled: false }),
        ],
    });
    rpc.updateProvider.mockImplementation(({ id, models, ...fields }) =>
        Promise.resolve({
            provider: provider(id, id === "acme" ? "Acme" : "Beta", {
                ...Object.fromEntries(
                    Object.entries(fields).filter(
                        ([, value]) => value !== undefined,
                    ),
                ),
                ...(models === undefined ? {} : { models: models.models }),
            }),
        }),
    );
});

it("loads the providers and opens the first one", async () => {
    renderPanel();

    expect(screen.getByRole("status", { name: "Loading…" })).toBeDefined();
    expect(await screen.findByRole("heading", { name: "Acme" })).toBeDefined();
    expect(
        screen
            .getByRole("button", { name: /Acme$/u })
            .getAttribute("aria-pressed"),
    ).toBe("true");
});

it("shows an empty page without providers", async () => {
    rpc.listProviders.mockResolvedValue({ providers: [] });
    renderPanel();

    expect(await screen.findByText("No providers yet.")).toBeDefined();
});

it("creates a provider and opens it", async () => {
    const user = userEvent.setup();
    rpc.createProvider.mockResolvedValue({
        provider: provider("corp", "", { models: [] }),
    });
    renderPanel();
    await screen.findByRole("heading", { name: "Acme" });

    await user.click(screen.getByRole("button", { name: "New provider" }));
    expect(
        screen
            .getByRole("button", { name: /Acme$/u })
            .getAttribute("aria-pressed"),
    ).toBe("false");
    await user.type(screen.getByLabelText("Provider ID"), "corp");
    await user.type(screen.getByLabelText("Base URL"), "https://a.dev");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("button", { name: "?" })).toBeDefined();
    expect(
        screen.getByRole("button", { name: "?" }).getAttribute("aria-pressed"),
    ).toBe("true");
    expect(rpc.createProvider.mock.lastCall?.[0]).toMatchObject({
        identifier: "corp",
        name: "corp",
        models: [],
    });
});

it("leaves the new provider page by cancelling or picking a provider", async () => {
    const user = userEvent.setup();
    renderPanel();
    await screen.findByRole("heading", { name: "Acme" });

    await user.click(screen.getByRole("button", { name: "New provider" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("heading", { name: "Acme" })).toBeDefined();
    await user.click(screen.getByRole("button", { name: "New provider" }));
    await user.click(screen.getByRole("button", { name: /Beta$/u }));

    expect(await screen.findByRole("heading", { name: "Beta" })).toBeDefined();
});

it("searches, collapses groups, and switches providers", async () => {
    const user = userEvent.setup();
    renderPanel();
    await screen.findByRole("heading", { name: "Acme" });

    await user.type(screen.getByPlaceholderText("Search providers…"), " BE ");
    expect(screen.queryByRole("button", { name: /Acme$/u })).toBeNull();
    await user.clear(screen.getByPlaceholderText("Search providers…"));
    await user.click(screen.getByRole("button", { name: /Enabled/u }));
    expect(screen.queryByRole("button", { name: /Acme$/u })).toBeNull();
    await user.click(screen.getByRole("button", { name: /Enabled/u }));
    await user.click(screen.getByRole("button", { name: /Beta$/u }));

    expect(await screen.findByRole("heading", { name: "Beta" })).toBeDefined();
    expect(
        screen
            .getByRole("switch", { name: "Enable provider" })
            .getAttribute("aria-checked"),
    ).toBe("false");
});

it("enables a provider and reports a failed toggle", async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(await screen.findByRole("button", { name: /Beta$/u }));

    await user.click(screen.getByRole("switch", { name: "Enable provider" }));
    expect(rpc.updateProvider.mock.lastCall?.[0]).toMatchObject({
        id: "beta",
        enabled: true,
    });
    rpc.updateProvider.mockRejectedValueOnce(offline());
    await user.click(screen.getByRole("switch", { name: "Enable provider" }));

    expect(await screen.findByText(OFFLINE_TEXT)).toBeDefined();
});

it("saves model list changes for the open provider", async () => {
    const user = userEvent.setup();
    renderPanel();
    await screen.findByRole("heading", { name: "Acme" });

    await user.click(screen.getByRole("button", { name: "Add model" }));
    await user.type(screen.getByPlaceholderText("e.g. gpt-4o"), "m2{Enter}");

    expect(rpc.updateProvider.mock.lastCall?.[0]).toMatchObject({
        id: "acme",
        models: { models: ["m2", "m1"] },
    });
});

it("fetches upstream models for the open provider", async () => {
    const user = userEvent.setup();
    rpc.fetchModels.mockResolvedValue({ models: ["m1", "m9"] });
    renderPanel();
    await screen.findByRole("heading", { name: "Acme" });

    await user.click(screen.getByRole("button", { name: "Fetch model list" }));

    expect(
        await screen.findByRole("dialog", { name: "Pick models" }),
    ).toBeDefined();
    expect(rpc.fetchModels.mock.lastCall?.[0]).toMatchObject({ id: "acme" });
});

it("checks the saved connection, or the edited one before saving", async () => {
    const user = userEvent.setup();
    rpc.checkProvider.mockResolvedValue({ error: "" });
    renderPanel();
    await screen.findByRole("heading", { name: "Acme" });

    await user.click(screen.getByRole("button", { name: "Check" }));
    expect(rpc.checkProvider.mock.lastCall?.[0]).toMatchObject({
        id: "acme",
        model: "m1",
    });
    await user.type(screen.getByLabelText("API key"), "sk-new");
    await user.click(screen.getByRole("button", { name: "Check" }));

    expect(rpc.checkProvider.mock.lastCall?.[0]).toMatchObject({
        apiKey: "sk-new",
        baseUrl: "https://api.example.com",
        model: "m1",
    });
});

it("saves edited connection settings, or discards them", async () => {
    const user = userEvent.setup();
    renderPanel();
    await screen.findByRole("heading", { name: "Acme" });
    const baseUrl = screen.getByLabelText("Base URL");

    await user.clear(baseUrl);
    await user.type(baseUrl, "api.example.com");
    expect(
        screen.getByText("Must start with http:// or https://."),
    ).toBeDefined();
    expect(screen.getByRole("button", { name: "Save" })).toHaveProperty(
        "disabled",
        true,
    );
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(baseUrl).toHaveProperty("value", "https://api.example.com");
    expect(screen.queryByText("You have unsaved changes.")).toBeNull();

    await user.type(screen.getByLabelText("Request path"), " /v2/chat ");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await vi.waitFor(() => {
        expect(screen.queryByText("You have unsaved changes.")).toBeNull();
    });
    expect(rpc.updateProvider.mock.lastCall?.[0]).toMatchObject({
        id: "acme",
        apiPath: "/v2/chat",
    });
    expect(screen.getByLabelText("Request path")).toHaveProperty(
        "value",
        "/v2/chat",
    );
});

it("keeps edits and shows the error when saving fails", async () => {
    const user = userEvent.setup();
    rpc.updateProvider.mockRejectedValue(offline());
    renderPanel();
    await screen.findByRole("heading", { name: "Acme" });

    await user.type(screen.getByLabelText("API key"), "sk-new");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect((await screen.findByRole("alert")).textContent).toBe(OFFLINE_TEXT);
    expect(screen.getByText("You have unsaved changes.")).toBeDefined();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("alert")).toBeNull();
});

it("renames the provider, falling back to its ID for a blank name", async () => {
    const user = userEvent.setup();
    renderPanel();
    await screen.findByRole("heading", { name: "Acme" });

    await user.click(screen.getByRole("button", { name: "Settings" }));
    const dialog = await screen.findByRole("dialog", {
        name: "Provider settings",
    });
    const name = within(dialog).getByLabelText("Provider name");
    const save = within(dialog).getByRole("button", { name: "Save" });
    expect(save).toHaveProperty("disabled", true);
    await user.clear(name);

    expect(save).toHaveProperty("disabled", false);
    await user.click(save);

    await vi.waitFor(() => {
        expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(rpc.updateProvider.mock.lastCall?.[0]).toMatchObject({
        id: "acme",
        name: "acme",
    });
});

it("shows a rename failure and resets the dialog when reopened", async () => {
    const user = userEvent.setup();
    rpc.updateProvider.mockRejectedValue(offline());
    renderPanel();
    await screen.findByRole("heading", { name: "Acme" });

    await user.click(screen.getByRole("button", { name: "Settings" }));
    let dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Provider name"), " Corp");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(await within(dialog).findByText(OFFLINE_TEXT)).toBeDefined();
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "Settings" }));

    dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText("Provider name")).toHaveProperty(
        "value",
        "Acme",
    );
    expect(within(dialog).queryByText(OFFLINE_TEXT)).toBeNull();
});

it("deletes the provider after confirmation and opens the next one", async () => {
    const user = userEvent.setup();
    rpc.deleteProvider.mockResolvedValue({});
    renderPanel();
    await screen.findByRole("heading", { name: "Acme" });

    await user.click(screen.getByRole("button", { name: "Delete provider" }));
    await user.click(await screen.findByRole("button", { name: "Delete" }));

    expect(await screen.findByRole("heading", { name: "Beta" })).toBeDefined();
    expect(rpc.deleteProvider).toHaveBeenCalledWith({ id: "acme" });
});

it("shows a failed delete on the provider page", async () => {
    const user = userEvent.setup();
    rpc.deleteProvider.mockRejectedValue(offline());
    renderPanel();
    await screen.findByRole("heading", { name: "Acme" });

    await user.click(screen.getByRole("button", { name: "Delete provider" }));
    await user.click(await screen.findByRole("button", { name: "Delete" }));

    expect((await screen.findByRole("alert")).textContent).toBe(OFFLINE_TEXT);
    expect(screen.getByRole("heading", { name: "Acme" })).toBeDefined();
});
