import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import { ThemePreviewTiles, type ThemeChoice } from "./theme-preview-tiles";

const LABELS: Record<ThemeChoice, string> = {
    light: "Light",
    dark: "Dark",
    system: "System",
};

it("renders three radio tiles and navigates with click and arrow keys", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn<(value: ThemeChoice) => void>();

    const { rerender } = render(
        <ThemePreviewTiles
            value="light"
            onValueChange={onValueChange}
            label="Theme"
            labels={LABELS}
        />,
    );

    expect(screen.getByRole("radiogroup", { name: "Theme" })).toBeDefined();
    const radios = screen.getAllByRole("radio");
    expect(radios.map((radio) => radio.getAttribute("aria-checked"))).toEqual([
        "true",
        "false",
        "false",
    ]);

    await user.click(screen.getByRole("radio", { name: "Dark" }));
    expect(onValueChange).toHaveBeenLastCalledWith("dark");

    rerender(
        <ThemePreviewTiles
            value="dark"
            onValueChange={onValueChange}
            label="Theme"
            labels={LABELS}
        />,
    );

    const darkRadio = screen.getByRole("radio", { name: "Dark" });
    darkRadio.focus();
    await user.keyboard("{ArrowRight}");
    expect(onValueChange).toHaveBeenLastCalledWith("system");

    await user.keyboard("{ArrowLeft}");
    expect(onValueChange).toHaveBeenLastCalledWith("dark");

    await user.keyboard("{ArrowUp}");
    expect(onValueChange).toHaveBeenLastCalledWith("light");

    await user.keyboard("{ArrowDown}");
    expect(onValueChange).toHaveBeenLastCalledWith("dark");

    await user.keyboard("{End}");
    expect(onValueChange).toHaveBeenLastCalledWith("system");

    await user.keyboard("{Home}");
    expect(onValueChange).toHaveBeenLastCalledWith("light");

    await user.keyboard("a");
    expect(onValueChange).toHaveBeenLastCalledWith("light");
});
