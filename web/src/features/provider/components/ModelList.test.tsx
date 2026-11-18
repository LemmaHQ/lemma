import { Code, ConnectError } from "@connectrpc/connect";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { useState } from "react";
import { expect, it, vi } from "vitest";

import type { Model } from "../store";
import { ModelList } from "./ModelList";

const model = (id: string, toolCalling = true): Model => ({
    id,
    toolCalling,
});

function Harness({
    initial,
    fetchDisabled,
    onFetch,
}: {
    initial: Model[];
    fetchDisabled: boolean;
    onFetch: () => Promise<string[]>;
}) {
    const [models, setModels] = useState(initial);
    return (
        <ModelList
            models={models}
            fetchDisabled={fetchDisabled}
            onChange={setModels}
            onFetch={onFetch}
        />
    );
}

const renderList = (
    initial: Model[],
    onFetch = vi.fn<() => Promise<string[]>>(() => Promise.resolve([])),
    fetchDisabled = false,
) =>
    render(
        <Harness
            initial={initial}
            fetchDisabled={fetchDisabled}
            onFetch={onFetch}
        />,
    );
const listed = () =>
    screen
        .queryAllByRole("switch", { name: /Tool calling$/u })
        .map((toggle) =>
            toggle.getAttribute("aria-label")?.replace(/ Tool calling$/u, ""),
        );

const addButton = (index: 0 | 1) => {
    const button = screen.getAllByRole("button", { name: "Add model" })[index];
    if (button === undefined) {
        throw new TypeError("missing add button");
    }
    return button;
};

const addField = () => screen.queryByPlaceholderText("e.g. gpt-4o");

const typeNewModel = async (user: UserEvent, text: string) => {
    await user.click(screen.getByRole("button", { name: "Add model" }));
    await user.type(screen.getByPlaceholderText("e.g. gpt-4o"), text);
};

it("adds a typed model with tool calling on and ignores blanks and duplicates", async () => {
    const user = userEvent.setup();
    renderList([model("gpt-4o")]);

    await typeNewModel(user, " o3 {Enter}");
    await typeNewModel(user, "gpt-4o");
    await user.click(addButton(1));
    await typeNewModel(user, "  {Enter}");

    expect(listed()).toEqual(["gpt-4o", "o3"]);
    expect(
        screen
            .getByRole("switch", { name: "o3 Tool calling" })
            .getAttribute("aria-checked"),
    ).toBe("true");
    expect(addField()).toBeNull();
});

it("keeps the add field open while an input method composes", async () => {
    const user = userEvent.setup();
    renderList([]);

    await typeNewModel(user, "gpt");
    const field = screen.getByPlaceholderText("e.g. gpt-4o");
    fireEvent.keyDown(field, { key: "Enter", isComposing: true });
    fireEvent.keyDown(field, { key: "Escape", isComposing: true });

    expect(listed()).toEqual([]);
    expect(addField()).not.toBeNull();
});

it("closes the add field with Escape, cancel, or the toggle", async () => {
    const user = userEvent.setup();
    renderList([]);

    expect(
        screen.getByText("No models yet. Fetch the list or add one manually."),
    ).toBeDefined();
    await typeNewModel(user, "x{Escape}");
    expect(addField()).toBeNull();
    await typeNewModel(user, "x");
    expect(addButton(1)).toHaveProperty("disabled", false);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(addField()).toBeNull();
    await typeNewModel(user, "x");
    await user.click(addButton(0));

    expect(addField()).toBeNull();
    expect(
        screen.getByText("No models yet. Fetch the list or add one manually."),
    ).toBeDefined();
});

it("removes listed models", async () => {
    const user = userEvent.setup();
    renderList([model("gpt-4o"), model("gpt-4o-mini"), model("o3")]);

    const removeButtons = screen.getAllByRole("button", {
        name: "Remove model",
    });
    await user.click(removeButtons[1]!);

    expect(listed()).toEqual(["gpt-4o", "o3"]);
});

it("changes tool calling for only the selected model", async () => {
    const user = userEvent.setup();
    renderList([model("gpt-4o"), model("o3", false)]);

    const gpt = screen.getByRole("switch", { name: "gpt-4o Tool calling" });
    const o3 = screen.getByRole("switch", { name: "o3 Tool calling" });
    await user.click(gpt);
    expect(gpt.getAttribute("aria-checked")).toBe("false");
    expect(o3.getAttribute("aria-checked")).toBe("false");
    await user.click(o3);
    expect(o3.getAttribute("aria-checked")).toBe("true");
    expect(gpt.getAttribute("aria-checked")).toBe("false");
});

it("shows why the model list could not be fetched", async () => {
    const user = userEvent.setup();
    renderList(
        [],
        vi.fn<() => Promise<string[]>>(() =>
            Promise.reject(new ConnectError("down", Code.Unavailable)),
        ),
    );

    await user.click(screen.getByRole("button", { name: "Fetch model list" }));

    expect(
        await screen.findByText("Connection failed, try again"),
    ).toBeDefined();
});

it("fetches once at a time and adds picked models with tool calling on", async () => {
    const user = userEvent.setup();
    const pending = Promise.withResolvers<string[]>();
    const onFetch = vi.fn<() => Promise<string[]>>(() => pending.promise);
    renderList([model("gpt-4o")], onFetch);

    await user.click(screen.getByRole("button", { name: "Fetch model list" }));
    await user.click(screen.getByRole("button", { name: "Fetch model list" }));
    pending.resolve(["gpt-4o", "gpt-4.1", "o3", "o4-mini"]);
    const dialog = await screen.findByRole("dialog", { name: "Pick models" });

    expect(onFetch).toHaveBeenCalledOnce();
    expect(
        within(dialog).getByText(
            "The provider returned 4 models. Pick the ones to add to the list.",
        ),
    ).toBeDefined();
    expect(within(dialog).getByText("Added")).toBeDefined();
    await user.click(within(dialog).getByRole("checkbox", { name: "o3" }));
    await user.click(
        within(dialog).getByRole("button", { name: "Add 1 model" }),
    );

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(listed()).toEqual(["gpt-4o", "o3"]);
    expect(
        screen
            .getByRole("switch", { name: "o3 Tool calling" })
            .getAttribute("aria-checked"),
    ).toBe("true");
});

it("selects all matching upstream models and can deselect them", async () => {
    const user = userEvent.setup();
    renderList(
        [model("gpt-4o")],
        vi.fn<() => Promise<string[]>>(() =>
            Promise.resolve(["gpt-4o", "o3", "o3-mini", "o4-mini"]),
        ),
    );
    await user.click(screen.getByRole("button", { name: "Fetch model list" }));
    const dialog = await screen.findByRole("dialog");
    const selectAll = within(dialog).getByRole("checkbox", {
        name: "Select all",
    });

    await user.type(
        within(dialog).getByPlaceholderText("Search models…"),
        "o3",
    );
    await user.click(selectAll);
    expect(
        within(dialog).getByRole("button", { name: "Add 2 models" }),
    ).toBeDefined();
    await user.click(within(dialog).getByRole("checkbox", { name: "o3-mini" }));
    expect(selectAll.getAttribute("aria-checked")).toBe("mixed");
    await user.click(within(dialog).getByRole("checkbox", { name: "o3-mini" }));
    await user.click(selectAll);
    expect(
        within(dialog).getByRole("button", { name: "Add 0 models" }),
    ).toHaveProperty("disabled", true);

    await user.type(within(dialog).getByPlaceholderText("Search models…"), "x");
    expect(
        within(dialog).getByText("No models match the current filter."),
    ).toBeDefined();
    expect(selectAll.getAttribute("aria-disabled")).toBe("true");
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(listed()).toEqual(["gpt-4o"]);
});

it("disables fetching models when fetchDisabled is true", () => {
    renderList(
        [model("gpt-4o")],
        vi.fn<() => Promise<string[]>>(() => Promise.resolve([])),
        true,
    );

    expect(
        screen.getByRole("button", { name: "Fetch model list" }),
    ).toHaveProperty("disabled", true);
});
