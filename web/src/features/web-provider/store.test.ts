import { create } from "@bufbuild/protobuf";
import { beforeEach, expect, it, vi } from "vitest";

import {
    SetWebProviderOrderRequest_Function as WebFunction,
    WebProvider_Kind,
    type WebProvider,
    WebProviderSchema,
} from "@/gen/lemma/v1/provider_pb";

import { useWebProviderStore } from "./store";

type Reply = { provider?: WebProvider | undefined };

const rpc = vi.hoisted(() => ({
    listWebProviders:
        vi.fn<(req: object) => Promise<{ providers: WebProvider[] }>>(),
    updateWebProvider:
        vi.fn<
            (req: {
                id: string;
                apiKey?: string | undefined;
                enabled?: boolean | undefined;
            }) => Promise<Reply>
        >(),
    setWebProviderOrder:
        vi.fn<
            (req: {
                function: WebFunction;
                ids: string[];
            }) => Promise<{ providers: WebProvider[] }>
        >(),
}));

vi.mock("@/rpc/clients", () => ({ providerClient: rpc }));

const provider = (kind: WebProvider_Kind, patch: object = {}) =>
    create(WebProviderSchema, {
        id: `${kind}-id`,
        kind,
        name: WebProvider_Kind[kind],
        enabled: kind === WebProvider_Kind.NATIVE,
        hasKey: kind === WebProvider_Kind.EXA,
        searchRank: 1,
        fetchRank: 2,
        ...patch,
    });

const fixtures = () => [
    provider(WebProvider_Kind.NATIVE),
    provider(WebProvider_Kind.EXA),
    provider(WebProvider_Kind.DEEPSEEK),
];

const state = () => useWebProviderStore.getState();

beforeEach(async () => {
    vi.resetAllMocks();
    useWebProviderStore.setState(useWebProviderStore.getInitialState());
    rpc.listWebProviders.mockResolvedValue({ providers: fixtures() });
    await state().refresh();
});

it("loads every web provider with write-only key state and ranks", () => {
    expect(state().loaded).toBe(true);
    expect(state().list).toEqual([
        {
            id: "1-id",
            kind: "native",
            name: "NATIVE",
            enabled: true,
            hasKey: false,
            searchRank: 1,
            fetchRank: 2,
        },
        {
            id: "2-id",
            kind: "exa",
            name: "EXA",
            enabled: false,
            hasKey: true,
            searchRank: 1,
            fetchRank: 2,
        },
        {
            id: "3-id",
            kind: "deepseek",
            name: "DEEPSEEK",
            enabled: false,
            hasKey: false,
            searchRank: 1,
            fetchRank: 2,
        },
    ]);
});

it("rejects an unknown provider kind without replacing the list", async () => {
    const previous = state().list;
    rpc.listWebProviders.mockResolvedValue({
        providers: [provider(WebProvider_Kind.UNSPECIFIED)],
    });

    await expect(state().refresh()).rejects.toThrow(
        "unknown web provider kind",
    );
    expect(state().list).toBe(previous);
});

it("sends key and enable patches and replaces the updated provider", async () => {
    rpc.updateWebProvider.mockResolvedValue({
        provider: provider(WebProvider_Kind.EXA, {
            enabled: true,
            hasKey: true,
            name: "Exa",
        }),
    });

    await state().update("2-id", { apiKey: "sk-new", enabled: true });

    expect(rpc.updateWebProvider).toHaveBeenCalledWith({
        id: "2-id",
        apiKey: "sk-new",
        enabled: true,
    });
    expect(state().list[1]).toMatchObject({ name: "Exa", enabled: true });
});

it("keeps the list when an update returns no provider", async () => {
    const previous = state().list;
    rpc.updateWebProvider.mockResolvedValue({});

    await state().update("2-id", { enabled: false });

    expect(state().list).toBe(previous);
});

it("sets search and fetch orders and stores the returned ranks", async () => {
    rpc.setWebProviderOrder.mockImplementation(({ ids }) =>
        Promise.resolve({
            providers: fixtures().toReversed().slice(0, ids.length),
        }),
    );

    await state().setOrder("search", ["3-id", "2-id"]);
    expect(rpc.setWebProviderOrder.mock.lastCall?.[0]).toEqual({
        function: WebFunction.SEARCH,
        ids: ["3-id", "2-id"],
    });
    expect(state().list.map((item) => item.kind)).toEqual(["deepseek", "exa"]);

    await state().setOrder("fetch", ["2-id", "1-id", "3-id"]);
    expect(rpc.setWebProviderOrder.mock.lastCall?.[0]).toEqual({
        function: WebFunction.FETCH,
        ids: ["2-id", "1-id", "3-id"],
    });
    expect(state().list.map((item) => item.kind)).toEqual([
        "deepseek",
        "exa",
        "native",
    ]);
});
