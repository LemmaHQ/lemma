import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

import { CodeBlock } from "./CodeBlock";

it("renders the highlighted code with its header actions", async () => {
    const { container } = render(
        <CodeBlock
            code="const a = 1;"
            language="ts"
            actions={<button type="button">Copy code</button>}
        />,
    );

    expect(await screen.findByText(/const/u)).toBeDefined();
    expect(screen.getByRole("button", { name: "Copy code" })).toBeDefined();
    expect(
        container.querySelector(
            '[data-slot="code-block"] [data-streamdown="code-block"]',
        ),
    ).not.toBeNull();
});
