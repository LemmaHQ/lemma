import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";

import { InputGroupAddon } from "#primitives/input-group";
import { TooltipProvider } from "#primitives/tooltip";

import { PasswordInput } from "./PasswordInput";

it("shows and hides the password from its labeled toggle", async () => {
    const user = userEvent.setup();
    render(
        <TooltipProvider>
            <PasswordInput
                aria-label="Password"
                showLabel="Show password"
                hideLabel="Hide password"
            >
                <InputGroupAddon>Key</InputGroupAddon>
            </PasswordInput>
        </TooltipProvider>,
    );
    const input = screen.getByLabelText("Password");
    expect(input.getAttribute("type")).toBe("password");

    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(input.getAttribute("type")).toBe("text");

    await user.click(screen.getByRole("button", { name: "Hide password" }));
    expect(input.getAttribute("type")).toBe("password");
});
