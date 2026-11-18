import { render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";

import { Button } from "#primitives/button";
import { SettingsField, SettingsRow } from "./SettingsField";
import { SettingsPage } from "./SettingsPage";
import { SettingsSection, SettingsSectionCompact } from "./SettingsSection";

it("renders a two-column section with description, meta, actions, error, and footer", () => {
    render(
        <SettingsPage actions={<Button>Help</Button>}>
            <SettingsSection
                title="Appearance"
                description="Choose theme and font."
                meta={<span>Synced across devices</span>}
                actions={<Button>Reset</Button>}
                error="Failed to save."
                footer={<Button>Apply</Button>}
            >
                <SettingsField label="Mode" align="top">
                    <Button>System</Button>
                </SettingsField>
            </SettingsSection>
        </SettingsPage>,
    );

    expect(screen.getByRole("banner")).toBeDefined();
    const section = within(screen.getByRole("region", { name: "Appearance" }));
    expect(section.getByRole("heading", { level: 2 }).textContent).toBe(
        "Appearance",
    );
    expect(section.getByText("Choose theme and font.")).toBeDefined();
    expect(section.getByText("Synced across devices")).toBeDefined();
    expect(section.getByRole("button", { name: "Reset" })).toBeDefined();
    expect(section.getByRole("alert").textContent).toBe("Failed to save.");
    expect(section.getByRole("button", { name: "Apply" })).toBeDefined();
});

it("names a compact section by its title and holds its actions, error, and footer", () => {
    render(
        <SettingsPage title="Providers">
            <SettingsSectionCompact
                title="Models"
                actions={<Button>Fetch</Button>}
                error="The provider is unreachable."
                footer={<Button>Save</Button>}
            >
                <SettingsRow label="gpt-4o">
                    <Button>Remove</Button>
                </SettingsRow>
            </SettingsSectionCompact>
        </SettingsPage>,
    );

    const section = within(screen.getByRole("region", { name: "Models" }));
    expect(section.getByRole("heading", { level: 2 }).textContent).toBe(
        "Models",
    );
    expect(section.getByRole("button", { name: "Fetch" })).toBeDefined();
    expect(section.getByRole("button", { name: "Remove" })).toBeDefined();
    expect(section.getByRole("alert").textContent).toBe(
        "The provider is unreachable.",
    );
    expect(section.getByRole("button", { name: "Save" })).toBeDefined();
});
