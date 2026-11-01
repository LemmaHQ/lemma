import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

import { Shimmer } from "./shimmer";
import { ThinkingLoader, ThinkingStatusIcon } from "./thinking-loader";

it("announces its label as a status", () => {
    render(<ThinkingLoader label="Thinking" />);

    expect(screen.getByRole("status").textContent).toBe("Thinking");
});

it("hides the status icon from assistive technology", () => {
    const { container } = render(
        <p>
            <ThinkingStatusIcon done />
            <Shimmer>Working</Shimmer>
        </p>,
    );

    expect(container.querySelector("[aria-hidden=true]")).not.toBeNull();
    expect(container.textContent).toBe("Working");
});
