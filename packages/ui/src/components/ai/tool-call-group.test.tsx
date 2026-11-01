import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";

import { ToolCallCard, type ToolCallLabels } from "#ai/tool";

import { ToolCallGroup } from "./tool-call-group";

const labels: ToolCallLabels = {
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

it("sums finished call durations and reveals the calls on expand", async () => {
    const user = userEvent.setup();
    render(
        <ToolCallGroup title="2 tools" failedLabel="1 failed">
            <ToolCallCard
                name="read_file"
                status="success"
                labels={labels}
                announcement="read_file finished"
                startedAt={0}
                finishedAt={1500}
            />
            <ToolCallCard
                name="bash"
                status="error"
                labels={labels}
                announcement="bash failed"
                startedAt={0}
                finishedAt={2000}
            />
        </ToolCallGroup>,
    );

    const toggle = screen.getByRole("button", { name: /2 tools/u });
    expect(toggle.textContent).toContain("3.5s");
    expect(toggle.textContent).toContain("1 failed");

    await user.click(toggle);

    expect(toggle.getAttribute("aria-expanded")).toBe("true");
});

it("adds the running calls' live time to the total", () => {
    const now = Date.now();
    render(
        <ToolCallGroup title="2 tools" failedLabel="1 failed">
            <ToolCallCard
                name="read_file"
                status="success"
                labels={labels}
                announcement="read_file finished"
                startedAt={now - 5000}
                finishedAt={now - 4000}
            />
            <ToolCallCard
                name="bash"
                status="running"
                labels={labels}
                announcement="bash running"
                startedAt={now - 2000}
            />
        </ToolCallGroup>,
    );

    const toggle = screen.getByRole("button", { name: /2 tools/u });
    expect(toggle.textContent).toMatch(/· 3\.\ds/u);
    expect(toggle.textContent).not.toContain("failed");
});

it.each([
    ["an untimed call", { status: "success" as const }],
    ["a running call without a start", { status: "running" as const }],
    ["a failure without a finish", { status: "error" as const, startedAt: 0 }],
])("leaves out the total for %s", (_, call) => {
    render(
        <ToolCallGroup title="1 tool" failedLabel="1 failed">
            <ToolCallCard
                name="bash"
                labels={labels}
                announcement="bash"
                {...call}
            />
        </ToolCallGroup>,
    );

    expect(
        screen.getByRole("button", { name: /1 tool/u }).textContent,
    ).not.toMatch(/\d(ms|s)\b/u);
});

it("shows no total for an empty group", () => {
    render(
        <ToolCallGroup title="No tools" failedLabel="failed">
            {[]}
        </ToolCallGroup>,
    );

    expect(screen.getByRole("button", { name: "No tools" })).toBeDefined();
});
