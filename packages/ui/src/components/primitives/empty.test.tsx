import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import { Button } from "./button";
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "./empty";

it("explains the empty state and offers its action", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn<() => void>();
    render(
        <Empty>
            <EmptyHeader>
                <EmptyMedia variant="icon">
                    <svg aria-label="Providers" />
                </EmptyMedia>
                <EmptyTitle>No providers</EmptyTitle>
                <EmptyDescription>Add one to start chatting.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
                <Button onClick={onAdd}>Add provider</Button>
            </EmptyContent>
        </Empty>,
    );

    expect(screen.getByLabelText("Providers")).toBeDefined();
    expect(screen.getByText("No providers")).toBeDefined();
    expect(screen.getByText("Add one to start chatting.")).toBeDefined();
    await user.click(screen.getByRole("button", { name: "Add provider" }));
    expect(onAdd).toHaveBeenCalledOnce();
});
