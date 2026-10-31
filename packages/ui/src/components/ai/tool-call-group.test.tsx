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
