import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { expect, it } from "vitest";

import { Button } from "./button";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "./tooltip";

const hoverCopy = async (content: ReactNode) => {
    const user = userEvent.setup();
    render(
        <TooltipProvider collisionPadding={{ top: 44 }}>
            <Tooltip>
                <TooltipTrigger render={<Button aria-label="Copy" />} />
                {content}
            </Tooltip>
        </TooltipProvider>,
    );
    await user.hover(screen.getByRole("button", { name: "Copy" }));
};

it("shows its content on hover within the provider's padding", async () => {
    await hoverCopy(<TooltipContent>Copy message</TooltipContent>);

    expect(await screen.findByText("Copy message")).toBeDefined();
});

it("shows its content on hover within its own padding", async () => {
    await hoverCopy(
        <TooltipContent collisionPadding={12}>Copy message</TooltipContent>,
    );

    expect(await screen.findByText("Copy message")).toBeDefined();
});
