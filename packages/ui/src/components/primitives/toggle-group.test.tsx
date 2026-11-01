import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import { Toggle } from "./toggle";
import { ToggleGroup, ToggleGroupItem } from "./toggle-group";

it("presses one item at a time and reports the choice", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn<(value: string[]) => void>();
    render(
        <ToggleGroup
            aria-label="Theme"
            defaultValue={["light"]}
            onValueChange={onValueChange}
            variant="outline"
            size="sm"
            spacing={0}
        >
            <ToggleGroupItem value="light">Light</ToggleGroupItem>
            <ToggleGroupItem value="dark">Dark</ToggleGroupItem>
        </ToggleGroup>,
    );

    await user.click(screen.getByRole("button", { name: "Dark" }));

    expect(onValueChange.mock.calls[0]?.[0]).toEqual(["dark"]);
    expect(
        screen
            .getByRole("button", { name: "Dark" })
            .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
        screen
            .getByRole("button", { name: "Light" })
            .getAttribute("aria-pressed"),
    ).toBe("false");
});

it("keeps an item's own style inside an unstyled group", async () => {
    const user = userEvent.setup();
    render(
        <ToggleGroup aria-label="Layout">
            <ToggleGroupItem value="grid" variant="outline" size="lg">
                Grid
            </ToggleGroupItem>
        </ToggleGroup>,
    );
    const item = screen.getByRole("button", { name: "Grid" });

    await user.click(item);

    expect(item.getAttribute("aria-pressed")).toBe("true");
    expect(item.dataset.variant).toBe("outline");
    expect(item.dataset.size).toBe("lg");
});

it("toggles a standalone toggle", async () => {
    const user = userEvent.setup();
    render(<Toggle aria-label="Bold">B</Toggle>);
    const toggle = screen.getByRole("button", { name: "Bold" });

    await user.click(toggle);

    expect(toggle.getAttribute("aria-pressed")).toBe("true");
});
