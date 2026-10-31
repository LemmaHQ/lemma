import { Code, ConnectError } from "@connectrpc/connect";
import { render, screen, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { useState } from "react";
import { expect, it, vi } from "vitest";

import { ModelList } from "./ModelList";

function Harness({
    initial,
    onFetch,
}: {
    initial: string[];
    onFetch: () => Promise<string[]>;
}) {
    const [models, setModels] = useState(initial);
    return <ModelList models={models} onChange={setModels} onFetch={onFetch} />;
}

const renderList = (
    initial: string[],
    onFetch = vi.fn<() => Promise<string[]>>(() => Promise.resolve([])),
) => render(<Harness initial={initial} onFetch={onFetch} />);

const listed = () =>
    screen
        .queryAllByRole("button", { name: "Remove model" })
        .map((button) => button.closest("[data-slot=item]")?.textContent);

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

it("adds a typed model to the top and ignores blanks and duplicates", async () => {
    const user = userEvent.setup();
    renderList(["gpt-4o"]);

    await typeNewModel(user, " o3 {Enter}");
    await typeNewModel(user, "gpt-4o");
    await user.click(addButton(1));
    await typeNewModel(user, "  {Enter}");

    expect(listed()).toEqual(["o3", "gpt-4o"]);
    expect(addField()).toBeNull();
});

it("closes the add field with Escape, cancel, or the toggle", async () => {
    const user = userEvent.setup();
    renderList([]);

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
        screen.getByText("No models match the current filter."),
    ).toBeDefined();
});

it("filters and removes listed models", async () => {
    const user = userEvent.setup();
    renderList(["gpt-4o", "gpt-4o-mini", "o3"]);

    await user.type(screen.getByPlaceholderText("Search models…"), " MINI ");
    expect(listed()).toEqual(["gpt-4o-mini"]);
    await user.click(screen.getByRole("button", { name: "Remove model" }));

    expect(listed()).toEqual([]);
    await user.clear(screen.getByPlaceholderText("Search models…"));
    expect(listed()).toEqual(["gpt-4o", "o3"]);
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
        await screen.findByText(
            "Can't reach the server, check your connection and try again",
        ),
    ).toBeDefined();
});

it("fetches once at a time and adds the picked upstream models", async () => {
    const user = userEvent.setup();
    const pending = Promise.withResolvers<string[]>();
    const onFetch = vi.fn<() => Promise<string[]>>(() => pending.promise);
    renderList(["gpt-4o"], onFetch);

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
});

it("selects all matching upstream models and can deselect them", async () => {
    const user = userEvent.setup();
    renderList(
        ["gpt-4o"],
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
