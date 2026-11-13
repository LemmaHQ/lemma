import { create } from "@bufbuild/protobuf";
import { Code, ConnectError } from "@connectrpc/connect";
import { Toaster, TooltipProvider } from "@lemma/ui";
import { render, screen, within } from "@testing-library/react";
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

const provider = (kind: WebProvider_Kind) =>
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
        hasKey: kind === WebProvider_Kind.EXA,
        searchRank: kind === WebProvider_Kind.EXA ? 0 : 1,
        fetchRank:
            kind === WebProvider_Kind.NATIVE
                ? 0
                : kind === WebProvider_Kind.EXA
                  ? 1
                  : 2,
    });

const fixtures = () => [
    provider(WebProvider_Kind.EXA),
    provider(WebProvider_Kind.DEEPSEEK),
    provider(WebProvider_Kind.NATIVE),
];

const renderPanel = () =>
    render(
        <TooltipProvider>
            <Toaster />
            <WebProviderPanel />
        </TooltipProvider>,
    );

const sectionElement = (name: string) => {
    const element = screen.getByRole("heading", { name }).closest("section");
    if (element === null) {
        throw new TypeError("no settings section");
    }
    return element;
};

const card = (name: string) => within(sectionElement(name));

const order = (name: string) => within(sectionElement(name));

const orderRows = (name: string) =>
    Array.from(
        sectionElement(name).querySelectorAll("[data-slot=settings-row]"),
        (item) => item.textContent,
    );

beforeEach(() => {
    vi.resetAllMocks();
    useWebProviderStore.setState(useWebProviderStore.getInitialState());
    rpc.listWebProviders.mockResolvedValue({ providers: fixtures() });
    rpc.updateWebProvider.mockImplementation(({ id, apiKey, enabled }) => {
        const current = fixtures().find((item) => item.id === id)!;
        return Promise.resolve({
            provider: create(WebProviderSchema, {
                ...current,
                hasKey: apiKey === undefined ? current.hasKey : apiKey !== "",
                enabled: apiKey === "" ? false : (enabled ?? current.enabled),
            }),
        });
    });
});

it("loads all accounts and ranks both backend lists", async () => {
    renderPanel();

    expect(screen.getByRole("status", { name: "Loading…" })).toBeDefined();
    expect(await screen.findByRole("heading", { name: "Exa" })).toBeDefined();
    expect(
        card("DeepSeek")
            .getByRole("switch", { name: "Enable DeepSeek" })
            .getAttribute("aria-checked"),
    ).toBe("false");
    expect(
        card("DeepSeek").getByRole("switch", { name: "Enable DeepSeek" })
            .dataset.disabled,
    ).toBeDefined();
    expect(card("Native").queryByLabelText("API key")).toBeNull();
    expect(orderRows("Search backend order")).toEqual(["Exa", "DeepSeek"]);
    expect(orderRows("Fetch backend order")).toEqual([
        "Native",
        "Exa",
        "DeepSeek",
    ]);
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

it("saves a trimmed replacement key and then allows enabling", async () => {
    const user = userEvent.setup();
    renderPanel();
    await screen.findByRole("heading", { name: "DeepSeek" });
    const deepseek = card("DeepSeek");

    await user.type(deepseek.getByLabelText("API key"), "  sk-new  ");
    await user.click(deepseek.getByRole("button", { name: "Save" }));

    expect(rpc.updateWebProvider).toHaveBeenCalledWith({
        id: "3-id",
        apiKey: "sk-new",
    });
    expect(deepseek.getByLabelText("API key")).toHaveProperty("value", "");
    expect(
        deepseek.getByRole("switch", { name: "Enable DeepSeek" }).dataset
            .disabled,
    ).toBeUndefined();
    expect(
        deepseek.getByText("A key is saved. Enter a new key to replace it."),
    ).toBeDefined();
});

it("keeps a failed key edit and discards it on cancel", async () => {
    const user = userEvent.setup();
    rpc.updateWebProvider.mockRejectedValue(
        new ConnectError("down", Code.Unavailable),
    );
    renderPanel();
    await screen.findByRole("heading", { name: "DeepSeek" });
    const deepseek = card("DeepSeek");

    await user.type(deepseek.getByLabelText("API key"), "sk-new");
    await user.click(deepseek.getByRole("button", { name: "Save" }));

    expect((await deepseek.findByRole("alert")).textContent).toContain(
        "Can't reach the server",
    );
    expect(deepseek.getByLabelText("API key")).toHaveProperty(
        "value",
        "sk-new",
    );
    await user.click(deepseek.getByRole("button", { name: "Cancel" }));
    expect(deepseek.queryByRole("alert")).toBeNull();
    expect(deepseek.queryByText("You have unsaved changes.")).toBeNull();
});

it("toggles hosted and native backends and reports failures", async () => {
    const user = userEvent.setup();
    renderPanel();
    await screen.findByRole("heading", { name: "Exa" });

    await user.click(card("Exa").getByRole("switch", { name: "Enable Exa" }));
    expect(rpc.updateWebProvider.mock.lastCall?.[0]).toEqual({
        id: "2-id",
        enabled: false,
    });
    await user.click(
        card("Native").getByRole("switch", { name: "Enable Native" }),
    );
    expect(rpc.updateWebProvider.mock.lastCall?.[0]).toEqual({
        id: "1-id",
        enabled: false,
    });
    rpc.updateWebProvider.mockRejectedValueOnce(
        new ConnectError("down", Code.Unavailable),
    );
    await user.click(
        card("Native").getByRole("switch", { name: "Enable Native" }),
    );

    expect(await screen.findByText(/Can't reach the server/u)).toBeDefined();
});

it("moves search and fetch providers through the order RPC", async () => {
    const user = userEvent.setup();
    rpc.setWebProviderOrder.mockResolvedValue({
        providers: [
            create(WebProviderSchema, {
                ...provider(WebProvider_Kind.EXA),
                searchRank: 1,
            }),
            create(WebProviderSchema, {
                ...provider(WebProvider_Kind.DEEPSEEK),
                searchRank: 0,
            }),
            provider(WebProvider_Kind.NATIVE),
        ],
    });
    renderPanel();
    await screen.findByRole("heading", { name: "Exa" });

    await user.click(
        order("Search backend order").getByRole("button", {
            name: "Move DeepSeek up",
        }),
    );
    expect(rpc.setWebProviderOrder.mock.lastCall?.[0]).toEqual({
        function: WebFunction.SEARCH,
        ids: ["3-id", "2-id"],
    });

    rpc.setWebProviderOrder.mockResolvedValue({
        providers: [
            create(WebProviderSchema, {
                ...provider(WebProvider_Kind.EXA),
                fetchRank: 0,
            }),
            provider(WebProvider_Kind.DEEPSEEK),
            create(WebProviderSchema, {
                ...provider(WebProvider_Kind.NATIVE),
                fetchRank: 1,
            }),
        ],
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
});
