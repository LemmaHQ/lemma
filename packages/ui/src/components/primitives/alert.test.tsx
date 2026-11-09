import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

import { Alert, AlertDescription, AlertTitle } from "./alert";

it("announces the failure with its title and reason", () => {
    render(
        <Alert variant="destructive">
            <AlertTitle>The agent failed</AlertTitle>
            <AlertDescription>The provider rejected the key.</AlertDescription>
        </Alert>,
    );

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toBe(
        "The agent failedThe provider rejected the key.",
    );
});
