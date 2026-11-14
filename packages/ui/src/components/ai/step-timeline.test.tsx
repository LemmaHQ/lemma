import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { expect, it, vi } from "vitest";

import { StepTimeline } from "./step-timeline";

it("toggles open state and renders interactive and static step rows", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn<() => void>();

    function TimelineHarness() {
        const [open, setOpen] = useState(false);
        return (
            <StepTimeline
                summary="3 steps"
                outcome="1.2s"
                open={open}
                onOpenChange={setOpen}
                rows={[
                    {
                        id: "r1",
                        verb: "read",
                        argument: "src/index.ts",
                        via: "fs",
                        meta: "12ms",
                        active: true,
                        onSelect,
                    },
                    {
                        id: "r2",
                        verb: "grep",
                        argument: "src/app.ts",
                        active: false,
                        onSelect,
                    },
                    {
                        id: "r3",
                        verb: "warn",
                        argument: "Retried request",
                        plainArgument: true,
                        warn: true,
                    },
                    {
                        id: "r4",
                        verb: "note",
                        argument: "Cached step",
                        active: true,
                    },
                ]}
            />
        );
    }

    render(<TimelineHarness />);

    const toggle = screen.getByRole("button", { name: /3 steps/u });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByText("1.2s")).toBeDefined();

    await user.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");

    const rowButton = screen.getByRole("button", { name: /src\/index\.ts/u });
    expect(rowButton.dataset.active).toBe("");
    await user.click(rowButton);
    expect(onSelect).toHaveBeenCalledTimes(1);

    expect(screen.getByText("Retried request")).toBeDefined();
});
