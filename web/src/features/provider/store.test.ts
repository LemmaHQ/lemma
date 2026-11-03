import { create } from "@bufbuild/protobuf";
import { beforeEach, expect, it, vi } from "vitest";

import {
    type Provider as ProviderProto,
    ProviderKind,
    ProviderSchema,
} from "@/gen/lemma/v1/provider_pb";

import { useProviderStore } from "./store";
import { clearProviders } from "./useProviders";

type Reply = { provider?: ProviderProto | undefined };

const rpc = vi.hoisted(() => ({
    listProviders:
        vi.fn<(req: object) => Promise<{ providers: ProviderProto[] }>>(),
    createProvider:
        vi.fn<(req: { kind: number; identifier: string }) => Promise<Reply>>(),
    updateProvider:
        vi.fn<
            (req: {
                id: string;
                models?: { models: string[] } | undefined;
                enabled?: boolean | undefined;
            }) => Promise<Reply>
        >(),
    deleteProvider: vi.fn<(req: { id: string }) => Promise<object>>(),
    fetchModels:
        vi.fn<
            (req: {
                id?: string;
                kind: number;
            }) => Promise<{ models: string[] }>
        >(),
    checkProvider: vi.fn<
        (req: { id?: string; kind: number; model: string }) => Promise<{
            error: string;
        }>
    >(),
}));

vi.mock("@/rpc/clients", () => ({ providerClient: rpc }));

const provider = (id: string, kind: ProviderKind, patch = {}) =>
    create(ProviderSchema, {
        id,
        kind,
        identifier: id,
        name: id.toUpperCase(),
        baseUrl: "https://api.example.com",
        models: ["m1"],
        enabled: true,
        ...patch,
    });

const state = () => useProviderStore.getState();

beforeEach(async () => {
    vi.resetAllMocks();
    clearProviders();
    rpc.listProviders.mockResolvedValue({
        providers: [
            provider("a", ProviderKind.ANTHROPIC),
            provider("g", ProviderKind.GEMINI),
            provider("o", ProviderKind.OPENAI),
            provider("u", ProviderKind.UNSPECIFIED),
        ],
    });
    await state().refresh();
});

it("loads providers with their API kinds, OpenAI when unspecified", () => {
    expect(state().loaded).toBe(true);
    expect(state().list.map((p) => [p.id, p.kind])).toEqual([
        ["a", "anthropic"],
        ["g", "gemini"],
        ["o", "openai"],
        ["u", "openai"],
    ]);
});

it("appends a created provider", async () => {
    rpc.createProvider.mockResolvedValue({
        provider: provider("n", ProviderKind.GEMINI),
    });

    const created = await state().create({
        kind: "gemini",
        identifier: "n",
        name: "N",
        baseUrl: "https://api.example.com",
        apiKey: "",
        models: [],
    });

    expect(created.id).toBe("n");
    expect(rpc.createProvider.mock.lastCall?.[0]).toMatchObject({
        kind: ProviderKind.GEMINI,
        identifier: "n",
    });
    expect(state().list.at(-1)?.id).toBe("n");
});

it("fails a create the server answers without a provider", async () => {
    rpc.createProvider.mockResolvedValue({});

    await expect(
        state().create({
            kind: "openai",
            identifier: "n",
            name: "N",
            baseUrl: "https://api.example.com",
            apiKey: "",
            models: [],
        }),
    ).rejects.toThrow("no provider in response");
    expect(state().list).toHaveLength(4);
});

it("sends only the patched fields and replaces the provider", async () => {
    rpc.updateProvider.mockResolvedValue({
        provider: provider("o", ProviderKind.OPENAI, { models: ["m1", "m2"] }),
    });

    await state().update("o", { models: ["m1", "m2"] });
    await state().update("o", { enabled: false });

    expect(rpc.updateProvider.mock.calls[0]?.[0]).toMatchObject({
        id: "o",
        models: { models: ["m1", "m2"] },
        enabled: undefined,
    });
    expect(rpc.updateProvider.mock.calls[1]?.[0]).toMatchObject({
        models: undefined,
        enabled: false,
    });
    expect(state().list.find((p) => p.id === "o")?.models).toEqual([
        "m1",
        "m2",
    ]);
});

it("keeps the list when an update returns no provider", async () => {
    rpc.updateProvider.mockResolvedValue({});

    await state().update("o", { name: "Renamed" });

    expect(state().list.find((p) => p.id === "o")?.name).toBe("O");
});

it("removes a deleted provider", async () => {
    rpc.deleteProvider.mockResolvedValue({});

    await state().remove("g");

    expect(state().list.map((p) => p.id)).toEqual(["a", "o", "u"]);
});

it("fetches models and checks a stored or an inline connection", async () => {
    rpc.fetchModels.mockResolvedValue({ models: ["x", "y"] });
    rpc.checkProvider.mockResolvedValue({ error: "401 Unauthorized" });

    await expect(state().fetchModels({ id: "o" })).resolves.toEqual(["x", "y"]);
    await expect(
        state().checkProvider({
            kind: "anthropic",
            baseUrl: "https://api.example.com",
            model: "m1",
        }),
    ).resolves.toBe("401 Unauthorized");

    expect(rpc.fetchModels.mock.lastCall?.[0]).toMatchObject({
        id: "o",
        kind: ProviderKind.UNSPECIFIED,
    });
    expect(rpc.checkProvider.mock.lastCall?.[0]).toMatchObject({
        kind: ProviderKind.ANTHROPIC,
        model: "m1",
    });
});
