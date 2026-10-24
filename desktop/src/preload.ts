import type {
    DesktopBridge,
    EngineExitNotice,
    EnginePortHandoff,
    TitleBarState,
} from "@lemma/desktop-bridge";
import { contextBridge, ipcRenderer } from "electron";

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
    setTitleBar: (state: TitleBarState): void => {
        ipcRenderer.send("set-titlebar", state);
    },
    toggleMaximize: (): void => {
        ipcRenderer.send("toggle-maximize");
    },
    connectEngine: (): void => {
        ipcRenderer.send("engine-connect");
    },
};
contextBridge.exposeInMainWorld("lemmaDesktop", bridge);
