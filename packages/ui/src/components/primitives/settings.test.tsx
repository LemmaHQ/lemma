import { render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";

import { Button } from "./button";
import { Input } from "./input";
import {
    SettingsField,
    SettingsPage,
    SettingsRow,
    SettingsSection,
    SettingsSectionCompact,
} from "./settings";

it("heads a page with its index slot, title, badge, and actions", () => {
    const { rerender } = render(
        <SettingsPage
            index={<aside aria-label="Providers index">Index</aside>}
            title="Acme"
            badge="Custom provider"
            actions={<Button>Delete</Button>}
        >
            <SettingsSectionCompact error={null}>
                <SettingsRow label="gpt-4o">
                    <Button>Remove</Button>
                </SettingsRow>
            </SettingsSectionCompact>
        </SettingsPage>,
    );

    expect(
        screen.getByRole("complementary", { name: "Providers index" }),
    ).toBeDefined();
    const header = within(screen.getByRole("banner"));
    expect(header.getByRole("heading", { level: 1 }).textContent).toBe("Acme");
    expect(header.getByText("Custom provider")).toBeDefined();
    expect(header.getByRole("button", { name: "Delete" })).toBeDefined();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText("gpt-4o")).toBeDefined();
    rerender(
        <SettingsPage title={<span>Node title</span>}>
            <SettingsSection>
                <SettingsRow label="item">
                    <Button>Edit</Button>
                </SettingsRow>
            </SettingsSection>
        </SettingsPage>,
    );
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
        "Node title",
    );
});

it("omits the page header when no title, badge, or actions are passed", () => {
    render(
        <SettingsPage>
            <SettingsSectionCompact actions={<Button>Add</Button>}>
                <SettingsRow label="Item">
                    <Button>Edit</Button>
                </SettingsRow>
            </SettingsSectionCompact>
        </SettingsPage>,
    );

    expect(screen.queryByRole("banner")).toBeNull();
    expect(screen.getByRole("button", { name: "Add" })).toBeDefined();
});

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
