import { Toaster, TooltipProvider } from "@lemma/ui";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import { SessionDirectoryBadge } from "./SessionDirectoryBadge";
import { SessionDirectoryPicker } from "./SessionDirectoryPicker";

it("renders SessionDirectoryBadge and handles SessionDirectoryPicker selection and errors", async () => {
    const user = userEvent.setup();
    const onSelectDirectory = vi.fn<(dir: string | undefined) => void>();
    const onPickDirectory = vi
        .fn<() => Promise<string | undefined>>()
        .mockResolvedValueOnce("C:\\work\\picked")
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error("picker failed"));

    const { rerender } = render(
        <TooltipProvider>
            <Toaster />
            <SessionDirectoryBadge directory="C:\\work\\project" />
        </TooltipProvider>,
    );
    expect(screen.getByText("project")).toBeDefined();

    rerender(
        <TooltipProvider>
            <Toaster />
            <SessionDirectoryPicker
                directoryControl={{
                    directory: undefined,
                    recentDirectories: ["/work/alpha"],
                    canPickDirectory: true,
                    onSelectDirectory,
                    onPickDirectory,
                }}
            />
        </TooltipProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Default workspace" }));
    await user.click(await screen.findByRole("option", { name: /alpha/u }));
    expect(onSelectDirectory).toHaveBeenCalledWith("/work/alpha");

    await user.click(screen.getByRole("button", { name: "Default workspace" }));
    await user.click(
        await screen.findByRole("button", {
            name: "Choose another directory…",
        }),
    );
    await waitFor(() => {
        expect(onSelectDirectory).toHaveBeenCalledWith("C:\\work\\picked");
    });

    await user.click(screen.getByRole("button", { name: "Default workspace" }));
    await user.click(
        await screen.findByRole("button", {
            name: "Choose another directory…",
        }),
    );
    await waitFor(() => {
        expect(onPickDirectory).toHaveBeenCalledTimes(2);
    });
    expect(onSelectDirectory).toHaveBeenCalledTimes(2);

    await user.click(screen.getByRole("button", { name: "Default workspace" }));
    await user.click(
        await screen.findByRole("button", {
            name: "Choose another directory…",
        }),
    );
    expect(
        await screen.findByText("Something went wrong, please try again"),
    ).toBeDefined();

    rerender(
        <TooltipProvider>
            <Toaster />
            <SessionDirectoryPicker
                directoryControl={{
                    directory: "/work/custom",
                    recentDirectories: [],
                    canPickDirectory: false,
                    onSelectDirectory,
                }}
            />
        </TooltipProvider>,
    );
    await user.click(screen.getByRole("button", { name: "custom" }));
    expect(
        screen.queryByRole("button", { name: "Choose another directory…" }),
    ).toBeNull();
    await user.click(
        await screen.findByRole("option", { name: "Default workspace" }),
    );
    expect(onSelectDirectory).toHaveBeenLastCalledWith(undefined);
});
