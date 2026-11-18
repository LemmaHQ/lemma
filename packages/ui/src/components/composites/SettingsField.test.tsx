import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

import { Button } from "#primitives/button";
import { Input } from "#primitives/input";
import { SettingsField } from "./SettingsField";
import { SettingsSection } from "./SettingsSection";

it("labels a field's control and replaces the description with an error", () => {
    const { rerender } = render(
        <SettingsSection>
            <SettingsField
                label="Base URL"
                htmlFor="base-url"
                description="The API endpoint."
            >
                <Input id="base-url" />
            </SettingsField>
            <SettingsField label="Theme" error={null}>
                <Button>Dark</Button>
            </SettingsField>
        </SettingsSection>,
    );

    expect(screen.getByLabelText("Base URL").id).toBe("base-url");
    expect(screen.getByText("The API endpoint.")).toBeDefined();
    expect(screen.getByText("Theme").tagName).toBe("DIV");
    expect(screen.queryByRole("alert")).toBeNull();

    rerender(
        <SettingsSection>
            <SettingsField
                label="Base URL"
                htmlFor="base-url"
                description="The API endpoint."
                error="Must start with https://."
            >
                <Input id="base-url" />
            </SettingsField>
        </SettingsSection>,
    );

    expect(screen.getByRole("alert").textContent).toBe(
        "Must start with https://.",
    );
    expect(screen.queryByText("The API endpoint.")).toBeNull();
});
