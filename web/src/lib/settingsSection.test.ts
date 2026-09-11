import { expect, it } from "vitest";

import { parseSettingsSection, SETTINGS_SECTIONS } from "./settingsSection";

it("parses valid section identifiers", () => {
    for (const section of SETTINGS_SECTIONS) {
        expect(parseSettingsSection(section)).toBe(section);
    }
});

it("returns null for invalid or unknown section identifiers", () => {
    expect(parseSettingsSection("general")).toBeNull();
    expect(parseSettingsSection("")).toBeNull();
    expect(parseSettingsSection(undefined)).toBeNull();
});
