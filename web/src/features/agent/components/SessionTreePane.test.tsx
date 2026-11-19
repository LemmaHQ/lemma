import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import type { SessionTreeRow } from "../session-tree";
import { SessionTreePane } from "./SessionTreePane";

const ROWS: SessionTreeRow[] = [
    {
        id: "n1",
        kind: "question",
        title: "Explain architecture",
        label: "main",
        meta: "14:00",
        rails: [],
        hasTopSpine: false,
        hasBottomSpine: true,
        onPath: true,
        isLeaf: false,
    },
    {
        id: "n2",
        kind: "answer",
        title: "Summary of crates",
        rails: ["tee"],
        hasTopSpine: true,
        hasBottomSpine: false,
        onPath: false,
        isLeaf: true,
    },
    {
        id: "n3",
        kind: "question",
        title: "Alternative approach",
        rails: ["bar", "empty"],
        hasTopSpine: true,
        hasBottomSpine: true,
        onPath: false,
        isLeaf: false,
    },
];

it("filters, navigates from the search box, selects rows, and saves or cancels inline labels", async () => {
    const user = userEvent.setup();
    const onSelectRow = vi.fn<(id: string) => void>();
    const onSaveLabel = vi.fn<(id: string, label: string) => void>();
    const onClose = vi.fn<() => void>();

    render(
        <SessionTreePane
            rows={ROWS}
            pathCount={2}
            onSelectRow={onSelectRow}
            onSaveLabel={onSaveLabel}
            onClose={onClose}
        />,
    );

    expect(screen.getByText("tree")).toBeDefined();
    expect(
        screen.getByRole("heading", { level: 2, name: "Session tree" }),
    ).toBeDefined();
    expect(screen.getByText("2 paths")).toBeDefined();

    const search = screen.getByRole("searchbox", { name: "Search tree…" });
    expect(search.getAttribute("aria-controls")).not.toBeNull();
    await user.click(search);
    await user.keyboard("{ArrowDown}{ArrowUp}{ArrowUp}{Enter}");
    expect(onSelectRow).toHaveBeenCalledWith("n3");

    await user.click(screen.getByRole("button", { name: "Questions" }));
    expect(screen.queryByText("Summary of crates")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Labeled" }));
    expect(screen.getByText("Explain architecture")).toBeDefined();
    expect(screen.queryByText("Alternative approach")).toBeNull();

    await user.click(screen.getByRole("button", { name: "All" }));
    await user.type(search, "crates");
    expect(screen.getByText("Summary of crates")).toBeDefined();

    await user.clear(search);
    await user.type(search, "main");
    expect(screen.getByText("Explain architecture")).toBeDefined();

    await user.clear(search);
    await user.type(search, "missing-node");
    expect(screen.getByText("No matching messages.")).toBeDefined();
    await user.keyboard("{ArrowDown}{Enter}");
    await user.clear(search);

    await user.click(screen.getByRole("button", { name: "Edit label" }));
    const editInput = screen.getByRole("textbox", { name: "Label…" });
    await user.type(editInput, "{Escape}");
    expect(screen.queryByRole("textbox", { name: "Label…" })).toBeNull();

    await user.type(search, "crates");
    await user.click(screen.getByRole("button", { name: "Label" }));
    await user.type(
        screen.getByRole("textbox", { name: "Label…" }),
        "branch-a{Enter}",
    );
    expect(onSaveLabel).toHaveBeenCalledWith("n2", "branch-a");

    await user.click(screen.getByRole("button", { name: "Summary of crates" }));
    expect(onSelectRow).toHaveBeenCalledWith("n2");

    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
});
