import { renderHook } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

import { type Provider, useProvidersStore } from "./store";
import { useModelOptions } from "./useModelOptions";

const rpc = vi.hoisted(() => ({
    listProviders: vi.fn<(req: object) => Promise<{ providers: [] }>>(),
}));

vi.mock("@/rpc/clients", () => ({ providerClient: rpc }));

const provider = (patch: Partial<Provider>): Provider => ({
    id: "p",
    kind: "openai",
    identifier: "p",
    name: "P",
    baseUrl: "",
    apiKey: "",
    apiPath: "",
    models: [],
    enabled: true,
    ...patch,
});

beforeEach(() => {
    vi.resetAllMocks();
    useProvidersStore.setState(useProvidersStore.getInitialState());
});

it("offers the models of enabled providers and names every provider", () => {
    useProvidersStore.setState({
        loaded: true,
        list: [
            provider({ id: "a", name: "Acme", models: ["m1", "m2"] }),
            provider({ id: "b", name: "Beta", models: ["m3"], enabled: false }),
            provider({ id: "c", name: "Cold", models: [] }),
        ],
    });

    const { result } = renderHook(() => useModelOptions());

    expect(result.current.options).toEqual([
        { providerId: "a", providerName: "Acme", model: "m1" },
        { providerId: "a", providerName: "Acme", model: "m2" },
    ]);
    expect([...result.current.providerNames]).toEqual([
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
        expect(useProvidersStore.getState().loaded).toBe(true);
    });
    expect(rpc.listProviders).toHaveBeenCalledOnce();
});
