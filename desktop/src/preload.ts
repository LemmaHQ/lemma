import type {
    DesktopBridge,
    EngineExitNotice,
    EnginePortHandoff,
    TitleBarState,
} from "@lemma/desktop-contract";
import { contextBridge, ipcRenderer } from "electron";
import { readAppVersion } from "./app-version";
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
    appVersion: readAppVersion(process.argv),
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
};
contextBridge.exposeInMainWorld("lemmaDesktop", bridge);
