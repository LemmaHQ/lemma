import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "./dropdown-menu";

it("opens the menu and runs an item's action", async () => {
    const user = userEvent.setup();
    const onRename = vi.fn<() => void>();
    const onDelete = vi.fn<() => void>();
    render(
        <DropdownMenu>
            <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
            <DropdownMenuContent>
                <DropdownMenuItem inset onClick={onRename}>
                    Rename
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onClick={onDelete}>
                    Delete
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>,
    );

    await user.click(screen.getByRole("button", { name: "Actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Rename" }));
    expect(onRename).toHaveBeenCalledOnce();

    await user.click(screen.getByRole("button", { name: "Actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Delete" }));
    expect(onDelete).toHaveBeenCalledOnce();
});
