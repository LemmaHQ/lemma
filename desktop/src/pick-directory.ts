import { dialog, type BrowserWindow } from "electron";

export const pickDirectory = async (
    window: BrowserWindow,
): Promise<string | null> => {
    const result = await dialog.showOpenDialog(window, {
        properties: ["openDirectory"],
    });
    if (result.canceled) {
        return null;
    }
    return result.filePaths[0] ?? null;
};
