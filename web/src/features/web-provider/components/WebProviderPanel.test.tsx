import { create } from "@bufbuild/protobuf";
import { Code, ConnectError } from "@connectrpc/connect";
import { Toaster, TooltipProvider } from "@lemma/ui";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";

import {
    SetWebProviderOrderRequest_Function as WebFunction,
    WebProvider_Kind,
    type WebProvider,
    WebProviderSchema,
} from "@/gen/lemma/v1/provider_pb";

import { useWebProviderStore } from "../store";
import { WebProviderPanel } from "./WebProviderPanel";

type UpdateRequest = {
    id: string;
    apiKey?: string | undefined;
    enabled?: boolean | undefined;
};
type OrderRequest = { function: WebFunction; ids: string[] };

const rpc = vi.hoisted(() => ({
    listWebProviders:
        vi.fn<(req: object) => Promise<{ providers: WebProvider[] }>>(),
    updateWebProvider:
        vi.fn<(req: UpdateRequest) => Promise<{ provider?: WebProvider }>>(),
    setWebProviderOrder:
        vi.fn<(req: OrderRequest) => Promise<{ providers: WebProvider[] }>>(),
}));

vi.mock("@/rpc/clients", () => ({ providerClient: rpc }));

const provider = (kind: WebProvider_Kind, patch: object = {}) =>
    create(WebProviderSchema, {
        id: `${kind}-id`,
        kind,
        name: {
            [WebProvider_Kind.UNSPECIFIED]: "Unknown",
            [WebProvider_Kind.NATIVE]: "Native",
            [WebProvider_Kind.EXA]: "Exa",
            [WebProvider_Kind.DEEPSEEK]: "DeepSeek",
        }[kind],
        enabled: kind !== WebProvider_Kind.DEEPSEEK,
        apiKey: kind === WebProvider_Kind.EXA ? "sk-exa" : "",
        searchRank: kind === WebProvider_Kind.EXA ? 0 : 1,
        fetchRank:
            kind === WebProvider_Kind.NATIVE
                ? 0
                : kind === WebProvider_Kind.EXA
                  ? 1
                  : 2,
        ...patch,
    });

const fixtures = () => [
    provider(WebProvider_Kind.NATIVE),
    provider(WebProvider_Kind.EXA),
    provider(WebProvider_Kind.DEEPSEEK),
];

const renderPanel = () =>
    render(
        <TooltipProvider>
            <Toaster />
            <WebProviderPanel />
        </TooltipProvider>,
    );
const backend = (name: string) => within(screen.getByRole("group", { name }));

const order = (name: string) => within(screen.getByRole("region", { name }));

const orderRows = (name: string) =>
    Array.from(
        screen
            .getByRole("region", { name })
            .querySelectorAll("[data-slot=web-order-row]"),
    );

const orderRow = (sectionName: string, providerName: string) => {
    const match = orderRows(sectionName).find((item) =>
        item.textContent?.includes(providerName),
    );
    if (match === undefined) {
        throw new TypeError(`missing order row ${providerName}`);
    }
    return match;
};

let currentProviders: WebProvider[] = [];

beforeEach(() => {
    vi.resetAllMocks();
    useWebProviderStore.setState(useWebProviderStore.getInitialState());
    currentProviders = fixtures();
    rpc.listWebProviders.mockImplementation(() =>
        Promise.resolve({ providers: currentProviders }),
    );
    rpc.updateWebProvider.mockImplementation(({ id, apiKey, enabled }) => {
        const current = currentProviders.find((item) => item.id === id);
        if (current === undefined) {
            return Promise.resolve({});
        }
        const nextKey = apiKey ?? current.apiKey;
        const updated = create(WebProviderSchema, {
            ...current,
            apiKey: nextKey,
            enabled:
                nextKey === "" && current.kind !== WebProvider_Kind.NATIVE
                    ? false
                    : (enabled ?? current.enabled),
        });
        currentProviders = currentProviders.map((item) =>
            item.id === id ? updated : item,
        );
        return Promise.resolve({ provider: updated });
    });
});

it("loads backends with plaintext key prefill, reveal, captions, live chains, and ranks", async () => {
    const user = userEvent.setup();
    renderPanel();

    expect(screen.getByRole("status", { name: "Loading…" })).toBeDefined();
    expect(
        await screen.findByRole("region", { name: "Backends" }),
    ).toBeDefined();

    const native = backend("Native");
    expect(native.getByText("Fetch only · Local HTTP")).toBeDefined();
    expect(native.getByText("Runs locally · no key needed")).toBeDefined();
    expect(native.queryByLabelText("API key")).toBeNull();

    const exa = backend("Exa");
    expect(exa.getByText("api.exa.ai")).toBeDefined();
    const exaInput = exa.getByLabelText("API key");
    expect(exaInput).toHaveProperty("value", "sk-exa");
    expect(exaInput).toHaveProperty("type", "password");
    await user.click(exa.getByRole("button", { name: "Show" }));
    expect(exaInput).toHaveProperty("type", "text");
    await user.click(exa.getByRole("button", { name: "Hide" }));
    expect(exaInput).toHaveProperty("type", "password");
    expect(exa.getByRole("button", { name: "Save" })).toHaveProperty(
        "disabled",
        true,
    );
    expect(exa.getByRole("button", { name: "Clear" })).toBeDefined();

    const deepseek = backend("DeepSeek");
    expect(deepseek.getByText("api.deepseek.com")).toBeDefined();
    expect(
        deepseek.getByRole("switch", { name: "Enable DeepSeek" }).dataset
            .disabled,
    ).toBeDefined();
    expect(deepseek.queryByRole("button", { name: "Clear" })).toBeNull();

    expect(
        order("Search backend order").getByText("Active: web_search (Exa)"),
    ).toBeDefined();
    expect(
        order("Fetch backend order").getByText(
            "Active: web_fetch (Native → Exa)",
        ),
    ).toBeDefined();

    expect(
        orderRows("Search backend order").map((el) => el.textContent),
    ).toEqual(["1ExaPrimary", "–DeepSeekDisabled · skipped"]);
    expect(
        orderRows("Fetch backend order").map((el) => el.textContent),
    ).toEqual([
        "1NativePrimary",
        "2ExaFallback #2",
        "–DeepSeekDisabled · skipped",
    ]);
    expect(orderRow("Fetch backend order", "DeepSeek").className).toContain(
        "opacity-60",
    );
    expect(
        order("Search backend order").getByRole("button", {
            name: "Move Exa up",
        }),
    ).toHaveProperty("disabled", true);
    expect(
        order("Search backend order").getByRole("button", {
            name: "Move DeepSeek down",
        }),
    ).toHaveProperty("disabled", true);
});

it("saves, clears, and toggles backends while updating live meta chains", async () => {
    const user = userEvent.setup();
    renderPanel();
    await screen.findByRole("group", { name: "DeepSeek" });

    const deepseek = backend("DeepSeek");
    await user.type(deepseek.getByLabelText("API key"), "  sk-ds  ");
    expect(
        deepseek.getByRole("switch", { name: "Enable DeepSeek" }).dataset
            .disabled,
    ).toBeUndefined();
    await user.click(deepseek.getByRole("button", { name: "Save" }));

    expect(rpc.updateWebProvider).toHaveBeenCalledWith({
        id: "3-id",
        apiKey: "sk-ds",
    });
    expect(deepseek.getByLabelText("API key")).toHaveProperty("value", "sk-ds");
    expect(deepseek.getByRole("button", { name: "Clear" })).toBeDefined();

    await user.click(deepseek.getByRole("switch", { name: "Enable DeepSeek" }));
    expect(rpc.updateWebProvider.mock.lastCall?.[0]).toEqual({
        id: "3-id",
        enabled: true,
    });
    expect(
        order("Search backend order").getByText(
            "Active: web_search (Exa → DeepSeek)",
        ),
    ).toBeDefined();

    const exa = backend("Exa");
    await user.click(exa.getByRole("button", { name: "Clear" }));
    expect(rpc.updateWebProvider.mock.lastCall?.[0]).toEqual({
        id: "2-id",
        apiKey: "",
    });
    expect(exa.getByLabelText("API key")).toHaveProperty("value", "");
    expect(exa.queryByRole("button", { name: "Clear" })).toBeNull();
    expect(
        exa
            .getByRole("switch", { name: "Enable Exa" })
            .getAttribute("aria-checked"),
    ).toBe("false");

    await user.type(exa.getByLabelText("API key"), "  sk-exa-2  ");
    await user.click(exa.getByRole("switch", { name: "Enable Exa" }));
    expect(rpc.updateWebProvider.mock.lastCall?.[0]).toEqual({
        id: "2-id",
        apiKey: "sk-exa-2",
        enabled: true,
    });
    expect(exa.getByLabelText("API key")).toHaveProperty("value", "sk-exa-2");
});

it("shows inactive meta when all backends for a tool are disabled", async () => {
    const user = userEvent.setup();
    renderPanel();
    await screen.findByRole("group", { name: "Exa" });

    await user.click(
        backend("Exa").getByRole("switch", { name: "Enable Exa" }),
    );
    await user.click(
        backend("Native").getByRole("switch", { name: "Enable Native" }),
    );

    expect(
        order("Search backend order").getByText(
            "No enabled backend; web_search is not registered",
        ),
    ).toBeDefined();
    expect(
        order("Fetch backend order").getByText(
            "No enabled backend; web_fetch is not registered",
        ),
    ).toBeDefined();
});

it("reports save, clear, toggle, and reorder failures via toast and keeps draft", async () => {
    const user = userEvent.setup();
    renderPanel();
    await screen.findByRole("group", { name: "DeepSeek" });

    rpc.updateWebProvider.mockRejectedValue(
        new ConnectError("down", Code.Unavailable),
    );
    const deepseek = backend("DeepSeek");
    await user.type(deepseek.getByLabelText("API key"), "sk-fail");
    await user.click(deepseek.getByRole("button", { name: "Save" }));

    expect(await screen.findByText(/Can't reach the server/u)).toBeDefined();
    expect(deepseek.getByLabelText("API key")).toHaveProperty(
        "value",
        "sk-fail",
    );

    await user.click(backend("Exa").getByRole("button", { name: "Clear" }));
    expect(backend("Exa").getByLabelText("API key")).toHaveProperty(
        "value",
        "sk-exa",
    );

    await user.click(
        backend("Native").getByRole("switch", { name: "Enable Native" }),
    );
    expect(
        backend("Native")
            .getByRole("switch", { name: "Enable Native" })
            .getAttribute("aria-checked"),
    ).toBe("true");

    rpc.setWebProviderOrder.mockRejectedValueOnce(
        new ConnectError("down", Code.Unavailable),
    );
    await user.click(
        order("Search backend order").getByRole("button", {
            name: "Move DeepSeek up",
        }),
    );
    expect(rpc.setWebProviderOrder).toHaveBeenCalledWith({
        function: WebFunction.SEARCH,
        ids: ["3-id", "2-id"],
    });
});

it("reorders via up and down buttons and drag-and-drop while ignoring cross-list drops", async () => {
    const user = userEvent.setup();
    rpc.setWebProviderOrder.mockResolvedValue({
        providers: [
            provider(WebProvider_Kind.EXA, { searchRank: 1, fetchRank: 1 }),
            provider(WebProvider_Kind.DEEPSEEK, {
                searchRank: 0,
                fetchRank: 2,
            }),
            provider(WebProvider_Kind.NATIVE, { fetchRank: 0 }),
        ],
    });
    renderPanel();
    await screen.findByRole("group", { name: "Exa" });

    await user.click(
        order("Search backend order").getByRole("button", {
            name: "Move Exa down",
        }),
    );
    expect(rpc.setWebProviderOrder.mock.lastCall?.[0]).toEqual({
        function: WebFunction.SEARCH,
        ids: ["3-id", "2-id"],
    });

    await user.click(
        order("Fetch backend order").getByRole("button", {
            name: "Move Native down",
        }),
    );
    expect(rpc.setWebProviderOrder.mock.lastCall?.[0]).toEqual({
        function: WebFunction.FETCH,
        ids: ["2-id", "1-id", "3-id"],
    });

    const searchExa = orderRow("Search backend order", "Exa");
    const searchDeepSeek = orderRow("Search backend order", "DeepSeek");
    const fetchNative = orderRow("Fetch backend order", "Native");
    const fetchExa = orderRow("Fetch backend order", "Exa");
    const dataTransfer = new DataTransfer();

    fireEvent.dragOver(fetchExa);
    fireEvent.drop(fetchExa);
    expect(rpc.setWebProviderOrder).toHaveBeenCalledTimes(2);

    fireEvent.dragStart(searchExa, { dataTransfer });
    fireEvent.dragOver(fetchExa);
    fireEvent.drop(fetchExa);
    expect(rpc.setWebProviderOrder).toHaveBeenCalledTimes(2);

    fireEvent.dragOver(searchExa);
    fireEvent.dragLeave(searchExa);
    fireEvent.dragOver(searchDeepSeek);
    fireEvent.dragOver(searchDeepSeek);
    expect(searchDeepSeek.className).toContain("bg-accent");
    fireEvent.dragLeave(searchDeepSeek);
    expect(searchDeepSeek.className).not.toContain("bg-accent");
    fireEvent.drop(searchExa);
    expect(rpc.setWebProviderOrder).toHaveBeenCalledTimes(2);

    fireEvent.dragStart(searchExa, { dataTransfer });
    fireEvent.dragOver(searchDeepSeek);
    fireEvent.drop(searchDeepSeek);
    expect(rpc.setWebProviderOrder.mock.lastCall?.[0]).toEqual({
        function: WebFunction.SEARCH,
        ids: ["2-id", "3-id"],
    });

    fireEvent.dragStart(fetchNative, { dataTransfer });
    fireEvent.dragEnd(fetchNative);
    fireEvent.drop(fetchExa);
    expect(rpc.setWebProviderOrder).toHaveBeenCalledTimes(3);

    fireEvent.dragStart(fetchNative, { dataTransfer });
    act(() => {
        useWebProviderStore.setState({
            list: useWebProviderStore
                .getState()
                .list.filter((item) => item.kind !== "native"),
        });
    });
    fireEvent.drop(orderRow("Fetch backend order", "Exa"));
    expect(rpc.setWebProviderOrder).toHaveBeenCalledTimes(3);
});
