import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { expect, it, vi } from "vitest";

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "./dropdown-menu";

function ThemeMenu({ onDelete }: { onDelete: () => void }) {
    const [theme, setTheme] = useState("light");
    return (
        <DropdownMenu>
            <DropdownMenuTrigger>Theme: {theme}</DropdownMenuTrigger>
            <DropdownMenuContent>
                <DropdownMenuGroup>
                    <DropdownMenuLabel inset>Appearance</DropdownMenuLabel>
                    <DropdownMenuRadioGroup
                        value={theme}
                        onValueChange={(value: string) => setTheme(value)}
                    >
                        <DropdownMenuRadioItem value="light">
                            Light
                        </DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="dark" inset>
                            Dark
                        </DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={onDelete}>
                    Delete
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

it("picks a radio item", async () => {
    const user = userEvent.setup();
    render(<ThemeMenu onDelete={() => {}} />);

    await user.click(screen.getByRole("button", { name: "Theme: light" }));
    expect(
        (await screen.findByRole("group", { name: "Appearance" })).textContent,
    ).toContain("Light");
    expect(
        screen
            .getByRole("menuitemradio", { name: "Light" })
            .getAttribute("aria-checked"),
    ).toBe("true");

    await user.click(screen.getByRole("menuitemradio", { name: "Dark" }));

    expect(screen.getByRole("button", { name: "Theme: dark" })).toBeDefined();
});

it("runs an item's action", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn<() => void>();
    render(<ThemeMenu onDelete={onDelete} />);

    await user.click(screen.getByRole("button", { name: "Theme: light" }));
    expect(await screen.findByRole("separator")).toBeDefined();
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));

    expect(onDelete).toHaveBeenCalledOnce();
});
