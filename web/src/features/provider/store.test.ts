import { create } from "@bufbuild/protobuf";
import { beforeEach, expect, it, vi } from "vitest";

import {
    ApiFormat,
    CustomProviderSchema,
    PredefinedProviderSchema,
    type Provider as ProviderProto,
    ProviderSchema,
} from "@/gen/lemma/v1/provider_pb";

import { useProviderStore } from "./store";

type Reply = { provider?: ProviderProto | undefined };

const rpc = vi.hoisted(() => ({
    listProviders:
        vi.fn<(req: object) => Promise<{ providers: ProviderProto[] }>>(),
    createCustomProvider:
        vi.fn<
            (req: { apiFormat: number; identifier: string }) => Promise<Reply>
        >(),
    updateCustomProvider:
        vi.fn<
            (req: {
                id: string;
                models?:
                    | { models: { id: string; toolCalling: boolean }[] }
                    | undefined;
                enabled?: boolean | undefined;
            }) => Promise<Reply>
        >(),
    updatePredefinedProvider:
        vi.fn<
            (req: {
                id: string;
                apiKey?: string | undefined;
                enabled?: boolean | undefined;
                defaultApiFormat?: number | undefined;
            }) => Promise<Reply>
        >(),
    deleteCustomProvider: vi.fn<(req: { id: string }) => Promise<object>>(),
    fetchModels:
        vi.fn<(req: { id: string }) => Promise<{ models: string[] }>>(),
    checkProvider: vi.fn<
        (req: { id: string; model: string }) => Promise<{
            error: string;
        }>
    >(),
}));

vi.mock("@/rpc/clients", () => ({ providerClient: rpc }));

const customProvider = (id: string, apiFormat: ApiFormat, patch: object = {}) =>
    create(ProviderSchema, {
        id,
        enabled: true,
        source: {
            case: "custom",
            value: create(CustomProviderSchema, {
                identifier: id,
                name: id.toUpperCase(),
                apiFormat,
                baseUrl: "https://api.example.com",
                models: [{ id: "m1", toolCalling: true }],
                ...patch,
            }),
        },
    });

const predefinedProvider = (patch: object = {}) =>
    create(ProviderSchema, {
        id: "deepseek-id",
        hasKey: true,
        enabled: false,
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

const state = () => useProviderStore.getState();

beforeEach(async () => {
    vi.resetAllMocks();
    useProviderStore.setState(useProviderStore.getInitialState());
    rpc.listProviders.mockResolvedValue({
        providers: [
            customProvider("a", ApiFormat.ANTHROPIC),
            customProvider("g", ApiFormat.GEMINI),
            customProvider("o", ApiFormat.OPENAI),
            customProvider("u", ApiFormat.UNSPECIFIED),
            predefinedProvider(),
        ],
    });
    await state().refresh();
});

it("loads custom and predefined providers with models and API formats", () => {
    expect(state().loaded).toBe(true);
    expect(
        state().list.map((provider) => [provider.id, provider.source]),
    ).toEqual([
        ["a", "custom"],
        ["g", "custom"],
        ["o", "custom"],
        ["u", "custom"],
        ["deepseek-id", "predefined"],
    ]);
    expect(state().list[0]).toMatchObject({ apiFormat: "anthropic" });
    expect(state().list[1]).toMatchObject({ apiFormat: "gemini" });
    expect(state().list[2]).toMatchObject({ apiFormat: "openai" });
    expect(state().list[3]).toMatchObject({ apiFormat: "openai" });
    expect(state().list.at(-1)).toMatchObject({
        source: "predefined",
        hasKey: true,
        defaultApiFormat: "anthropic",
        apiFormats: ["anthropic", "openai"],
        models: [
            { id: "deepseek-flash", toolCalling: true },
            { id: "deepseek-v4-pro", toolCalling: false },
        ],
    });
});

it("rejects a listed provider without a source", async () => {
    const previous = state().list;
    rpc.listProviders.mockResolvedValue({
        providers: [create(ProviderSchema, { id: "broken" })],
    });

    await expect(state().refresh()).rejects.toThrow(Error);
    expect(state().list).toBe(previous);
    expect(state().loaded).toBe(true);
});

it("appends a created custom provider", async () => {
    rpc.createCustomProvider.mockResolvedValue({
        provider: customProvider("n", ApiFormat.GEMINI),
    });

    const created = await state().create({
        apiFormat: "gemini",
        identifier: "n",
        name: "N",
        baseUrl: "https://api.example.com",
        apiKey: "",
        models: [],
    });

    expect(created.id).toBe("n");
    expect(rpc.createCustomProvider.mock.lastCall?.[0]).toMatchObject({
        apiFormat: ApiFormat.GEMINI,
        identifier: "n",
    });
    expect(state().list.at(-1)?.id).toBe("n");
});

it("fails a create the server answers without a provider", async () => {
    rpc.createCustomProvider.mockResolvedValue({});

    await expect(
        state().create({
            apiFormat: "openai",
            identifier: "n",
            name: "N",
            baseUrl: "https://api.example.com",
            apiKey: "",
            models: [],
        }),
    ).rejects.toThrow("no provider in response");
    expect(state().list).toHaveLength(5);
});

it("sends only custom patches and replaces the provider", async () => {
    const models = [
        { id: "m1", toolCalling: false },
        { id: "m2", toolCalling: true },
    ];
    rpc.updateCustomProvider.mockResolvedValue({
        provider: customProvider("o", ApiFormat.OPENAI, { models }),
    });

    await state().updateCustom("o", { models });
    await state().updateCustom("o", { enabled: false });

    expect(rpc.updateCustomProvider.mock.calls[0]?.[0]).toMatchObject({
        id: "o",
        models: { models },
        enabled: undefined,
    });
    expect(rpc.updateCustomProvider.mock.calls[1]?.[0]).toMatchObject({
        models: undefined,
        enabled: false,
    });
    expect(state().list.find((p) => p.id === "o")?.models).toEqual(models);
});

it("sends predefined key, enabled, and default format patches", async () => {
    rpc.updatePredefinedProvider.mockResolvedValue({
        provider: predefinedProvider({
            defaultApiFormat: ApiFormat.OPENAI,
        }),
    });

    await state().updatePredefined("deepseek-id", {
        apiKey: "sk-new",
        defaultApiFormat: "openai",
    });

    expect(rpc.updatePredefinedProvider.mock.lastCall?.[0]).toMatchObject({
        id: "deepseek-id",
        apiKey: "sk-new",
        enabled: undefined,
        defaultApiFormat: ApiFormat.OPENAI,
    });
    expect(state().list.at(-1)).toMatchObject({
        defaultApiFormat: "openai",
    });
});

it("keeps the list when an update returns no provider", async () => {
    rpc.updateCustomProvider.mockResolvedValue({});

    await state().updateCustom("o", { name: "Renamed" });

    expect(state().list.find((p) => p.id === "o")?.name).toBe("O");
});

it("removes a deleted custom provider", async () => {
    rpc.deleteCustomProvider.mockResolvedValue({});

    await state().remove("g");

    expect(state().list.map((p) => p.id)).toEqual([
        "a",
        "o",
        "u",
        "deepseek-id",
    ]);
});

it("fetches models and checks a stored provider by id", async () => {
    rpc.fetchModels.mockResolvedValue({ models: ["x", "y"] });
    rpc.checkProvider.mockResolvedValue({ error: "401 Unauthorized" });

    await expect(state().fetchModels("o")).resolves.toEqual(["x", "y"]);
    await expect(state().checkProvider("o", "m1")).resolves.toBe(
        "401 Unauthorized",
    );

    expect(rpc.fetchModels).toHaveBeenCalledWith({ id: "o" });
    expect(rpc.checkProvider).toHaveBeenCalledWith({
        id: "o",
        model: "m1",
    });
});
