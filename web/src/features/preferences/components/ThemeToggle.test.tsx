import { TooltipProvider } from "@lemma/ui";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "next-themes";
import { beforeEach, expect, it } from "vitest";

import { THEME_STORAGE_KEY } from "../theme";
import { ThemeToggle } from "./ThemeToggle";

const renderToggle = () =>
    render(
        <ThemeProvider attribute="class" storageKey={THEME_STORAGE_KEY}>
            <TooltipProvider>
                <ThemeToggle />
            </TooltipProvider>
        </ThemeProvider>,
    );

beforeEach(() => {
    localStorage.clear();
});

it("stores the theme picked from the menu", async () => {
    const user = userEvent.setup();
    renderToggle();

    await user.click(screen.getByRole("button", { name: "Toggle theme" }));
    await user.click(
        await screen.findByRole("menuitemradio", { name: "Dark" }),
    );

    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(document.documentElement).toHaveProperty("className", "dark");
});

it("marks the system theme when the stored theme is unknown", async () => {
    const user = userEvent.setup();
    localStorage.setItem(THEME_STORAGE_KEY, "sepia");
    renderToggle();

    await user.click(screen.getByRole("button", { name: "Toggle theme" }));

    expect(
        (
            await screen.findByRole("menuitemradio", { name: "System" })
        ).getAttribute("aria-checked"),
    ).toBe("true");
});
