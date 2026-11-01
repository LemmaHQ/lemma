import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "./alert-dialog";
import { Button } from "./button";

const confirm = (onConfirm: () => void) => (
    <AlertDialog>
        <AlertDialogTrigger render={<Button variant="destructive" />}>
            Delete
        </AlertDialogTrigger>
        <AlertDialogContent size="sm">
            <AlertDialogHeader>
                <AlertDialogTitle>Delete conversation?</AlertDialogTitle>
                <AlertDialogDescription>
                    This cannot be undone.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onConfirm}>
                    Delete
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
);

it("asks before a destructive action and cancels without acting", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn<() => void>();
    render(confirm(onConfirm));

    await user.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = await screen.findByRole("alertdialog", {
        name: "Delete conversation?",
    });
    expect(dialog.textContent).toContain("This cannot be undone.");

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => {
        expect(screen.queryByRole("alertdialog")).toBeNull();
    });
    expect(onConfirm).not.toHaveBeenCalled();
});

it("runs the action on confirmation", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn<() => void>();
    render(confirm(onConfirm));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    const dialog = await screen.findByRole("alertdialog");
    await user.click(
        [...dialog.querySelectorAll("button")].find(
            (button) => button.textContent === "Delete",
        )!,
    );

    expect(onConfirm).toHaveBeenCalledOnce();
});
