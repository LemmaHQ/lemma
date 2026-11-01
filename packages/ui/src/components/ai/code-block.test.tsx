import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";

import { TooltipProvider } from "#primitives/tooltip";

import { CodeBlock, CodeBlockSection } from "./code-block";

const labels = {
    copy: "Copy",
    copied: "Copied",
    showAll: "Show all",
    showLess: "Show less",
};

const section = (value: unknown) => (
    <TooltipProvider>
        <CodeBlockSection
            label="Output"
            labels={labels}
            value={value}
            cap={100}
        />
    </TooltipProvider>
);

afterEach(() => {
    vi.restoreAllMocks();
});

it("highlights code and keeps only the latest code", async () => {
    const { container, rerender } = render(
        <CodeBlock code="const first = 1;" language="javascript" />,
    );
    rerender(<CodeBlock code="const second = 2;" language="javascript" />);

    await waitFor(
        () => {
            expect(container.querySelector("pre")?.textContent).toBe(
                "const second = 2;",
            );
        },
        { timeout: 5000 },
    );
    expect(container.querySelectorAll("pre span").length).toBeGreaterThan(1);
});

it.each([
    ["plain text", "plain text"],
    ["{not json", "{not json"],
    [" [1,2] ", "[\n  1,\n  2\n]"],
    [{ ok: true }, '{\n  "ok": true\n}'],
])("copies %j as %j", async (value, text) => {
    const user = userEvent.setup();
    render(section(value));

    await user.click(screen.getByRole("button", { name: "Copy" }));

    expect(await navigator.clipboard.readText()).toBe(text);
});

it("caps tall code until the reader shows all of it", async () => {
    const user = userEvent.setup();
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(400);
    render(section("long"));

    const more = screen.getByRole("button", { name: "Show all" });
    expect(more.getAttribute("aria-expanded")).toBe("false");

    await user.click(more);

    expect(more.textContent).toBe("Show less");
    expect(more.getAttribute("aria-expanded")).toBe("true");
});

it("shows short code whole", () => {
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(124);
    render(section("short"));

    expect(screen.queryByRole("button", { name: "Show all" })).toBeNull();
});
