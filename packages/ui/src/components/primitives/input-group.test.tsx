import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import {
    InputGroup,
    InputGroupAddon,
    InputGroupButton,
    InputGroupInput,
} from "./input-group";

it("focuses the control from a click on its addon, not its buttons", async () => {
    const user = userEvent.setup();
    const onClear = vi.fn<() => void>();
    render(
        <InputGroup>
            <InputGroupAddon>
                <span>Search</span>
            </InputGroupAddon>
            <InputGroupInput aria-label="Query" />
            <InputGroupAddon align="inline-end">
                <InputGroupButton
                    size="icon-xs"
                    aria-label="Clear"
                    onClick={onClear}
                >
                    x
                </InputGroupButton>
            </InputGroupAddon>
        </InputGroup>,
    );
    const input = screen.getByRole("textbox", { name: "Query" });

    await user.click(screen.getByText("Search"));
    expect(document.activeElement).toBe(input);

    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "Clear" }),
    );
    expect(onClear).toHaveBeenCalledOnce();
});
