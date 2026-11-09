import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";

import { Button } from "./button";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "./tooltip";

it("shows its content on hover", async () => {
    const user = userEvent.setup();
    render(
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger render={<Button aria-label="Copy" />} />
                <TooltipContent>Copy message</TooltipContent>
            </Tooltip>
        </TooltipProvider>,
    );

    await user.hover(screen.getByRole("button", { name: "Copy" }));

    expect(await screen.findByText("Copy message")).toBeDefined();
});
