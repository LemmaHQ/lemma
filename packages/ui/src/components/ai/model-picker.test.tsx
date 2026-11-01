import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";

import {
    ModelPicker,
    type ModelPickerOption,
    type ModelPickerSelection,
} from "./model-picker";

const options: ModelPickerOption[] = [
    { providerId: "p1", providerName: "Acme", model: "fast" },
    { providerId: "p1", providerName: "Acme", model: "smart" },
    { providerId: "p2", providerName: "Beta", model: "fast" },
];

const renderPicker = (
    selection: ModelPickerSelection | null,
    onSelect = vi.fn<(selection: ModelPickerSelection) => void>(),
    pickerOptions = options,
) =>
    render(
        <ModelPicker
            selection={selection}
            options={pickerOptions}
            onSelect={onSelect}
            label="Select model"
            placeholder="No model"
        />,
    );

const trigger = () => screen.getByRole("button", { name: "Select model" });

const fill = () => {
    const element = document.querySelector('[data-part="fill"]');
    if (!(element instanceof HTMLElement)) {
        throw new TypeError("no highlight fill");
    }
    return element;
};

const nextFrame = () =>
    new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
            resolve();
        });
    });

afterEach(() => {
    vi.restoreAllMocks();
});

it("shows the placeholder and is disabled without options", () => {
    renderPicker(null, undefined, []);

    expect(trigger().textContent).toBe("No model");
    expect(trigger()).toHaveProperty("disabled", true);
});

it("lists models by provider and selects one", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn<(selection: ModelPickerSelection) => void>();
    renderPicker({ providerId: "p1", model: "smart" }, onSelect);
    expect(trigger().textContent).toBe("smart");

    await user.click(trigger());
    const menu = await screen.findByRole("menu", { name: "Select model" });
    expect(menu.textContent).toContain("Acme");
    expect(menu.textContent).toContain("Beta");
    const items = screen.getAllByRole("menuitemradio");
    expect(items.map((item) => item.getAttribute("aria-checked"))).toEqual([
        "false",
        "true",
        "false",
    ]);

    await user.click(items[2]!);

    expect(onSelect).toHaveBeenCalledWith({ providerId: "p2", model: "fast" });
    await waitFor(() => {
        expect(trigger().getAttribute("aria-expanded")).toBe("false");
    });
});

it("marks the selected model and follows the highlight", async () => {
    const user = userEvent.setup();
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(36);
    renderPicker({ providerId: "p1", model: "smart" });

    await user.click(trigger());
    await waitFor(() => {
        expect(fill().dataset.visible).toBe("true");
    });

    await user.keyboard("{ArrowDown}");
    await waitFor(() => {
        expect(fill().dataset.glide).toBe("true");
    });

    await user.keyboard("{Escape}");
    await waitFor(() => {
        expect(trigger().getAttribute("aria-expanded")).toBe("false");
    });
});

it("hides the highlight while nothing is selected", async () => {
    const user = userEvent.setup();
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(36);
    renderPicker(null);

    await user.click(trigger());
    await screen.findByRole("menu");
    await nextFrame();

    expect(fill().dataset.visible).toBe("false");

    await user.keyboard("{ArrowDown}{Escape}");
    await waitFor(() => {
        expect(trigger().getAttribute("aria-expanded")).toBe("false");
    });
    expect(fill().dataset.visible).toBe("false");
});

it("hides the highlight for a selection that is no longer offered", async () => {
    const user = userEvent.setup();
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(36);
    renderPicker({ providerId: "gone", model: "old" });

    await user.click(trigger());
    await screen.findByRole("menu");
    await nextFrame();

    expect(fill().dataset.visible).toBe("false");
});

it("keeps the highlight hidden until items have a size", async () => {
    const user = userEvent.setup();
    renderPicker({ providerId: "p1", model: "smart" });

    await user.click(trigger());
    await screen.findByRole("menu");
    await nextFrame();

    expect(fill().dataset.visible).toBe("false");
});
