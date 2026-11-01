import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import { Button } from "./button";

it("blocks clicks and reports busy while loading", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn<() => void>();
    const { rerender } = render(
        <Button loading onClick={onClick}>
            Save
        </Button>,
    );
    const button = screen.getByRole("button", { name: "Save" });

    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
    expect(button.getAttribute("aria-busy")).toBe("true");

    rerender(<Button onClick={onClick}>Save</Button>);
    await user.click(button);
    expect(onClick).toHaveBeenCalledOnce();
    expect(button.hasAttribute("aria-busy")).toBe(false);
});

it("stays disabled when asked", () => {
    render(<Button disabled>Save</Button>);

    expect(screen.getByRole("button", { name: "Save" })).toHaveProperty(
        "disabled",
        true,
    );
});
