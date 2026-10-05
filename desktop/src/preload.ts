import { contextBridge, ipcRenderer } from "electron";

const serverUrl = ipcRenderer.sendSync("get-server-url-sync");
contextBridge.exposeInMainWorld("__LEMMA_SERVER_URL__", serverUrl);

contextBridge.exposeInMainWorld("lemmaDesktop", {
    getSkipCredentials: (): Promise<{
        serverUrl: string;
        username: string;
        password: string;
    } | null> => ipcRenderer.invoke("get-skip-credentials"),
    setTitleBar: (state: {
        theme: "light" | "dark";
        surface: "sidebar" | "background";
    }): void => {
        ipcRenderer.send("set-titlebar", state);
    },
    toggleMaximize: (): void => {
        ipcRenderer.send("toggle-maximize");
    },
});
