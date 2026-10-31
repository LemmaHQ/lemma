/** Returns the platform-specific file name of the desktop engine addon. */
export function addonFile(): string {
    switch (process.platform) {
        case "win32": {
            return "lemma_desktop.dll";
        }
        case "darwin": {
            return "liblemma_desktop.dylib";
        }
        default: {
            return "liblemma_desktop.so";
        }
    }
}
