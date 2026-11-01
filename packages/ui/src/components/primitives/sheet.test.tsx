import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "./sheet";

it("closes from its labeled close button", async () => {
    const user = userEvent.setup();
    render(
        <Sheet defaultOpen>
            <SheetContent closeLabel="Close">
                <SheetHeader>
                    <SheetTitle>Filters</SheetTitle>
                </SheetHeader>
            </SheetContent>
        </Sheet>,
    );

    await user.click(
        within(
            await screen.findByRole("dialog", { name: "Filters" }),
        ).getByRole("button", { name: "Close" }),
    );

    await waitFor(() => {
        expect(screen.queryByRole("dialog")).toBeNull();
    });
});
