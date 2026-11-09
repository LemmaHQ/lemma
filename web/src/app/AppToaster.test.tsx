import { toast } from "@lemma/ui";
import { act, render, screen } from "@testing-library/react";
import { ThemeProvider } from "next-themes";
import { expect, it } from "vitest";

import { AppToaster } from "./AppToaster";

it("shows toasts in the dark theme", async () => {
    render(
        <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem={false}
        >
            <AppToaster />
        </ThemeProvider>,
    );

    act(() => {
        toast("Saved");
    });

    const message = await screen.findByText("Saved");
    expect(
        message.closest<HTMLElement>("[data-sonner-toaster]")?.dataset
            .sonnerTheme,
    ).toBe("dark");
});
