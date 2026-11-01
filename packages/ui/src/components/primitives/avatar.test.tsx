import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

import { Avatar, AvatarBadge, AvatarFallback } from "./avatar";

it("shows the fallback initial with a status badge", async () => {
    render(
        <Avatar size="sm">
            <AvatarFallback>A</AvatarFallback>
            <AvatarBadge aria-label="Enabled" />
        </Avatar>,
    );

    expect((await screen.findByText("A")).textContent).toBe("A");
    expect(screen.getByLabelText("Enabled")).toBeDefined();
});
