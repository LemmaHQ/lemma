import { renderHook } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

import {
    type CustomProvider,
    type PredefinedProvider,
    useProviderStore,
} from "./store";
import { useModelOptions } from "./useModelOptions";

const rpc = vi.hoisted(() => ({
    listProviders: vi.fn<(req: object) => Promise<{ providers: [] }>>(),
}));

vi.mock("@/rpc/clients", () => ({ providerClient: rpc }));

const customProvider = (
    patch: Partial<CustomProvider> = {},
): CustomProvider => ({
    id: "custom",
    source: "custom",
    apiFormat: "openai",
    identifier: "custom",
    name: "Custom",
    baseUrl: "",
    apiKey: "",
    apiPath: "",
    modelsPath: "",
    models: [],
    enabled: true,
    ...patch,
});

const predefinedProvider = (
    patch: Partial<PredefinedProvider> = {},
): PredefinedProvider => ({
    id: "deepseek-id",
    source: "predefined",
    identifier: "deepseek",
    name: "DeepSeek",
    apiKey: "sk-saved",
    apiFormats: ["anthropic", "openai"],
    defaultApiFormat: "anthropic",
    models: [{ id: "deepseek-flash", toolCalling: true }],
    enabled: true,
    ...patch,
});

beforeEach(() => {
    vi.resetAllMocks();
    useProviderStore.setState(useProviderStore.getInitialState());
});

it("offers models of enabled custom and predefined providers", () => {
    useProviderStore.setState({
        loaded: true,
        list: [
            predefinedProvider(),
            customProvider({
                id: "a",
                name: "Acme",
                models: [
                    { id: "m1", toolCalling: true },
                    { id: "m2", toolCalling: false },
                ],
            }),
            customProvider({
                id: "b",
                name: "Beta",
                models: [{ id: "m3", toolCalling: true }],
                enabled: false,
            }),
            customProvider({ id: "c", name: "Cold", models: [] }),
        ],
    });

    const { result } = renderHook(() => useModelOptions());

    expect(result.current.options).toEqual([
        {
            providerId: "deepseek-id",
            providerName: "DeepSeek",
            model: "deepseek-flash",
        },
        { providerId: "a", providerName: "Acme", model: "m1" },
        { providerId: "a", providerName: "Acme", model: "m2" },
    ]);
    expect([...result.current.providerNames]).toEqual([
        ["deepseek-id", "DeepSeek"],
        ["a", "Acme"],
        ["b", "Beta"],
        ["c", "Cold"],
    ]);
    expect(rpc.listProviders).not.toHaveBeenCalled();
});

it("loads the providers on first use", async () => {
    rpc.listProviders.mockResolvedValue({ providers: [] });

    renderHook(() => useModelOptions());

    await vi.waitFor(() => {
        expect(useProviderStore.getState().loaded).toBe(true);
    });
    expect(rpc.listProviders).toHaveBeenCalledOnce();
});
