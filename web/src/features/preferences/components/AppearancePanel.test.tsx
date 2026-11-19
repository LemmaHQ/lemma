import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "next-themes";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { i18n } from "@/i18n";

import { isThemePreference, THEME_STORAGE_KEY } from "../theme";
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

const tile = (name: string) =>
    screen.getByRole<HTMLInputElement>("radio", { name });

const checked = (name: string) => tile(name).checked;

beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = "";
});

afterEach(async () => {
    vi.useRealTimers();
    document.documentElement.classList.remove("theme-transition");
    await i18n.changeLanguage("en");
});

it("renders the appearance section, all three theme tiles, and the language select", () => {
    renderPanel();

    expect(
        screen.getByRole("heading", { level: 1, name: "Appearance" }),
    ).toBeDefined();
    const section = screen.getByRole("region", { name: "Appearance" });
    expect(
        within(section).getByRole("heading", { level: 2, name: "Appearance" }),
    ).toBeDefined();
    const group = within(section).getByRole("group", { name: "Theme" });
    expect(
        ["Light", "Dark", "System"].map(
            (name) =>
                within(group).getByRole<HTMLInputElement>("radio", { name })
                    .checked,
        ),
    ).toEqual([false, false, true]);
    expect(
        within(section).getByRole("combobox", { name: "Language" }).textContent,
    ).toBe("English");
});

it("falls back to system when the theme preference is unknown or undefined", () => {
    expect(isThemePreference(undefined)).toBe(false);
    localStorage.setItem(THEME_STORAGE_KEY, "sepia");
    renderPanel();

    expect(["Light", "Dark", "System"].map(checked)).toEqual([
        false,
        false,
        true,
    ]);
});

it("selects a theme by click and by keyboard", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(tile("Light"));
    expect(checked("Light")).toBe(true);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");

    tile("Light").focus();
    await user.keyboard("{ArrowRight}");
    expect(checked("Dark")).toBe(true);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");

    await user.keyboard("{ArrowRight}");
    expect(checked("System")).toBe(true);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("system");
});

it("adds and removes the theme-transition class across rapid theme switches", () => {
    vi.useFakeTimers();
    renderPanel();

    fireEvent.click(tile("Dark"));
    expect(
        document.documentElement.classList.contains("theme-transition"),
    ).toBe(true);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");

    act(() => {
        vi.advanceTimersByTime(200);
    });
    expect(
        document.documentElement.classList.contains("theme-transition"),
    ).toBe(true);

    fireEvent.click(tile("Light"));
    expect(
        document.documentElement.classList.contains("theme-transition"),
    ).toBe(true);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");

    act(() => {
        vi.advanceTimersByTime(200);
    });
    expect(
        document.documentElement.classList.contains("theme-transition"),
    ).toBe(true);

    act(() => {
        vi.advanceTimersByTime(60);
    });
    expect(
        document.documentElement.classList.contains("theme-transition"),
    ).toBe(false);
});

it("removes the theme-transition class when unmounted mid-transition", () => {
    vi.useFakeTimers();
    const { unmount } = renderPanel();

    fireEvent.click(tile("Dark"));
    expect(
        document.documentElement.classList.contains("theme-transition"),
    ).toBe(true);

    unmount();
    expect(
        document.documentElement.classList.contains("theme-transition"),
    ).toBe(false);
});

it("switches the interface language between Chinese and English", async () => {
    const user = userEvent.setup();
    renderPanel();

    const trigger = screen.getByRole("combobox", { name: "Language" });
    expect(trigger.textContent).toBe("English");

    await user.click(trigger);
    await user.click(await screen.findByRole("option", { name: "中文" }));

    expect(i18n.language).toBe("zh");
    expect(screen.getByRole("combobox", { name: "语言" }).textContent).toBe(
        "中文",
    );

    await user.click(screen.getByRole("combobox", { name: "语言" }));
    await user.click(await screen.findByRole("option", { name: "English" }));

    expect(i18n.language).toBe("en");
    expect(screen.getByRole("combobox", { name: "Language" }).textContent).toBe(
        "English",
    );
});
