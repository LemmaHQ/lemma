import { TooltipProvider } from "@lemma/ui";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it } from "vitest";

import { i18n } from "@/i18n";

import { LanguageToggle } from "./LanguageToggle";

afterEach(async () => {
    await i18n.changeLanguage("en");
});

it("switches the interface language from the menu", async () => {
    const user = userEvent.setup();
    render(
        <TooltipProvider>
            <LanguageToggle />
        </TooltipProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Language" }));
    await user.click(
        await screen.findByRole("menuitemradio", { name: "中文" }),
    );

    expect(i18n.language).toBe("zh");
    expect(screen.getByRole("button", { name: "语言" })).toBeDefined();
    expect(
        screen
            .getByRole("menuitemradio", { name: "中文" })
            .getAttribute("aria-checked"),
    ).toBe("true");
    await user.click(screen.getByRole("menuitemradio", { name: "English" }));

    expect(i18n.language).toBe("en");
});
