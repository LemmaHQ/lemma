/** Returns the platform-specific file name of the desktop engine addon. */
export function addonFile(): string {
    switch (process.platform) {
        case "win32": {
            return "lemma_napi.dll";
        }
        case "darwin": {
            return "liblemma_napi.dylib";
        }
        default: {
            return "liblemma_napi.so";
        }
    }
}
