import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import { Suggestion } from "./suggestion";

it("passes its suggestion to the click handler", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn<(suggestion: string) => void>();
    render(<Suggestion suggestion="Explain closures" onClick={onClick} />);

    await user.click(screen.getByRole("button", { name: "Explain closures" }));

    expect(onClick).toHaveBeenCalledWith("Explain closures");
});
