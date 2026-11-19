import { contextBridge, ipcRenderer } from "electron";

import type {
    DesktopBridge,
    EngineExitNotice,
    EnginePortHandoff,
    TitleBarState,
} from "./desktop-bridge";
import { TITLEBAR_HEIGHT } from "./titlebar";

ipcRenderer.on("engine-port", (event) => {
    const handoff: EnginePortHandoff = { type: "lemma-engine-port" };
    window.postMessage(handoff, "*", event.ports);
});
ipcRenderer.on("engine-exit", (_event, detail: unknown) => {
    const notice: EngineExitNotice = {
        type: "lemma-engine-exit",
        detail: typeof detail === "string" ? detail : "",
    };
    window.postMessage(notice, "*");
});

const bridge: DesktopBridge = {
    titlebarHeight: TITLEBAR_HEIGHT,
    setTitleBar: (state: TitleBarState): void => {
        ipcRenderer.send("set-titlebar", state);
    },
    toggleMaximize: (): void => {
        ipcRenderer.send("toggle-maximize");
    },
    connectEngine: (): void => {
        ipcRenderer.send("engine-connect");
    },
    pickDirectory: async (): Promise<string | null> => {
        const path: unknown = await ipcRenderer.invoke("pick-directory");
        return typeof path === "string" ? path : null;
    },
};
contextBridge.exposeInMainWorld("lemmaDesktop", bridge);
