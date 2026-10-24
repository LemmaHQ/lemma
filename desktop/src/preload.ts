import type { DesktopBridge, TitleBarState } from "@lemma/desktop-bridge";
import { contextBridge, ipcRenderer } from "electron";

const serverUrl: unknown = ipcRenderer.sendSync("get-server-url-sync");
contextBridge.exposeInMainWorld(
    "__LEMMA_SERVER_URL__",
    typeof serverUrl === "string" ? serverUrl : "",
);

const bridge: DesktopBridge = {
    getSkipCredentials: () => ipcRenderer.invoke("get-skip-credentials"),
    setTitleBar: (state: TitleBarState): void => {
        ipcRenderer.send("set-titlebar", state);
    },
    toggleMaximize: (): void => {
        ipcRenderer.send("toggle-maximize");
    },
};
contextBridge.exposeInMainWorld("lemmaDesktop", bridge);
