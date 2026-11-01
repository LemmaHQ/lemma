import { act, render, screen } from "@testing-library/react";
import { toast } from "sonner";
import { expect, it } from "vitest";

import { Toaster } from "./sonner";

it("shows toasts sent while it is mounted", async () => {
    render(<Toaster />);

    act(() => {
        toast.error("Could not save");
    });

    expect(await screen.findByText("Could not save")).toBeDefined();
});
