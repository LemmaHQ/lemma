import { create } from "@bufbuild/protobuf";
import { Code, ConnectError } from "@connectrpc/connect";
import { Toaster, TooltipProvider } from "@lemma/ui";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";

import {
    ApiFormat,
    CustomProviderSchema,
    PredefinedProviderSchema,
    type Provider,
    ProviderSchema,
} from "@/gen/lemma/v1/provider_pb";

import { useProviderStore } from "../store";
import { ProviderPanel } from "./ProviderPanel";

type Reply = { provider?: Provider | undefined };
type ModelRecord = { id: string; toolCalling: boolean };
type UpdateRequest = {
    id: string;
    name?: string | undefined;
    apiKey?: string | undefined;
    baseUrl?: string | undefined;
    apiPath?: string | undefined;
    enabled?: boolean | undefined;
    models?: { models: ModelRecord[] } | undefined;
};
type PredefinedUpdateRequest = {
    id: string;
    apiKey?: string | undefined;
    enabled?: boolean | undefined;
    defaultApiFormat?: ApiFormat | undefined;
};
type ProviderFixture = {
    enabled?: boolean;
    apiKey?: string;
    identifier?: string;
    apiFormat?: ApiFormat;
    baseUrl?: string;
    apiPath?: string;
    modelsPath?: string;
    models?: ModelRecord[];
};

const rpc = vi.hoisted(() => ({
    listProviders: vi.fn<(req: object) => Promise<{ providers: Provider[] }>>(),
    createCustomProvider: vi.fn<(req: object) => Promise<Reply>>(),
    updateCustomProvider: vi.fn<(req: UpdateRequest) => Promise<Reply>>(),
    updatePredefinedProvider:
        vi.fn<(req: PredefinedUpdateRequest) => Promise<Reply>>(),
    deleteCustomProvider: vi.fn<(req: { id: string }) => Promise<object>>(),
    fetchModels:
        vi.fn<(req: { id: string }) => Promise<{ models: string[] }>>(),
    checkProvider: vi.fn<(req: object) => Promise<{ error: string }>>(),
}));

vi.mock("@/rpc/clients", () => ({ providerClient: rpc }));

const provider = (
    id: string,
    name: string,
    { enabled = true, apiKey = "", ...patch }: ProviderFixture = {},
) =>
    create(ProviderSchema, {
        id,
        enabled,
        apiKey,
        source: {
            case: "custom",
            value: create(CustomProviderSchema, {
                apiFormat: ApiFormat.OPENAI,
                identifier: id,
                name,
                baseUrl: "https://api.example.com",
                models: [{ id: "m1", toolCalling: true }],
                ...patch,
            }),
        },
    });

const predefinedProvider = ({
    enabled = false,
    apiKey = "",
    ...patch
}: {
    enabled?: boolean;
    apiKey?: string;
    defaultApiFormat?: ApiFormat;
} = {}) =>
    create(ProviderSchema, {
        id: "deepseek-id",
        enabled,
        apiKey,
        source: {
            case: "predefined",
            value: create(PredefinedProviderSchema, {
                identifier: "deepseek",
                name: "DeepSeek",
                apiFormats: [ApiFormat.ANTHROPIC, ApiFormat.OPENAI],
                defaultApiFormat: ApiFormat.ANTHROPIC,
                models: [
                    { id: "deepseek-flash", toolCalling: true },
                    { id: "deepseek-v4-pro", toolCalling: false },
                ],
                ...patch,
            }),
        },
    });

const renderPanel = () =>
    render(
        <TooltipProvider>
            <Toaster />
            <ProviderPanel />
        </TooltipProvider>,
    );

const offline = () => new ConnectError("down", Code.Unavailable);

const check = () => screen.getByRole("button", { name: "Check" });

const OFFLINE_TEXT =
    "Can't reach the server, check your connection and try again";

beforeEach(() => {
    vi.resetAllMocks();
    useProviderStore.setState(useProviderStore.getInitialState());
    rpc.listProviders.mockResolvedValue({
        providers: [
            provider("acme", "Acme"),
            provider("beta", "Beta", { enabled: false }),
        ],
    });
    rpc.updateCustomProvider.mockImplementation(({ id, models, ...fields }) =>
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
    let predefinedState: Parameters<typeof predefinedProvider>[0] = {};
    rpc.updatePredefinedProvider.mockImplementation(
        ({ id: _id, ...fields }) => {
            predefinedState = {
                ...predefinedState,
                ...Object.fromEntries(
                    Object.entries(fields).filter(
                        ([, value]) => value !== undefined,
                    ),
                ),
            };
            return Promise.resolve({
                provider: predefinedProvider(predefinedState),
            });
        },
    );
});

it("loads the providers and opens the first one", async () => {
    renderPanel();

    expect(screen.getByRole("status", { name: "Loading…" })).toBeDefined();
    expect(await screen.findByRole("heading", { name: "Acme" })).toBeDefined();
    expect(screen.getByLabelText("API format")).toHaveProperty(
        "value",
        "OpenAI",
    );
    expect(screen.getByLabelText("API format")).toHaveProperty(
        "readOnly",
        true,
    );
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
    rpc.createCustomProvider.mockResolvedValue({
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
    expect(rpc.createCustomProvider.mock.lastCall?.[0]).toMatchObject({
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
    await user.click(screen.getByRole("button", { name: /Custom/u }));
    expect(screen.queryByRole("button", { name: /Acme$/u })).toBeNull();
    await user.click(screen.getByRole("button", { name: /Custom/u }));
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
    expect(rpc.updateCustomProvider.mock.lastCall?.[0]).toMatchObject({
        id: "beta",
        enabled: true,
    });
    rpc.updateCustomProvider.mockRejectedValueOnce(offline());
    await user.click(screen.getByRole("switch", { name: "Enable provider" }));

    expect(await screen.findByText(OFFLINE_TEXT)).toBeDefined();
});

it("saves model list changes for the open provider", async () => {
    const user = userEvent.setup();
    renderPanel();
    await screen.findByRole("heading", { name: "Acme" });

    await user.click(screen.getByRole("button", { name: "Add model" }));
    await user.type(screen.getByPlaceholderText("e.g. gpt-4o"), "m2{Enter}");

    expect(rpc.updateCustomProvider.mock.lastCall?.[0]).toMatchObject({
        id: "acme",
        models: {
            models: [
                { id: "m2", toolCalling: true },
                { id: "m1", toolCalling: true },
            ],
        },
    });
    await user.click(screen.getByRole("switch", { name: "m1 Tool calling" }));

    expect(rpc.updateCustomProvider.mock.lastCall?.[0]).toMatchObject({
        id: "acme",
        models: {
            models: [
                { id: "m2", toolCalling: true },
                { id: "m1", toolCalling: false },
            ],
        },
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
    expect(baseUrl.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByRole("button", { name: "Save" })).toHaveProperty(
        "disabled",
        true,
    );
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(baseUrl).toHaveProperty("value", "https://api.example.com");
    expect(baseUrl.getAttribute("aria-invalid")).toBe("false");
    expect(screen.queryByText("You have unsaved changes.")).toBeNull();

    await user.type(screen.getByLabelText("Request path"), " /v2/chat ");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await vi.waitFor(() => {
        expect(screen.queryByText("You have unsaved changes.")).toBeNull();
    });
    expect(rpc.updateCustomProvider.mock.lastCall?.[0]).toMatchObject({
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
    rpc.updateCustomProvider.mockRejectedValue(offline());
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
    expect(rpc.updateCustomProvider.mock.lastCall?.[0]).toMatchObject({
        id: "acme",
        name: "acme",
    });
});

it("shows a rename failure and resets the dialog when reopened", async () => {
    const user = userEvent.setup();
    rpc.updateCustomProvider.mockRejectedValue(offline());
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
    rpc.deleteCustomProvider.mockResolvedValue({});
    renderPanel();
    await screen.findByRole("heading", { name: "Acme" });

    await user.click(screen.getByRole("button", { name: "Delete provider" }));
    await user.click(await screen.findByRole("button", { name: "Delete" }));

    expect(await screen.findByRole("heading", { name: "Beta" })).toBeDefined();
    expect(rpc.deleteCustomProvider).toHaveBeenCalledWith({ id: "acme" });
});

it("shows a failed delete on the provider page", async () => {
    const user = userEvent.setup();
    rpc.deleteCustomProvider.mockRejectedValue(offline());
    renderPanel();
    await screen.findByRole("heading", { name: "Acme" });

    await user.click(screen.getByRole("button", { name: "Delete provider" }));
    await user.click(await screen.findByRole("button", { name: "Delete" }));

    expect((await screen.findByRole("alert")).textContent).toBe(OFFLINE_TEXT);
    expect(screen.getByRole("heading", { name: "Acme" })).toBeDefined();
});

it("shows predefined formats and read-only models, and requires a key to enable", async () => {
    const user = userEvent.setup();
    rpc.listProviders.mockResolvedValue({
        providers: [predefinedProvider(), provider("acme", "Acme")],
    });
    renderPanel();

    expect(
        await screen.findByRole("heading", { name: "DeepSeek" }),
    ).toBeDefined();
    expect(screen.getByRole("button", { name: /Predefined/u })).toBeDefined();
    expect(screen.getByRole("button", { name: /Custom/u })).toBeDefined();
    expect(
        screen
            .getByRole("switch", { name: "Enable provider" })
            .getAttribute("aria-disabled"),
    ).toBe("true");
    expect(
        screen.getByText("Save an API key before enabling this provider."),
    ).toBeDefined();
    expect(
        screen.getByText("Models and their features ship with Lemma."),
    ).toBeDefined();
    expect(
        screen
            .getByRole("switch", { name: "deepseek-flash Tool calling" })
            .getAttribute("aria-disabled"),
    ).toBe("true");
    expect(
        screen
            .getByRole("switch", { name: "deepseek-flash Tool calling" })
            .getAttribute("aria-checked"),
    ).toBe("true");
    expect(
        screen
            .getByRole("switch", { name: "deepseek-v4-pro Tool calling" })
            .getAttribute("aria-checked"),
    ).toBe("false");
    expect(screen.queryByRole("button", { name: "Settings" })).toBeNull();
    expect(
        screen.queryByRole("button", { name: "Delete provider" }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "Add model" })).toBeNull();
    expect(
        screen.queryByRole("button", { name: "Fetch model list" }),
    ).toBeNull();

    await user.click(screen.getByLabelText("Default API format"));
    expect(screen.queryByRole("option", { name: "Gemini" })).toBeNull();
    await user.click(await screen.findByRole("option", { name: "OpenAI" }));

    expect(rpc.updatePredefinedProvider.mock.lastCall?.[0]).toMatchObject({
        id: "deepseek-id",
        defaultApiFormat: ApiFormat.OPENAI,
    });
});

it("saves a predefined key, enables the provider, and checks its models", async () => {
    const user = userEvent.setup();
    rpc.listProviders.mockResolvedValue({ providers: [predefinedProvider()] });
    rpc.checkProvider.mockResolvedValue({ error: "" });
    renderPanel();
    await screen.findByRole("heading", { name: "DeepSeek" });
    expect(check()).toHaveProperty("disabled", true);

    await user.type(screen.getByLabelText("API key"), "sk-discarded");
    expect(check()).toHaveProperty("disabled", true);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByLabelText("API key")).toHaveProperty("value", "");
    expect(rpc.updatePredefinedProvider).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("API key"), " sk-new ");
    rpc.updatePredefinedProvider.mockRejectedValueOnce(offline());
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect((await screen.findByRole("alert")).textContent).toBe(OFFLINE_TEXT);
    await user.click(screen.getByRole("button", { name: "Save" }));
    await vi.waitFor(() => {
        expect(screen.queryByText("You have unsaved changes.")).toBeNull();
    });
    expect(check()).toHaveProperty("disabled", false);
    expect(rpc.updatePredefinedProvider.mock.lastCall?.[0]).toMatchObject({
        id: "deepseek-id",
        apiKey: "sk-new",
    });
    expect(
        screen.queryByText("Save an API key before enabling this provider."),
    ).toBeNull();

    const enabled = screen.getByRole("switch", { name: "Enable provider" });
    expect(enabled.getAttribute("aria-disabled")).not.toBe("true");
    await user.click(enabled);
    expect(rpc.updatePredefinedProvider.mock.lastCall?.[0]).toMatchObject({
        id: "deepseek-id",
        enabled: true,
    });
    await user.click(screen.getByRole("button", { name: "Check" }));
    expect(rpc.checkProvider.mock.lastCall?.[0]).toMatchObject({
        id: "deepseek-id",
        model: "deepseek-flash",
    });
});
