import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { expect, it, vi } from "vitest";

import { Button } from "#primitives/button";
import { AnchoredPicker, type AnchoredPickerGroup } from "./AnchoredPicker";

function PickerHarness({
    groups,
    onFooter,
    trigger,
}: {
    groups: AnchoredPickerGroup[];
    onFooter?: () => void;
    trigger?: "button" | "text";
}) {
    const [open, setOpen] = useState(false);
    return (
        <div>
            <button type="button">Outside</button>
            <AnchoredPicker
                open={open}
                onOpenChange={setOpen}
                trigger={
                    trigger === "text" ? (
                        "Open Picker"
                    ) : (
                        <Button>Open Picker</Button>
                    )
                }
                searchPlaceholder="Search models"
                emptyText="No matches"
                groups={groups}
                {...(onFooter === undefined
                    ? {}
                    : {
                          footerAction: {
                              label: "Manage providers",
                              onSelect: onFooter,
                          },
                      })}
            />
        </div>
    );
}

it("filters items, supports keyboard navigation, actions, and footer", async () => {
    const user = userEvent.setup();
    const onFirst = vi.fn<() => void>();
    const onSecond = vi.fn<() => void>();
    const onThird = vi.fn<() => void>();
    const onGroupAction = vi.fn<() => void>();
    const onFooter = vi.fn<() => void>();

    const groups: AnchoredPickerGroup[] = [
        {
            id: "g1",
            label: "OpenAI",
            actionLabel: "Refresh",
            onAction: onGroupAction,
            items: [
                {
                    id: "1",
                    label: "gpt-4o",
                    sublabel: "Fast",
                    mono: true,
                    selected: true,
                    onSelect: onFirst,
                },
                {
                    id: "2",
                    label: "o3-mini",
                    onSelect: onSecond,
                },
            ],
        },
        {
            id: "g2",
            items: [{ id: "3", label: "claude-sonnet", onSelect: onThird }],
        },
    ];

    render(<PickerHarness groups={groups} onFooter={onFooter} />);

    await user.click(screen.getByRole("button", { name: "Open Picker" }));
    await screen.findByRole("searchbox", { name: "Search models" });
    await user.click(screen.getByRole("button", { name: "Refresh" }));
    expect(onGroupAction).toHaveBeenCalledTimes(1);

    await user.hover(screen.getByRole("option", { name: /o3-mini/u }));
    await user.click(screen.getByRole("searchbox", { name: "Search models" }));
    await user.keyboard("{ArrowUp}{ArrowUp}{ArrowDown}{Enter}");
    expect(onFirst).toHaveBeenCalledTimes(1);
    await waitFor(() => {
        expect(screen.queryByRole("listbox")).toBeNull();
    });

    await user.click(screen.getByRole("button", { name: "Open Picker" }));
    const searchAgain = await screen.findByRole("searchbox", {
        name: "Search models",
    });
    await user.type(searchAgain, "Fast");
    expect(screen.getAllByRole("option")).toHaveLength(1);

    await user.clear(searchAgain);
    await user.type(searchAgain, "zzz");
    expect(screen.getByText("No matches")).toBeDefined();
    await user.keyboard("{ArrowDown}{Enter}{Escape}");
    await waitFor(() => {
        expect(screen.queryByRole("listbox")).toBeNull();
    });

    await user.click(screen.getByRole("button", { name: "Open Picker" }));
    await user.click(
        await screen.findByRole("button", { name: "Manage providers" }),
    );
    expect(onFooter).toHaveBeenCalledTimes(1);
});

it("clicks an option directly and closes on outside click", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn<() => void>();
    const groups: AnchoredPickerGroup[] = [
        {
            id: "g1",
            label: "Primary",
            items: [{ id: "1", label: "gpt-4o", onSelect }],
        },
        {
            id: "g2",
            actionLabel: "More",
            onAction: onSelect,
            items: [{ id: "2", label: "o3-mini", onSelect }],
        },
        {
            id: "g3",
            label: "Anthropic",
            actionLabel: "Disabled · Settings",
            onAction: onSelect,
            items: [],
        },
    ];

    render(<PickerHarness groups={groups} trigger="text" />);
    await user.click(screen.getByRole("button", { name: "Open Picker" }));
    expect(
        await screen.findByRole("button", { name: "Disabled · Settings" }),
    ).toBeDefined();
    await user.click(await screen.findByRole("option", { name: "gpt-4o" }));
    expect(onSelect).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Open Picker" }));
    await screen.findByRole("listbox");
    await user.click(screen.getByRole("button", { name: "Outside" }));
    await waitFor(() => {
        expect(screen.queryByRole("listbox")).toBeNull();
    });
    expect(screen.queryAllByRole("searchbox")).toHaveLength(0);
});
