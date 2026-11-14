import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { expect, it, vi } from "vitest";

import { ModelPickerPopover } from "./ModelPickerPopover";

it("handles ModelPickerPopover groups, disabled providers, and empty states", async () => {
    const user = userEvent.setup();
    const onOpenProviders = vi.fn<() => void>();
    const onSelectModel =
        vi.fn<(selection: { providerId: string; model: string }) => void>();

    function Harness({
        initialModel,
        providers,
    }: {
        initialModel: { providerId: string; model: string } | null;
        providers: Parameters<typeof ModelPickerPopover>[0]["providers"];
    }) {
        const [open, setOpen] = useState(false);
        const [model, setModel] = useState(initialModel);
        return (
            <ModelPickerPopover
                open={open}
                onOpenChange={setOpen}
                model={model}
                providers={providers}
                onSelectModel={(next) => {
                    setModel(next);
                    onSelectModel(next);
                }}
                onOpenProviders={onOpenProviders}
            />
        );
    }

    const { rerender } = render(
        <Harness
            initialModel={{ providerId: "p1", model: "m1" }}
            providers={[
                {
                    id: "p1",
                    name: "Acme",
                    enabled: true,
                    models: [{ id: "m1" }, { id: "m2" }],
                },
                {
                    id: "p2",
                    name: "DisabledCo",
                    enabled: false,
                    models: [{ id: "m3" }],
                },
                {
                    id: "p3",
                    name: "EmptyEnabled",
                    enabled: true,
                    models: [],
                },
            ]}
        />,
    );

    await user.click(screen.getByRole("button", { name: "m1" }));
    await user.click(
        await screen.findByRole("button", { name: "Disabled · Settings" }),
    );
    expect(onOpenProviders).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "m1" }));
    await user.click(await screen.findByRole("option", { name: "m2" }));
    expect(onSelectModel).toHaveBeenCalledWith({
        providerId: "p1",
        model: "m2",
    });

    rerender(<Harness key="empty" initialModel={null} providers={[]} />);
    await user.click(screen.getByRole("button", { name: "Select model" }));
    expect(await screen.findByText("No provider")).toBeDefined();
    await user.click(screen.getByRole("button", { name: "Open settings" }));
    expect(onOpenProviders).toHaveBeenCalledTimes(2);

    rerender(
        <Harness
            key="disabled"
            initialModel={null}
            providers={[
                { id: "p2", name: "DisabledOnly", enabled: false, models: [] },
            ]}
        />,
    );
    await user.click(screen.getByRole("button", { name: "Select model" }));
    const search = await screen.findByRole("searchbox", {
        name: "Search models…",
    });
    await user.type(search, "zzz");
    expect(
        await screen.findByText("No models match the current filter."),
    ).toBeDefined();
});
