import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";

import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "./collapsible";

it("expands and collapses its panel when the trigger is clicked", async () => {
    const user = userEvent.setup();
    render(
        <Collapsible>
            <CollapsibleTrigger>Advanced</CollapsibleTrigger>
            <CollapsibleContent>API path settings</CollapsibleContent>
        </Collapsible>,
    );

    expect(screen.queryByText("API path settings")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Advanced" }));
    expect(screen.getByText("API path settings")).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Advanced" }));
    expect(screen.queryByText("API path settings")).toBeNull();
});
