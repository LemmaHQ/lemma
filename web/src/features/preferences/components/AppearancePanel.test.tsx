import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "next-themes";
import { afterEach, beforeEach, expect, it } from "vitest";

import { i18n } from "@/i18n";

import { THEME_STORAGE_KEY } from "../theme";
import { AppearancePanel } from "./AppearancePanel";

const renderPanel = () =>
    render(
        <ThemeProvider
            attribute="class"
            storageKey={THEME_STORAGE_KEY}
            scriptProps={{ type: "application/json" }}
        >
            <AppearancePanel />
        </ThemeProvider>,
    );

const pressed = (name: string) =>
    screen.getByRole("button", { name }).getAttribute("aria-pressed");

beforeEach(() => {
    localStorage.clear();
});

afterEach(async () => {
    await i18n.changeLanguage("en");
});

it("picks a theme and keeps it when pressed again", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole("button", { name: "Dark" }));
    await user.click(screen.getByRole("button", { name: "Dark" }));

    expect(pressed("Dark")).toBe("true");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
});

it("presses no theme when the stored theme is unknown", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "sepia");
    renderPanel();

    expect(["Light", "Dark", "System"].map(pressed)).toEqual([
        "false",
        "false",
        "false",
    ]);
});

it("switches the language and keeps it when pressed again", async () => {
    const user = userEvent.setup();
    renderPanel();

    expect(pressed("English")).toBe("true");
    await user.click(screen.getByRole("button", { name: "中文" }));
    await user.click(screen.getByRole("button", { name: "中文" }));

    expect(i18n.language).toBe("zh");
    expect(pressed("中文")).toBe("true");
});
