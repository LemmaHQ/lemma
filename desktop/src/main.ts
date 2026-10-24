import type { SkipCredentials, TitleBarState } from "@lemma/desktop-bridge";
import { app, BrowserWindow, ipcMain, Menu, nativeTheme } from "electron";
import started from "electron-squirrel-startup";
import path from "node:path";
import * as engine from "./engine";
import { themeColors } from "./gen/theme-colors";

if (started) {
    app.quit();
}

const debugPort = process.env.LEMMA_DEBUG_PORT;
if (debugPort !== undefined && debugPort !== "") {
    app.commandLine.appendSwitch("remote-debugging-port", debugPort);
}

let mainWindow: BrowserWindow | null = null;
let engineStopping = false;

const loadFatalPage = (detail: string) => {
    if (mainWindow === null) {
        return;
    }
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Lemma</title></head>
<body style="margin:0;font-family:system-ui;background:#151615;color:#e6e6e4">
<main style="display:flex;flex-direction:column;gap:12px;align-items:center;justify-content:center;height:100vh">
<h1 style="font-size:18px;margin:0">Cannot start the local engine</h1>
<p style="opacity:0.7;margin:0">${detail}</p>
</main></body></html>`;
    mainWindow
        .loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
        .catch((err: unknown) => {
            console.error("fatal page failed to load:", err);
        });
};

const loadApp = () => {
    if (mainWindow === null) {
        return;
    }
    mainWindow
        .loadFile(path.join(__dirname, "../../web-dist/index.html"))
        .catch((err: unknown) => {
            console.error("app page failed to load:", err);
        });
};

const titleBarOverlay = (state: TitleBarState) => ({
    color: themeColors[state.theme][state.surface],
    symbolColor: themeColors[state.theme].foreground,
    height: 40,
});

const initialTitleBarState = (): TitleBarState => ({
    theme: nativeTheme.shouldUseDarkColors ? "dark" : "light",
    surface: "background",
});

const isTitleBarState = (value: unknown): value is TitleBarState =>
    typeof value === "object" &&
    value !== null &&
    "theme" in value &&
    (value.theme === "light" || value.theme === "dark") &&
    "surface" in value &&
    (value.surface === "sidebar" || value.surface === "background");
const createWindow = () => {
    const initialState = initialTitleBarState();
    const window = new BrowserWindow({
        width: 1280,
        height: 800,
        backgroundColor: themeColors[initialState.theme].background,
        titleBarStyle: "hidden",
        titleBarOverlay: titleBarOverlay(initialState),
        webPreferences: {
            preload: path.join(__dirname, "preload.cjs"),
        },
    });
    mainWindow = window;
    window.on("closed", () => {
        mainWindow = null;
    });

    window.webContents.on("before-input-event", (_event, input) => {
        if (input.type !== "keyDown") {
            return;
        }
        const devtoolsKey =
            input.key === "F12" ||
            ((input.control || input.meta) &&
                input.shift &&
                input.key.toLowerCase() === "i");
        if (devtoolsKey) {
            window.webContents.toggleDevTools();
        }
    });
};

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

ipcMain.on("get-server-url-sync", (event) => {
    event.returnValue = engine.serverUrl() ?? "";
});
ipcMain.handle("get-skip-credentials", (): SkipCredentials | null => {
    const skip = engine.getSkipCredentials();
    const url = engine.serverUrl();
    return url !== null && skip !== null
        ? { serverUrl: url, username: skip.username, password: skip.password }
        : null;
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

const openWindow = () => {
    createWindow();
    if (fatalDetail === null) {
        loadApp();
    } else {
        loadFatalPage(fatalDetail);
    }
};

const boot = async () => {
    try {
        await engine.start();
    } catch (err) {
        fatalDetail = err instanceof Error ? err.message : String(err);
    }
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
        void boot();
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
