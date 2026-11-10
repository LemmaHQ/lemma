import { app, BrowserWindow, ipcMain, Menu, type WebContents } from "electron";
import started from "electron-squirrel-startup";
import { registerAppScheme, serveApp } from "./app-protocol";
import * as engine from "./engine";
import {
    createWindow,
    isTitleBarState,
    loadApp,
    loadFatalPage,
    titleBarOverlay,
} from "./main-window";

if (started) {
    app.quit();
}

const debugPort = process.env.LEMMA_DEBUG_PORT;
if (debugPort !== undefined && debugPort !== "") {
    app.commandLine.appendSwitch("remote-debugging-port", debugPort);
}

registerAppScheme();

let mainWindow: BrowserWindow | null = null;
let engineStopping = false;

ipcMain.on("set-titlebar", (_event, state: unknown) => {
    if (!isTitleBarState(state)) {
        console.error("titlebar state rejected:", state);
        return;
    }
    try {
        mainWindow?.setTitleBarOverlay(titleBarOverlay(state));
    } catch (err) {
        console.error("titlebar overlay rejected:", state, err);
    }
});

const connectWhenStarted = async (target: WebContents): Promise<void> => {
    await engineStart;
    engine.connect(target);
};
ipcMain.on("engine-connect", (event) => {
    void connectWhenStarted(event.sender);
});
engine.onExit((detail) => {
    mainWindow?.webContents.send("engine-exit", detail);
});
ipcMain.on("toggle-maximize", () => {
    if (mainWindow === null) {
        return;
    }
    if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
    } else {
        mainWindow.maximize();
    }
});

let fatalDetail: string | null = null;
let engineStart: Promise<void> = Promise.resolve();

const openWindow = () => {
    const window = createWindow();
    mainWindow = window;
    window.on("closed", () => {
        mainWindow = null;
    });
    if (fatalDetail === null) {
        loadApp(window);
    } else {
        loadFatalPage(window, fatalDetail);
    }
};

const startEngine = async (): Promise<void> => {
    try {
        await engine.start();
    } catch (err) {
        fatalDetail = err instanceof Error ? err.message : String(err);
        loadFatalPage(mainWindow, fatalDetail);
    }
};

const boot = () => {
    serveApp();
    engineStart = startEngine();
    openWindow();
    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            openWindow();
        }
    });
};

const gotTheLock = app.requestSingleInstanceLock();

if (gotTheLock) {
    app.on("second-instance", () => {
        if (mainWindow !== null) {
            if (mainWindow.isMinimized()) {
                mainWindow.restore();
            }
            mainWindow.focus();
        }
    });

    app.on("ready", () => {
        Menu.setApplicationMenu(null);
        boot();
    });

    app.on("before-quit", (event) => {
        if (engineStopping) {
            return;
        }
        event.preventDefault();
        engineStopping = true;
        engine
            .stop()
            .catch((err: unknown) => {
                console.error("engine stop failed:", err);
            })
            .finally(() => app.quit());
    });

    app.on("window-all-closed", () => {
        if (process.platform !== "darwin") {
            app.quit();
        }
    });
} else {
    app.quit();
}
