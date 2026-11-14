import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import { DetailPane } from "./detail-pane";

it("renders prose, code, web, and output bodies and triggers close", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn<() => void>();

    const { rerender } = render(
        <DetailPane
            verb="read"
            title="notes.md"
            meta="40 lines"
            closeLabel="Close"
            onClose={onClose}
            body={{ kind: "prose", content: <p>Markdown note</p> }}
        />,
    );

    expect(screen.getByText("read")).toBeDefined();
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(
        "notes.md",
    );
    expect(screen.getByText("40 lines")).toBeDefined();
    expect(screen.getByText("Markdown note")).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);

    rerender(
        <DetailPane
            verb="code"
            title="app.ts"
            closeLabel="Close"
            onClose={onClose}
            body={{ kind: "code", code: "line 1\nline 2", language: "ts" }}
        />,
    );
    expect(screen.getByText("line 1")).toBeDefined();
    expect(screen.getByText("2")).toBeDefined();

    rerender(
        <DetailPane
            verb="web"
            title="Search"
            closeLabel="Close"
            onClose={onClose}
            body={{
                kind: "web",
                hits: [
                    {
                        id: "h1",
                        title: "Example",
                        url: "https://example.com",
                        snippet: "Summary text",
                    },
                    {
                        id: "h2",
                        title: "Second",
                        url: "https://example.org",
                    },
                ],
            }}
        />,
    );
    expect(screen.getByRole("link", { name: /Example/u })).toBeDefined();
    expect(screen.getByText("Summary text")).toBeDefined();

    rerender(
        <DetailPane
            verb="bash"
            title="test"
            closeLabel="Close"
            onClose={onClose}
            body={{ kind: "output", content: "Error output", warn: true }}
        />,
    );
    expect(screen.getByText("Error output").className).toContain(
        "text-destructive",
    );

    rerender(
        <DetailPane
            verb="bash"
            title="test"
            closeLabel="Close"
            onClose={onClose}
            body={{ kind: "output", content: "Ok output" }}
        />,
    );
    expect(screen.getByText("Ok output").className).toContain(
        "text-foreground",
    );
});
