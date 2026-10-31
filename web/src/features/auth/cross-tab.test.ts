import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";

import { installCrossTabGuard } from "./cross-tab";

const reload = vi.fn<() => void>();

const storageEvent = (
    key: string,
    oldValue: string | null,
    newValue: string | null,
): void => {
    window.dispatchEvent(
        new StorageEvent("storage", { key, oldValue, newValue }),
    );
};

beforeAll(() => {
    vi.spyOn(window.location, "reload").mockImplementation(reload);
    installCrossTabGuard();
});

beforeEach(() => {
    reload.mockClear();
});

afterAll(() => {
    vi.restoreAllMocks();
});

it("reloads when another tab signs in as a different user", () => {
    storageEvent("lemma.user_id", "u1", "u2");

    expect(reload).toHaveBeenCalledOnce();
});

it.each([
    ["another key changes", "lemma.theme", "dark", "light"],
    ["the same user signs in again", "lemma.user_id", "u1", "u1"],
    ["this tab had no user", "lemma.user_id", null, "u2"],
    ["this tab's user was empty", "lemma.user_id", "", "u2"],
    ["another tab signs out", "lemma.user_id", "u1", null],
    ["another tab clears the user", "lemma.user_id", "u1", ""],
])("stays put when %s", (_case, key, oldValue, newValue) => {
    storageEvent(key, oldValue, newValue);

    expect(reload).not.toHaveBeenCalled();
});
