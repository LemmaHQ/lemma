import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";

import { TooltipProvider } from "#primitives/tooltip";

import { CopyButton } from "./CopyButton";

it("copies its text and names itself copied for a moment", async () => {
    const user = userEvent.setup();
    render(
        <TooltipProvider>
            <CopyButton text="Use **bold**" label="Copy" copiedLabel="Copied" />
        </TooltipProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Copy" }));

    expect(await navigator.clipboard.readText()).toBe("Use **bold**");
    expect(await screen.findByRole("button", { name: "Copied" })).toBeDefined();
});
