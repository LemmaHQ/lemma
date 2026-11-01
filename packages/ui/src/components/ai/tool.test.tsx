import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";

import { TooltipProvider } from "#primitives/tooltip";

import { ToolCallCard, type ToolCallCardProps } from "./tool";

const labels = {
    failed: "Failed",
    arguments: "Arguments",
    copyArguments: "Copy arguments",
    output: "Output",
    copyResult: "Copy result",
    waiting: "Waiting",
    copied: "Copied",
    showAll: "Show all",
    showLess: "Show less",
};

const card = (props: Partial<ToolCallCardProps>) => (
    <TooltipProvider>
        <ToolCallCard
            name="read_file"
            status="success"
            labels={labels}
            announcement="read_file finished"
            {...props}
        />
    </TooltipProvider>
);

const toggle = () => screen.getByRole("button", { name: /read_file/u });

it("waits for a running call's result with a live duration", async () => {
    const user = userEvent.setup();
    render(card({ status: "running", startedAt: Date.now() - 2500 }));

    expect(toggle().textContent).toMatch(/2\.\ds/u);
    expect(toggle().getAttribute("aria-expanded")).toBe("false");

    await user.click(toggle());

    expect(toggle().getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Waiting")).toBeDefined();
    expect(screen.getByRole("status").textContent).toBe("read_file finished");
});

it("shows a finished call's arguments and result for copying", async () => {
    const user = userEvent.setup();
    render(
        card({
            args: { path: "a.txt" },
            result: '{"lines":3}',
            startedAt: 0,
            finishedAt: 1500,
        }),
    );
    expect(toggle().textContent).toContain("1.5s");
    expect(screen.queryByText("Waiting")).toBeNull();

    await user.click(toggle());
    await user.click(screen.getByRole("button", { name: "Copy result" }));

    expect(await navigator.clipboard.readText()).toBe(
        JSON.stringify({ lines: 3 }, null, 2),
    );
    expect(await screen.findByRole("button", { name: "Copied" })).toBeDefined();
    await user.click(screen.getByRole("button", { name: "Copy arguments" }));
    expect(await navigator.clipboard.readText()).toBe(
        JSON.stringify({ path: "a.txt" }, null, 2),
    );
});

it("shows no duration or output for an untimed call without a result", () => {
    render(card({}));

    expect(toggle().textContent).toBe("read_file");
    expect(screen.queryByText("Output")).toBeNull();
});

it("opens a failed call and closes it again when it recovers", () => {
    const { rerender } = render(card({ status: "running" }));

    rerender(card({ status: "error", error: "no such file" }));
    expect(toggle().getAttribute("aria-expanded")).toBe("true");
    expect(toggle().textContent).toContain("Failed");
    expect(screen.getByText("no such file")).toBeDefined();

    rerender(card({ status: "success" }));
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
});

it("keeps a card the reader opened open through a failure", async () => {
    const user = userEvent.setup();
    const { rerender } = render(card({ status: "running" }));
    await user.click(toggle());

    rerender(card({ status: "error", error: "boom" }));
    rerender(card({ status: "success" }));

    expect(toggle().getAttribute("aria-expanded")).toBe("true");
});

it("leaves a failure open once the reader toggles it", async () => {
    const user = userEvent.setup();
    const { rerender } = render(card({ status: "error", error: "boom" }));
    expect(toggle().getAttribute("aria-expanded")).toBe("true");

    await user.click(toggle());
    await user.click(toggle());
    rerender(card({ status: "success" }));

    expect(toggle().getAttribute("aria-expanded")).toBe("true");
});
