import type {
    BrowserWindow,
    OpenDialogOptions,
    OpenDialogReturnValue,
} from "electron";
import { beforeEach, expect, it, vi } from "vitest";

import { pickDirectory } from "./pick-directory";

const mocks = vi.hoisted(() => ({
    showOpenDialog:
        vi.fn<
            (
                window: BrowserWindow,
                options: OpenDialogOptions,
            ) => Promise<OpenDialogReturnValue>
        >(),
}));

vi.mock("electron", () => ({
    dialog: { showOpenDialog: mocks.showOpenDialog },
}));

// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the dialog mock only observes the parent window identity
const window = { id: 1 } as BrowserWindow;

beforeEach(() => {
    mocks.showOpenDialog.mockReset();
});

it("returns the directory chosen in the window's native picker", async () => {
    mocks.showOpenDialog.mockResolvedValue({
        canceled: false,
        filePaths: ["C:\\work\\project"],
    });

    await expect(pickDirectory(window)).resolves.toBe("C:\\work\\project");
    expect(mocks.showOpenDialog).toHaveBeenCalledWith(window, {
        properties: ["openDirectory"],
    });
});

it("returns null when the picker is canceled", async () => {
    mocks.showOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] });

    await expect(pickDirectory(window)).resolves.toBeNull();
});

it("returns null when the picker has no selection", async () => {
    mocks.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: [] });

    await expect(pickDirectory(window)).resolves.toBeNull();
});
