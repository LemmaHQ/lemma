import { render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";

import { Button } from "#primitives/button";
import { SettingsRow } from "./SettingsField";
import { SettingsPage } from "./SettingsPage";
import { SettingsSection, SettingsSectionCompact } from "./SettingsSection";

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
